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
        display: ["Archivo", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "JetBrains Mono", "monospace"],
      },
    },
  },
} satisfies Config;
