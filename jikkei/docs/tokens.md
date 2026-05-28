# docs/tokens.md — Design System & Tokens

> All design tokens are defined in `src/styles/theme.css`.
> Never hardcode these values — always use the CSS variable.
> Update this file whenever a token is added, changed, or removed.

---

## Theme

**Visual language:** Pink, black, white — manga-energy, Persona 5 aesthetic
**Style keywords:** Asymmetric, sharp edges, clip-path geometry, high contrast, scan lines

---

## Fonts

| CSS Variable | Font | Use |
|---|---|---|
| `--font-display` | Bebas Neue | Titles, menu labels, headings |
| `--font-ui` | Rajdhani | Body text, descriptions, UI |
| `--font-mono` | Share Tech Mono | Code, system labels, tags, timestamps |

Fonts are loaded in `src/styles/fonts.css`.

---

## Color Tokens

| CSS Variable | Value | Use |
|---|---|---|
| `--pink` | `#e91e8c` | Primary accent, buttons, borders |
| `--pink-hot` | `#ff2d78` | Hover states, emphasis |
| `--pink-soft` | `#ff85b3` | Secondary text, muted accents |
| `--pink-pale` | `#ffd6e7` | Very light fills |
| `--black` | `#0a0a0f` | Primary background |
| `--black-2` | `#12121a` | Sidebar, secondary surfaces |
| `--black-3` | `#1a1a26` | Cards, elevated surfaces |
| `--black-4` | `#242433` | Hover surfaces |
| `--white` | `#ffffff` | Primary text |

---

## Tailwind Config Notes

- Tailwind is v3; custom tokens above are mapped into `tailwind.config.ts` so
  classes like `bg-black-3` resolve to the correct value.
- Never add a Tailwind token without adding the corresponding CSS var here and
  updating `tailwind.config.ts`.
