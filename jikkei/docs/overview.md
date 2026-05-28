# docs/overview.md — Project Overview

> What Jikkei is and what makes it different.

---

## What it is

Jikkei is a web platform where players experience AI-driven visual novel stories —
branching narratives where character memory, player choices, and affinity systems
create a different story every playthrough. Creators can build their own characters
and stories using a built-in editor.

Characters are portable via a standardized Character Card format compatible with
SillyTavern V2.

## What makes it different

- AI characters that maintain persistent memory across sessions (not a chatbot reset)
- Expression + pose system driven by AI metadata output (not hardcoded)
- Branching relationship graph — not just branching plot
- Open character card format — players own their characters
- Creator marketplace — build once, share everywhere
- Adaptive audio system — music shifts with story tension state

## Character Card Format

Jikkei uses a superset of SillyTavern V2. Cards are portable JSON, optionally
embedded in PNG metadata.

```typescript
interface CharacterCard {
  spec: 'chara_card_v2'
  spec_version: '2.0'
  // SillyTavern V2 fields
  name: string
  personality: string
  scenario: string
  first_message: string
  lore_entries: LoreEntry[]
  // Jikkei extensions
  visual_ext: {
    portrait: string                                    // Cloudinary URL
    expressions: Record<CharacterExpression, string>
    poses: Record<CharacterPose, string>
    color_palette: string[]
    voice_tone: string
  }
  story_ext: {
    trigger_events: TriggerEvent[]
    minigame_hooks: string[]
  }
}
```
