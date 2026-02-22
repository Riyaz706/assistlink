/**
 * AssistLink — Tailwind theme extension (use in tailwind.config.js)
 * Matches docs/ASSISTLINK_UI_DESIGN_SPEC.md and frontend/src/theme.ts
 *
 * Usage in tailwind.config.js:
 *   module.exports = {
 *     theme: { extend: require('./docs/ASSISTLINK_TAILWIND_THEME.js') },
 *     ...
 *   }
 */

module.exports = {
  colors: {
    primary: {
      DEFAULT: '#2563EB',
      dark: '#1D4ED8',
      light: '#3B82F6',
    },
    secondary: {
      DEFAULT: '#059669',
      dark: '#047857',
      light: '#10B981',
    },
    accent: {
      DEFAULT: '#F59E0B',
      dark: '#D97706',
      light: '#FBBF24',
    },
    background: '#F8FAFC',
    card: '#FFFFFF',
    'text-primary': '#1F2937',
    'text-secondary': '#6B7280',
    'text-muted': '#9CA3AF',
    error: '#DC2626',
    success: '#059669',
    warning: '#F59E0B',
    border: '#E5E7EB',
  },
  fontFamily: {
    heading: ['Inter', 'Poppins', 'sans-serif'],
    body: ['Open Sans', 'system-ui', 'sans-serif'],
  },
  fontSize: {
    'heading-lg': ['24px', { lineHeight: '1.3' }],
    'heading-md': ['20px', { lineHeight: '1.35' }],
    'heading-sm': ['18px', { lineHeight: '1.4' }],
    body: ['16px', { lineHeight: '1.5' }],
    'body-sm': ['14px', { lineHeight: '1.5' }],
    caption: ['12px', { lineHeight: '1.4' }],
  },
  spacing: {
    'touch': '48px', // min touch target
    '18': '4.5rem',
    '22': '5.5rem',
  },
  borderRadius: {
    'assist-sm': '6px',
    'assist-md': '10px',
    'assist-lg': '16px',
  },
  minHeight: {
    'touch': '48px',
  },
  minWidth: {
    'touch': '48px',
  },
  boxShadow: {
    'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
    'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
  },
};
