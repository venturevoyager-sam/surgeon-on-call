# Doctor Web

- React 19 CRA, port 3003. For surgeons (desktop).
- Auth: phone+password → `POST /api/surgeons/login` → localStorage `surgeon_id`, `surgeon_name` via `lib/auth.js`
- ProtectedRoute: `isLoggedIn()` checks localStorage. All protected routes wrapped in Layout (sidebar + mobile bottom nav).
- Supabase used ONLY for file storage uploads (bucket: `surgeon-documents`). All data via backend API.
- Run: `cd doctor-web && npm install && npm start`
- Deploy: Render Static Site. **`public/_redirects` required** (`/* /index.html 200`) for client-side routing on Render.

## Env Vars

`REACT_APP_API_URL` (**no default — breaks if unset**), `REACT_APP_SUPABASE_URL` (req), `REACT_APP_SUPABASE_ANON_KEY` (req)

## Routes

| Path | File | Auth | API Calls | Notes |
|------|------|------|-----------|-------|
| `/login` | Login.js | public | `POST /api/surgeons/login` | auto-creates account on first login |
| `/signup` | Signup.js | public | `GET /api/specialties`, `POST /api/surgeons/register`, Supabase storage uploads, Nominatim geocoding | 6-step form, Leaflet map, document uploads |
| `/home` | Home.js | req | `GET /api/surgeons/:id`, `GET /api/surgeons/:id/requests`, `PATCH /api/surgeons/:id/availability` | 60s polling, emergency-first sort |
| `/request/:caseId` | RequestDetail.js | req | `GET /api/cases/:caseId/surgeon-view?surgeon_id=`, `PATCH /api/cases/:caseId/accept`, `PATCH /api/cases/:caseId/decline` | countdown timer, fee breakdown (10% commission), confirm dialogs |
| `/case/:caseId` | AcceptedCase.js | req | `GET /api/cases/:caseId/surgeon-view?surgeon_id=`, `GET /api/cases/:caseId/recommendation`, `POST /api/cases/:caseId/recommend` | hospital name revealed, reconsult recommendation form |
| `/profile` | Profile.js | req | `GET /api/surgeons/:id`, `GET /api/specialties`, `PATCH /api/surgeons/:id/profile`, `PATCH /api/surgeons/:id/password`, Supabase storage uploads, Nominatim geocoding | 4 sections, Leaflet map, per-file immediate save |
| `/earnings` | Earnings.js | req | `GET /api/surgeons/:id/earnings` | summary cards, payment table, 10% commission client-side |

## Layout.js

- Desktop: left sidebar (dark brown `#2C1A0E`). Mobile: bottom nav bar.
- Fetches `GET /api/surgeons/:id` on every mount for verification banner
- Nav: Home, Profile, Earnings

## Quirks

- `_redirects` file in `public/` is critical — without it Render returns 404 on direct URL access
- `REACT_APP_API_URL` has no fallback (unlike hospital-web)
- Earnings reads `res.data.cases` but backend returns `{earnings:[]}` — may render empty
- RequestDetail shows 10% commission; backend computes 5%; mobile shows 5% — inconsistent
- Layout re-fetches surgeon profile on every navigation (not shared with child pages)
- Document uploads save URL immediately via PATCH; other form changes require "Save Changes" click
