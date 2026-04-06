# Backend — CLAUDE.md

## What the Backend Does

Express.js 5 REST API for the Surgeon on Call platform. Connects hospitals with surgeons for surgery case assignments. Handles:

- Hospital and surgeon registration, login, profile management
- Surgery case creation, matching, cascade notifications, and lifecycle
- Admin dashboard: platform stats, case overrides, surgeon/hospital verification
- Notifications via WhatsApp (primary) and SMS (fallback) through Twilio
- Email notifications to admin team for new registrations (Gmail SMTP)
- Daily cron job: 9:00 AM IST surgery reminders to confirmed surgeons
- Specialty lookup table for dropdown menus across all frontends

No auth middleware — all routes are currently open. Auth is handled client-side via Supabase. Custom auth tables (`surgeon_auth`, `hospital_auth`) store bcrypt password hashes.

---

## API Endpoints

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns `{ status: 'ok', service, timestamp }`. No DB query. Used by load balancers and uptime monitors. |

---

### Cases (`/api/cases`)

#### `POST /api/cases/draft`
Create a minimal draft case with a surgeon pre-assigned (from "Book This Surgeon" flow).

**Request body:**
```json
{
  "hospital_id": "uuid (required)",
  "pre_assigned_surgeon": "uuid (required)",
  "request_type": "elective|emergency|opd|reconsult (optional, default: elective)",
  "fee": "integer paise (optional)",
  "fee_min": "integer paise (optional, deprecated)",
  "fee_max": "integer paise (optional, deprecated)"
}
```
**Response:** `201` — `{ message, case }`. Case created with `status: 'draft'`, all clinical fields null.

**Tables:** reads `hospitals`, `surgeons`; writes `cases`.

---

#### `POST /api/cases`
Create a full surgery case and run the matching algorithm.

**Request body:**
```json
{
  "hospital_id": "uuid (required)",
  "procedure": "string (required)",
  "specialty_required": "string (required)",
  "surgery_date": "YYYY-MM-DD (required)",
  "surgery_time": "HH:MM (required)",
  "duration_hours": "number (required for non-OPD)",
  "ot_number": "string (required for non-OPD)",
  "patient_name": "string (required for non-OPD)",
  "patient_age": "number (required for non-OPD)",
  "patient_gender": "string (required for non-OPD)",
  "fee": "integer paise (required)",
  "request_type": "elective|emergency|opd|reconsult (optional, default: elective)",
  "parent_case_id": "uuid (optional, links re-consult to originating case)",
  "fee_min": "integer paise (optional, deprecated)",
  "fee_max": "integer paise (optional, deprecated)",
  "notes": "string (optional)",
  "documents": "JSONB array (optional)"
}
```
**Response:** `201` — `{ message, case, matched_surgeons[], skip_shortlist }`.

- `skip_shortlist` is `true` for emergency cases or same-day OPD.
- `matched_surgeons` returned sorted by match score.
- Hospital must be verified (`403` if not).
- OPD cases have fewer required fields (no patient details, duration, ot_number).

**Tables:** reads `hospitals`, `surgeons`, `cases` (conflict check); writes `cases`.

---

#### `GET /api/cases`
List all cases for a hospital.

**Query params:** `hospital_id` (required)

**Response:** `200` — `{ cases[] }` ordered by `created_at` descending.

**Tables:** reads `cases`.

---

#### `GET /api/cases/:id/matches`
Get matched surgeons for an existing case (re-runs matching algorithm).

**Response:** `200` — `{ matched_surgeons[] }` sorted by match score.

**Tables:** reads `cases`, `hospitals`, `surgeons`, `cases` (conflict check).

---

#### `POST /api/cases/:caseId/recommend`
Surgeon submits a surgery recommendation for a re-consult case.

**Request body:**
```json
{
  "surgeon_id": "uuid (required)",
  "suggested_procedure": "string (required)",
  "recommendation_notes": "string (optional)",
  "urgency": "elective|urgent (required)"
}
```
**Response:** `201` — `{ message, recommendation }`.

- Only allowed on `reconsult` cases.
- Only the confirmed surgeon on the case can recommend.

**Tables:** reads `cases`; writes `surgery_recommendations`.

---

#### `GET /api/cases/:caseId/recommendation`
Get the most recent surgery recommendation for a case.

**Response:** `200` — `{ recommendation }` (with joined surgeon details) or `{ recommendation: null }`.

**Tables:** reads `surgery_recommendations`, `surgeons`.

---

