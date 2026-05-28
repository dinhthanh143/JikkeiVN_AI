# FastAPI auth dependencies for the current user and admin checks.
import logging
from uuid import UUID
from uuid import UUID as PyUUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_access_token  # <── Add this line!
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)


class ResourceOwnershipError(Exception):
    """Raised when a user tries to access a resource they don't own."""
    pass


async def assert_resource_owner(
    resource_owner_id: PyUUID,
    current_user: User,
) -> None:
    """
    Core ownership check to prevent BOLA attacks. Call this in any route that 
    returns a user-owned resource. Raises ForbiddenError if the current user 
    is neither the owner nor an admin.
    """
    from app.core.exceptions import ForbiddenError

    if resource_owner_id != current_user.id and current_user.role != "admin":
        logger.warning(
            "BOLA attempt: user %s tried to access resource owned by %s",
            current_user.id,
            resource_owner_id,
        )
        raise ForbiddenError()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Authenticate the incoming request by decoding the JWT access token stored in cookies.
    Returns the database User record if valid and active.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_uuid = UUID(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the authenticated user has administrative privileges."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user