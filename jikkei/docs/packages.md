# docs/packages.md — Dependencies

> Add a row here whenever a package is installed or removed.
> Never add an npm or pip package without updating this file.

---

## Frontend (npm)

### Core

| Package | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 (strict) | Type safety |
| Vite | 5 | Build tool and dev server |
| React Router DOM | v6 | Client-side routing with lazy loading |

### Styling

| Package | Purpose |
|---|---|
| Tailwind CSS v3 | Utility classes for layout and spacing |
| clsx | Conditional className construction |
| tailwind-merge | Merge Tailwind classes without conflicts |

> `cn()` in `src/lib/cn.ts` combines clsx + tailwind-merge — always use this, never import either directly in components.

### 3D / Visual Engine

| Package | Purpose |
|---|---|
| Three.js | 3D scene rendering — homepage background geometry |
| @react-three/fiber | React renderer for Three.js |
| @react-three/drei | Three.js helpers (OrbitControls, etc.) |
| PixiJS *(Phase 2)* | 2D canvas engine for in-game scene rendering |

### State Management

| Package | Purpose |
|---|---|
| Zustand | Global client state (game state, audio, player) |
| TanStack Query v5 | Server state — all API calls, caching, mutations |

### Forms & Validation

| Package | Purpose |
|---|---|
| React Hook Form | Form state management |
| Zod | Schema validation — shared between forms and API types |

### Audio

| Package | Purpose |
|---|---|
| Howler.js | Game audio engine — music layers, SFX, crossfade |

### Assets / Media

| Package | Purpose |
|---|---|
| @cloudinary/react | React components for Cloudinary images |
| @cloudinary/url-gen | Cloudinary URL generation with transforms |

### HTTP / API

| Package | Purpose |
|---|---|
| Axios | HTTP client — configured instance in `src/services/api.ts` |

### Icons

| Package | Purpose |
|---|---|
| Lucide React | UI icons (nav, buttons) |

### Auth *(Phase 2)*

| Package | Purpose |
|---|---|
| Supabase JS | Auth, realtime, database client |

### Dev Tools

| Package | Purpose |
|---|---|
| ESLint + @typescript-eslint | Linting |
| Prettier | Code formatting |
| @types/three | Three.js TypeScript definitions |
| Vitest | Frontend unit and component test runner |
| React Testing Library | User-facing React component tests |
| jest-dom | Accessible DOM assertions for Vitest |
| user-event | Realistic keyboard and pointer interaction tests |
| jsdom | Browser-like DOM environment for frontend tests |

---

## Backend (pip)

Dialogue generation no longer installs the Anthropic SDK. Free and premium
both use Gemini 2.5 Flash; premium differs only in configured usage limits.

| Package | Purpose |
|---|---|
| gunicorn | Production ASGI server — multi-worker process manager |
| loguru | Structured logging with JSON output for log aggregators |
| sentry-sdk[fastapi] | Error tracking, crash reporting, performance monitoring |
| bandit | Static security analysis — scans Python code for vulnerabilities |
| pip-audit | Dependency vulnerability scanner against Python Advisory DB |
| psycopg[binary] | Postgres driver — used for admin bootstrap script; avoids requiring local `pg_config` build toolchain |
| slowapi | Rate limiting per IP |
| SQLAlchemy | ORM — parameterized queries for SQL injection prevention |
| stripe 15.3.0 | Async checkout, subscription, customer-portal, and webhook integration |