#### `PATCH /api/cases/:caseId/convert`
Hospital converts a re-consult case into a full surgery case.

**Request body:**
```json
{
  "hospital_id": "uuid (required)"
}
```
**Response:** `200` — `{ message, case_id }`.

- Sets case status to `converted`.
- Sets pending recommendation status to `accepted`.
- Only allowed on `reconsult` cases belonging to the requesting hospital.

**Tables:** reads/writes `cases`; writes `surgery_recommendations`.

---

#### `GET /api/cases/:id`
Get a single case with full details and priority list.

**Response:** `200` — `{ case, priority_list[], skip_shortlist }`.

- Priority list includes joined surgeon details (name, specialty, experience, rating, city).

**Tables:** reads `cases`, `case_priority_list`, `surgeons`.

---

#### `PATCH /api/cases/:id/priority`
Save the hospital's surgeon priority list and trigger cascade/broadcast.

**Request body:**
```json
{
  "priority_list": ["surgeon_uuid_1", "surgeon_uuid_2", "..."] 
}
```
**Response:** `200` — `{ message, case_id }`.

- Deletes any existing priority list rows for this case.
- Inserts new rows with `status: 'pending'`.
- Sets case status to `cascading`.
- **Emergency cases:** broadcasts to ALL surgeons simultaneously (no cascade).
- **Normal cases:** triggers cascade — notifies first surgeon, 2hr expiry window.

**Tables:** reads `cases`; writes/deletes `case_priority_list`; writes `cases`.

---

#### `PATCH /api/cases/:id`
Update any fields on a case (partial update). Used for filling in draft cases and editing active cases.

**Request body:** Any subset of case fields:
```json
{
  "procedure": "string",
  "specialty_required": "string",
  "surgery_date": "YYYY-MM-DD",
  "surgery_time": "HH:MM",
  "duration_hours": "number",
  "ot_number": "string",
  "patient_name": "string",
  "patient_age": "number",
  "patient_gender": "string",
  "fee": "integer paise",
  "request_type": "elective|emergency|opd|reconsult",
  "fee_min": "integer paise",
  "fee_max": "integer paise",
  "notes": "string",
  "documents": "JSONB array",
  "status": "string"
}
```
**Response:** `200` — `{ message, case }`.

**Tables:** reads/writes `cases`.

---

#### `DELETE /api/cases/:id`
Delete a case and its priority list entries.

**Response:** `200` — `{ message }`.

**Tables:** deletes from `case_priority_list`, `cases`.

---

#### `GET /api/cases/:caseId/surgeon-view`
Case detail for the surgeon mobile app. Hospital address hidden until surgeon accepts.

**Query params:** `surgeon_id` (optional — used to fetch expiry time)

**Response:** `200` — `{ case }` with `hospital_city`, `hospital_name` (only if confirmed), `expires_at`.

**Tables:** reads `cases`, `hospitals`, `case_priority_list`.

---

#### `PATCH /api/cases/:caseId/accept`
Surgeon accepts a case.

**Request body:**
```json
{
  "surgeon_id": "uuid (required)"
}
```
**Response:** `200` — `{ message }`.

- Returns `409` if case already confirmed by another surgeon.
- Updates priority list row to `accepted`.
- Sets case `status: 'confirmed'` and `confirmed_surgeon_id`.
- Cancels all other notified/pending surgeons for this case.

**Tables:** reads/writes `cases`, `case_priority_list`.

---

#### `PATCH /api/cases/:caseId/decline`
Surgeon declines a case.

**Request body:**
```json
{
  "surgeon_id": "uuid (required)"
}
```
**Response:** `200` — `{ message }`.

- Updates priority list row to `declined`.
- **Emergency cases:** checks if any surgeons are still notified; marks unfilled if none remain.
- **Normal cases:** triggers cascade to next surgeon.

**Tables:** reads/writes `cases`, `case_priority_list`.

---

### Surgeons (`/api/surgeons`)

#### `POST /api/surgeons/register`
New surgeon self-registration from the Doctor Web signup form.

