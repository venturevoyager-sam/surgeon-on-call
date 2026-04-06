# Hospital Web

- React 19 CRA, port 3000. For hospital SPOCs.
- Auth: email+password → `POST /api/hospitals/login` → localStorage `hospital_id`, `hospital_name`
- ProtectedRoute checks `localStorage.getItem('hospital_id')`
- Supabase used for direct DB reads (Dashboard, FindSurgeon) AND file uploads. Backend API used for mutations.
- Run: `cd hospital-web && npm install && npm start`
- Deploy: Render Static Site, `build/`, rewrite `/* → /index.html`

## Env Vars

`REACT_APP_API_URL` (default: `http://localhost:5000`), `REACT_APP_SUPABASE_URL` (req), `REACT_APP_SUPABASE_ANON_KEY` (req)

## Routes

| Path | File | Auth | API Calls | Notes |
|------|------|------|-----------|-------|
| `/` | Login.js | public | `POST /api/hospitals/login` | stores hospital_id in localStorage |
| `/register` | HospitalSignup.js | public | `POST /api/hospitals/register`, Nominatim geocoding | Leaflet map for lat/lng |
| `/dashboard` | Dashboard.js | req | Supabase: `hospitals`, `cases` + `case_priority_list` join | sorts emergency first, then by expires_at |
| `/find-surgeon` | FindSurgeon.js | req | `GET /api/specialties`, `POST /api/cases/draft`, Supabase: `surgeons` | "Book This Surgeon" → draft case |
| `/cases/:id/edit` | EditCase.js | req | `PATCH /api/cases/:id` (draft→active), Supabase storage upload | **Quirk: uses fee_min/fee_max not single fee** |
| `/new-request` | NewRequest.js | req | `GET /api/specialties`, `POST /api/cases` (elective), Supabase storage upload | supports re-consult pre-fill via route state |
| `/emergency-request` | EmergencyRequest.js | req | `GET /api/specialties`, `POST /api/cases` (emergency), `PATCH /api/cases/:id/priority` | skips shortlist, broadcasts to ALL surgeons |
| `/opd-request` | OPDRequest.js | req | `GET /api/specialties`, `POST /api/cases` (opd), `PATCH /api/cases/:id/priority` if same-day | same-day→auto-cascade, future→shortlist |
| `/reconsult-request` | ReconsultRequest.js | req | `GET /api/specialties`, `POST /api/cases` (reconsult) | always goes to shortlist |
| `/cases/:id/shortlist` | Shortlist.js | req | `GET /api/cases/:id`, `GET /api/cases/:id/matches`, `GET /api/cases?hospital_id=`, `PATCH /api/cases/:id/priority` | go-to surgeons, budget badge, max 5 |
| `/cases/:id` | CaseDetail.js | req | `GET /api/cases/:id` (polled 10s/30s), `GET /api/cases/:id/recommendation`, `GET /api/specialties`, `PATCH /api/cases/:id`, `PATCH /api/cases/:id/convert`, `DELETE /api/cases/:id` | countdown timer, edit modal, delete |

## Quirks

- Dual data access: Supabase direct (Dashboard, FindSurgeon) + backend API (everything else)
- EditCase uses `fee_min`/`fee_max`; all other forms use single `fee`
- CaseDetail polls forever (even after confirmed/completed)
- File uploads never cleaned from Supabase Storage on removal
- Notification bell is placeholder (not wired)
- Recommendation dismiss is client-side only (reappears on refresh)
