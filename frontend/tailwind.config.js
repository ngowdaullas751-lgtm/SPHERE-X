/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'space-dark': '#050810',
        'space-navy': '#0a0f1e',
        'space-blue': '#0d1b3e',
        'cosmic-blue': '#1a3a6e',
        'neon-blue': '#00d4ff',
        'neon-purple': '#7c3aed',
        'neon-cyan': '#06b6d4',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
