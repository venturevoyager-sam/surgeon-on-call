# CLAUDE.md — Surgeon on Call

Medical staffing platform connecting Indian hospitals with on-demand surgeons. Hospitals post surgery requests, platform matches by specialty + distance + rating, cascade notifies surgeons via WhatsApp/SMS until one accepts. Company: Surgeon on Call (OPC) Pvt Ltd. Stage: pilot.

## Services

| Service | Dir | Tech | Port | Purpose |
|---------|-----|------|------|---------|
| Backend API | `backend/` | Express.js 5, CommonJS | 5000 | REST API, matching, cascade, notifications |
| Hospital Web | `hospital-web/` | React 19 CRA | 3000 | Post cases, browse surgeons, track status |
| Doctor Web | `doctor-web/` | React 19 CRA | 3003 | Accept/decline cases, earnings, profile |
| Admin Web | `admin-web/` | React 19 CRA | 3001 | Stats, overrides, verification |
| Onboarding Web | `onboarding-web/` | React 19 CRA | 3002 | Placeholder — not built |
| Surgeon Mobile | `surgeon-mobile/` | RN 0.81, Expo 54 | Expo | Android app, same as doctor-web |

Per-service docs: [backend/](backend/CLAUDE.md) | [hospital-web/](hospital-web/CLAUDE.md) | [doctor-web/](doctor-web/CLAUDE.md) | [surgeon-mobile/](surgeon-mobile/CLAUDE.md)

## Data Flow

- All apps → backend API via Axios
- hospital-web, admin-web also query Supabase tables directly for some reads
- doctor-web, surgeon-mobile use Supabase for file storage uploads only
- No shared code layer — each app owns its own `lib/supabase.js`, `lib/config.js`

## Database — Supabase

- Project: `https://gqwfyjbzzzsvhcmvyumr.supabase.co`
- Tables: `cases`, `surgeons`, `surgeon_auth`, `hospitals`, `hospital_auth`, `case_priority_list`, `specialties`, `surgery_recommendations`
- Storage: `case-documents` (hospital uploads), `surgeon-documents` (surgeon uploads)
- Case lifecycle: `draft → active → cascading → confirmed → completed` | alt: `→ unfilled`, `→ cancelled`, `→ converted`
- Request types: `elective` (default), `emergency`, `opd`, `reconsult`

## Deployment — Render.com

Config: `render.yaml`. Backend region: Singapore. Env vars set in Render dashboard.

| Service | Render Name | URL |
|---------|-------------|-----|
| Backend | `surgeon-on-call-api` | `https://surgeon-on-call-api.onrender.com` |
| Hospital Web | `surgeon-on-call-hospital` | `https://surgeon-on-call-hospital.onrender.com` |
| Doctor Web | `surgeon-on-call-doctor` | `https://surgeon-on-call-doctor.onrender.com` |
| Admin Web | `surgeon-on-call-admin` | `https://surgeon-on-call-admin.onrender.com` |
| Surgeon Mobile | N/A | Sideloaded APK (Android only) |

All static sites: SPA rewrite `/* → /index.html`.

## Domains — `surgeononcall.in`

`surgeononcall.in` (onboarding) | `hospital.` | `doctor.` | `admin.` | `api.` (if configured)

## Dev Rules

- All JavaScript, no TypeScript. No shared packages. No tests/linters.
- Backend: CommonJS (`require`). Frontends: ES modules (`import`).
- No auth middleware on backend — all routes open. Auth is client-side only (localStorage / AsyncStorage).
- Custom auth tables (`surgeon_auth`, `hospital_auth`) with bcrypt. No JWT. No Supabase Auth.
- Hospital login: email + password. Surgeon login: phone + password (auto-creates on first login).
- Fees in **paise** (1/100 ₹). `fee: 7500000` = ₹75,000. New cases use `fee`; legacy uses `fee_min`/`fee_max`.
- Commission: 5% hospital + 5% surgeon = 10% total. Mobile shows 5%. Doctor-web shows 10%.
- Brand: `#E56717` (orange), `#CD4D00` (dark), `#FDF8F5` (bg), `#444444` (text), `#2C1A0E` (header). Font: DM Sans.

## Surgeon Mobile Critical Rules

- `App.js` MUST be in `surgeon-mobile/` root, NOT `src/`
- `expo-router` must NEVER be installed — uses React Navigation
- Expo SDK 54, RN 0.81 — do not upgrade without testing
- Local dev: phone connects via WiFi IP in `src/lib/config.js` (not localhost)

## Env Vars

- **Backend `.env`:** `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- **Web apps `.env`:** `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_API_URL`
- `REACT_APP_API_URL` defaults to `http://localhost:5000` in hospital-web. **No default in doctor-web** — breaks if unset.
- Surgeon mobile: no `.env` — hardcoded in `src/lib/config.js`

## Not Yet Built

- Twilio production WhatsApp (sandbox only, needs Meta-approved templates)
- Razorpay payments (no payment integration, `payment_status` set manually)
- GPS tracking (config exists, no implementation)
- Push notifications (polls every 60s, no FCM/APNs)
- Backend auth middleware (all routes open)
- Automated cascade expiry (2hr window not auto-enforced, needs decline or admin)
- Admin login (admin-web has no auth — fully open)
- iOS support (Android only)
- File cleanup (orphan files accumulate in Supabase Storage)
