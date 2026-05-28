# Deduplication configuration for lore_chunks writes.
#
# Fact extraction (history_service.py) can resurface the same narratively
# salient fact across multiple 10-turn compression windows — a secret
# revealed at turn 20 might still be the single most relevant thing to
# extract again at turn 30, even though it's not new information. Without a
# write-time guard, each resurfacing becomes its own chunk, all competing for
# the same Stage 2 retrieval slots in search_relevant_lore.
#
# This threshold is intentionally much stricter than retrieval's
# similarity_threshold (0.70 in search_relevant_lore) — retrieval asks "is
# this related enough to be useful context", dedup asks "is this close
# enough to be the literal same fact restated". A false-positive dedup
# (silently dropping a genuinely new but similar-sounding fact) is worse
# than an occasional near-duplicate slipping through, so default high.
#
# No real-data calibration has happened yet (2026-06) — this is a starting
# value. Tune once LORE_DEDUP log lines (see lore_service.py) show real
# skip/no-skip similarity scores from actual sessions.
DEDUP_SIMILARITY_THRESHOLD: float = 0.93
