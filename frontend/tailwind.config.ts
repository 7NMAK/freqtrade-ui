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
        bg: {
          0: "#06060b",
          1: "#0c0c14",
          2: "#12121c",
          3: "#1a1a28",
        },
        border: {
          DEFAULT: "#1e1e30",
          hover: "#2e2e48",
        },
        text: {
          0: "#f0f0f5",
          1: "#c0c0d0",
          2: "#808098",
          3: "#55556a",
        },
        accent: {
          DEFAULT: "#6366f1",
          dim: "#4f46e5",
          glow: "rgba(99,102,241,0.12)",
        },
        green: {
          DEFAULT: "#22c55e",
          dim: "#166534",
          bg: "rgba(34,197,94,0.08)",
        },
        red: {
          DEFAULT: "#ef4444",
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
        card: "10px",
        btn: "6px",
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