**Request body:**
```json
{
  "name": "string (required)",
  "phone": "10-digit string (required)",
  "mci_number": "string (required)",
  "city": "string (required)",
  "email": "string (optional)",
  "specialty": "string[] (optional)",
  "preferred_lat": "number (optional)",
  "preferred_lng": "number (optional)",
  "preferred_location_name": "string (optional)",
  "experience_years": "number (optional)",
  "ug_college": "string (optional)",
  "pg_college": "string (optional)",
  "bio": "string (optional)",
  "communication_preference": "whatsapp|call|email (optional)",
  "practice_type": "independent|hospital_attached|both (optional)",
  "hospital_affiliations": "string (optional)",
  "open_to_teleconsultation": "boolean (optional)",
  "open_to_emergency": "boolean (optional)",
  "open_to_physical_visits": "boolean (optional)",
  "key_procedures": "string[] (optional)",
  "declaration_agreed": "boolean (must be true if provided)",
  "highest_qualification": "string (optional)",
  "avg_hourly_rate": "integer paise (optional)",
  "profile_photo_url": "string (optional)",
  "certificate_url": "string (optional)",
  "government_id_url": "string (optional)",
  "resume_url": "string (optional)"
}
```
**Response:** `201` — `{ message, surgeon_id, name, phone, verified }`.

- Creates surgeon with `verified: false` (admin must approve).
- Creates `surgeon_auth` record with default password `'password'` (bcrypt hashed).
- Sends admin email notification.
- Returns `409` if phone number already exists.

**Tables:** reads `surgeons`; writes `surgeons`, `surgeon_auth`.

---

#### `POST /api/surgeons/login`
Phone + password login for the surgeon mobile app.

**Request body:**
```json
{
  "phone": "10-digit string (required)",
  "password": "string (required)"
}
```
**Response:** `200` — `{ message, surgeon_id, name, phone, verified, available }`.

- If auth record exists: verifies password with bcrypt.
- If no auth record but surgeon exists: creates auth record with provided password.
- If no surgeon exists: auto-creates surgeon + auth record (placeholder profile).
- Returns `201` for newly created accounts.

**Tables:** reads `surgeon_auth`, `surgeons`; may write `surgeons`, `surgeon_auth`.

---

#### `GET /api/surgeons/:id`
Returns full surgeon profile.

**Response:** `200` — `{ surgeon }` with fields: id, name, phone, email, specialty, mci_number, experience_years, city, bio, verified, available, rating, total_cases, status, ug_college, pg_college, profile_photo_url, certificate_url, created_at.

**Tables:** reads `surgeons`.

---

#### `PATCH /api/surgeons/:id/availability`
Toggle surgeon availability.

**Request body:**
```json
{
  "available": "boolean (required)"
}
```
**Response:** `200` — `{ message, available }`.

**Tables:** writes `surgeons`.

---

#### `GET /api/surgeons/:id/requests`
Returns incoming requests and upcoming cases for a surgeon.

**Response:** `200` — `{ incoming_requests[], upcoming_cases[] }`.

- `incoming_requests`: cases where surgeon is currently notified (not expired, case not yet confirmed).
- `upcoming_cases`: cases surgeon has accepted with future surgery dates (`status: confirmed|in_progress`).

**Tables:** reads `case_priority_list`, `cases`.

---

#### `GET /api/surgeons/:id/earnings`
Returns completed cases with earnings breakdown.

**Response:** `200` — `{ earnings[] }` where each entry has:
- `gross_fee` (fee_max in paise)
- `commission_amount` (5% platform commission)
- `net_payout` (95% to surgeon)
- `payment_status`

**Tables:** reads `cases`.

---

#### `PATCH /api/surgeons/:id/profile`
Update surgeon profile (partial update). Accepts all profile fields.

**Request body:** Any subset of surgeon fields (name, city, bio, specialty, experience_years, mci_number, ug_college, pg_college, highest_qualification, avg_hourly_rate, preferred_lat/lng/location_name, communication_preference, practice_type, hospital_affiliations, open_to_teleconsultation, open_to_emergency, open_to_physical_visits, key_procedures, declaration_agreed, profile_photo_url, certificate_url, government_id_url, resume_url).

**Response:** `200` — `{ message, surgeon }`.

**Tables:** writes `surgeons`.

---

#### `PATCH /api/surgeons/:id/password`
Change surgeon password (requires current password).

**Request body:**
```json
{
  "current_password": "string (required)",
  "new_password": "string (required, min 4 chars)"
}
```
**Response:** `200` — `{ message }`.

**Tables:** reads/writes `surgeon_auth`.

---

### Hospitals (`/api/hospitals`)

#### `POST /api/hospitals/register`
New hospital self-registration.

