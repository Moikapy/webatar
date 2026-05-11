/**
 * Webatar theme — re-exports from @0xkobold/warm-editorial + project-specific additions.
 *
 * The design system package provides COLORS (light/dark), TYPOGRAPHY, SPACING,
 * ROUNDED, ANIMATION, TEXT_SHADOW, and CLASSES. This file re-exports them and
 * adds any Webatar-specific tokens.
 *
 * @see @0xkobold/warm-editorial — the reusable design system package
 * @see DESIGN.md — the canonical design system definition
 * @see STYLE_GUIDE.md — human reference
 */

export {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  ROUNDED,
  ANIMATION,
  TEXT_SHADOW,
  CLASSES,
  theme,
  type Theme,
  type ThemeMode,
} from '@0xkobold/warm-editorial'

// Re-export provider for convenience
export { ThemeProvider, useTheme } from '@0xkobold/warm-editorial'