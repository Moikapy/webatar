/**
 * Warm Dark Editorial — Design system tokens
 *
 * This file IS the TypeScript representation of DESIGN.md.
 * If you change a token here, update DESIGN.md. If you change
 * DESIGN.md, update this file. They must stay in sync.
 *
 * DESIGN.md is the source of truth for AI agents and linters.
 * This file is the source of truth for TypeScript consumers.
 * Both must match.
 *
 * @see DESIGN.md — the canonical design system definition
 * @see STYLE_GUIDE.md — the human-readable style guide
 * @see src/index.css — the CSS implementation
 */

// ─── Color Tokens ────────────────────────────────────────────────────────────
// Must match DESIGN.md → colors section exactly.

export const COLORS = {
  background:          '#141311',
  foreground:          '#f5f5f5',

  card:                '#1a1918',
  'card-foreground':   '#f5f5f5',

  primary:             '#10b981',
  'primary-foreground':'#0a0a0a',

  secondary:          '#222220',
  'secondary-foreground': '#f5f5f5',

  muted:               '#222220',
  'muted-foreground':  '#8a8a90',

  accent:              '#2a2a28',
  'accent-foreground': '#f5f5f5',

  destructive:          '#ef4444',
  'destructive-foreground': '#ffffff',

  border:              '#262624',
  input:              '#2e2e2c',
  ring:                '#10b981',

  surface:             '#161614',
  'on-surface':       '#f5f5f5',

  'primary-muted':    '#0d3d2e',
  'primary-container': '#1a3d30',
  'on-primary-container': '#a7f3d0',

  'error-container':    '#451212',
  'on-error-container': '#fca5a5',

  // Chart colors (for data visualization)
  chart1: '#10b981',
  chart2: '#8a8a90',
  chart3: '#6b7280',
  chart4: '#4b5563',
  chart5: '#374151',

  // Sidebar (mirrors card/muted)
  sidebar:                    '#161614',
  'sidebar-foreground':       '#f5f5f5',
  'sidebar-primary':          '#10b981',
  'sidebar-primary-foreground':'#0a0a0a',
  'sidebar-accent':           '#222220',
  'sidebar-accent-foreground':'#f5f5f5',
  'sidebar-border':          '#262624',
  'sidebar-ring':            '#6b7280',
} as const

// ─── Typography Tokens ───────────────────────────────────────────────────────
// Desktop sizes from DESIGN.md. Use CSS clamp() classes for responsive scaling.

export const TYPOGRAPHY = {
  fontFamily: {
    sans: "'Geist Variable', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },

  scale: {
    display: {
      fontSize:    'clamp(3rem, 8vw, 6rem)',
      desktopPx:   96,
      lineHeight:  1,
      letterSpacing: '-0.02em',
      fontWeight:  '700',
      usage: 'Hero headings',
    },
    headline: {
      fontSize:    'clamp(2rem, 5vw, 4rem)',
      desktopPx:   64,
      lineHeight:  1.1,
      letterSpacing: '-0.02em',
      fontWeight:  '700',
      usage: 'Section headings',
    },
    title: {
      fontSize:    'clamp(1.5rem, 3vw, 2.5rem)',
      desktopPx:   40,
      lineHeight:  1.2,
      letterSpacing: '-0.01em',
      fontWeight:  '700',
      usage: 'Card titles, sub-sections',
    },
    bodyLg: {
      fontSize:    '1.25rem',
      desktopPx:   20,
      lineHeight:  1.6,
      letterSpacing: 'normal',
      fontWeight:  '400',
      usage: 'Large body, lead paragraphs',
    },
    body: {
      fontSize:    '1rem',
      desktopPx:   16,
      lineHeight:  1.6,
      letterSpacing: 'normal',
      fontWeight:  '400',
      usage: 'Body text',
    },
    bodySm: {
      fontSize:    '0.875rem',
      desktopPx:   14,
      lineHeight:  1.5,
      letterSpacing: 'normal',
      fontWeight:  '400',
      usage: 'Small text, secondary info',
    },
    caption: {
      fontSize:    '0.75rem',
      desktopPx:   12,
      lineHeight:  1.4,
      letterSpacing: '0.05em',
      fontWeight:  '400',
      usage: 'Labels, tags, uppercase headings',
    },
    stat: {
      fontSize:    'clamp(2rem, 4vw, 3.75rem)',
      desktopPx:   60,
      lineHeight:  1,
      letterSpacing: 'normal',
      fontWeight:  '700',
      usage: 'Stat numbers',
    },
    mono: {
      fontSize:    '0.8125rem',
      desktopPx:   13,
      lineHeight:  1.5,
      letterSpacing: 'normal',
      fontWeight:  '400',
      usage: 'System info, FPS counters',
    },
  },

  weight: {
    regular: 400,
    medium:  500,
    bold:    700,
  },
} as const

// ─── Spacing & Layout Tokens ──────────────────────────────────────────────────

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  sectionY: '80px',
  sectionYMobile: '40px',
  containerMax: '80rem',
  containerPaddingMobile: '1.5rem',
  containerPaddingTablet: '2rem',
  containerPaddingDesktop: '3rem',
} as const

