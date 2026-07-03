/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0b0c", // near-black base
          soft: "#14161a", // inputs / subtle fills
          panel: "#0e0f12", // sidebar / rails
          elev: "#171a1f", // modals / elevated cards
        },
        line: "#23262d", // hairline borders
        brand: {
          DEFAULT: "#22e06b", // vivid green
          soft: "#6af2a3", // lighter green for text/links
          dim: "#16a34a", // darker green for hovers
          ink: "#06140c", // near-black text to sit on green
        },
        muted: "#828a95",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 10px 40px -12px rgba(34, 224, 107, 0.35)",
        card: "0 20px 60px -20px rgba(0, 0, 0, 0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        glow: {
          "0%, 100%": {
            boxShadow:
              "0 0 40px -14px rgba(34,224,107,0.45), 0 0 0 1px rgba(34,224,107,0.25), inset 0 0 24px -18px rgba(34,224,107,0.5)",
          },
          "50%": {
            boxShadow:
              "0 0 78px -8px rgba(34,224,107,0.7), 0 0 0 1px rgba(34,224,107,0.45), inset 0 0 30px -16px rgba(34,224,107,0.7)",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        glow: "glow 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
