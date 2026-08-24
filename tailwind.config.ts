import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm coral — primary actions, key accents.
        brand: {
          50: "#FFF4F1",
          100: "#FFE6DF",
          200: "#FFCCBE",
          300: "#FFA98F",
          400: "#FF8563",
          500: "#FF6B47",
          600: "#F04E28",
          700: "#CC3B1A",
          800: "#A32F16",
          900: "#7C2611",
        },
        // Warm teal — secondary accents, links, "mastered"/complete states.
        accent: {
          50: "#EFFBF9",
          100: "#D7F3EE",
          200: "#B0E7DD",
          300: "#7ED7C8",
          400: "#47BFAC",
          500: "#22A390",
          600: "#178273",
          700: "#14675C",
          800: "#14524A",
          900: "#12433D",
        },
        // Warm ivory — page backgrounds, replacing cool slate-50.
        cream: {
          50: "#FDFAF6",
          100: "#FBF3EA",
          200: "#F5E6D3",
          300: "#EAD3B3",
          400: "#DBB889",
          500: "#C89A63",
          600: "#A87B49",
          700: "#87613B",
          800: "#6D4E33",
          900: "#5A412C",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: [
          "var(--font-heading)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
