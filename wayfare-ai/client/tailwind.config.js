/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        "primary": "#0b50da",
        "primary-light": "#2563eb",
        "primary-dark": "#1e40af",
        "coral": "#ec5b13",
        "coral-light": "#f97316",
        "coral-dark": "#c2410c",

        // Background Colors
        "background-light": "#f5f6f8",
        "background-dark": "#101622",
        "bg-sand": "#fdfcfb",
        "bg-beige": "#e2d1c3",
        "bg-sky": "#a1c4fd",
        "bg-cyan": "#c2e9fb",

        // Ocean Blue
        "ocean": "#1a365d",
        "ocean-light": "#1e40af",

        // Gray/Slate scale
        "slate-50": "#f8fafc",
        "slate-100": "#f1f5f9",
        "slate-200": "#e2e8f0",
        "slate-300": "#cbd5e1",
        "slate-400": "#94a3b8",
        "slate-500": "#64748b",
        "slate-600": "#475569",
        "slate-700": "#334155",
        "slate-800": "#1e293b",
        "slate-900": "#0f172a",
      },
      fontFamily: {
        "display": ["Inter", "Public Sans", "sans-serif"],
        "sans": ["Inter", "Public Sans", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px"
      },
      boxShadow: {
        "glass": "0 10px 35px rgba(6, 26, 41, 0.16)",
        "glass-sm": "0 4px 20px rgba(6, 26, 41, 0.1)",
        "primary": "0 10px 30px rgba(11, 80, 218, 0.25)",
        "primary-lg": "0 20px 40px rgba(11, 80, 218, 0.3)",
        "coral": "0 10px 30px rgba(236, 91, 19, 0.25)",
        "coral-lg": "0 20px 40px rgba(236, 91, 19, 0.3)",
        "xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        "2xl": "0 35px 60px -15px rgba(0, 0, 0, 0.3)",
      },
      backgroundImage: {
        // Sand-Ocean Gradient (blue primary)
        "sand-ocean": "linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 30%, #a1c4fd 70%, #c2e9fb 100%)",
        "sand-ocean-blue": "linear-gradient(135deg, #e2d1c3 0%, #fdfcfb 40%, #e0f2fe 70%, #0b50da 100%)",
        "sand-ocean-alt": "linear-gradient(135deg, #fdfbfb 0%, #e2d1c3 30%, #a1c4fd 100%)" ,

        // Ocean Gradient (coral primary)
        "ocean": "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)",
        "ocean-dark": "linear-gradient(135deg, #221610 0%, #1a0f0a 100%)",
        "ocean-night": "linear-gradient(135deg, #1a365d 0%, #0f172a 100%)",

        // Soft gradient backgrounds
        "soft-gradient": "radial-gradient(circle at top right, rgba(11, 80, 218, 0.05), transparent), radial-gradient(circle at bottom left, rgba(11, 80, 218, 0.03), transparent)",
      },
      backdropBlur: {
        "xs": "2px",
      },
      animation: {
        "float": "float 8s ease-in-out infinite",
        "float-slow": "float 12s ease-in-out infinite",
        "float-fast": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        }
      }
    },
  },
  plugins: []
};
