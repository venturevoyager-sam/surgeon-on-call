# Surgeon Mobile — CLAUDE.md

## What This App Does

React Native 0.81 + Expo 54 mobile app for surgeons to receive and respond to surgery case requests on their Android phones. This is the mobile counterpart to doctor-web — both serve the same user base with the same backend API, but this app is optimized for on-the-go use with native features (push-style polling, image picker, AsyncStorage session persistence).

**Users:** Verified surgeons registered on the Surgeon on Call platform. Unverified surgeons can log in but won't receive case requests.

**Platform:** Android only (pilot phase). Sideloaded APK — not on Google Play.

---

## Screens

### LoginScreen (`src/screens/LoginScreen.js`)
Phone + password login. Dark header background (`#2C1A0E`) with brand card.

**Fields:** 10-digit Indian mobile number (with +91 prefix display), password.

**API calls:**
- `POST /api/surgeons/login` — phone + password authentication (10s timeout)

**Behavior:** On success, calls `onLogin()` prop from App.js which saves session to AsyncStorage and sets `surgeonId` + `isLoggedIn` state. If no auth record exists for the phone, the backend auto-creates surgeon + auth record.

**DEV_MODE:** When `DEV_MODE = true` (hardcoded constant in the file), a "DEV: Skip Login" button appears at the bottom that calls `onLogin()` with `CONFIG.DEV_SURGEON_ID` and a hardcoded name/phone. This bypasses the API entirely.

**Hint text:** "New to the platform? Enter your phone and create a password to register automatically."

---

### HomeScreen (`src/screens/HomeScreen.js`)
Main dashboard. Shows surgeon profile header, availability toggle, incoming requests, and upcoming confirmed cases.

**Header section:**
- Profile photo (or initials avatar), greeting, surgeon name, primary specialty
- Availability toggle (Switch component) — green when available, grey when unavailable
- Stats row: Total Cases, Rating, Pending count

**Incoming Requests section:**
- Cards with amber urgency bar showing "Response needed" + countdown timer
- Sorted: emergency cases pinned to top, then by `notified_at` descending
- Shows: procedure, specialty, date, time, fee
- Tap navigates to `RequestDetail` screen

**Upcoming Cases section:**
- Cards with date badge (day/month), procedure, time, OT, fee
- Sorted: emergency first, then by `surgery_date` descending
- Tap navigates to `AcceptedCase` screen

**API calls:**
- `GET /api/surgeons/:id` — fetch surgeon profile (name, specialty, available, total_cases, rating, profile_photo_url)
- `GET /api/surgeons/:id/requests` — fetch `incoming_requests[]` and `upcoming_cases[]`
- `PATCH /api/surgeons/:id/availability` — toggle availability on/off

**Polling:** Auto-refreshes every 60 seconds via `setInterval`. Pull-to-refresh also supported via `RefreshControl`.

---

### RequestDetailScreen (`src/screens/RequestDetailScreen.js`)
Full case details for a pending request. Modal presentation (slides up over tabs).

**Receives:** `caseId` and `surgeonId` via `route.params`.

**Sections:**
- **Header:** Back button, "Surgery Request" title, countdown timer pill (orange, monospace font)
- **Surgery Details card:** Procedure, specialty, date, time, duration, OT, location (city only — "Revealed after acceptance")
- **Patient Details card:** Age, gender, clinical notes
- **Clinical Documents:** List of attached files (PDF/images) with tap-to-open via `Linking.openURL()`
- **Fee Breakdown card** (warm orange tint):
  - Offered Fee (gross)
  - Platform Commission (5%)
  - Net Payout (95% of gross)
- **Surgery Recommendation section** (reconsult cases only, when status = confirmed):
  - Loading state → checks for existing recommendation
  - If submitted: read-only summary (procedure, urgency, notes) with green "Submitted" badge
  - If not submitted: "Recommend Surgery" button → expandable form (suggested procedure, clinical notes, urgency elective/urgent)
- **Bottom action bar:** Decline (outlined red) + Accept Case (solid orange)

