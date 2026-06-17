import type { Config } from "tailwindcss";

/**
 * Kawaii Arcade theme.
 * All values map to CSS custom properties in `globals.css`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          1000: "var(--bg-1000)",
          900:  "var(--bg-900)",
          800:  "var(--bg-800)",
          700:  "var(--bg-700)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          2: "var(--paper-2)",
          3: "var(--paper-3)",
        },
        fg: {
          dark:       "var(--on-dark)",
          "dark-soft":"var(--on-dark-soft)",
          "dark-mute":"var(--on-dark-mute)",
          light:       "var(--on-light)",
          "light-soft":"var(--on-light-soft)",
          "light-mute":"var(--on-light-mute)",
        },
        line: {
          dark:     "var(--line-dark)",
          "dark-2": "var(--line-dark-2)",
          light:    "var(--line-light)",
          "light-2":"var(--line-light-2)",
        },
        pink: {
          300: "var(--pink-300)",
          400: "var(--pink-400)",
          500: "var(--pink-500)",
          600: "var(--pink-600)",
        },
        cyan: {
          300: "var(--cyan-300)",
          400: "var(--cyan-400)",
          500: "var(--cyan-500)",
        },
        violet: {
          300: "var(--violet-300)",
          400: "var(--violet-400)",
          500: "var(--violet-500)",
          600: "var(--violet-600)",
          700: "var(--violet-700)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans:    ["var(--font-body)"],
        /** Reserved for the JUDY SHOP hero wordmark only — see
         *  app/layout.tsx for the rationale. */
        hero:    ["var(--font-hero)"],
      },
      spacing: {
        s1: "var(--s-1)",
        s2: "var(--s-2)",
        s3: "var(--s-3)",
        s4: "var(--s-4)",
        s5: "var(--s-5)",
        s6: "var(--s-6)",
        s7: "var(--s-7)",
        s8: "var(--s-8)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      transitionTimingFunction: {
        out:    "var(--ease-out)",
        spring: "var(--ease-spring)",
      },
      transitionDuration: {
        fast: "180ms",
        base: "280ms",
        slow: "440ms",
      },
    },
  },
  plugins: [],
};

export default config;
