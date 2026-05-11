---
version: alpha
name: Warm Dark Editorial
description: ToxSam-inspired editorial minimalism for a dark-mode VRM avatar tracking tool. Warm neutrals, generous whitespace, monochrome chrome, emerald status accents.
colors:
  background: "#141311"
  foreground: "#f5f5f5"
  card: "#1a1918"
  card-foreground: "#f5f5f5"
  primary: "#10b981"
  primary-foreground: "#0a0a0a"
  secondary: "#222220"
  secondary-foreground: "#f5f5f5"
  muted: "#222220"
  muted-foreground: "#8a8a90"
  accent: "#2a2a28"
  accent-foreground: "#f5f5f5"
  destructive: "#ef4444"
  destructive-foreground: "#ffffff"
  border: "#262624"
  input: "#2e2e2c"
  ring: "#10b981"
  surface: "#161614"
  on-surface: "#f5f5f5"
  primary-muted: "#0d3d2e"
  primary-container: "#1a3d30"
  on-primary-container: "#a7f3d0"
  error-container: "#451212"
  on-error-container: "#fca5a5"
typography:
  display:
    fontFamily: Geist Variable
    fontSize: 96px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.02em
  headline:
    fontFamily: Geist Variable
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: Geist Variable
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist Variable
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Geist Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Geist Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Geist Variable
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.05em
  stat:
    fontFamily: Geist Variable
    fontSize: 60px
    fontWeight: 700
    lineHeight: 1
  mono:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 0.225rem
  md: 0.3rem
  DEFAULT: 0.375rem
  lg: 0.375rem
  xl: 0.525rem
  2xl: 0.675rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  section-y: 80px
  section-y-mobile: 40px
  container-max: 80rem
  container-padding-mobile: 1.5rem
  container-padding-tablet: 2rem
  container-padding-desktop: 3rem
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: 0.75rem 1.5rem
  button-primary-hover:
    backgroundColor: "#d4d4d4"
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: 0.75rem 1.5rem
  button-outline-hover:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  button-destructive:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: 0.75rem 1.5rem
  badge-default:
    backgroundColor: "{colors.primary-muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 0.125rem 0.5rem
  badge-outline:
    backgroundColor: transparent
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: 0.125rem 0.5rem
  badge-secondary:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: 0.125rem 0.5rem
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-hover:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
  nav-tab-active:
    textColor: "{colors.foreground}"
    padding: "{spacing.sm} {spacing.md}"
  nav-tab-inactive:
    textColor: "{colors.muted-foreground}"
    padding: "{spacing.sm} {spacing.md}"
  status-dot-active:
    backgroundColor: "{colors.primary}"
  status-dot-idle:
    backgroundColor: "{colors.muted-foreground}"
  status-dot-error:
    backgroundColor: "{colors.destructive}"
---

## Overview