**Request body:**
```json
{
  "name": "string (required)",
  "address": "string (required)",
  "city": "string (required)",
  "contact_name": "string (required)",
  "contact_email": "string (required)",
  "contact_phone": "string (required)",
  "password": "string (required)",
  "lat": "number (optional)",
  "lng": "number (optional)",
  "bed_count": "number (optional)",
  "hospital_type": "string (optional)"
}
```
**Response:** `201` — `{ message, hospital: { id, name, city, status } }`.

- Creates hospital with `verified: false` (admin must verify before case posting).
- Creates `hospital_auth` record (email + bcrypt hash).
- Sends admin email notification.
- Returns `409` if email already exists.

**Tables:** reads `hospitals`; writes `hospitals`, `hospital_auth`.

---

#### `POST /api/hospitals/login`
Email + password login for hospital web app.

**Request body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```
**Response:** `200` — `{ message, hospital_id, hospital_name, contact_email, verified }`.

**Tables:** reads `hospital_auth`, `hospitals`.

---

#### `PATCH /api/hospitals/:id/password`
Change hospital password (requires current password).

**Request body:**
```json
{
  "current_password": "string (required)",
  "new_password": "string (required, min 6 chars)"
}
```
**Response:** `200` — `{ message }`.

**Tables:** reads/writes `hospital_auth`.

---

### Admin (`/api/admin`)

#### `GET /api/admin/stats`
Platform-wide statistics and per-hospital breakdown.

**Response:** `200`:
```json
{
  "stats": {
    "total_cases": 0,
    "active_cases": 0,
    "completed_cases": 0,
    "unfilled_cases": 0,
    "fill_rate": 0,
    "total_surgeons": 0,
    "available_now": 0,
    "total_hospitals": 0
  },
  "hospital_breakdown": [
    { "id": "", "name": "", "verified": true, "total": 0, "active": 0, "cascading": 0, "confirmed": 0, "completed": 0, "unfilled": 0 }
  ]
}
```
- `active_cases` = active + cascading combined.
- `fill_rate` = confirmed / (confirmed + unfilled + cascading) as percentage.
- `total_surgeons` counts only verified surgeons.

**Tables:** reads `cases`, `surgeons`, `hospitals`.

---

#### `GET /api/admin/cases`
All cases across all hospitals with hospital and confirmed surgeon details.

**Query params:**
- `status` (optional): `active|cascading|confirmed|completed|unfilled|all`
- `search` (optional): text search on procedure, patient_name, case_number, hospital name

**Response:** `200` — `{ cases[] }` with joined `hospitals` and `surgeons` data.

**Tables:** reads `cases`, `hospitals`, `surgeons`.

---

#### `GET /api/admin/surgeons`
All surgeons (verified and unverified).

**Query params:**
- `available` (optional): `true|false`
- `search` (optional): text search on name, city, specialty

**Response:** `200` — `{ surgeons[] }`.

**Tables:** reads `surgeons`.

---

#### `GET /api/admin/hospitals`
All hospitals with case count breakdown.

**Response:** `200` — `{ hospitals[] }` where each hospital has `case_counts: { total, active, confirmed, completed, unfilled, cascading }`.

**Tables:** reads `hospitals`, `cases`.

---

#### `GET /api/admin/earnings`
Earnings/commission report for confirmed and completed cases.

**Response:** `200`:
```json
{
  "earnings": [
    { "...case fields", "surgeon_fee": 0, "hospital_commission": 0, "surgeon_commission": 0, "total_commission": 0 }
  ],
  "summary": {
    "total_cases": 0, "completed_cases": 0, "confirmed_cases": 0,
    "total_commission": 0, "hospital_commission": 0, "surgeon_commission": 0
  }
}
```
- Platform commission: 5% from hospital + 5% from surgeon = 10% total.

**Tables:** reads `cases`, `hospitals`, `surgeons`.

---

#### `PATCH /api/admin/cases/:id/override`
Manually assign a surgeon to a case, bypassing the cascade.

**Request body:**
```json
{
  "surgeon_id": "uuid (required)",
  "admin_note": "string (optional)"
}
```
**Response:** `200` — `{ message, case_id, surgeon_id, surgeon_name }`.

- Only works on cases with status: `active`, `cascading`, or `unfilled`.
- Cancels all pending/notified rows in priority list.
- Upserts an `accepted` row for the chosen surgeon (priority_order: 99).
- Sets case to `confirmed`.

**Tables:** reads `cases`, `surgeons`; writes `case_priority_list`, `cases`.

---

#### `PATCH /api/admin/cases/:id/status`
Update case status.

**Request body:**
```json
{
  "status": "completed|cancelled|active|cascading (required)"
}
```
**Response:** `200` — `{ message, case }`.

**Tables:** writes `cases`.

---

#### `PATCH /api/admin/cases/:id/reassign`
Reassign a confirmed case to a different surgeon.

**Request body:**
```json
{
  "surgeon_id": "uuid (required)"
}
```
**Response:** `200` — `{ message, case }`.

- Sets `confirmed_surgeon_id` and status to `confirmed`.
- Marks previous accepted surgeon as `overridden` in priority list.
- Inserts/updates new surgeon's priority list row as `accepted`.

**Tables:** reads/writes `cases`, `case_priority_list`.

---

#### `POST /api/admin/cases/:id/cascade`
Manually trigger cascade on a stuck case.

**Response:** `200` — `{ message }` with notified surgeon name.

- Resets any `notified` rows back to `pending`.
- Sets case status to `cascading`.
- Finds next pending surgeon and notifies them (2hr expiry).
- Returns `400` if no pending surgeons remain.

**Tables:** reads/writes `case_priority_list`, `cases`; reads `surgeons`.

---

#### `PATCH /api/admin/surgeons/:id/verify`
Verify or reject a surgeon registration.

**Request body:**
```json
{
  "action": "verify|reject (required)"
}
```
**Response:** `200` — `{ message, surgeon }`.

- `verify`: sets `verified: true`, `status: 'active'`, `available: true`.
- `reject`: sets `verified: false`, `status: 'suspended'`, `available: false`.

**Tables:** writes `surgeons`.

---

#### `PATCH /api/admin/surgeons/:id/suspend`
Suspend or reactivate a surgeon.

**Request body:**
```json
{
  "action": "suspend|reactivate (required)"
}
```
**Response:** `200` — `{ message, surgeon }`.

**Tables:** writes `surgeons`.

---

#### `PATCH /api/admin/surgeons/:id/profile`
Edit any surgeon's profile fields from the admin dashboard.

**Request body:** Any subset of: name, phone, email, city, specialty, experience_years, mci_number, bio, hospital_affiliations, avg_hourly_rate, available, profile_photo_url, certificate_url, government_id_url, resume_url.

**Response:** `200` — `{ message, surgeon }`.

**Tables:** writes `surgeons`.

---

#### `PATCH /api/admin/hospitals/:id/verify`
Verify or unverify a hospital.

**Request body:**
```json
{
  "verified": "boolean (required)"
}
```
**Response:** `200` — `{ message, hospital }`.

**Tables:** writes `hospitals`.

---

### Specialties (`/api/specialties`)

#### `GET /api/specialties`
List all active specialties, ordered alphabetically.

**Response:** `200` — `{ specialties[] }`.

**Tables:** reads `specialties`.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `cases` | Surgery cases — id, case_number, hospital_id, procedure, specialty_required, surgery_date, surgery_time, duration_hours, ot_number, patient_name, patient_age, patient_gender, fee, fee_min, fee_max, request_type, parent_case_id, notes, documents (JSONB), status, confirmed_surgeon_id, payment_status, created_at, updated_at |
| `surgeons` | Surgeon profiles — id, name, phone, email, specialty (text[]), mci_number, experience_years, city, bio, verified, available, rating, total_cases, status, ug_college, pg_college, highest_qualification, avg_hourly_rate, preferred_lat, preferred_lng, preferred_location_name, travel_radius_km, communication_preference, practice_type, hospital_affiliations, open_to_teleconsultation, open_to_emergency, open_to_physical_visits, key_procedures, declaration_agreed, profile_photo_url, certificate_url, government_id_url, resume_url, created_at, updated_at |
| `surgeon_auth` | Surgeon login credentials — id, surgeon_id, phone, password_hash |
| `hospitals` | Hospital profiles — id, name, address, city, lat, lng, bed_count, hospital_type, contact_name, contact_email, contact_phone, verified, status, created_at |
| `hospital_auth` | Hospital login credentials — id, hospital_id, email, password_hash |
| `case_priority_list` | Cascade tracking — id, case_id, surgeon_id, priority_order, status (pending/notified/accepted/declined/cancelled/overridden), notified_at, expires_at, responded_at. Unique constraint on (case_id, surgeon_id). |
| `specialties` | Lookup table — id, name, active (boolean) |
| `surgery_recommendations` | Surgeon recommendations for re-consult cases — id, case_id, surgeon_id, suggested_procedure, recommendation_notes, urgency (elective/urgent), status (pending/accepted), created_at |

### Case status values
`draft` → `active` → `cascading` → `confirmed` → `completed`  
Alternative paths: `cascading` → `unfilled`, `active` → `cancelled`, `reconsult` → `converted`

### Case request types
`elective` (default), `emergency`, `opd`, `reconsult`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `SUPABASE_URL` | Yes | Supabase project API URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase publishable anon key |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio phone number for SMS |
| `TWILIO_WHATSAPP_NUMBER` | Yes | Twilio WhatsApp sandbox number |
| `GMAIL_USER` | No* | Gmail address for admin notifications |
| `GMAIL_APP_PASSWORD` | No* | Gmail App Password (16-char) |

*Email gracefully degrades in dev — logs emails instead of sending if GMAIL vars are missing.

---

## Cascade Notification System

The cascade is the core mechanism for assigning surgeons to cases.

### Normal (elective/OPD/reconsult) flow:
1. Hospital creates a case → matching algorithm returns ranked surgeons.
2. Hospital orders surgeons into a priority list and submits it (`PATCH /priority`).
3. Priority list rows are inserted with `status: 'pending'`.
4. **`triggerCascade()`** is called — finds the first pending surgeon, sets their row to `notified` with a 2-hour expiry window, and sends a WhatsApp/SMS notification.
5. If surgeon **accepts**: case status → `confirmed`, all other pending/notified surgeons cancelled.
6. If surgeon **declines**: their row → `declined`, `triggerCascade()` called again for the next surgeon.
7. If surgeon **doesn't respond** (expiry): handled by the next interaction (currently no automated expiry check — relies on decline or admin intervention).
8. If **no surgeons remain**: case status → `unfilled`.

### Emergency flow:
1. Hospital creates an emergency case → matching returns ALL matching surgeons (no limit).
2. Hospital submits priority list → `broadcastEmergency()` called instead of cascade.
3. ALL surgeons in the list are notified simultaneously (all rows set to `notified` at once).
4. **First surgeon to accept wins** — all other notified/pending rows are cancelled.
5. If all decline and none remain notified → case marked `unfilled`.

### Notification channels:
- **Primary:** WhatsApp via Twilio sandbox (`whatsapp:+91XXXXXXXXXX` format)
- **Fallback:** SMS via Twilio (if WhatsApp send fails)
- Phone numbers converted to E.164 format (`+91` prefix for Indian 10-digit numbers)

### Admin overrides:
- `PATCH /admin/cases/:id/override` — bypasses cascade, directly assigns a surgeon.
- `PATCH /admin/cases/:id/reassign` — changes the confirmed surgeon.
- `POST /admin/cases/:id/cascade` — manually triggers next cascade step on a stuck case.

---

## Matching Algorithm

Located in `src/routes/cases.js` — the `matchSurgeons()` function.

### Input
- `specialty_required` — the surgical specialty needed
- `surgery_date` — to check for scheduling conflicts
- `surgery_time` — passed through (not currently used in scoring)
- `hospital_lat`, `hospital_lng` — hospital coordinates for distance calculation
- `limit` — max results (default 7; 0 = unlimited for emergencies)

### Step 1: Filter candidates
Query all surgeons where:
- `verified = true`
- `available = true`
- `status = 'active'`
- `specialty` array contains the required specialty (Supabase `cs` filter)

### Step 2: Conflict check
For each candidate, check if they have a confirmed/in_progress case on the same surgery date. Exclude surgeons with conflicts.

### Step 3: Distance filtering
- If both hospital and surgeon have lat/lng: calculate haversine distance.
  - Exclude if distance > surgeon's `travel_radius_km` (default: 10km).
- If either has no coordinates: include with neutral proximity score.

### Step 4: Scoring (max 120 points)
| Component | Max Points | Formula |
|-----------|-----------|---------|
| Proximity | 50 | `max(0, 50 - (distance_km * 2))`. Neutral 25 if no coordinates. |
| Rating | 50 | `rating * 10` |
| Platform experience | 20 | `min(total_cases / 10, 20)` |

### Output
Surgeons sorted by `match_score` descending, capped at `limit`. Each includes `match_score` and `distance_km`.

---

## How to Run Locally

```bash
cd backend
npm install
```

Create `.env` file with required environment variables (see table above).

```bash
npm start    # runs: node src/index.js (port 5000)
```

No test suites or linters are configured.

---

## Deployment

- **Platform:** Render.com (Web Service)
- **Region:** Singapore
- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `node src/index.js`
- **Environment:** Node.js
- **Config:** defined in `render.yaml` at repo root
