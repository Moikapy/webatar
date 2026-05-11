# Webatar 🐉

**Real-time webcam-driven VRM avatar animation in the browser.**

Webatar captures your webcam input and maps facial expressions, head rotation, and body movement onto VRM avatars from [Open Source Avatars](https://www.opensourceavatars.com/). Zero install — point your browser, pick an avatar, and go.

![dark-ui](https://img.shields.io/badge/theme-warm%20dark-141311?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![tests](https://img.shields.io/badge/tests-130%20passing-brightgreen?style=flat-square)

---

## Features

- **Real-time face tracking** — MediaPipe FaceLandmarker → 52 ARKit blend shapes → VRM expressions
- **Pose tracking** — Upper-body animation at 15fps, face at 30fps, render at 60fps
- **Avatar gallery** — Browse 300+ CC0 avatars from Open Source Avatars
- **LRU cache** — 5-model cache for instant avatar switching
- **Warm dark editorial UI** — ToxSam-inspired design system with emerald status accents

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Production build
bun run build
```

## Architecture

```
Webcam → MediaPipe FaceLandmarker → Raw Landmarks
                                         ↓
PoseLandmarker → Raw Landmarks    → Custom ARKit→VRM solver
                                         ↓
                                  VRM Expressions + Bone Rotations
                                         ↓
                                  Three.js Render Loop
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Expression mapping | Custom solver | Kalidokit is deprecated, targets old MediaPipe API |
| UI framework | React 19 + shadcn/ui | Component library with design system tokens |
| 3D rendering | Three.js r180 + @pixiv/three-vrm | Standard VRM loading and expression system |
| Face tracking | @mediapipe/tasks-vision | Modern WASM-based, 52 blend shapes |
| Design system | Google DESIGN.md format | Lintable, exportable, machine-readable tokens |

## Project Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Root component (ToxSam-inspired UI)
├── theme.ts              # Design system tokens (TypeScript)
├── constants.ts          # All constants in one place
├── components/
│   ├── AvatarGallery.tsx # OSA avatar browser + search
│   └── ui/               # shadcn/ui components (badge, button, card, separator, tabs)
├── hooks/
│   └── useWebatar.ts     # Main orchestrator hook
├── engine/
│   ├── WebatarEngine.ts  # State machine (idle→tracking→error)
│   └── index.ts
├── tracking/
│   ├── face-tracker.ts   # MediaPipe FaceLandmarker wrapper
│   ├── pose-solver.ts    # Head rotation from landmarks
│   ├── expression-map.ts # ARKit→VRM blend shape mapping
│   ├── smoothing.ts      # Exponential smoothing filter
│   └── index.ts
├── vrm/
│   ├── loader.ts         # Three.js scene + VRMLoader
│   ├── expressions.ts    # Expression weight application
│   ├── bones.ts          # VRM bone rotation helpers
│   ├── idle-pose.ts      # Default T-pose for rest state
│   ├── types.ts          # VRM type definitions
│   └── index.ts
├── osa/
│   ├── client.ts         # Open Source Avatars registry client
│   ├── types.ts           # Zod-validated API types
│   └── index.ts
├── rendering/             # Three.js scene setup
└── utils/
    ├── math.ts            #lerp, clamp, radDeg conversions
    └── permissions.ts     # Camera permission helpers
```

## Design System

Webatar uses the **Warm Dark Editorial** design system — a ToxSam-inspired aesthetic defined in three synchronized files:

| File | Role | Format |
|------|-----|--------|
| **`DESIGN.md`** | Source of truth — tokens + prose | Google DESIGN.md spec |
| **`src/theme.ts`** | TypeScript constants | Importable objects |
| **`src/index.css`** | CSS custom properties + utilities | Tailwind v4 |
| **`STYLE_GUIDE.md`** | Human-readable reference | Markdown |

Key principles:
- **Warm near-black background** (`#141311`) — not pure `#000`
- **Emerald accent** (`#10b981`) — reserved for tracking status only
- **Monochrome chrome** — all UI uses white/gray, no colored buttons
- **Border-based elevation** — no shadows, tonal layers instead
- **Editorial typography** — Geist Variable with `clamp()` responsive headings

### Lint the design system

```bash
bun run design:lint    # Validate DESIGN.md (WCAG contrast, broken refs)
bun run design:diff    # Compare two DESIGN.md versions
```

## Testing

```bash
bun test                    # Run all 130 unit tests
bun test src/tracking/      # Run specific module
bun run typecheck           # TypeScript strict check
```

All production code is test-driven. Write a failing test first, then implement.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Bun |
| Framework | React 19 + TypeScript 5 (strict) |
| 3D | Three.js r180 + @pixiv/three-vrm v3 |
| Tracking | @mediapipe/tasks-vision v0.10 |
| UI | shadcn/ui (base-ui/react) + Tailwind v4 |
| Design tokens | Google DESIGN.md format + @google/design.md CLI |
| Fonts | Geist Variable + Geist Mono |
| Testing | Vitest + Playwright |
| Build | Vite 6 |

## Hardware Target

Developed on **dasua** (AMD Ryzen 5 2600, RTX 2070 8GB, 62GB RAM, Logitech C930e). Target: 60fps render, 30fps face tracking, 15fps pose tracking.

## License

MIT — code. CC0 — avatars.

---

*Built on faith. Driven by purpose. Guarded by a dragon.* 🐉🛡️