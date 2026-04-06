# Hospital Web — CLAUDE.md

## What This App Does

React 19 CRA app for hospital staff (SPOCs — Single Points of Contact) to manage surgery case requests on the Surgeon on Call platform. This is the primary interface for hospitals to:

- Post surgery requests (elective, emergency, OPD, re-consultation)
- Browse and directly book verified surgeons
- Set surgeon priority order for cascade notifications
- Track case status with live countdown timers and polling
- Edit case details, view confirmed surgeon info, delete cases
- Convert re-consultation recommendations into full surgery requests
- Upload clinical documents to Supabase Storage

**Users:** Hospital SPOC staff (admins/coordinators who manage surgeon assignments).

---

## Pages and Routes

### `/ ` — Login (`Login.js`)
**Public.** Split-panel layout: brand panel (left) + email/password form (right).

**API calls:**
- `POST /api/hospitals/login` — email + password authentication

**Behavior:** On success, stores `hospital_id` and `hospital_name` in localStorage, navigates to `/dashboard`. Links to `/register` for new hospitals.

---

### `/register` — Hospital Signup (`HospitalSignup.js`)
**Public.** Self-registration form for new hospitals.

**Fields:** Hospital name, address, city, bed count, hospital type (private/corporate/nursing home/clinic), contact name/email/phone, password. Includes an embedded Leaflet/OpenStreetMap with a draggable pin for lat/lng. "Use my current location" button uses browser Geolocation API.

**API calls:**
- `POST /api/hospitals/register` — creates hospital (verified: false) + hospital_auth record
- Nominatim reverse geocoding (`nominatim.openstreetmap.org/reverse`) for location name display

**Behavior:** Shows success page after registration. Hospital must be admin-verified before posting cases.

---

### `/dashboard` — Dashboard (`Dashboard.js`)
**Protected.** Main hub showing case stats and case list.

**Header nav:** Logo, Find a Surgeon button, "+ New Request" dropdown (Emergency, OPD, Re-consultation, Elective Surgery), notification bell (placeholder), hospital name, logout.

**Stats row:** Total Cases, Active Requests, Draft Cases, Completed.

**Tabs:** Active Cases (draft + active + cascading + confirmed + in_progress) | Past Cases (completed + cancelled + unfilled).

**Active case sorting:** Emergency cases first, then by soonest `expires_at` from the notified priority list row.

**Supabase direct queries:**
- `hospitals` table — fetch hospital record by ID from localStorage
- `cases` table with `case_priority_list` join — fetch all cases for this hospital

**Behavior:** Clicking a case row navigates to `/cases/:caseId`. Draft cases show "Complete Details" action linking to `/cases/:caseId/edit`. Logout clears localStorage and redirects to `/`.

---

### `/find-surgeon` — Find a Surgeon (`FindSurgeon.js`)
**Protected.** Browse all verified surgeons on the platform.

**Features:** Search by name/bio, filter by specialty and availability. Surgeon cards show photo, name, specialty, city, rating, experience, bio.

**API calls:**
- `GET /api/specialties` — populate specialty filter dropdown
- `POST /api/cases/draft` — "Book This Surgeon" creates a draft case with surgeon pre-assigned

**Supabase direct queries:**
- `hospitals` table — fetch current hospital
- `surgeons` table — fetch all verified, active surgeons ordered by rating

**Behavior:** After booking, navigates to `/cases/:caseId/edit` with surgeon passed via route state.

---

### `/cases/:caseId/edit` — Edit Case (`EditCase.js`)
**Protected.** Fill in clinical details for a draft case (created via Find a Surgeon flow).

**Fields:** Procedure, specialty (auto-populated from surgeon), surgery date/time, duration, OT number, patient name/age/gender, fee min/max, notes. Document upload (PDF/JPG/PNG, max 5 files, 5MB each) via Supabase Storage bucket `case-documents`.

**API calls:**
- `PATCH /api/cases/:id` — saves all fields, changes status from `draft` → `active`

**Supabase direct queries:**
- `hospitals` table — fetch current hospital
- `cases` table — fetch existing draft case to pre-fill form
- `surgeons` table — fetch pre-assigned surgeon if not passed via nav state
- `supabase.storage` — upload documents to `case-documents` bucket

**Behavior:** On save, navigates to `/cases/:caseId/shortlist`.

**Quirk:** EditCase still uses `fee_min`/`fee_max` fields (not the new single `fee` field). This is a legacy inconsistency — other request forms use single `fee`.

---

### `/new-request` — Elective Surgery Request (`NewRequest.js`)
**Protected.** Full surgery request form for elective (planned) procedures.

