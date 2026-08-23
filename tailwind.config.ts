import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          blue: "#9bb8ff",
          blueDark: "#688df2",
          blueLight: "#e5eeff",
          purple: "#ebb3ff",
          purpleDark: "#c76ef3",
          purpleLight: "#fae8ff",
          orange: "#ffa842",
          orangeDark: "#e58619",
          orangeLight: "#ffedd5",
          bg: "#f4f6fb",
          card: "#ffffff",
          darkBg: "#0e1118",
          darkCard: "#171a23",
          darkPill: "#232836",
          black: "#111318",
        },
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
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
        '5xl': '40px',
      },
    },
  },
  plugins: [],
} satisfies Config;
