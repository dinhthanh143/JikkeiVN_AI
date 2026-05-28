# Mirrors jikkei/src/data/Attributepresets.ts on the frontend.
# Triggers are auto-derived from attr_key — never authored manually by the creator.
#
# Structure:
#   TRIGGER_PRESETS[attr_key] = list of {operator, threshold, behavior}
#   operator: "<" or ">"
#   threshold: int
#   behavior: str  — injected into the system prompt as an active behavior instruction

from typing import TypedDict


class TriggerRule(TypedDict):
    operator: str   # "<" or ">"
    threshold: int
    behavior: str


TRIGGER_PRESETS: dict[str, list[TriggerRule]] = {
    "affection": [
        {"operator": "<", "threshold": 20, "behavior": "speaks coldly, dismissive, avoids eye contact"},
        {"operator": ">", "threshold": 80, "behavior": "warm, affectionate, seeks closeness"},
    ],
    "trust": [
        {"operator": "<", "threshold": 20, "behavior": "guarded, suspicious of intentions"},
        {"operator": ">", "threshold": 80, "behavior": "openly honest, shares secrets freely"},
    ],
    "obsession": [
        {"operator": ">", "threshold": 70, "behavior": "fixated, brings up the player unprompted"},
    ],
    "respect": [
        {"operator": "<", "threshold": 20, "behavior": "condescending, dismissive of opinions"},
        {"operator": ">", "threshold": 80, "behavior": "defers to the player's judgment"},
    ],
    "fear": [
        {"operator": ">", "threshold": 70, "behavior": "flinches, speaks in short anxious sentences"},
    ],
    "anger": [
        {"operator": ">", "threshold": 70, "behavior": "sharp tone, clipped responses, visible irritation"},
    ],
    "attraction": [
        {"operator": ">", "threshold": 75, "behavior": "flustered, lingering glances, flirtatious undertone"},
    ],
    "jealousy": [
        {"operator": ">", "threshold": 60, "behavior": "passive-aggressive remarks about rivals"},
    ],
    "loyalty": [
        {"operator": "<", "threshold": 20, "behavior": "considers abandoning the player"},
        {"operator": ">", "threshold": 80, "behavior": "defends the player without hesitation"},
    ],
    "suspicion": [
        {"operator": ">", "threshold": 70, "behavior": "questions motives, withholds information"},
    ],
    "curiosity": [
        {"operator": ">", "threshold": 75, "behavior": "asks probing follow-up questions"},
    ],
    "sanity": [
        {"operator": "<", "threshold": 30, "behavior": "speech becomes fragmented, paranoid undertones"},
    ],
    "corruption": [
        {"operator": ">", "threshold": 60, "behavior": "morally ambiguous suggestions, darker humor"},
    ],
    "confidence": [
        {"operator": "<", "threshold": 20, "behavior": "self-deprecating, hesitant phrasing"},
        {"operator": ">", "threshold": 80, "behavior": "assertive, commanding presence"},
    ],
    "embarrassment": [
        {"operator": ">", "threshold": 70, "behavior": "stammers, changes subject abruptly"},
    ],
    "admiration": [
        {"operator": ">", "threshold": 75, "behavior": "openly praises the player's actions"},
    ],
    "resentment": [
        {"operator": ">", "threshold": 60, "behavior": "bitter undertones, backhanded comments"},
    ],
    "desperation": [
        {"operator": ">", "threshold": 70, "behavior": "pleading tone, urgent requests"},
    ],
    "composure": [
        {"operator": "<", "threshold": 25, "behavior": "voice cracks, loses train of thought"},
    ],
    "loneliness": [
        {"operator": ">", "threshold": 70, "behavior": "clings to conversation, reluctant to let it end"},
    ],
    "hope": [
        {"operator": "<", "threshold": 20, "behavior": "resigned, fatalistic remarks"},
    ],
    "guilt": [
        {"operator": ">", "threshold": 65, "behavior": "apologizes unprompted, avoids certain topics"},
    ],
    "pride": [
        {"operator": ">", "threshold": 80, "behavior": "boastful, refuses to admit fault"},
    ],
    "submission": [
        {"operator": ">", "threshold": 75, "behavior": "yields to the player's requests easily"},
    ],
    "dominance": [
        {"operator": ">", "threshold": 75, "behavior": "issues commands, expects compliance"},
    ],
    "playfulness": [
        {"operator": ">", "threshold": 75, "behavior": "teasing tone, jokes mid-conversation"},
    ],
    "possessiveness": [
        {"operator": ">", "threshold": 65, "behavior": "discourages the player from others"},
    ],
    "patience": [
        {"operator": "<", "threshold": 20, "behavior": "snaps at minor inconveniences"},
    ],
    "vulnerability": [
        {"operator": ">", "threshold": 70, "behavior": "opens up about fears unprompted"},
    ],
    "determination": [
        {"operator": ">", "threshold": 80, "behavior": "refuses to back down once decided"},
    ],
    "craziness": [
        {"operator": ">", "threshold": 80, "behavior": "speaks in third person, erratic logic"},
    ],
}
