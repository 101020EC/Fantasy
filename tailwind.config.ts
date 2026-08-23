import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fpl: {
          purple: "#38003c",
          darkPurple: "#240026",
          green: "#00ff87",
          darkGreen: "#02894b",
          cyan: "#04f5ff",
          pink: "#e90052",
          card: "#1e0021",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