// ─── Rounding Tokens ──────────────────────────────────────────────────────────

export const ROUNDED = {
  sm: '0.225rem',
  md: '0.3rem',
  DEFAULT: '0.375rem',
  lg: '0.375rem',
  xl: '0.525rem',
  '2xl': '0.675rem',
  full: '9999px',
} as const

// ─── Animation Tokens ────────────────────────────────────────────────────────

export const ANIMATION = {
  slideUp: {
    keyframes: {
      from: { opacity: '0', transform: 'translateY(20px)' },
      to:   { opacity: '1', transform: 'translateY(0)' },
    },
    duration: '0.6s',
    easing: 'ease-out',
    fill: 'forwards' as const,
    stagger: {
      slow: '0.1s',
      medium: '0.2s',
      fast: '0.3s',
    },
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    sharp:   'cubic-bezier(0.4, 0, 0.6, 1)',
  },

  duration: {
    fast:   '150ms',
    normal: '200ms',
    slow:   '300ms',
  },
} as const

// ─── Text Shadows ────────────────────────────────────────────────────────────

export const TEXT_SHADOW = {
  dark: '0 3px 12px rgba(20, 19, 17, 0.95), 0 0 16px rgba(20, 19, 17, 0.8)',
  darkStrong: '0 4px 16px #141311, 0 0 24px rgba(20, 19, 17, 0.9)',
} as const

// ─── Component CSS Class Tokens ──────────────────────────────────────────────
// Maps to CSS classes defined in src/index.css

export const CLASSES = {
  // Buttons
  btnPrimary: 'btn-primary',
  btnOutline: 'btn-outline',

  // Links
  linkHover: 'link-hover',

  // Layout
  containerCustom: 'container-custom',
  sectionPadding: 'section-padding',

  // Typography
  textDisplay: 'text-display',
  textHeadline: 'text-headline',
  textTitle: 'text-title',
  textBody: 'text-body',
  textBodyLg: 'text-body-lg',
  textBodySm: 'text-small',
  textCaption: 'text-caption',

  // Animation
  animateSlideUp: 'animate-slide-up',
  animationDelay100: 'animation-delay-100',
  animationDelay200: 'animation-delay-200',
  animationDelay300: 'animation-delay-300',

  // Text shadows
  textShadowDark: 'text-shadow-dark',
  textShadowDarkStrong: 'text-shadow-dark-strong',

  // Stats
  statNumber: 'stat-number',
} as const

// ─── Aggregated Theme Object ─────────────────────────────────────────────────

export const theme = {
  colors:     COLORS,
  typography: TYPOGRAPHY,
  spacing:    SPACING,
  rounded:    ROUNDED,
  animation:  ANIMATION,
  textShadow: TEXT_SHADOW,
  classes:    CLASSES,
} as const

export type Theme = typeof theme