/**
 * Tailwind CSS config - PRD: Tailwind CSS for styling.
 * PRD color palette: Primary #2563EB, Secondary #059669, Accent #F59E0B,
 * Background #F8FAFC, Text #1F2937 / #6B7280
 */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#059669',
        accent: '#F59E0B',
        background: '#F8FAFC',
      },
    },
  },
  plugins: [],
};