**API calls:**
- `GET /api/cases/:caseId/surgeon-view?surgeon_id=X` — fetch case details with hospital city only
- `PATCH /api/cases/:caseId/accept` — accept the case (with confirmation Alert)
- `PATCH /api/cases/:caseId/decline` — decline the case (with confirmation Alert, triggers cascade)
- `GET /api/cases/:caseId/recommendation` — fetch existing recommendation (reconsult cases only)
- `POST /api/cases/:caseId/recommend` — submit surgery recommendation (reconsult cases only)

**Fee display:** Shows 5% platform commission (surgeon's share). This differs from doctor-web which shows 10%.

**Behavior:** Accept navigates back via `navigation.goBack()` (returns to HomeScreen). Decline also goes back. Both show native Alert dialogs for confirmation and success/error feedback.

---

### AcceptedCaseScreen (`src/screens/AcceptedCaseScreen.js`)
Confirmed case details with full hospital information revealed. Modal presentation.

**Receives:** `caseId` via `route.params`.

**Sections:**
- **Header:** Back button, "Case Details" title, green "Confirmed" badge
- **Confirmed banner:** Green-tinted card with checkmark, surgery date/time
- **Surgery Details card:** Procedure (highlighted in orange), specialty, date, time, duration, OT, case number
- **Hospital card:** Hospital name (now revealed), city
- **Patient card:** Age, gender, notes
- **Fee Breakdown card:** Offered fee, platform fee (5%), net payout (orange accent row)
- **Contact note:** "Our associate will contact you 24 hours before..."

**API calls:**
- `GET /api/cases/:caseId/surgeon-view?surgeon_id=X` — fetch case with hospital name revealed

**Quirk:** Uses `CONFIG.DEV_SURGEON_ID` hardcoded for the `surgeon_id` param instead of the logged-in surgeon's ID. This is a bug — should use the actual `surgeonId` from session.

---

### EarningsScreen (`src/screens/EarningsScreen.js`)
Payment history and summary. Bottom tab screen.

**Summary cards row:** This Month (orange), All Time (dark brown), Pending (amber).

**Commission note:** "All amounts shown are after 5% platform commission deduction."

**Payment history:** Cards with procedure, date, status badge (Pending/Released/Disputed), and fee breakdown (gross, commission, net payout).

**API calls:**
- `GET /api/surgeons/:id/earnings` — fetch earnings data

**Quirk:** Uses `CONFIG.DEV_SURGEON_ID` hardcoded instead of the logged-in surgeon's ID. This means earnings always show DEV_SURGEON_ID's data regardless of who's logged in.

**Data handling:** Uses `response.data.earnings` (correct field name, unlike doctor-web which reads `.cases`). Computes this-month/all-time/pending summaries client-side using the backend-computed `net_payout` field.

---

### ProfileScreen (`src/screens/ProfileScreen.js`)
Surgeon profile editor with 3 tabs. Bottom tab screen.

**Header:** Tappable avatar (opens image picker), surgeon name, specialty list, verified/pending badge.

**Tabs:**
1. **Personal** — name, city, bio, experience years. Editable with "Save" button.
2. **Credentials** — specialty multi-select (from hardcoded `SPECIALTY_OPTIONS` list, NOT from API), MCI number, UG college, PG college. Editable with "Save" button.
3. **Documents** — profile photo upload, certificate upload via `expo-image-picker`.

**Password change:** Expandable form at bottom with current password, new password, confirm password.

**API calls:**
- `GET /api/surgeons/:id` — fetch current profile
- `PATCH /api/surgeons/:id/profile` — save personal or credentials fields (depends on active tab)
- `PATCH /api/surgeons/:id/profile` — save uploaded document URL (per-file, immediate)
- `PATCH /api/surgeons/:id/password` — change password

**Supabase direct calls:**
- `supabase.storage.from('surgeon-documents').upload()` — upload profile photo and certificate

**Quirk:** Specialty options are hardcoded in `SPECIALTY_OPTIONS` array (15 specialties) rather than fetched from `GET /api/specialties` like every other page in the platform. This can cause mismatches with the canonical specialty list in the database.

**Logout:** Alert confirmation dialog, then calls `onLogout()` prop from App.js which clears AsyncStorage and resets navigation to LoginScreen.

---

## Navigation Structure (`src/lib/navigation.js`)

```
NavigationContainer
└── Stack.Navigator (headerShown: false)
    ├── [Not logged in] → LoginScreen
    └── [Logged in]
        ├── MainTabs (Bottom Tab Navigator)
        │   ├── Home tab → HomeScreen (receives surgeonId prop)
        │   ├── Earnings tab → EarningsScreen
        │   └── Profile tab → ProfileScreen (receives surgeonId + onLogout props)
        ├── RequestDetail (modal presentation, receives caseId + surgeonId via route.params)
        └── AcceptedCase (modal presentation, receives caseId via route.params)
```

- Uses `@react-navigation/native`, `@react-navigation/stack`, `@react-navigation/bottom-tabs`
- Tab icons are emoji-based (`TabIcon` component)
- Tab bar: white background, active tint `#1A56A0` (blue), inactive `#94A3B8` (grey)
- `surgeonId` is passed as a prop from App.js → Navigation → MainTabs → individual screens

---

## Auth Flow

1. App starts → `App.js` checks AsyncStorage for `surgeon_session` key.
2. If found: parses JSON, restores `surgeon_id`, sets `isLoggedIn = true`, skips login.
3. If not found: shows LoginScreen.
4. Surgeon enters phone + password → `POST /api/surgeons/login`.
5. On success: `handleLogin()` saves `{ surgeon_id, name, phone }` to AsyncStorage under `surgeon_session` key, sets `surgeonId` state and `isLoggedIn = true`.
6. Navigation component switches from auth stack to main stack.
7. **Logout:** ProfileScreen calls `onLogout()` → `handleLogout()` in App.js removes `surgeon_session` from AsyncStorage, resets state.

**DEV_MODE:** `LoginScreen.js` has `const DEV_MODE = true;` which shows a skip button that calls `onLogin()` with `CONFIG.DEV_SURGEON_ID`. This bypasses the API call entirely. **HomeScreen.js** also has `const DEV_MODE = true;` but doesn't appear to use it for any branching logic.

**Session persistence:** AsyncStorage survives app restarts. The surgeon stays logged in until they explicitly log out or clear app data.

---

## Config File (`src/lib/config.js`)

All configuration values are centralized in a single `CONFIG` object:

| Key | Value | Description |
|-----|-------|-------------|
| `API_URL` | `'https://surgeon-on-call-api.onrender.com'` | Backend API URL. Commented-out alternative: `'http://192.168.1.44:5000'` for local dev. |
| `SUPABASE_URL` | `'https://gqwfyjbzzzsvhcmvyumr.supabase.co'` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `'sb_publishable_xSDJqDrwZf3n...'` | Supabase publishable anon key |
| `CASCADE_TIMEOUT_HOURS` | `2` | How long a surgeon has to respond before cascade moves on |
| `GPS_INTERVAL_MS` | `120000` | GPS tracking interval (2 minutes) — referenced in config but GPS tracking not implemented in screens |
| `DEV_SURGEON_ID` | `'3c4cefd8-677a-4039-b6fd-aec8653fc910'` | Test surgeon ID (Dr. Arjun Mehta) for DEV_MODE skip login |

**No `.env` file.** All values are hardcoded in `config.js`. To change the API URL for local development, edit the `API_URL` line directly.

---

## How to Run Locally with Expo Go

```bash
cd surgeon-mobile
npm install
npx expo start               # Expo dev server
npx expo start --android     # Android directly
```

**Local backend connection:**
1. Run backend on your computer: `cd backend && npm start` (port 5000)
2. Find your computer's WiFi IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Edit `src/lib/config.js` — uncomment/change the local `API_URL`:
   ```js
   API_URL: 'http://192.168.1.44:5000',  // your WiFi IP
   ```
4. Phone and computer must be on the **same WiFi network**
5. Open Expo Go on Android phone, scan QR code from terminal

**Important:** `localhost` and `127.0.0.1` will NOT work from a physical device — the phone needs the computer's actual network IP.

---

## Critical Rules

### 1. App.js MUST be in the project root, not src/
`App.js` lives at `surgeon-mobile/App.js`, not `surgeon-mobile/src/App.js`. This is required by Expo's entry point resolution. The file uses `registerRootComponent(App)` from `expo` to register itself. Moving it into `src/` will break the app.

### 2. expo-router must NEVER be installed
This app uses `@react-navigation/native` + `@react-navigation/stack` + `@react-navigation/bottom-tabs` for navigation. Installing `expo-router` will conflict with this setup and break navigation entirely. Expo Router expects a file-based routing structure in `app/` directory which does not exist.

### 3. Expo SDK 54, React Native 0.81
The app targets Expo SDK 54 with React Native 0.81.x. Do not upgrade Expo SDK without testing all screens. Key dependencies pinned to SDK 54:
- `expo` ~54
- `react-native` 0.81.x
- `@react-navigation/native` 7.x
- `@react-navigation/stack` 7.x
- `@react-navigation/bottom-tabs` 7.x
- `expo-image-picker` (for profile photo/certificate uploads)
- `@react-native-async-storage/async-storage` (session persistence)
- `@supabase/supabase-js` (file storage uploads)
- `react-native-url-polyfill` (required by Supabase in React Native)

### 4. Phone connects to backend via WiFi IP
During local development, the Android phone connects to the backend via the computer's WiFi IP address (e.g. `192.168.1.44:5000`). The IP is hardcoded in `src/lib/config.js`. If the IP changes (different WiFi network, DHCP renewal), update `config.js`. Production uses the Render URL.

---

## Deployment

- **Method:** Sideloaded APK (not on Google Play Store)
- **Platform:** Android only for pilot phase
- **Build:** `npx expo build:android` or `eas build --platform android`
- **Distribution:** APK shared directly with pilot surgeons
- **Backend:** Points to `https://surgeon-on-call-api.onrender.com` in production config

---

## Known Quirks

1. **AcceptedCaseScreen and EarningsScreen use `CONFIG.DEV_SURGEON_ID` instead of the logged-in surgeon's ID.** AcceptedCaseScreen passes `CONFIG.DEV_SURGEON_ID` as `surgeon_id` param to the API. EarningsScreen fetches earnings for `CONFIG.DEV_SURGEON_ID`. Both should use the actual `surgeonId` from the session. This means in production, these screens show the wrong surgeon's data.

2. **ProfileScreen uses hardcoded specialty list.** The `SPECIALTY_OPTIONS` array has 15 specialties hardcoded in the file, while every other page (doctor-web Signup, Profile, hospital-web NewRequest, etc.) fetches from `GET /api/specialties`. This causes specialty name mismatches (e.g. "Orthopedic Surgery" vs "Orthopaedics").

3. **DEV_MODE is hardcoded `true` in LoginScreen and HomeScreen.** The skip-login button is always visible. There's no environment-based toggle — to hide it, you must manually set `const DEV_MODE = false;` in the file.

4. **Fee commission inconsistency across the platform.** RequestDetailScreen shows 5% platform commission (surgeon sees 95% payout). Doctor-web's RequestDetail shows 10% commission (surgeon sees 90%). The backend's earnings endpoint computes 5% commission. The actual commission model is ambiguous.

5. **HomeScreen shows `fee_max` for incoming requests, not `fee`.** The fee display uses `req.fee_max` instead of `req.fee || req.fee_max`. Since the migration introduced a single `fee` field, older cases use `fee_max` and newer cases use `fee`. The fallback should check both.

6. **GPS tracking is configured but not implemented.** `CONFIG.GPS_INTERVAL_MS` is set to 120000 (2 minutes) but no screen reads this value or implements location tracking. The Supabase client comment mentions "realtime subscriptions (GPS tracking)" but no realtime code exists.

7. **No registration flow in mobile app.** Unlike doctor-web which has a full 6-section Signup page, the mobile app has no registration screen. The login hint says "Enter your phone and create a password to register automatically" — the backend auto-creates accounts on first login. Full profile setup must be done via doctor-web.

8. **Supabase client configured with auth persistence.** `src/lib/supabase.js` configures the Supabase client with `auth.storage: AsyncStorage` and `persistSession: true`. However, Supabase Auth is not actually used for authentication — it's only used for file storage uploads. The auth config is unnecessary but harmless.

9. **No push notifications.** The app polls every 60 seconds for new requests. There are no push notifications configured — surgeons must have the app open to see incoming requests.

10. **Tab bar active color is blue (`#1A56A0`), not brand orange.** The bottom tab navigator uses blue for the active tab, which doesn't match the brand orange (`#E56717`) used everywhere else in the app.
