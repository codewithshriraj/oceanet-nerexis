module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nerexis logo palette: blue, green, orange, red
        primary: '#1F2937',
        'marine-slate': '#374151',
        secondary: '#374151',
        bioluminescent: '#2563EB',
        accent: '#6B7280',
        'neon-coral': '#DC2626',
        'neon-coral-alt': '#B91C1C',

        // Expanded data viz
        coral: '#9CA3AF',
        goldenrod: '#D97706',
        'electric-violet': '#7C3AED',
        'seafoam': '#059669',

        // Route accents for section-specific identity
        'accent-home': '#111827',
        'accent-dashboard': '#1F2937',
        'accent-datahub': '#374151',
        'accent-analytics': '#4B5563',
        'accent-news': '#6B7280',
        'accent-reports': '#4B5563',
        'accent-ai': '#374151',
        'accent-api': '#1F2937',

        // Neutrals & UI
        'text-primary': '#111827',
        'text-secondary': '#4B5563',
        'deep-twilight': '#D1D5DB',

        // Status
        success: '#059669',
        error: '#DC2626',
        danger: '#DC2626',
        warning: '#D97706',

        // Backwards-compatible aliases (maps old class names to new palette)
        cyan: '#1F2937',
        teal: '#4B5563',
        emerald: '#6B7280',
        info: '#1F2937',
        'neon-blue': '#1F2937',
        'ocean-900': '#F8FAFC',
        'ocean-orange': '#6B7280',
        'ocean-red': '#111827',
        'ocean-yellow': '#9CA3AF',

        // Preserve dark-bg keys used elsewhere
        'dark-bg': '#F8FAFC',
        'darker-bg': '#EDF2F6',
      },
      backgroundImage: {
        'ocean-gradient': 'linear-gradient(180deg, #FAFAFA 0%, #F3F4F6 100%)',
        'gradient-primary': 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
        'gradient-accent': 'linear-gradient(135deg, #6B7280 0%, #111827 100%)',
        'gradient-dark': 'linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%)',
      },
      backdropBlur: {
        glass: '10px',
        'glass-lg': '20px',
      },
      boxShadow: {
        'glow': '0 8px 24px rgba(17, 24, 39, 0.12)',
        'glow-teal': '0 8px 24px rgba(31, 41, 55, 0.14)',
        'glow-coral': '0 8px 24px rgba(31, 41, 55, 0.16)',
        'glow-lg': '0 16px 40px rgba(15, 23, 42, 0.1)',
        'neon': '0 10px 28px rgba(17, 24, 39, 0.16)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.75)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'wave': 'wave 3s ease-in-out infinite',
        'typing': 'typing 0.7s steps(4, end) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'gradient': 'gradient 8s ease infinite',
        'rotate': 'rotate 20s linear infinite',
        'pulse-scale': 'pulse-scale 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 14px rgba(17, 24, 39, 0.16)' },
          '50%': { boxShadow: '0 0 22px rgba(17, 24, 39, 0.26)' },
        },
        wave: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-10px)' },
          '75%': { transform: 'translateX(10px)' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        rotate: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-in-out',
      },
      backgroundSize: {
        '400%': '400%',
      },
    },
  },
  plugins: [],
}
