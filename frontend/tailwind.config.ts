import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accentBase: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        borderBase: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // ─── V1 Backward Compatibility Map ───
        bg: {
          0: "var(--background)",
          1: "var(--card)",
          2: "var(--muted)",
          3: "var(--popover)",
        },
        border: {
          DEFAULT: "var(--border)",
          hover: "var(--ring)",
        },
        text: {
          0: "var(--foreground)",
          1: "var(--foreground)",
          2: "var(--muted-foreground)",
          3: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--primary)",
          dim: "var(--primary)",
          glow: "rgba(99,102,241,0.12)",
        },
        green: {
          DEFAULT: "#22c55e",
          dim: "#166534",
          bg: "rgba(34,197,94,0.08)",
        },
        red: {
          DEFAULT: "var(--destructive)",
          dim: "#991b1b",
          bg: "rgba(239,68,68,0.08)",
        },
        amber: {
          DEFAULT: "#f59e0b",
          dim: "#92400e",
          bg: "rgba(245,158,11,0.08)",
        },
        cyan: "#06b6d4",
        purple: "#a855f7",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": "10px",
        xs: "11px",
        sm: "12px",
        base: "13px",
        md: "14px",
        lg: "16px",
        xl: "22px",
      },
      borderRadius: {
        card: "var(--radius)",
        btn: "calc(var(--radius) - 2px)",
      },
      spacing: {
        sidebar: "240px",
        header: "56px",
      },
    },
  },
  plugins: [],
};
export default config;
