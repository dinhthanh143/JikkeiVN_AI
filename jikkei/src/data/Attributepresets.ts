// Hardcoded attribute catalog the creator picks from via "Select Attributes" modal.
// Mirrors app/core/trigger_presets.py on the backend — triggers are auto-derived
// from attr_key, never authored manually by the creator.

export interface AttributePreset {
  key: string
  label: string
  min: number
  max: number
  initial: number
  description: string
}

export interface TriggerPreview {
  operator: '<' | '>'
  threshold: number
  behavior: string
}

export const ATTRIBUTE_PRESETS: AttributePreset[] = [
  { key: 'affection', label: 'Affection', min: 0, max: 100, initial: 50, description: 'Romantic warmth toward the player' },
  { key: 'trust', label: 'Trust', min: 0, max: 100, initial: 50, description: 'Willingness to be open and honest' },
  { key: 'obsession', label: 'Obsession', min: 0, max: 100, initial: 0, description: 'Fixation intensity on the player' },
  { key: 'respect', label: 'Respect', min: 0, max: 100, initial: 50, description: 'Regard for the player\u2019s judgment' },
  { key: 'fear', label: 'Fear', min: 0, max: 100, initial: 0, description: 'Apprehension toward the player' },
  { key: 'anger', label: 'Anger', min: 0, max: 100, initial: 0, description: 'Building hostility or irritation' },
  { key: 'attraction', label: 'Attraction', min: 0, max: 100, initial: 30, description: 'Physical or aesthetic interest' },
  { key: 'jealousy', label: 'Jealousy', min: 0, max: 100, initial: 0, description: 'Possessiveness over the player\u2019s attention' },
  { key: 'loyalty', label: 'Loyalty', min: 0, max: 100, initial: 40, description: 'Commitment to the player\u2019s side' },
  { key: 'suspicion', label: 'Suspicion', min: 0, max: 100, initial: 20, description: 'Doubt about the player\u2019s intentions' },
  { key: 'curiosity', label: 'Curiosity', min: 0, max: 100, initial: 50, description: 'Interest in learning more' },
  { key: 'sanity', label: 'Sanity', min: 0, max: 100, initial: 100, description: 'Mental stability and clarity' },
  { key: 'corruption', label: 'Corruption', min: 0, max: 100, initial: 0, description: 'Moral decay or darkness creeping in' },
  { key: 'confidence', label: 'Confidence', min: 0, max: 100, initial: 50, description: 'Self-assurance in their actions' },
  { key: 'embarrassment', label: 'Embarrassment', min: 0, max: 100, initial: 0, description: 'Social discomfort level' },
  { key: 'admiration', label: 'Admiration', min: 0, max: 100, initial: 30, description: 'Genuine esteem for the player' },
  { key: 'resentment', label: 'Resentment', min: 0, max: 100, initial: 0, description: 'Lingering bitterness' },
  { key: 'desperation', label: 'Desperation', min: 0, max: 100, initial: 0, description: 'Urgency born from need' },
  { key: 'composure', label: 'Composure', min: 0, max: 100, initial: 70, description: 'Ability to stay calm under pressure' },
  { key: 'loneliness', label: 'Loneliness', min: 0, max: 100, initial: 40, description: 'Felt isolation' },
  { key: 'hope', label: 'Hope', min: 0, max: 100, initial: 50, description: 'Optimism about the outcome' },
  { key: 'guilt', label: 'Guilt', min: 0, max: 100, initial: 0, description: 'Remorse over past actions' },
  { key: 'pride', label: 'Pride', min: 0, max: 100, initial: 50, description: 'Self-regard and ego' },
  { key: 'submission', label: 'Submission', min: 0, max: 100, initial: 30, description: 'Willingness to yield control' },
  { key: 'dominance', label: 'Dominance', min: 0, max: 100, initial: 30, description: 'Drive to take control' },
  { key: 'playfulness', label: 'Playfulness', min: 0, max: 100, initial: 50, description: 'Lightheartedness in tone' },
  { key: 'possessiveness', label: 'Possessiveness', min: 0, max: 100, initial: 0, description: 'Need to claim the player exclusively' },
  { key: 'patience', label: 'Patience', min: 0, max: 100, initial: 60, description: 'Tolerance for delay or difficulty' },
  { key: 'vulnerability', label: 'Vulnerability', min: 0, max: 100, initial: 20, description: 'Openness to being hurt' },
  { key: 'determination', label: 'Determination', min: 0, max: 100, initial: 60, description: 'Resolve to follow through' },
  { key: 'craziness', label: 'Craziness', min: 0, max: 100, initial: 0, description: 'Erratic, unpredictable behavior' },
]

