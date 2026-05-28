import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_models import dialogue_model_candidates_for_tier
from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.main import limiter
from app.models.user import User
from app.services.ai_service import call_openrouter_text, stream_openrouter_text
from app.services.credit_service import consume_credit

router = APIRouter()

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parents[1] / 'core' / 'system_prompt.txt'


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    # Deprecated compatibility field. Account tiers share one model chain.
    tier: str | None = 'free'


class ChatResponse(BaseModel):
    text: str


@router.post('/chat', response_model=ChatResponse)
@limiter.limit(settings.RATE_LIMIT_AI_CHAT)
async def chat_endpoint(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Generate a single-turn chat response using OpenRouter (non-streaming)."""
    try:
        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding='utf-8')
    except Exception:
        system_prompt = 'Replies in plain text, no special format.'

    await consume_credit(current_user.id, db)
    model_candidates = dialogue_model_candidates_for_tier('free')
    logger.info("OpenRouter chat request received for user=%s", current_user.id)

    try:
        result = await call_openrouter_text(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": payload.prompt}],
            model_candidates=model_candidates,
            max_tokens=220,
            cache_key=str(current_user.id),
        )
        text = str(result.get('text', '')).strip()
        if text:
            logger.info("OpenRouter chat response generated with model=%s", result.get('model'))
            return ChatResponse(text=text)

        logger.warning("OpenRouter returned an empty chat response")
        return ChatResponse(text="Sorry, I can't answer that right now.")

    except Exception as e:
        logger.exception("OpenRouter chat generation failed: %s", e)
        return ChatResponse(text="Sorry, I can't answer that right now.")


@router.post('/chat/stream')
@limiter.limit(settings.RATE_LIMIT_AI_CHAT)
async def chat_stream_endpoint(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a chat response as Server-Sent Events.

    Each SSE event carries a JSON payload:
      - token event:  data: {"token": "..."}\n\n
      - done  event:  data: {"done": true}\n\n
      - error event:  data: {"error": "..."}\n\n

    The client reads the response body as a ReadableStream and appends tokens
    to the dialogue box in real time.
    """
    try:
        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding='utf-8')
    except Exception:
        system_prompt = 'Replies in plain text, no special format.'

    await consume_credit(current_user.id, db)
    model_candidates = dialogue_model_candidates_for_tier('free')
    logger.info("OpenRouter SSE stream request for user=%s", current_user.id)

    async def event_generator():
        try:
            async for token in stream_openrouter_text(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": payload.prompt}],
                model_candidates=model_candidates,
                max_tokens=220,
                cache_key=str(current_user.id),
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            logger.exception("OpenRouter SSE stream failed: %s", exc)
            yield f"data: {json.dumps({'error': 'Generation failed'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            # Disable buffering so tokens reach the client immediately.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )

