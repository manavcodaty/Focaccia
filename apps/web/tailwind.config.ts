import type { Config } from "tailwindcss";

import { focacciaBrand } from "../../packages/shared/src/brand";

const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: focacciaBrand.background,
        border: focacciaBrand.border,
        card: focacciaBrand.card,
        primary: focacciaBrand.primary,
        secondary: focacciaBrand.secondary,
      },
    },
  },
} satisfies Config;

export default config;
