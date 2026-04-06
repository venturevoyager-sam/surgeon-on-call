# Doctor Web — CLAUDE.md

## What This App Does

React 19 CRA app for surgeons (doctors) to manage their availability, view incoming case requests, accept or decline cases, track earnings, and maintain their professional profile. This is the desktop/browser counterpart to the Surgeon Mobile app — both serve the same user base with the same backend.

**Users:** Verified surgeons registered on the Surgeon on Call platform. Unverified surgeons can log in but see a verification banner and won't receive case requests.

**Key distinction from hospital-web:** This app is surgeon-facing (receive and respond to requests), while hospital-web is hospital-facing (create and track requests).

---

## Pages and Routes

### `/login` — Login (`Login.js`)
**Public.** Phone number + password login.

**API calls:**
- `POST /api/surgeons/login` — phone + password authentication

**Behavior:** On success, stores `surgeon_id` and `surgeon_name` in localStorage via `loginSurgeon()` helper, navigates to `/home`. If no auth record exists for the phone, the backend auto-creates a surgeon + auth record (see backend docs). Links to `/signup` for new surgeons.

---

### `/signup` — Registration (`Signup.js`)
**Public.** 6-section multi-step registration form with progress indicator.

**Sections:**
1. **Basic Details** — name, phone, email, city, communication preference (Phone Call / WhatsApp / Email)
2. **Professional Details** — specialty (multi-select with search from API), highest qualification, experience years, practice type, hospital affiliations
3. **Practice & Availability** — Leaflet map with draggable pin for preferred location, travel radius slider, toggles (teleconsultation / emergency / physical visits), avg hourly rate (₹, converted to paise)
4. **Verification & Credentialing** — MCI number, document uploads (medical certificate, government ID, resume/CV, degree certificate)
5. **Profile Building** — bio, key procedures, profile photo upload
6. **Declaration** — checkbox agreement, submit button

**API calls:**
- `GET /api/specialties` — populate specialty multi-select
- `POST /api/surgeons/register` — submit full registration payload
- Nominatim reverse geocoding for location name display

**Supabase direct calls:**
- `supabase.storage.from('surgeon-documents').upload()` — upload profile photo, certificate, government ID, resume, degree

**Behavior:** On success, shows confirmation page with "Go to Login" button. Surgeon is created with `verified: false` — admin must verify before case requests flow in.

---

### `/home` — Home / Dashboard (`Home.js`)
**Protected.** Main dashboard with availability toggle, incoming requests, and upcoming cases.

**Sections:**
- **Availability toggle** — green/grey switch, surgeon name greeting
- **Incoming Requests** — pending case notifications sorted: emergency first, then by `notified_at` descending. Each card shows request type badge, countdown timer, procedure, specialty, date/time, fee
- **Upcoming Cases** — confirmed/in_progress cases with future surgery dates, sorted: emergency first, then by `surgery_date` descending

**API calls:**
- `GET /api/surgeons/:id` — fetch surgeon profile (for name, availability status)
- `GET /api/surgeons/:id/requests` — fetch `incoming_requests[]` and `upcoming_cases[]`
- `PATCH /api/surgeons/:id/availability` — toggle availability on/off

**Polling:** Auto-refreshes every 60 seconds via `setInterval`.

**Navigation:** Clicking an incoming request navigates to `/request/:caseId`. Clicking an upcoming case navigates to `/case/:caseId`.

---

### `/request/:caseId` — Request Detail (`RequestDetail.js`)
**Protected.** Full case details for a pending request. Surgeon can accept or decline.

**Sections:**
- Request type badge + countdown timer
- Surgery details: date, time, duration, OT, location (city only — full address hidden until acceptance)
- Patient details: age, gender, notes
- Fee breakdown: gross fee, platform commission (10%), net payout
- Accept / Decline buttons

**API calls:**
- `GET /api/cases/:caseId/surgeon-view?surgeon_id=X` — fetch case details with hospital city only (address hidden)
- `PATCH /api/cases/:caseId/accept` — accept the case (with `surgeon_id` in body)
- `PATCH /api/cases/:caseId/decline` — decline the case (triggers cascade to next surgeon)

**Behavior:**
- Accept navigates to `/case/:caseId` (confirmed case view with full hospital details).
- Decline navigates to `/home`.
- Both actions show confirmation dialog (`window.confirm`) before proceeding.
- Fee breakdown shows 10% commission (5% hospital + 5% surgeon per backend logic, but displayed as flat 10% to the surgeon).

---

### `/case/:caseId` — Accepted Case (`AcceptedCase.js`)
**Protected.** Confirmed case details with full hospital information revealed.

