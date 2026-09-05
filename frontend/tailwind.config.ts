import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent-light)',
        },
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
      },
      boxShadow: {
        sm: '0 1px 2px var(--color-shadow)',
        md: '0 4px 6px -1px var(--color-shadow), 0 2px 4px -1px var(--color-shadow)',
        lg: '0 10px 15px -3px var(--color-shadow), 0 4px 6px -2px var(--color-shadow)',
      }
    },
  },
  plugins: [],
};

export default config;
