// surgeon-on-call/surgeon-mobile/src/lib/config.js
//
// CENTRAL CONFIGURATION FILE
// All config values for the surgeon mobile app live here.
// If you need to change an API URL, Supabase key, or any setting,
// this is the only file you need to edit.

const CONFIG = {

  // ── API SERVER ─────────────────────────────────────────────────────────────
  // This is your computer's local WiFi IP address.
  // The phone and computer must be on the SAME WiFi network.
  // If the app can't reach the backend, run `ipconfig` on your computer
  // and update this IP to match your current WiFi IPv4 address.
  API_URL: 'http://192.168.1.44:5000',

  // ── SUPABASE ───────────────────────────────────────────────────────────────
  // Your Supabase project credentials.
  // Find these at: supabase.com → your project → Settings → API
  // NEVER commit real keys to GitHub — but these are the anon/public keys
  // so they are safe to use on the frontend.
  SUPABASE_URL: 'https://gqwfyjbzzzsvhcmvyumr.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_xSDJqDrwZf3nH3u9j14A7w_b7CNoWh1',

  // ── APP SETTINGS ───────────────────────────────────────────────────────────
  // How long a surgeon has to respond before the cascade moves to the next surgeon
  CASCADE_TIMEOUT_HOURS: 2,

  // How often the app sends the surgeon's GPS location to the server on surgery day
  // 120000 milliseconds = 2 minutes
  GPS_INTERVAL_MS: 120000,

  // ── TEST DATA (DEV MODE ONLY) ──────────────────────────────────────────────
  // When DEV_MODE = true in App.js, the app pretends this surgeon is logged in.
  // This is Dr. Arjun Mehta's ID from our Supabase test data.
  DEV_SURGEON_ID: '3c4cefd8-677a-4039-b6fd-aec8653fc910',

};

// Export so other files can import and use these values
export default CONFIG;