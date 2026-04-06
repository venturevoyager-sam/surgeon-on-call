# Surgeon Mobile

- React Native 0.81, Expo SDK 54. Android only, sideloaded APK.
- Auth: phone+password → `POST /api/surgeons/login` → AsyncStorage `surgeon_session` (persists across restarts)
- App.js in root (NOT src/). Uses `registerRootComponent()`.
- Supabase used ONLY for file storage uploads (bucket: `surgeon-documents`).
- Run: `cd surgeon-mobile && npm install && npx expo start --android`
- Deploy: `eas build --platform android` → APK distributed directly

## Critical Rules

- **App.js MUST stay in project root** — Expo entry point resolution requires it
- **NEVER install expo-router** — conflicts with React Navigation setup
- **Expo SDK 54, RN 0.81** — do not upgrade without full testing
- **Local dev:** WiFi IP in `src/lib/config.js` (not localhost). Phone + computer on same network.

## Config — `src/lib/config.js` (no .env)

| Key | Value |
|-----|-------|
| `API_URL` | `https://surgeon-on-call-api.onrender.com` (swap to `http://192.168.x.x:5000` for local) |
| `SUPABASE_URL` | `https://gqwfyjbzzzsvhcmvyumr.supabase.co` |
| `SUPABASE_ANON_KEY` | hardcoded publishable key |
| `CASCADE_TIMEOUT_HOURS` | `2` |
| `GPS_INTERVAL_MS` | `120000` (not implemented) |
| `DEV_SURGEON_ID` | `3c4cefd8-677a-4039-b6fd-aec8653fc910` |

## Navigation — `src/lib/navigation.js`

- Auth stack: LoginScreen
- Main stack: bottom tabs (Home, Earnings, Profile) + modal screens (RequestDetail, AcceptedCase)
- `surgeonId` passed as prop from App.js → Navigation → screens
- Tab bar active color: `#1A56A0` (blue — not brand orange)

## Screens

| Screen | File | API Calls | Notes |
|--------|------|-----------|-------|
| LoginScreen | `screens/LoginScreen.js` | `POST /api/surgeons/login` | DEV_MODE=true shows skip button with DEV_SURGEON_ID |
| HomeScreen | `screens/HomeScreen.js` | `GET /api/surgeons/:id`, `GET /api/surgeons/:id/requests`, `PATCH /api/surgeons/:id/availability` | 60s polling + pull-to-refresh, emergency-first sort |
| RequestDetailScreen | `screens/RequestDetailScreen.js` | `GET /api/cases/:id/surgeon-view`, `PATCH /api/cases/:id/accept`, `PATCH /api/cases/:id/decline`, `GET /api/cases/:id/recommendation`, `POST /api/cases/:id/recommend` | modal, countdown timer, documents via Linking.openURL, 5% commission, reconsult recommendation form |
| AcceptedCaseScreen | `screens/AcceptedCaseScreen.js` | `GET /api/cases/:id/surgeon-view` | **BUG: uses CONFIG.DEV_SURGEON_ID** not logged-in ID |
| EarningsScreen | `screens/EarningsScreen.js` | `GET /api/surgeons/:id/earnings` | **BUG: uses CONFIG.DEV_SURGEON_ID** not logged-in ID |
| ProfileScreen | `screens/ProfileScreen.js` | `GET /api/surgeons/:id`, `PATCH /api/surgeons/:id/profile`, `PATCH /api/surgeons/:id/password`, Supabase storage uploads | 3 tabs (personal/credentials/documents), **hardcoded specialty list** (not from API), expo-image-picker |

## Quirks

- AcceptedCaseScreen + EarningsScreen hardcode `CONFIG.DEV_SURGEON_ID` — show wrong surgeon's data
- ProfileScreen specialty list hardcoded (15 items) vs API-fetched everywhere else — name mismatches
- DEV_MODE=true hardcoded in LoginScreen + HomeScreen — skip button always visible
- Fee shows 5% commission (mobile) vs 10% (doctor-web) — inconsistent
- HomeScreen uses `req.fee_max` not `req.fee || req.fee_max` — misses new fee field
- No registration screen — auto-creates on first login, full setup via doctor-web
- GPS tracking configured but not implemented
- No push notifications — 60s polling only
