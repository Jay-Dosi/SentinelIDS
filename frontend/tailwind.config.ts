import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#070b10',
          secondary: '#0d1117',
          card: '#111820',
          hover: '#161e28',
        },
        accent: {
          green: '#00ff88',
          'green-dim': '#00cc6a',
          amber: '#ffb800',
          red: '#ff3864',
          blue: '#00b4ff',
          purple: '#9d4edd',
        },
        border: {
          DEFAULT: '#1e2d3d',
          bright: '#2a3f55',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#7d9ab5',
          muted: '#3d5a7a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 3s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(0,255,136,0.4)' },
          '50%': { opacity: '.8', boxShadow: '0 0 0 8px rgba(0,255,136,0)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'glow': {
          'from': { textShadow: '0 0 10px #00ff88, 0 0 20px #00ff88' },
          'to': { textShadow: '0 0 20px #00ff88, 0 0 40px #00ff88, 0 0 60px #00ff88' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'green': '0 0 20px rgba(0,255,136,0.15)',
        'green-lg': '0 0 40px rgba(0,255,136,0.2)',
        'red': '0 0 20px rgba(255,56,100,0.2)',
        'amber': '0 0 20px rgba(255,184,0,0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'inset-green': 'inset 0 1px 0 rgba(0,255,136,0.1)',
      },
    },
  },
  plugins: [],
}

export default config