**Sections:**
- Confirmed badge + request type badge
- Case details: procedure, specialty, date, time, duration, OT, hospital name, city, fee
- Patient details: name, age, gender, notes
- **Surgery Recommendation** (reconsult cases only):
  - If no recommendation submitted: "Recommend Surgery" button → inline form
  - Form fields: suggested procedure, clinical notes, urgency (elective/urgent)
  - If already submitted: shows submitted summary (procedure, urgency, notes) with "Submitted" badge

**API calls:**
- `GET /api/cases/:caseId/surgeon-view?surgeon_id=X` — fetch case with hospital name revealed (confirmed status)
- `GET /api/cases/:caseId/recommendation` — fetch existing recommendation (reconsult cases only)
- `POST /api/cases/:caseId/recommend` — submit surgery recommendation (reconsult cases only)

**Behavior:** Hospital name and city are now visible (hidden before acceptance). For reconsult cases, the recommendation form allows the surgeon to suggest a follow-up surgery, which the hospital can then convert into a full case.

---

### `/profile` — Profile (`Profile.js`)
**Protected.** Four editable sections with a global "Save Changes" button, plus document uploads and password change.

**Sections:**
1. **Personal** — name, city, communication preference, bio
2. **Credentials** — MCI number, highest qualification, UG/PG college, experience years, practice type, specialty multi-select with search
3. **Location & Availability** — Leaflet map with draggable pin, travel radius, location name (reverse geocoded), toggles (teleconsultation, emergency, physical visits), avg hourly rate
4. **Documents** — file upload for profile photo, medical certificate, government ID, resume (each uploaded individually and saved immediately)
5. **Password Change** — current password + new password fields

**API calls:**
- `GET /api/surgeons/:id` — fetch current profile
- `GET /api/specialties` — populate specialty multi-select
- `PATCH /api/surgeons/:id/profile` — save all editable fields (bulk save on "Save Changes" click)
- `PATCH /api/surgeons/:id/profile` — also called per-document after each file upload (saves URL immediately)
- `PATCH /api/surgeons/:id/password` — change password (requires current password)
- Nominatim reverse geocoding for location name

**Supabase direct calls:**
- `supabase.storage.from('surgeon-documents').upload()` — upload profile photo, certificate, government ID, resume

**Behavior:** "Save Changes" sends a bulk PATCH with all form fields. Document uploads save independently and immediately via a separate PATCH call per file. Password change is a separate form at the bottom. Success/failure messages shown inline and auto-clear after 3 seconds.

---

### `/earnings` — Earnings (`Earnings.js`)
**Protected.** Payment history and summary dashboard.

**Summary cards:**
- **This Month** — net payout for cases with surgery_date in the current month
- **All Time** — total net payout across all completed cases
- **Pending** — total net payout for cases with `payment_status: 'pending'`

**Payment history table:** case number, procedure, date, gross fee, commission (10%), net payout, payment status (Paid/Pending).

**API calls:**
- `GET /api/surgeons/:id/earnings` — fetch all completed cases with fee data

**Commission calculation:** 10% deducted from gross fee (fee or fee_max). Net payout = 90% of gross fee. Computed client-side.

**Note:** The API endpoint returns cases from the `cases` table, but the Earnings page reads the response as `res.data.cases` — the backend actually returns `{ earnings: [...] }`. This appears to be a bug where the page reads `res.data.cases` but the backend sends `res.data.earnings`. The page may show empty if this field mismatch isn't handled.

---

## Layout Component (`Layout.js`)

All protected routes are wrapped in `Layout`, which provides:
- **Desktop:** Left sidebar (dark brown `#2C1A0E`) with brand name, surgeon name, nav links (Home, Profile, Earnings), logout
- **Mobile:** Bottom navigation bar (fixed) with the same 3 nav items
- **Verification banner:** Yellow bar at top when `surgeon.verified === false`

**API calls:**
- `GET /api/surgeons/:id` — fetched once on mount to check verification status

---

## Shared Libraries

### `lib/auth.js`
localStorage-based auth helpers:
- `getSurgeonId()` / `getSurgeonName()` — read from localStorage
- `loginSurgeon(id, name)` — set both values
- `logoutSurgeon()` — remove both values
- `isLoggedIn()` — returns `true` if `surgeon_id` exists in localStorage

### `lib/helpers.js`
Shared formatting utilities:
- `formatFee(paise)` — paise to `₹X,XX,XXX` string
- `formatDate(d)` — ISO date to Indian locale `"Mon, 30 Mar 2026"`
- `REQUEST_TYPE_STYLES` — color/label config for emergency/opd/reconsult/elective badges
- `getTimeRemaining(expiresAt)` — countdown string `"HH:MM:SS"` or `"Expired"`

