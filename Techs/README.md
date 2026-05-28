# Techs Knowledge Base

Purpose:
- Store project knowledge in one place.
- Document both project-specific and general technical decisions.
- Preserve security/audit context so future work is consistent.

Scope rules:
- This folder is documentation-only.
- No runtime code should live here.
- Notes can reference both Jikkei and general best practices.

Last updated: 2026-04-14

## Sections

- Libraries
  - What is installed and why.
  - Security relevance and upgrade strategy.

- Security
  - Current controls, gaps, and hardening checklist.
  - Vulnerability scan results and remediation plan.
  - Security regression test coverage in CI.

- Auth
  - Authentication architecture and threat model.
  - Token lifecycle and lockout behavior.

- Infrastructure
  - Runtime model (dev vs production).
  - CI security scanning and deployment behavior.

- Database
  - Pooling strategy and reliability controls.
  - Schema choices tied to security logic.

## How to use this folder

1. Read section README/docs before changing related code.
2. Update docs after security or architecture changes.
3. Keep details concrete (settings, tradeoffs, failure modes, trigger conditions).
4. Prefer checklists and tables for readability.
5. Treat this folder as architecture truth for security-critical behavior.
