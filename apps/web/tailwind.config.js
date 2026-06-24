/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Blinkit Brand Palette ────────────────────────────────────────
        blinkit: {
          yellow:   "#F7D108",   // Primary CTA – high-visibility grocery yellow
          "yellow-hover": "#E6C200", // Hover / darker shade
          "yellow-soft": "rgba(247, 209, 8, 0.12)", // Tinted backgrounds
          black:    "#121212",   // Core text & headers
          dark:     "#1A1A1A",   // Page background
          charcoal: "#222222",   // Card surfaces
          "card-border": "#2E2E2E", // Subtle card borders
          grey:     "#8A8A8A",   // Muted copy
          "grey-light": "#B0B0B0", // Secondary labels
        },
        // ─── Semantic Tokens (wired to Blinkit palette) ───────────────────
        primary:    "#F7D108",
        background: "#121212",
        foreground: "#F5F5F5",
        card:       "#1A1A1A",
        border:     "#2E2E2E",
        muted: {
          DEFAULT:    "#222222",
          foreground: "#8A8A8A",
        },
        // ─── Status Colours (kept neutral – no violet) ────────────────────
        success:  "#22C55E",
        warning:  "#F59E0B",
        error:    "#EF4444",
        info:     "#3B82F6",
      },
      fontFamily: {
        sans: ["Outfit", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "pulse-glow": { "0%, 100%": { boxShadow: "0 0 0 0 rgba(247, 209, 8, 0.4)" }, "50%": { boxShadow: "0 0 0 8px rgba(247, 209, 8, 0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
}