### `lib/supabase.js`
Supabase client for file uploads to `surgeon-documents` bucket.

---

## Auth Flow

1. Surgeon navigates to `/login`.
2. Enters 10-digit phone number + password.
3. Frontend calls `POST /api/surgeons/login` with phone and password.
4. Backend looks up `surgeon_auth` by phone, verifies password with bcrypt.
   - If no auth record exists: auto-creates surgeon + auth record with provided password.
   - Returns `surgeon_id`, `name`, `phone`, `verified`, `available`.
5. Frontend stores via `loginSurgeon()`:
   - `surgeon_id` — UUID, used for all subsequent API calls
   - `surgeon_name` — display name
6. `ProtectedRoute` in `App.js` calls `isLoggedIn()` which checks `localStorage.getItem('surgeon_id')`.
7. **Logout:** `logoutSurgeon()` clears both localStorage keys, navigates to `/login`.

**No JWT/session tokens.** Auth is entirely localStorage-based, identical to hospital-web's pattern.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Backend API URL. No default — must be set. |
| `REACT_APP_SUPABASE_URL` | Yes | Supabase project API URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase publishable anon key |

Create a `.env` file in `doctor-web/` root:
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

**Important:** Unlike hospital-web, `REACT_APP_API_URL` has no fallback default. If not set, all API calls will fail (the variable will be `undefined`).

---

## How to Run Locally

```bash
cd doctor-web
npm install
npm start          # CRA dev server on port 3003
npm run build      # Production build to build/
```

Requires the backend running (set `REACT_APP_API_URL` to backend URL).

No test suites or linters are configured.

---

## Deployment

- **Platform:** Render.com (Static Site)
- **Root directory:** `doctor-web`
- **Build command:** `npm run build`
- **Publish directory:** `build`
- **Production URL:** `https://doctor.surgeononcall.in`

---

## Known Quirks

1. **`_redirects` file required for client-side routing.** The file `public/_redirects` contains `/*    /index.html    200` which is essential for Render static site deployments. Without it, direct navigation to any route other than `/` (e.g. `/home`, `/profile`) returns a 404 because Render tries to serve a static file at that path. This file is copied into `build/` during `npm run build` and tells Render's CDN to serve `index.html` for all paths, letting React Router handle routing client-side.

2. **`REACT_APP_API_URL` has no default.** Hospital-web falls back to `http://localhost:5000` if the env var is missing. Doctor-web does not — the API URL is read directly as `process.env.REACT_APP_API_URL` with no fallback. All API calls break if it's not set.

3. **Earnings page field mismatch.** The Earnings page reads `res.data.cases` but the backend endpoint `GET /api/surgeons/:id/earnings` returns `{ earnings: [...] }`. This means the page may render an empty table. The data is being sent, just under a different key.

4. **Signup uploads go to `surgeon-documents` bucket.** The Signup page and Profile page both upload files to a Supabase Storage bucket named `surgeon-documents`. This bucket must exist in Supabase and should be configured for public access (or signed URLs must be used).

5. **No Supabase direct DB queries.** Unlike hospital-web which queries Supabase tables directly, doctor-web exclusively uses the backend API for all data reads/writes. Supabase is only used for file storage uploads.

6. **Layout fetches surgeon profile on every route change.** The Layout component fetches `GET /api/surgeons/:id` on mount for the verification banner check. Since Layout wraps every protected route, this fires on every navigation. The surgeon profile is not shared between Layout and child pages — Home and Profile each fetch it independently.

7. **Home page polls every 60 seconds.** The auto-refresh interval is fixed at 60s regardless of request type. Unlike hospital-web's CaseDetail (10s for emergency), there's no emergency-aware polling.

8. **Request type badge on Earnings page is missing.** The Earnings table doesn't show the request type (emergency/OPD/etc.) — only procedure, date, and fee data.

9. **Fee calculation inconsistency.** RequestDetail shows 10% commission (combining both hospital and surgeon commission), while the backend's surgeon earnings endpoint calculates 5% commission. The Earnings page re-computes 10% client-side, which may show different numbers than what the backend returns.

10. **Document upload on Profile saves immediately.** Each file upload triggers an immediate `PATCH /api/surgeons/:id/profile` call to save the URL. This is separate from the "Save Changes" button which saves all other form fields. If the user uploads a file but doesn't click Save, the file URL is persisted but other unsaved changes are lost.
