/**
 * ONBOARDING LANDING PAGE — Surgeon on Call
 * Company: Vaidhya Healthcare Pvt Ltd
 *
 * Single-page landing that routes visitors to the appropriate app:
 *   - Doctors  → doctor-web (port 3001)
 *   - Hospitals → hospital-web (port 3000)
 *
 * No React Router needed — this is one static page with external links.
 *
 * Brand colors:
 *   Primary orange : #E56717
 *   Hover orange   : #CD4D00
 *   Background     : #FDF8F5
 *   Body text      : #444444
 *   Muted text     : #8B8B8B
 *   Borders        : #E8E0D8
 *   Dark header    : #2C1A0E
 */

import './index.css';

// ── EXTERNAL APP URLS ────────────────────────────────────────────────────────
// In production these would be real domain names; in dev they're localhost ports.
const DOCTOR_URL   = 'http://localhost:3003';
const HOSPITAL_URL = 'http://localhost:3000';

export default function App() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#FDF8F5', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
    >

      {/* ════════════════════════════════════════════════════════════════════════
          HEADER
          Warm dark bar with brand logo text
      ════════════════════════════════════════════════════════════════════════ */}
      <header
        className="px-6 py-5 flex items-center justify-between"
        style={{ backgroundColor: '#2C1A0E' }}
      >
        {/* Logo text — "Surgeon" in white, "on Call" in brand orange */}
        <h1 className="text-xl font-extrabold tracking-tight">
          <span style={{ color: '#FFFFFF' }}>Surgeon </span>
          <span style={{ color: '#E56717' }}>on Call</span>
        </h1>

        {/* Subtle company name on the right */}
        <span className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Vaidhya Healthcare Pvt Ltd
        </span>
      </header>


      {/* ════════════════════════════════════════════════════════════════════════
          HERO SECTION
          Tagline + brief description of the platform
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="text-center px-6 pt-16 pb-10 max-w-3xl mx-auto">

        {/* Main tagline */}
        <h2
          className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight"
          style={{ color: '#444444' }}
        >
          On-demand surgical staffing for{' '}
          <span style={{ color: '#E56717' }}>hospitals</span> and{' '}
          <span style={{ color: '#E56717' }}>surgeons</span>
        </h2>

        {/* Platform description */}
        <p
          className="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
          style={{ color: '#8B8B8B' }}
        >
          Surgeon on Call connects hospitals that need specialist surgeons with
          verified doctors available for on-demand procedures. Post a surgery
          request, get matched with the right surgeon, and confirm — all within
          hours, not days.
        </p>
      </section>


      {/* ════════════════════════════════════════════════════════════════════════
          ROLE SELECTION CARDS
          Two large cards side by side (stack vertically on mobile).
          Each card links to the appropriate app.
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="flex-1 px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── DOCTOR CARD ────────────────────────────────────────────────── */}
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center text-center transition-shadow hover:shadow-lg"
            style={{ border: '1px solid #E8E0D8' }}
          >
            {/* Icon — stethoscope emoji in a brand-colored circle */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-5"
              style={{ backgroundColor: '#FFF7F0' }}
            >
              🩺
            </div>

            {/* Card title */}
            <h3
              className="text-xl font-bold mb-3"
              style={{ color: '#444444' }}
            >
              I am a Doctor
            </h3>

            {/* Description */}
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: '#8B8B8B' }}
            >
              Join our verified surgeon network and receive surgery
              requests from hospitals near you. Set your availability,
              accept cases, and grow your practice.
            </p>

            {/* CTA button — navigates to doctor-web */}
            <a
              href={DOCTOR_URL}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm
                transition-colors duration-150 text-center inline-block"
              style={{ backgroundColor: '#E56717' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#CD4D00'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E56717'}
            >
              Register / Login →
            </a>
          </div>


          {/* ── HOSPITAL CARD ──────────────────────────────────────────────── */}
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center text-center transition-shadow hover:shadow-lg"
            style={{ border: '1px solid #E8E0D8' }}
          >
            {/* Icon — hospital emoji in a brand-colored circle */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-5"
              style={{ backgroundColor: '#FFF7F0' }}
            >
              🏥
            </div>

            {/* Card title */}
            <h3
              className="text-xl font-bold mb-3"
              style={{ color: '#444444' }}
            >
              I am a Hospital
            </h3>

            {/* Description */}
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: '#8B8B8B' }}
            >
              Post surgery requests and get matched with verified surgeons
              instantly. Manage cases, track responses, and confirm
              bookings — all from one dashboard.
            </p>

            {/* CTA button — navigates to hospital-web */}
            <a
              href={HOSPITAL_URL}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm
                transition-colors duration-150 text-center inline-block"
              style={{ backgroundColor: '#E56717' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#CD4D00'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E56717'}
            >
              Register / Login →
            </a>
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════════
          FOOTER
          Simple copyright line
      ════════════════════════════════════════════════════════════════════════ */}
      <footer
        className="px-6 py-5 text-center text-xs"
        style={{ borderTop: '1px solid #E8E0D8', color: '#8B8B8B' }}
      >
        © 2026 Vaidhya Healthcare Pvt Ltd. All rights reserved.
      </footer>

    </div>
  );
}
