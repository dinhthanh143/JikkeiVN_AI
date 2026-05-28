# CI Security Workflow

This document describes the security-focused CI job and how to interpret results.

## Workflow intent

- Scan dependencies for known vulnerabilities.
- Scan source for insecure coding patterns.
- Run automatically on backend-relevant pushes and on schedule.

## Current checks

1. pip-audit
- Input: backend requirements lock file.
- Output: advisory/CVE findings and available fixed versions.

2. bandit
- Input: backend Python source.
- Output: static security findings by severity/confidence.

3. pytest security suite
- Input: tests/test_auth.py and tests/test_access.py integration suite.
- Output: regression signal for auth/session/access-control guarantees.
- Why this matters: static scans cannot prove runtime authorization behavior.

## Typical actions by result

No findings:
- Proceed with normal change flow.

Dependency findings:
- Check available fix versions.
- Assess compatibility impact.
- Prioritize auth, crypto, request parsing, and framework packages.

Code findings:
- Patch issue in source.
- Re-run scanner locally and in CI.

## Known policy gap

The scanner job may report findings without blocking release in some cases depending on command flags and project policy.

Recommendation:
- Define severity thresholds that must fail CI.
- Use documented temporary exceptions with expiry dates where immediate upgrade is not possible.

## Suggested improvement roadmap

1. Add SBOM generation artifact for dependency inventory.
2. Add weekly dependency update PR automation.
3. Expand security regression tests beyond auth/admin into all resource-ownership routes.
4. Add release gate requiring zero high severity issues unless explicitly waived.
