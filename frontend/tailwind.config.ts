import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Avenir Next", "Avenir", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", "sans-serif"],
        mono: ["SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgb(17 24 39 / 0.04), 0 12px 32px rgb(17 24 39 / 0.045)",
      },
    },
  },
  plugins: [],
};

export default config;
