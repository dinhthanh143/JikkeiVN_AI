# Chunk-lifecycle consolidation configuration for session-scoped 'event' lore.
#
# Episodic event chunks (chunk_type='event', priority=1) accumulate forever
# once written by store_event_as_lore — nothing currently prunes or compacts
# them. The rolling prose summary (history_summary, see history_service.py)
# already has its own compaction (re-summarise past _SUMMARY_MAX_CHARS), but
# that's a different, lossy long-term store; lore_chunks need to stay
# retrievable as discrete facts, so their compaction must be a LOSSLESS
# merge (combine near-duplicate/redundant facts into fewer chunks, never
# summarize 30 turns into 3 sentences the way history_summary does).
#
# Trigger choice (2026-06): count-based, not turn-based. Reasoning: turn
# cadence is steady in this app (1 player action = 1 turn), but how many
# facts get extracted per 10-turn compression window varies a lot with how
# eventful the scene is — a tense scene might yield 6-8 facts, a quiet one
# 0-2. A turn-based trigger ("every N turns") would fire at a predictable
# time but consolidate a wildly inconsistent number of chunks, sometimes
# barely any — not worth an LLM call. A count-based trigger fires at an
# unpredictable time but always consolidates a meaningful, consistent batch,
# which is what actually justifies the LLM call's cost. Revisit if real
# session data shows this assumption wrong.
#
# These are reasoned starting values, not measured ones — no production
# session data existed at the time this was written. Tune once sessions
# accumulate real event-chunk counts.

# Consolidation fires once a session's 'event' chunk count exceeds this.
EVENT_CHUNK_CONSOLIDATION_THRESHOLD: int = 40

# How many of the oldest 'event' chunks get pulled into one consolidation
# pass when the threshold is hit. Deliberately less than the threshold so
# consolidation doesn't immediately re-trigger next turn (40 - 20 = 20
# headroom before the count climbs back to 40).
EVENT_CHUNK_CONSOLIDATION_BATCH_SIZE: int = 20

# Hard cap on how many merged output chunks a single consolidation pass may
# produce, regardless of batch size. Pure safety net against a pathological
# LLM response — the prompt asks for "fewest possible", this just bounds it.
EVENT_CHUNK_CONSOLIDATION_MAX_OUTPUT: int = 12

CONSOLIDATION_SYSTEM_PROMPT = (
    "You merge redundant or overlapping facts from a roleplay's long-term "
    "memory into the fewest possible distinct statements. "
    "This is a LOSSLESS merge, not a summary — every distinct fact, name, "
    "decision, or detail in the input must still be recoverable in the "
    "output. Only combine facts that are genuinely the same information "
    "restated, or naturally belong together as one statement. Never drop a "
    "fact just to shorten the output, and never invent or infer facts not "
    "present in the input. "
    "Return strict JSON only: {\"merged_facts\": [\"fact 1\", \"fact 2\", ...]}. "
    "Each fact must be a single self-contained sentence."
)
