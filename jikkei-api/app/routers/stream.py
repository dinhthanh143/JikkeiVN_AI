# Streaming turn endpoint.
#
# ARCHITECTURE (2026-06, Epic F1):
# Previously this was two separate HTTP requests: /sessions/turn/stream sent
# SSE tokens but never touched the DB, and the frontend had to call
# /sessions/turn/commit afterward with the full response text echoed back,
# which the server then trusted and parsed.
#
# That split had two real problems, not just an extra round-trip:
#   1. Data loss on disconnect — if the connection dropped or the tab closed
#      between the stream finishing and the client calling /commit, the turn
#      was never persisted at all. Silent, not just delayed.
#   2. Trusting client-echoed text for persisted state — the server had no
#      independent record of what it actually streamed, so a buggy or
#      modified client could submit text that didn't match.
#
# Fix: this is now a single request. The server accumulates full_text itself
# while streaming (already did this), and calls apply_turn_result itself once
# the stream finishes, still inside the same event_generator() coroutine — the
# SSE response only fully closes after persistence completes, so the final
# SSE event can carry the persisted turn data and the frontend never needs a
# second call. This isn't a detached BackgroundTasks job: it's sequential
# work inside the same generator, after the last token, before the response
# ends.
#
# Session lifecycle note: the `db` session injected via Depends(get_db) is
# request-scoped and FastAPI returns/closes it once the route handler
# *returns* — but with StreamingResponse, the handler returns almost
# immediately and event_generator() keeps running after that. By the time
# the persistence step needs to run, the original `db` may already be
# invalid. The persistence step (_persist_streamed_turn) therefore opens its
# OWN fresh AsyncSessionLocal() and re-fetches session/session_chars fresh,
# rather than trying to reuse the request-scoped session or any ORM objects
# bound to it.
#
# Credit timing: deducted at stream start, inside the SAME _prepare_turn_inputs
# helper process_turn uses (explicit product decision — the model call is what
# costs money, and it's already in flight by the time tokens start arriving,
# so charging for a stream that started but failed partway is accepted as the
# simpler and more honest tradeoff over a "charge only on confirmed commit"
# policy).
#
# ARCHITECTURE (2026-06, Epic F2):
# This route used to duplicate session/scene/char validation, the turn-limit
# check, credit deduction, and input normalization independently from
# process_turn in scene.py — two copies of the same logic that had already
# drifted once (different credit-timing policies before Epic F1). Both routes
# now call the shared _prepare_turn_inputs() helper from scene.py, and both
# accept the same PlayerTurnRequest schema (StreamTurnRequest removed) — the
# ONLY thing that's actually different between streaming and non-streaming is
# how the AI is called (stream_ai_turn yielding tokens vs run_ai_turn
# returning one dict) and how the result reaches the client (SSE events vs one
# JSON response). Everything else is one code path now.
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.core.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.main import limiter
from app.models.scene import Scene, SceneSession
from app.models.user import User
from app.routers.scene import (
    _build_turn_response,
    _load_scene_backgrounds,
    _load_session_characters,
    _get_owned_session,
    _prepare_turn_inputs,
)
from app.schemas.scene import PlayerTurnRequest
from app.services.ai_service import _parse_json_payload, apply_turn_result, stream_ai_turn
from app.services.context_builder import build_turn_context
from app.services.turn_claim import claim_session_turn, release_session_turn

logger = logging.getLogger(__name__)

stream_router = APIRouter(tags=["stream"])


