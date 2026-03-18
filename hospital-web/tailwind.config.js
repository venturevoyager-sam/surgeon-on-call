/** @type {import('tailwindcss').Config} */

// ── SURGEON ON CALL — TAILWIND CONFIG ──────────────────────────────────────────
// Brand colors are registered here so you can use them as Tailwind classes:
//   bg-brand         → #E56717 (primary orange)
//   bg-brand-dark    → #CD4D00 (hover / pressed state)
//   bg-brand-light   → #FDF8F5 (warm page background)
//   text-body        → #444444
//   text-muted       → #8B8B8B
//   border-warm      → #E8E0D8

module.exports = {
  // Tell Tailwind which files to scan — only includes CSS that is actually used
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {

      // ── BRAND COLORS ────────────────────────────────────────────────────────
      colors: {
        brand: {
          DEFAULT: '#E56717',   // primary — buttons, active states, links
          dark:    '#CD4D00',   // hover / pressed
          light:   '#FDF8F5',   // warm page background (replaces cold gray-50)
        },
        body:    '#444444',     // main body text
        muted:   '#8B8B8B',     // labels, placeholders, secondary text
        warm:    '#E8E0D8',     // borders and dividers (warm, not cold gray)
      },

      // ── FONT FAMILY ─────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

    },
  },

  plugins: [],
};