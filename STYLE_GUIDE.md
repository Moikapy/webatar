# Webatar Style Guide

> **Warm Dark Editorial** — ToxSam-inspired editorial minimalism for a dark-mode VRM avatar tool.
> Inspired by [toxsam.com](https://www.toxsam.com/) — warm neutrals, generous whitespace, monochrome chrome, emerald status accents.

---

## Architecture

The design system lives in **four** places, kept in sync:

| File | Role | Audience |
|------|------|----------|
| **`DESIGN.md`** | Source of truth — YAML tokens + markdown prose | AI agents, linters, designers |
| **`src/theme.ts`** | TypeScript constants matching DESIGN.md tokens | TS/JSX consumers |
| **`src/index.css`** | CSS implementation (custom properties + utility classes) | Browser |
| **`STYLE_GUIDE.md`** | This file — visual reference & usage guide | Humans |

**Rule:** If you change a token, change it in DESIGN.md first. Then update `theme.ts` and `index.css` to match. Run `bun run design:lint` to verify.

---

## Color Philosophy

| Principle              | Implementation                                      |
|------------------------|------------------------------------------------------|
| Warm, not cold         | Background is `#141311` (warm near-black), not `#000` |
| Monochrome chrome      | All UI elements use white/gray, never colored          |
| Emerald = status only  | `#10b981` means "active/tracking" — not decoration     |
| Borders, not shadows   | Subtle `rgba(255,255,255,0.08)` borders separate areas  |

### Token Reference

| Token              | Hex                              | Usage                          |
|--------------------|----------------------------------|--------------------------------|
| `background`       | `#141311`                        | Page background               |
| `foreground`       | `#f5f5f5`                        | Body text                     |
| `card`             | `#1a1918`                        | Card/elevated surfaces        |
| `primary`          | `#10b981`                        | Status: tracking, face detect |
| `primaryForeground`| `#0a0a0a`                        | Text on primary               |
| `secondary`        | `#222220`                        | Tabs, elevated surfaces       |
| `muted`            | `#222220`                        | Muted surfaces                |
| `mutedForeground`  | `#8a8a90`                        | Labels, captions              |
| `accent`           | `#2a2a28`                        | Hover states                  |
| `destructive`      | `#ef4444`                        | Errors, stop                  |
| `border`           | `rgba(255,255,255,0.08)`         | Subtle borders                |
| `ring`             | `#10b981`                        | Focus rings                   |

Full token list in `src/theme.ts` → `COLORS.dark`.

---

## Typography

Font: **Geist Variable** (already bundled via `@fontsource-variable/geist`).

### Scale (CSS Classes)

| Class            | Size                              | Weight | Tracking   | Usage            |
|------------------|-----------------------------------|--------|------------|------------------|
| `.text-display`  | `clamp(3rem, 8vw, 6rem)`         | 700    | `-0.02em`  | Hero headings    |
| `.text-headline` | `clamp(2rem, 5vw, 4rem)`         | 700    | `-0.02em`  | Section headings |
| `.text-title`    | `clamp(1.5rem, 3vw, 2.5rem)`     | 700    | `-0.01em`  | Card titles      |
| `.text-body`     | `1rem`                            | 400    | normal     | Body text        |
| `.text-body-lg`  | `1.25rem`                         | 400    | normal     | Lead paragraphs  |
| `.text-caption`  | `0.75rem`                         | 400    | `0.05em`   | Labels, tags     |
| `.text-small`    | `0.875rem`                        | 400    | normal     | Secondary info   |

Full definitions in `src/theme.ts` → `TYPOGRAPHY.scale`.

---

## Layout

| Token                | Mobile   | Desktop  | Class                |
|----------------------|----------|----------|----------------------|
| Container max-width  | —        | `80rem`  | `.container-custom`  |
| Container padding    | `1.5rem` | `3rem`   | `.container-custom`  |
| Section padding      | `5rem`   | `8rem`   | `.section-padding`   |
| Border radius base   | `0.375rem` | —      | CSS var `--radius`   |

Full layout tokens in `src/theme.ts` → `LAYOUT`.

---

## Components

### Buttons

| Class            | Style                                            | Hover                      |
|------------------|--------------------------------------------------|----------------------------|
| `.btn-primary`   | Near-white fill (`#f5f5f5`), dark text (`#141311`) | Brightens to `#d4d4d4`   |
| `.btn-outline`   | 2px white border, transparent fill              | Fill white, text dark     |
| `.btn-primary` + `opacity-40` | Disabled primary                   | —                          |

### Links

| Class           | Style                         |
|-----------------|-------------------------------|
| `.link-hover`  | Underline sweeps in on hover  |

### Badges (shadcn)

| Variant       | Style                                         |
|---------------|-----------------------------------------------|
| `default`    | Emerald border + tint (`border-primary/50`)   |
| `outline`     | Subtle border, muted text                      |
| `secondary`  | Muted surface fill                            |
| `destructive` | Red tint                                      |

### Cards

- 1px `border` color, `.rounded-lg` at most
- Hover: border brightens to `foreground/20`
- No shadow — borders define edges

### Text Over 3D

| Class                  | Purpose                             |
|------------------------|-------------------------------------|
| `.text-shadow-dark`       | Subtle background glow for labels    |
| `.text-shadow-dark-strong`| Stronger glow for hero text          |

---

## Animation

### Slide Up Entrance

```css
.animate-slide-up          /* 0.6s ease-out, opacity 0→1, translateY 20→0 */
.animation-delay-100      /* 0.1s stagger */
.animation-delay-200      /* 0.2s stagger */
.animation-delay-300      /* 0.3s stagger */
```

### Easing

| Name      | Curve                              | Usage              |
|-----------|------------------------------------|--------------------|
| default   | `cubic-bezier(0.4, 0, 0.2, 1)`   | Most transitions   |
| sharp     | `cubic-bezier(0.4, 0, 0.6, 1)`   | Snappy interactions |

Full animation tokens in `src/theme.ts` → `ANIMATION`.

---

## Using in Components

### Import CSS classes (most common)

```tsx
import { COMPONENTS } from '@/theme'

// Use the class name constant
<div className={COMPONENTS.containerCustom}>
  <h1 className={COMPONENTS.textHeadline}>Section</h1>
  <button className={COMPONENTS.btnPrimary}>Action</button>
</div>
```

### Use token values in JS (for dynamic styles, canvas, Three.js)

```tsx
import { COLORS, TEXT_SHADOW } from '@/theme'

// For canvas/Three.js overlays
const shadow = TEXT_SHADOW.dark

// For dynamic theme toggling (future)
const bg = COLORS.dark.background // "#141311"
```

### Add a new token

1. Add the value to `src/theme.ts` in the appropriate section
2. Add the matching CSS custom property / class in `src/index.css`
3. Update this style guide if it affects the visual system

---

## Responsive Breakpoints

| Name | Min Width | Common Use          |
|------|-----------|---------------------|
| `sm` | 640px     | Large phones        |
| `md` | 768px     | Tablets             |
| `lg` | 1024px    | Desktop             |
| `xl` | 1280px    | Wide desktop        |

---

## Scrollbar

Custom thin scrollbar via `::-webkit-scrollbar`:
- Width: `6px`
- Track: transparent
- Thumb: `rgba(255,255,255,0.1)` → `0.2` on hover
- Border radius: `3px`

---

## Source Attribution

Design system derived from [toxsam.com](https://www.toxsam.com/) — ToxSam's portfolio site. Key patterns borrowed:
- Warm dark palette (`#141311` bg, `#EBE7E0` light bg)
- Editorial typography scale with `clamp()` sizing
- Border-based card system (no shadows)
- `.btn-primary` / `.btn-outline` monochrome buttons
- `.link-hover` underline sweep animation
- `.animate-slide-up` staggered entrance
- Container + section padding responsive utilities
- Text shadow for readability over 3D content