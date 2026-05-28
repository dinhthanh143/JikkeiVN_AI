// DEPRECATED (TASK-011) — this mock is no longer used. AccountTab.tsx now
// gets real credits data from the shared `useCredits()` hook at
// src/features/credits/useCredits.ts, which wires to the real
// GET /api/credits endpoint (see jikkei-api/app/routers/credits.py).
//
// Kept as an empty stub rather than deleted outright since this tool has no
// remote file-delete capability — safe to actually remove this file the
// next time anyone touches this directory.
export {}