**Fields:** Procedure, specialty, surgery date/time, duration, OT number, patient name/age/gender, single flat fee (₹, converted to paise), clinical notes, document upload (same Supabase Storage pattern).

**API calls:**
- `GET /api/specialties` — populate specialty dropdown
- `POST /api/cases` — creates case with `request_type: 'elective'`

**Supabase direct queries:**
- `hospitals` table — fetch current hospital
- `supabase.storage` — upload documents

**Behavior:** On success, navigates to `/cases/:caseId/shortlist`. Supports pre-fill from re-consult conversion (via route state: `fromReconsult`, `suggested_procedure`, `patient_name`, etc.). When pre-filled from re-consult, passes `parent_case_id` and `recommending_surgeon_id` to the Shortlist page.

---

### `/emergency-request` — Emergency Request (`EmergencyRequest.js`)
**Protected.** Minimal emergency surgery form — speed over detail.

**Fields:** Procedure, specialty, patient name/age/gender, flat fee (₹), notes. No date/time/duration/OT/documents — defaults to today/now/2.5h/TBD.

**API calls:**
- `GET /api/specialties` — populate specialty dropdown
- `POST /api/cases` — creates case with `request_type: 'emergency'`
- `PATCH /api/cases/:id/priority` — immediately sends ALL matched surgeons as priority list (triggers broadcast, not cascade)

**Supabase direct queries:**
- `hospitals` table — fetch current hospital

**Behavior:** Skips shortlist entirely. After submission, auto-broadcasts to all matched surgeons, then navigates directly to `/cases/:caseId`. No surgeon limit for emergency matching.

---

### `/opd-request` — OPD Consultation Request (`OPDRequest.js`)
**Protected.** Outpatient consultation request.

**Fields:** Procedure/consultation name, specialty, date, time, flat fee (₹), notes. No duration/OT/patient details/documents.

**API calls:**
- `GET /api/specialties` — populate specialty dropdown
- `POST /api/cases` — creates case with `request_type: 'opd'`
- `PATCH /api/cases/:id/priority` — only if same-day (auto-cascade with top 5 surgeons)

**Supabase direct queries:**
- `hospitals` table — fetch current hospital

**Behavior:** Same-day OPD → auto-cascade top 5, navigate to `/cases/:caseId`. Future-dated OPD → navigate to `/cases/:caseId/shortlist`.

---

### `/reconsult-request` — Re-consultation Request (`ReconsultRequest.js`)
**Protected.** Follow-up consultation request.

**Fields:** Specialty, date, time, patient name/age/gender, reason for re-consultation (maps to `procedure` field), patient summary (maps to `notes`), flat fee (₹), additional notes.

**API calls:**
- `GET /api/specialties` — populate specialty dropdown
- `POST /api/cases` — creates case with `request_type: 'reconsult'`, procedure prefixed with "Re-consultation: "

**Supabase direct queries:**
- `hospitals` table — fetch current hospital

**Behavior:** Always navigates to `/cases/:caseId/shortlist` (never auto-cascades). Duration defaults to 1h, OT set to "OPD".

---

### `/cases/:caseId/shortlist` — Surgeon Shortlist (`Shortlist.js`)
**Protected.** After case creation, select and order surgeons for the cascade.

**Features:**
- Matched surgeons displayed as cards sorted by `avg_hourly_rate` ascending (cheapest first), then `match_score` as tiebreaker
- "Your go-to surgeons" section — top 3 most-booked surgeons for this hospital (derived from confirmed/completed case history)
- "Within budget range" badge for surgeons whose rate is within ±20% of case fee
- Click to add surgeon to priority list (max 5), drag/reorder
- Auto-adds recommending surgeon at position #1 when opened from re-consult conversion

**API calls:**
- `GET /api/cases/:id` — fetch case details
- `GET /api/cases/:id/matches` — fetch matched surgeons from matching algorithm
- `GET /api/cases?hospital_id=X` — fetch all hospital cases to compute go-to surgeons
- `PATCH /api/cases/:id/priority` — sends priority list, triggers cascade

**Behavior:** On "Send Requests", navigates to `/cases/:caseId` (CaseDetail).

---

### `/cases/:caseId` — Case Detail (`CaseDetail.js`)
**Protected.** Full case status view with live tracking.

**Features:**
- Case summary: procedure, date/time, patient, fee (paise → ₹)
- Request type badge: Emergency (red), OPD (blue), Re-consult (purple), Elective (grey)
- Priority cascade tracker: visual timeline of which surgeon was notified, accepted, declined
- Live countdown timer for currently notified surgeon's expiry
- Confirmed surgeon card when case is confirmed
- Edit modal: all case fields editable, saves via PATCH
- Delete case with confirmation dialog
- **Re-consult recommendation banner** (for reconsult cases): shows surgeon's surgery recommendation with "Create Surgery Request" button for conversion
- Auto-polling: 10s for emergency cases, 30s for all others

