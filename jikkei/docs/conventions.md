# docs/conventions.md — Naming Conventions

> Global conventions for the Jikkei codebase. Follow these everywhere.

---

## File & Identifier Naming

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `DialogueBox.tsx` |
| Hooks | camelCase + `use` prefix | `useCharacter.ts` |
| Stores | camelCase + `use` prefix | `useGameStore.ts` |
| Services | camelCase | `characterService.ts` |
| Types / Interfaces | PascalCase | `CharacterCard` |
| CSS variables | kebab-case with `--` prefix | `--pink-hot` |
| Zustand actions | verb + noun | `setExpression`, `addWorldEvent` |
| Env variables | `VITE_` prefix + SCREAMING_SNAKE | `VITE_API_BASE_URL` |

---

## Import Order

```typescript
// 1. React
import { useState } from 'react'

// 2. Third-party
import { useQuery } from '@tanstack/react-query'

// 3. Internal aliases
import { useGameStore } from '@/store/useGameStore'

// 4. Relative
import { DialogueBox } from './DialogueBox'
```

---

## Component Shape

```typescript
// Named export, const arrow syntax, explicit Props interface
interface DialogueBoxProps {
  text: string
  speakerName: string | null
}

export const DialogueBox = ({ text, speakerName }: DialogueBoxProps) => {
  // ...
}
```

- Named exports — avoid default exports from multi-export files.
- `<button>` for actions — never `<div onClick>`.
- `<Link>` for internal navigation — never `<a href>` internally.
- `cn()` from `@/lib/cn` for className merging — never string concatenation.
- No inline `style={{}}` for design-system colors — always use CSS variables.

---

## State Rules

- `useGameStore` — game state
- `useAudioStore` — audio
- `usePlayerStore` / `useAuth` — auth identity
- Never store API responses in Zustand — use TanStack Query.
- No `useEffect` data fetching — use TanStack Query for server state.