Warm Dark Editorial is a design system where editorial minimalism meets functional tool UI. Inspired by [toxsam.com](https://www.toxsam.com/), it uses warm near-black backgrounds (not pure #000), generous whitespace, and monochrome chrome — reserving emerald green exclusively for live status indicators.

The UI exists to showcase the avatar. Everything else should get out of the way. Borders define edges, not shadows. Typography guides the eye. Emerald means "alive and tracking."

### Responsive Typography

The token values above are desktop sizes. Use CSS `clamp()` for responsive scaling:

- **Display:** `clamp(3rem, 8vw, 6rem)` — hero headings
- **Headline:** `clamp(2rem, 5vw, 4rem)` — section headings
- **Title:** `clamp(1.5rem, 3vw, 2.5rem)` — card titles
- **Stat:** `clamp(2rem, 4vw, 3.75rem)` — stat numbers

These are implemented as `.text-display`, `.text-headline`, `.text-title`, `.text-body`, `.text-body-lg`, `.text-caption`, `.text-small`, `.stat-number` in `src/index.css`.

## Colors

The palette is deliberately constrained — warm neutrals with one accent.

- **Background (#141311):** Not pure black. A warm near-black that feels rich, not clinical. Every surface starts here.
- **Foreground (#f5f5f5):** Not pure white. Slightly warm, easy on the eyes. Used for all readable text.
- **Card (#1a1918):** One shade lighter than background. Barely perceptible elevation.
- **Primary (#10b981):** Emerald. Reserved exclusively for status — tracking active, face detected, focus rings. Never used for decoration or chrome.
- **Muted Foreground (#8a8a90):** The workhorse color. Captions, secondary text, labels, inactive states.
- **Destructive (#ef4444):** Errors and stop buttons only.
- **Border (#262624):** Subtle warm-tinted border. Enough to define edges without visual noise.

No shadows. No gradients (except avatar overlays). No color for color's sake.

### Transparency Notes

Some borders and inputs use transparency for subtlety in the CSS implementation:
- Borders: `rgba(255, 255, 255, 0.08)` — maps to design intent `#262624` against `#141311`
- Inputs: `rgba(255, 255, 255, 0.12)` — maps to design intent `#2e2e2c` against `#141311`

The hex tokens above are the opaque equivalent. The CSS uses transparency for better compositing.

## Typography

Two fonts, one personality.

- **Geist Variable** handles everything: display headings through body text. Its tight x-height and wide apertures stay readable at every size.
- **Geist Mono** is reserved for system info (FPS counters, status strings) where tabular data matters more than aesthetics.

The scale uses `clamp()` for headings — no breakpoint jumps, just smooth scaling. Body text is always `1rem / 1.6` for comfortable reading. Captions use `0.05em` letter-spacing and uppercase transforms for section labels.

## Layout

The layout uses a max-width container (`80rem / 1280px`) with responsive padding that grows from mobile to desktop. Sections breathe with generous vertical padding (5rem mobile, 8rem desktop).

The grid is border-based, not shadow-based. Cards separate via 1px borders that brighten on hover. This keeps the UI flat and editorial — depth comes from tonal layering, not drop shadows.

## Elevation & Depth

This design system uses **tonal layers** instead of shadows.

- **Level 0 (Background):** `#141311` — the canvas
- **Level 1 (Card):** `#1a1918` — barely perceptible lift
- **Level 2 (Accent):** `#2a2a28` — hover states, active surfaces
- **Level 3 (Foreground):** `#f5f5f5` — buttons, headings, primary text

No `box-shadow` anywhere in the system. Depth is communicated through background lightness steps, not shadow tricks.

## Shapes

All interactive elements use a `0.375rem` (6px) corner radius — enough to feel modern without becoming round. Images and overlays use `0.5rem`. Badges and pills use `0.3rem`.

Full-radius (`9999px`) is reserved for status dots and avatars only.

## Components

### Primary Button

Near-white fill on dark background. The inversion creates maximum contrast and draws attention without using the emerald accent. On hover, lightens to `#d4d4d4`.

- Never use emerald for buttons — emerald means "tracking status"
- Always use for the single primary action per screen

### Outline Button

2px border in foreground color, transparent fill. On hover, fills with foreground and text flips to background — a clear state change that feels decisive.

### Badges

Small, inline status indicators. Default badges use emerald tint to signal "active tracking" — the only component where emerald is a background tint. Outline badges are for metadata. Secondary badges are for non-critical status.

### Cards

Flat rectangles with 1px borders. Hover state brightens the border from `rgba(255,255,255,0.08)` to `rgba(255,255,255,0.20)` — subtle but perceptible. No shadows, no transforms.

### Links

The `.link-hover` class applies an underline sweep animation on hover. The underline grows from 0% to 100% width over `0.3s`. Used for navigation links and footer links.

### Navigation Tabs

Line-style navigation with an underline indicator on the active tab. No filled backgrounds, no pill shapes. Active tab shows a 1px line at the bottom. Muted text on inactive tabs brightens on hover.

## Do's and Don'ts

- **Do** use emerald exclusively for tracking status, face detected, and focus rings
- **Don't** use emerald for buttons, links, or decorative elements
- **Do** use borders (not shadows) to separate UI elements
- **Don't** add `box-shadow` to any component
- **Do** use `clamp()` for responsive heading sizes
- **Don't** use fixed pixel sizes for headings at different breakpoints
- **Do** keep the warm near-black background (#141311) — it's not #000
- **Don't** use pure black or pure white anywhere
- **Do** apply text shadows for content over 3D canvases
- **Don't** apply text shadows anywhere else
- **Do** use geometric sans-serif (Geist) for all UI text
- **Don't** mix more than two font families
- **Do** use `0.375rem` border-radius for all interactive elements
- **Don't** use irregular or inconsistent corner radii