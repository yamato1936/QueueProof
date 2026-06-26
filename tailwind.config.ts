import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#f7f5ee",
        line: "#d9d3c4",
        moss: "#66745d",
        clay: "#b2644d",
        steel: "#45606d"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(20, 20, 20, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
