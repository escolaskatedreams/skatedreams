import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1F4FB0",
          "primary-strong": "#143A8A",
          sky: "#C9E0EA",
          "sky-soft": "#E8F2F7",
          cloud: "#FFFFFF",
          ink: "#0F1B3D",
          muted: "#6B7A99",
          success: "#3DBE7A",
          warn: "#F5B935",
          danger: "#E14B5A",
        },
      },
      fontFamily: {
        display: ["Boldonse", "system-ui", "sans-serif"],
        body: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "soft": "0 1px 2px 0 rgba(15, 27, 61, 0.04), 0 1px 3px 0 rgba(15, 27, 61, 0.06)",
        "soft-md": "0 4px 12px -2px rgba(15, 27, 61, 0.08), 0 2px 4px -1px rgba(15, 27, 61, 0.06)",
        "soft-lg": "0 12px 32px -8px rgba(15, 27, 61, 0.12), 0 4px 8px -2px rgba(15, 27, 61, 0.08)",
        "soft-xl": "0 24px 48px -12px rgba(15, 27, 61, 0.18), 0 8px 16px -4px rgba(15, 27, 61, 0.10)",
        "glow": "0 0 0 1px rgba(31, 79, 176, 0.10), 0 4px 16px -4px rgba(31, 79, 176, 0.20)",
      },
      backgroundImage: {
        "atmosphere": "radial-gradient(ellipse at top right, rgba(31, 79, 176, 0.06) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(201, 224, 234, 0.40) 0%, transparent 60%)",
        "cloud-gradient": "linear-gradient(135deg, #E8F2F7 0%, #C9E0EA 100%)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-press": "scalePress 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeInUp: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        scalePress: { "0%": { transform: "scale(1)" }, "50%": { transform: "scale(0.96)" }, "100%": { transform: "scale(1)" } },
      },
    },
  },
} satisfies Config;
