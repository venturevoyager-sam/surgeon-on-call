/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand:  { DEFAULT: '#E56717', dark: '#CD4D00', light: '#FDF8F5' },
        body:   '#444444',
        muted:  '#8B8B8B',
        warm:   '#E8E0D8',
        header: '#2C1A0E',
      },
      fontFamily: { sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
