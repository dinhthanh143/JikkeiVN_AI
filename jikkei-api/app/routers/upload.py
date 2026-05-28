import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from app.core.config import settings
from app.dependencies import get_current_user
from app.main import limiter
from app.models.user import User
from app.schemas.scene import (
    CloudinarySignatureRequest,
    CloudinarySignatureResponse,
    CloudinaryUploadResponse,
)
from app.services.cloudinary_service import generate_upload_signature, upload_image_bytes

router = APIRouter(prefix="/upload", tags=["upload"])


def _allowed_mime_types() -> set[str]:
    configured = [
        item.strip().lower()
        for item in settings.UPLOAD_ALLOWED_MIME_TYPES.split(",")
        if item.strip()
    ]
    return set(configured) or {"image/jpeg", "image/png", "image/webp"}


def _parse_scene_id_from_folder(folder: str) -> UUID | None:
    marker = "/scenes/"
    if marker not in folder:
        return None

    after = folder.split(marker, 1)[1]
    scene_segment = after.split("/", 1)[0].strip()
    if not scene_segment:
        return None

    try:
        return UUID(scene_segment)
    except ValueError:
        return None


def _resolve_upload_target(payload: CloudinarySignatureRequest) -> tuple[str, UUID | None]:
    normalized = payload.folder.strip().lower().strip("/")
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="folder is required",
        )

    if normalized in {"avatar", "expression", "background"}:
        return normalized, None

    if normalized.startswith("avatar:"):
        scene_id_part = normalized.split(":", 1)[1].strip()
        try:
            return "avatar", UUID(scene_id_part)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid scene UUID for avatar upload",
            ) from exc

    if normalized.startswith("expression:"):
        scene_id_part = normalized.split(":", 1)[1].strip()
        try:
            return "expression", UUID(scene_id_part)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid scene UUID for expression upload",
            ) from exc

    if normalized.startswith("background:"):
        scene_id_part = normalized.split(":", 1)[1].strip()
        try:
            return "background", UUID(scene_id_part)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid scene UUID for background upload",
            ) from exc

    if "/expressions" in normalized:
        return "expression", _parse_scene_id_from_folder(normalized)
    if "/backgrounds" in normalized:
        return "background", _parse_scene_id_from_folder(normalized)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported folder. Use avatar, expression, or background",
    )


def _merge_scene_scope(
    parsed_scene_id: UUID | None,
    explicit_scene_id: UUID | None,
) -> UUID | None:
    if parsed_scene_id and explicit_scene_id and parsed_scene_id != explicit_scene_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scene_id mismatch between folder and form field",
        )

    return explicit_scene_id or parsed_scene_id


@router.post("/signature", response_model=CloudinarySignatureResponse)
@limiter.limit("20/minute")
async def get_upload_signature(
    request: Request,
    payload: CloudinarySignatureRequest,
    current_user: User = Depends(get_current_user),
) -> CloudinarySignatureResponse:
    resource_type, scene_id = _resolve_upload_target(payload)

    try:
        signature_data = generate_upload_signature(
            user_id=current_user.id,
            resource_type=resource_type,
            scene_id=scene_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return CloudinarySignatureResponse.model_validate(signature_data)


@router.post("", response_model=CloudinaryUploadResponse)
@limiter.limit("20/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form(...),
    scene_id: UUID | None = Form(default=None),
    current_user: User = Depends(get_current_user),
) -> CloudinaryUploadResponse:
    if not folder.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="folder is required")

    resource_type, parsed_scene_id = _resolve_upload_target(CloudinarySignatureRequest(folder=folder.strip()))
    effective_scene_id = _merge_scene_scope(parsed_scene_id, scene_id)

    if effective_scene_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scene_id is required for all uploads (avatar, expression, background)",
        )

    content_type = (file.content_type or "").lower().strip()
    if content_type not in _allowed_mime_types():
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported media type. Allowed: image/jpeg, image/png, image/webp",
        )

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    payload_bytes = await file.read(max_bytes + 1)
    await file.close()

    if len(payload_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(payload_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    try:
        upload_data = await asyncio.to_thread(
            upload_image_bytes,
            file_bytes=payload_bytes,
            user_id=current_user.id,
            resource_type=resource_type,
            scene_id=effective_scene_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upload provider error",
        ) from exc

    return CloudinaryUploadResponse.model_validate(upload_data)
