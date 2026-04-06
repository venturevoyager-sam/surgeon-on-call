# Surgeon on Call — Root

- Medical staffing platform: hospitals post surgery requests → matching algorithm → cascade WhatsApp/SMS notifications → surgeon accepts
- Company: Surgeon on Call (OPC) Pvt Ltd. Stage: pilot.
- All JavaScript, no TypeScript. No shared code layer. No tests/linters.

## Services

| Service | Dir | Tech | Port |
|---------|-----|------|------|
| Backend API | `backend/` | Express.js 5, CommonJS | 5000 |
| Hospital Web | `hospital-web/` | React 19 CRA | 3000 |
| Doctor Web | `doctor-web/` | React 19 CRA | 3003 |
| Admin Web | `admin-web/` | React 19 CRA | 3001 |
| Onboarding Web | `onboarding-web/` | React 19 CRA | 3002 |
| Surgeon Mobile | `surgeon-mobile/` | RN 0.81, Expo 54 | Expo |

## Database — Supabase `https://gqwfyjbzzzsvhcmvyumr.supabase.co`

- Tables: `cases`, `surgeons`, `surgeon_auth`, `hospitals`, `hospital_auth`, `case_priority_list`, `specialties`, `surgery_recommendations`
- Storage buckets: `case-documents`, `surgeon-documents`
- Case lifecycle: `draft → active → cascading → confirmed → completed` | `→ unfilled` | `→ cancelled` | `→ converted`
- Request types: `elective` (default), `emergency`, `opd`, `reconsult`

## Deployment — Render.com (`render.yaml`)

| Service | Render Name | URL |
|---------|-------------|-----|
| Backend | `surgeon-on-call-api` | `https://surgeon-on-call-api.onrender.com` |
| Hospital | `surgeon-on-call-hospital` | `https://surgeon-on-call-hospital.onrender.com` |
| Doctor | `surgeon-on-call-doctor` | `https://surgeon-on-call-doctor.onrender.com` |
| Admin | `surgeon-on-call-admin` | `https://surgeon-on-call-admin.onrender.com` |
| Mobile | N/A | Sideloaded APK, Android only |

- Domains: `surgeononcall.in` | `hospital.` | `doctor.` | `admin.`
- All static sites: SPA rewrite `/* → /index.html`

## Auth

- No backend auth middleware — all routes open
- Custom bcrypt auth tables (`surgeon_auth`, `hospital_auth`). No JWT. No Supabase Auth.
- Hospital: email + password. Surgeon: phone + password (auto-creates on first login).
- Client-side gate: localStorage (web) / AsyncStorage (mobile)

## Fees

- Stored in **paise** (1/100 ₹). New cases: `fee` field. Legacy: `fee_min`/`fee_max`.
- Commission: 5% hospital + 5% surgeon = 10%. Mobile shows 5%. Doctor-web shows 10%.

## Brand

- `#E56717` orange, `#CD4D00` dark, `#FDF8F5` bg, `#444444` text, `#2C1A0E` header. Font: DM Sans.

## Env Vars

- **Backend:** `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- **Web apps:** `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_API_URL` (defaults `localhost:5000` in hospital-web; **no default in doctor-web**)
- **Surgeon mobile:** no `.env` — hardcoded in `src/lib/config.js`

## Surgeon Mobile Critical Rules

- `App.js` MUST be in `surgeon-mobile/` root, NOT `src/`
- `expo-router` must NEVER be installed — uses React Navigation
- Expo SDK 54, RN 0.81 — do not upgrade without testing
- Local dev: WiFi IP in `src/lib/config.js` (not localhost)

## Not Yet Built

- Twilio production WhatsApp (sandbox only)
- Razorpay payments (`payment_status` manual)
- GPS tracking, push notifications, backend auth middleware, automated cascade expiry
- Admin login (fully open), iOS support, file cleanup