**API calls:**
- `GET /api/cases/:id` — fetch case + priority list (polled on interval)
- `GET /api/cases/:caseId/recommendation` — fetch surgery recommendation (reconsult cases only)
- `GET /api/specialties` — populate specialty dropdown in edit modal
- `PATCH /api/cases/:id` — save edits (fee sent as paise)
- `PATCH /api/cases/:caseId/convert` — convert re-consult to surgery case
- `DELETE /api/cases/:id` — delete case

**Behavior:** Convert re-consult navigates to `/new-request` with pre-fill state. Dismiss recommendation hides banner client-side only (no backend call).

---

## Auth Flow

1. Hospital navigates to `/` (Login page).
2. Enters email + password.
3. Frontend calls `POST /api/hospitals/login` with email and password.
4. Backend verifies against `hospital_auth` table (bcrypt compare).
5. On success, backend returns `hospital_id`, `hospital_name`, `contact_email`, `verified`.
6. Frontend stores in **localStorage**:
   - `hospital_id` — UUID, used for all subsequent API calls and Supabase queries
   - `hospital_name` — display name shown in header
7. `ProtectedRoute` component checks `localStorage.getItem('hospital_id')` — if missing, redirects to `/`.
8. **Logout:** clears `hospital_id` and `hospital_name` from localStorage, navigates to `/`.

**No JWT/session tokens.** Auth is entirely localStorage-based. The `hospital_id` in localStorage is trusted by the frontend to gate access. Backend API routes have no auth middleware — they are open.

**Supabase client** (`lib/supabase.js`) is used for direct database reads (hospitals, surgeons, cases tables) and file storage uploads, NOT for authentication. The Supabase anon key provides read access.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | No | Backend API URL. Defaults to `http://localhost:5000` if not set. Production: set to backend URL. |
| `REACT_APP_SUPABASE_URL` | Yes | Supabase project API URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase publishable anon key |

Create a `.env` file in `hospital-web/` root:
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

---

## How to Run Locally

```bash
cd hospital-web
npm install
npm start          # CRA dev server on port 3000
npm run build      # Production build to build/
```

Requires the backend running on port 5000 (or set `REACT_APP_API_URL`).

No test suites or linters are configured.

---

## Deployment

- **Platform:** Render.com (Static Site)
- **Root directory:** `hospital-web`
- **Build command:** `npm run build`
- **Publish directory:** `build`
- **Rewrite rules:** `/* → /index.html` (SPA client-side routing)
- **Production URL:** `https://hospital.surgeononcall.in`

---

## Known Quirks

1. **Dual data access pattern.** Some pages use Supabase JS client directly (Dashboard fetches cases via `supabase.from('cases')`), while others use Axios to the backend API (`GET /api/cases/:id`). This means the app depends on both the backend API URL and Supabase credentials.

2. **EditCase uses fee_min/fee_max, other forms use single fee.** The EditCase page (draft case flow from Find a Surgeon) still sends `fee_min` and `fee_max` to the backend. All other request forms (NewRequest, EmergencyRequest, OPDRequest, ReconsultRequest) send a single `fee` field. This is a migration inconsistency.

3. **No auth middleware on backend.** The `hospital_id` in localStorage is the only access control. Anyone with a valid hospital UUID could call API endpoints. The ProtectedRoute only checks localStorage presence, not validity.

4. **Notification bell is a placeholder.** The bell icon in the Dashboard header is not wired to any notification system.

5. **File upload doesn't clean up on removal.** When a user removes a file from the upload list, it's removed from the UI state but NOT deleted from Supabase Storage. Orphan files accumulate.

6. **Leaflet icon fix.** Both HospitalSignup and any map-using page need the Leaflet default icon workaround (deleting `_getIconUrl` and setting unpkg CDN URLs) because Webpack breaks Leaflet's internal icon path resolution.

7. **Polling doesn't stop.** CaseDetail polls the case endpoint on an interval (10s emergency / 30s normal) and never stops, even after the case is confirmed/completed.

8. **Dashboard fetches hospital via Supabase, not localStorage.** Despite having `hospital_name` in localStorage, Dashboard re-fetches the full hospital record from Supabase by ID on every mount.

9. **Recommendation dismiss is client-side only.** Dismissing a surgery recommendation on CaseDetail sets local state to null — if the user refreshes, the recommendation banner reappears.

10. **`FindSurgeon` page has nav header buttons.** "New Request" in the FindSurgeon header navigates to `/new-request` (elective only), while the Dashboard header has the full 4-type dropdown. Inconsistent access to request types.
