# Cloudinary configuration and signed upload helper service.
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils

from app.core.config import settings


ALLOWED_FORMATS = "jpg,jpeg,png,webp"

# Root namespace for every upload this app makes. Lets us cleanly distinguish
# this app's assets from anything else sharing the same Cloudinary account,
# and gives us one folder to delete-by-prefix per story.
_ROOT = "Jikkei/VN_AI/Private"


def configure_cloudinary() -> None:
    """Configure Cloudinary with settings."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def story_folder(user_id: UUID, scene_id: UUID) -> str:
    """Root folder for everything belonging to one story. Deleting this
    folder (via delete_story_assets) removes every character + background
    image for that story in one call — nothing is tracked per-file."""
    return f"{_ROOT}/{user_id}/stories/{scene_id}"


def _build_folder(
    user_id: UUID,
    resource_type: Literal["avatar", "expression", "background"],
    scene_id: UUID | None,
) -> str:
    if scene_id is None:
        raise ValueError("scene_id is required for all uploads (avatar, expression, background)")

    base = story_folder(user_id, scene_id)

    if resource_type in ("avatar", "expression"):
        return f"{base}/characters/"
    if resource_type == "background":
        return f"{base}/backgrounds/"

    raise ValueError("resource_type must be one of: avatar, expression, background")


def generate_upload_signature(
    user_id: UUID,
    resource_type: str,
    scene_id: UUID | None = None,
) -> dict:
    """
    Generate time-limited Cloudinary upload signature.
    Folder structure: Jikkei/VN_AI/Private/{user_id}/stories/{scene_id}/characters/
                       Jikkei/VN_AI/Private/{user_id}/stories/{scene_id}/backgrounds/
    Returns dict with signature, timestamp, api_key, cloud_name, folder.
    """
    configure_cloudinary()

    typed_resource_type = resource_type  # preserve requested str signature while validating below
    if typed_resource_type not in {"avatar", "expression", "background"}:
        raise ValueError("resource_type must be one of: avatar, expression, background")

    timestamp = int(datetime.now(timezone.utc).timestamp())
    folder = _build_folder(user_id, typed_resource_type, scene_id)
    max_file_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    params_to_sign = {
        "folder": folder,
        "timestamp": timestamp,
        "allowed_formats": ALLOWED_FORMATS,
        "max_file_size": max_file_size,
    }

    signature = cloudinary.utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "folder": folder,
    }


def upload_image_bytes(
    *,
    file_bytes: bytes,
    user_id: UUID,
    resource_type: Literal["avatar", "expression", "background"],
    scene_id: UUID | None = None,
) -> dict:
    """Upload raw image bytes to Cloudinary under guarded per-story folders."""
    if resource_type not in {"avatar", "expression", "background"}:
        raise ValueError("resource_type must be one of: avatar, expression, background")

    configure_cloudinary()
    folder = _build_folder(user_id, resource_type, scene_id)

    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="image",
        folder=folder,
        allowed_formats=ALLOWED_FORMATS,
        overwrite=False,
        use_filename=False,
        unique_filename=True,
    )

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise ValueError("Cloudinary upload failed to return URL/public_id")

    return {
        "url": str(secure_url),
        "public_id": str(public_id),
        "folder": folder,
        "bytes": int(result.get("bytes") or 0),
        "format": result.get("format"),
        "width": result.get("width"),
        "height": result.get("height"),
    }


def delete_story_assets(user_id: UUID, scene_id: UUID) -> None:
    """
    Deletes every Cloudinary asset under a story's folder — all character
    avatars/expressions and all backgrounds — in one call. Called from
    routers/scene.py delete_scene() right before the DB row is removed.

    Cloudinary's delete_resources_by_prefix only clears resources, not the
    now-empty folder entries themselves, so we follow up with delete_folder.
    Both calls are best-effort: if Cloudinary is unreachable or the folder
    was already empty, we log and continue rather than blocking scene deletion
    on a third-party API. Orphaned image files are a minor cost; a stuck
    "can't delete my story" experience is a much worse one.
    """
    import logging
    logger = logging.getLogger(__name__)

    configure_cloudinary()
    folder = story_folder(user_id, scene_id)

    try:
        cloudinary.api.delete_resources_by_prefix(folder)
    except Exception as exc:
        logger.warning("Cloudinary delete_resources_by_prefix failed for %s: %s", folder, exc)

    try:
        cloudinary.api.delete_folder(folder)
    except Exception as exc:
        logger.warning("Cloudinary delete_folder failed for %s: %s", folder, exc)