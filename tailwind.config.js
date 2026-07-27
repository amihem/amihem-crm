/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2340",       // deep indigo-dye — primary
        ink2: "#2D3A6B",      // lighter indigo for hover/active
        paper: "#F7F5EF",     // warm bolt-paper background
        panel: "#FFFFFF",
        thread: "#C9862D",    // mustard/dye accent — warnings, highlights
        loom: "#2F6E5D",      // muted teal-green — success/approved
        rust: "#B4453A",      // rejected/lost/overdue
        line: "#E4E0D6",      // hairline borders
        muted: "#6B7280",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}

