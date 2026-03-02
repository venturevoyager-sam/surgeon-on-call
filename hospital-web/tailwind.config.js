/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tell Tailwind which files to scan for CSS classes
  // It only includes CSS that is actually used — keeps the file size small
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}