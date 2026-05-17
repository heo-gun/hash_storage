/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                canvas: "#060607",
                surface: {
                    1: "#0d0e10",
                    2: "#131418",
                    3: "#1a1b20",
                },
                hairline: {
                    DEFAULT: "#24262c",
                    2: "#34373f",
                },
                ink: {
                    DEFAULT: "#f5f6f7",
                    muted: "#c8ccd4",
                    subtle: "#7e848e",
                    dim: "#4d525c",
                },
                accent: {
                    DEFAULT: "#6ee7d5",
                    hover: "#8ff0e1",
                    press: "#5dd4c1",
                    dim: "#1f3c39",
                },
            },
            fontFamily: {
                sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
                mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
            },
            letterSpacing: {
                "tightest-3": "-0.05em",
                "tightest-4": "-0.07em",
            },
            spacing: {
                section: "96px",
                hero: "160px",
            },
            borderRadius: {
                xs: "4px",
            },
            transitionTimingFunction: {
                "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
                "out-quick": "cubic-bezier(0.4, 0, 0.2, 1)",
            },
        },
    },
    plugins: [],
};