async def _persist_streamed_turn(
    session_id: UUID,
    player_input: str,
    input_type: str,
    context_change: str | None,
    full_text: str,
    claim_id: UUID,
    tokens_used: int,
) -> dict:
    """
    Persists a completed streamed turn. Called once token streaming finishes,
    from inside the same event_generator() coroutine — replaces what used to
    be a separate client-initiated /sessions/turn/commit call. Opens its own
    session (see module docstring for why) and re-fetches everything fresh
    rather than reusing any ORM object from the request-scoped session used
    during streaming.

    Returns a plain dict (not a Pydantic model) describing the persisted
    turn, sent as the final SSE event so the frontend has everything it
    needs without a follow-up request.

    Raises on failure — the caller (event_generator) is responsible for
    catching this and emitting an SSE error event; this function's only job
    is correct persistence, not client communication.
    """
    turn_result = _parse_json_payload(full_text)

    async with AsyncSessionLocal() as db:
        session_result = await db.execute(
            select(SceneSession).where(
                SceneSession.id == session_id,
                SceneSession.turn_claim_id == claim_id,
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise RuntimeError(f"Session {session_id} not found during turn persistence")

        scene = (await db.execute(select(Scene).where(Scene.id == session.scene_id))).scalar_one_or_none()
        if scene is None:
            raise RuntimeError(f"Scene not found for session {session_id} during turn persistence")

        session_chars = await _load_session_characters(session.id, db)
        if not session_chars:
            raise RuntimeError(f"Session {session_id} has no characters during turn persistence")

        backgrounds = await _load_scene_backgrounds(
            session.scene_id, db, session_id=session.id
        )

        turn, turn_messages = await apply_turn_result(
            session=session,
            session_chars=session_chars,
            turn_result=turn_result,
            player_input=player_input,
            input_type=input_type,
            context_change=context_change,
            tokens_used=tokens_used,
            backgrounds=backgrounds,
            db=db,
        )

        # apply_turn_result sets session.current_choices and commits itself
        # (see Epic G2 fix in ai_service.py) — no separate commit needed here.
        turn_response = await _build_turn_response(turn, turn_messages, session, db)
        return turn_response.model_dump(mode="json")


@stream_router.post("/sessions/turn/stream")
@limiter.limit("30/minute")
async def stream_turn(
    request: Request,
    payload: PlayerTurnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Single-phase streaming turn: validates the session, deducts credit,
    streams dialogue tokens as SSE, then persists the turn server-side once
    the stream completes — all within this one request. See module
    docstring for the architecture (Epic F1) and the Epic F2 unification
    with process_turn via _prepare_turn_inputs.

    SSE format:
      data: {"token": "..."}\\n\\n              one per token
      data: {"done": true, "turn": {...}}\\n\\n  stream + persistence both finished,
                                                  "turn" is the same shape as
                                                  TurnResponse, ready to use directly
      data: {"error": "..."}\\n\\n               something went wrong (streaming OR
                                                  persistence) — no silent data loss
    """
    owned_session = await _get_owned_session(
        payload.session_id, current_user, db, require_active=True
    )
    claim_id = await claim_session_turn(owned_session.id, db)
    try:
        session, _scene, session_chars, player_input, context_change = await _prepare_turn_inputs(
            payload,
            current_user,
            db,
            preloaded_session=owned_session,
        )
        context_payload = await build_turn_context(
            session=session,
            session_chars=session_chars,
            player_input=player_input,
            context_change=context_change,
            db=db,
            input_type=payload.input_type,
        )
        await db.commit()
    except Exception:
        await release_session_turn(owned_session.id, claim_id, db)
        raise

    session_id = session.id
    usage: dict[str, int | str] = {}

    async def event_generator():
        full_text = ""
        try:
            async for token in stream_ai_turn(
                system_prompt=context_payload["system"],
                messages=context_payload["messages"],
                cache_key=str(session_id),
                usage_out=usage,
            ):
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            logger.exception("Streaming turn failed during token generation")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            return

        # Streaming succeeded — persist now, in this same request, using the
        # server's own accumulated full_text (never the client's echo).
        try:
            turn_payload = await _persist_streamed_turn(
                session_id=session_id,
                player_input=player_input,
                input_type=payload.input_type,
                context_change=context_change,
                full_text=full_text,
                claim_id=claim_id,
                tokens_used=int(usage.get("tokens_used", 0) or 0),
            )
            yield f"data: {json.dumps({'done': True, 'turn': turn_payload})}\n\n"
        except Exception as exc:
            logger.exception("Streaming turn failed during persistence (tokens were already sent to client)")
            yield f"data: {json.dumps({'error': f'Turn generated but failed to save: {exc}'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
        background=BackgroundTask(release_session_turn, session_id, claim_id),
    )
