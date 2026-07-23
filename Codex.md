# Codex Notes

- 2026-07-23 13:16:04 Central Time: Cloned `Toydrum/RoadMap2U` into `Z:\GitHub\RoadMap2U` for initial project onboarding.
- Related backend repo: `Z:\GitHub\roadmap2u-backend`.
- Codex review task created: `019f9067-5b70-7a92-b994-886e633acb69`.
- 2026-07-23 14:17:18 Central Time: Initial system review documented in `docs/codebase/`. Frontend is Angular 22 PWA, local-first IndexedDB, mock/AWS auth/API seams, AWS config generated from backend SSM handoff, and owns normative contract files under `src/app/core/`.
- 2026-07-23 14:17:18 Central Time: Important release gates: AWS delivery is prepared behind GitHub variables; checked-in config is mock/local; preserve lazy Amplify/Cognito seam and bundle grep; read `AGENTS.md` before UI/product changes.
- 2026-07-23 14:33:38 Central Time: Signup bug root cause from prod screenshot: user entered `Lynx Pardelle`; Cognito rejects usernames with spaces as `InvalidParameterException`, while the app mapped it to `unknown`. Fixed local create-account validation, Cognito error mapping, and clearer ES/EN copy. Verified AWS read-only with profile `ADMIN-AIM-CLI` because `ADMIN-CLI` was not configured locally.
- 2026-07-23 15:12:00 Central Time: Created and published Google Form `RoadMap2U - Reporte de bugs beta` in Drive folder `1hGKdvSkiWUw8BCUBoTVEK-5MlFKIRDUo` for beta tester and QA bug intake. Respondent URL: https://docs.google.com/forms/d/e/1FAIpQLSelXiTkj1W9hKmgw1z_fLVFKy_a2bpWDFT8FdSABTLteHxmew/viewform. A first Gemini-generated draft form was defective; deleting it via the Drive connector failed with `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, so it may need manual cleanup if visible.
- 2026-07-23 15:23:00 Central Time: Release tag bumped to `0.0.116 · 23 jul 2026 — reportes beta`. Account errors and Settings now link to the published beta bug intake Form.