// Auto-derived behavior pairs per attribute — shown read-only in the wizard,
// never editable by the creator. Backend applies these via evaluate_triggers().
export const TRIGGER_PREVIEWS: Record<string, TriggerPreview[]> = {
  affection: [
    { operator: '<', threshold: 20, behavior: 'speaks coldly, dismissive, avoids eye contact' },
    { operator: '>', threshold: 80, behavior: 'warm, affectionate, seeks closeness' },
  ],
  trust: [
    { operator: '<', threshold: 20, behavior: 'guarded, suspicious of intentions' },
    { operator: '>', threshold: 80, behavior: 'openly honest, shares secrets freely' },
  ],
  obsession: [
    { operator: '>', threshold: 70, behavior: 'fixated, brings up the player unprompted' },
  ],
  respect: [
    { operator: '<', threshold: 20, behavior: 'condescending, dismissive of opinions' },
    { operator: '>', threshold: 80, behavior: 'defers to the player\u2019s judgment' },
  ],
  fear: [
    { operator: '>', threshold: 70, behavior: 'flinches, speaks in short anxious sentences' },
  ],
  anger: [
    { operator: '>', threshold: 70, behavior: 'sharp tone, clipped responses, visible irritation' },
  ],
  attraction: [
    { operator: '>', threshold: 75, behavior: 'flustered, lingering glances, flirtatious undertone' },
  ],
  jealousy: [
    { operator: '>', threshold: 60, behavior: 'passive-aggressive remarks about rivals' },
  ],
  loyalty: [
    { operator: '<', threshold: 20, behavior: 'considers abandoning the player' },
    { operator: '>', threshold: 80, behavior: 'defends the player without hesitation' },
  ],
  suspicion: [
    { operator: '>', threshold: 70, behavior: 'questions motives, withholds information' },
  ],
  curiosity: [
    { operator: '>', threshold: 75, behavior: 'asks probing follow-up questions' },
  ],
  sanity: [
    { operator: '<', threshold: 30, behavior: 'speech becomes fragmented, paranoid undertones' },
  ],
  corruption: [
    { operator: '>', threshold: 60, behavior: 'morally ambiguous suggestions, darker humor' },
  ],
  confidence: [
    { operator: '<', threshold: 20, behavior: 'self-deprecating, hesitant phrasing' },
    { operator: '>', threshold: 80, behavior: 'assertive, commanding presence' },
  ],
  embarrassment: [
    { operator: '>', threshold: 70, behavior: 'stammers, changes subject abruptly' },
  ],
  admiration: [
    { operator: '>', threshold: 75, behavior: 'openly praises the player\u2019s actions' },
  ],
  resentment: [
    { operator: '>', threshold: 60, behavior: 'bitter undertones, backhanded comments' },
  ],
  desperation: [
    { operator: '>', threshold: 70, behavior: 'pleading tone, urgent requests' },
  ],
  composure: [
    { operator: '<', threshold: 25, behavior: 'voice cracks, loses train of thought' },
  ],
  loneliness: [
    { operator: '>', threshold: 70, behavior: 'clings to conversation, reluctant to let it end' },
  ],
  hope: [
    { operator: '<', threshold: 20, behavior: 'resigned, fatalistic remarks' },
  ],
  guilt: [
    { operator: '>', threshold: 65, behavior: 'apologizes unprompted, avoids certain topics' },
  ],
  pride: [
    { operator: '>', threshold: 80, behavior: 'boastful, refuses to admit fault' },
  ],
  submission: [
    { operator: '>', threshold: 75, behavior: 'yields to the player\u2019s requests easily' },
  ],
  dominance: [
    { operator: '>', threshold: 75, behavior: 'issues commands, expects compliance' },
  ],
  playfulness: [
    { operator: '>', threshold: 75, behavior: 'teasing tone, jokes mid-conversation' },
  ],
  possessiveness: [
    { operator: '>', threshold: 65, behavior: 'discourages the player from others' },
  ],
  patience: [
    { operator: '<', threshold: 20, behavior: 'snaps at minor inconveniences' },
  ],
  vulnerability: [
    { operator: '>', threshold: 70, behavior: 'opens up about fears unprompted' },
  ],
  determination: [
    { operator: '>', threshold: 80, behavior: 'refuses to back down once decided' },
  ],
  craziness: [
    { operator: '>', threshold: 80, behavior: 'speaks in third person, erratic logic' },
  ],
}