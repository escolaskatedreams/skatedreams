import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF5A1F",
          dark: "#0F1115",
          light: "#FAFAF7",
          accent: "#3DDC84",
          warn: "#FFC93C",
          danger: "#E63946",
          muted: "#6B7280",
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
