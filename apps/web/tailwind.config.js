/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        arctic: {
          ink: "#071522",
          panel: "#0d2030",
          line: "#1d384b",
          cyan: "#37c8df",
          muted: "#89a2b3",
        },
      },
    },
  },
  plugins: [],
};
