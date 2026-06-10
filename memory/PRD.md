# مخيم العائدين — PRD

## Original Problem Statement
تحويل مشروع Camp من باك اند FastAPI (Firebase Admin) إلى فرونت اند فقط مع Firebase مدموج مباشرة (زي مشروع cards)، مع إبقاء المصادقة عبر Firebase Auth وحذف الباك اند، وبدون أي تغيير في الوظائف أو التصميم.

## Architecture (since 2026-06-10)
- **Frontend-only**: React + Firebase Web SDK (project: camp-50ca4)
  - `src/lib/firebase.js`: hardcoded Firebase config (Auth + Realtime Database) — like cards project
  - `src/lib/api.js`: full API shim that re-implements ALL old backend routes client-side (same paths, same responses) so pages stayed untouched:
    - Auth (Firebase Auth signIn, session in localStorage camp_token/camp_user)
    - users (create via secondary Firebase app so admin stays logged in), family-fields, families, aid-types, aid-records, individual-members, categories, category-fields, category-records, family-members, stats
    - Excel import/export client-side via `xlsx` (SheetJS) replacing openpyxl, incl. Arabic fuzzy matching (normalize/match_score ported to JS)
    - Default categories seeding on first /categories read
- **Backend**: deleted — only a tiny FastAPI stub at /api/ to keep the platform service healthy (no logic, no Firebase)

## What's been implemented
- 2026-06-10: Full backend→frontend Firebase migration. Verified live: login (admin@camp.com), dashboard stats (160 families from real RTDB), families page with real data. No functional/design changes.

## Notes
- RTDB rules must allow authenticated reads/writes (currently working).
- Deleting a user removes the DB record only; the Firebase Auth account remains (same as old backend behavior — first Firebase login auto-creates as admin).

## Backlog
- P2: tighten RTDB security rules per role (currently client-enforced roles, same trust level as before for authenticated users)
