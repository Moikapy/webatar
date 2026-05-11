# AGENTS.md — Webatar Project Rules

> Mandatory rules for any agent (human or AI) working on this codebase.

## Must-Read Files

Before touching any code, read these in order:

1. **`AGENTS.md`** — This file. Rules of engagement.
2. **`Spec.md`** — Full project specification, API contracts, types, architecture
3. **`DESIGN.md`** — Canonical design system tokens (YAML) + rationale (prose). The source of truth for colors, typography, spacing, and components.

If modifying styling, layout, or UI components, also read:
- **`STYLE_GUIDE.md`** — Human-readable design reference and usage guide
- **`src/theme.ts`** — TypeScript constants matching DESIGN.md tokens (import in JS/TSX)
- **`src/index.css`** — CSS implementation (custom properties + utility classes)

## 1. Test-Driven Development (TDD)

**ALL production code must be preceded by a failing test. No exceptions.**

### Red-Green-Refactor Cycle

1. **RED** — Write a failing test that describes the desired behavior
2. **Verify RED** — Run `bun test`, confirm the test fails for the RIGHT reason (feature missing, not a typo)
3. **GREEN** — Write the minimal code to make the test pass
4. **Verify GREEN** — Run `bun test`, confirm ALL tests pass
5. **REFACTOR** — Clean up while keeping tests green

### Rules

- No production code without a failing test first
- Tests must fail before implementation is written
- If you write code before a test: **delete it, start over**
- "Keep as reference" is the same as cheating — delete means delete
- Every bug fix starts with a test proving the bug exists

### Verification Before Completion

**Evidence before assertions, always.**

- Run `bun test` and confirm 0 failures before claiming "tests pass"
- Run `bun run build` and confirm exit 0 before claiming "build works"
- Run `bun run lint` and confirm 0 errors before claiming "lint clean"
- If you haven't run the command in this session, you can't claim it passes
- "Should work", "probably fine", "looks correct" = not verified

**Required verification sequence before marking any task complete:**

```bash
bun test          # Must pass with 0 failures
bun run build     # Must exit 0
bun run lint      # Must show 0 errors
```

## 2. Programming Philosophy

Follow the 0xKobold philosophy at all times:

### DRY (Don't Repeat Yourself)
- Every piece of knowledge has a single, unambiguous representation
- Extract shared logic into utilities/helpers immediately
- Shared types in `src/types.ts` — one source of truth

### KISS (Keep It Simple, Stupid)
- Prefer the simplest solution that works
- No premature abstraction — write code that's easy to delete
- Explicit over clever

### Functional Programming
- Prefer immutability and pure functions
- No mutation of inputs
- Composition over inheritance
- Functions, not classes, unless state is genuinely needed
- Use `readonly` on arrays and object properties where data shouldn't change

### NASA's 10 Rules (Adapted for TypeScript)
1. No complex control flow (avoid deeply nested ifs, no recursion without bounds)
2. Loops must have fixed upper bounds
3. No dynamic memory allocation in hot paths (reuse buffers, pool objects)
4. Functions ≤ 60 lines
5. At least two assertions per function (params, returns, invariants)
6. Minimal variable scope (prefer `const`, avoid globals)
7. Check all return values (no ignored promises, no unchecked nulls)
8. No complex macros or conditional compilation
9. Single level of access (avoid deep property chains `a?.b?.c?.d`)
10. Strict TypeScript — `strict: true`, no `any`, no `@ts-ignore`

### Bugfix Discipline
- Never fix a bug without a test that proves it was there
- Test first → fix → test proves fix

## 3. Project Architecture

### Directory Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Root component (Warm Dark Editorial UI)
├── theme.ts              # Design system tokens (TypeScript)
├── constants.ts          # All constants in one place
├── components/
│   ├── AvatarGallery.tsx # OSA avatar browser + search
│   └── ui/               # shadcn/ui components (badge, button, card, separator)
├── hooks/
│   └── useWebatar.ts     # Main orchestrator hook
├── engine/
│   ├── WebatarEngine.ts  # State machine (idle→tracking→error)
│   └── index.ts
├── tracking/
│   ├── face-tracker.ts   # MediaPipe FaceLandmarker wrapper
│   ├── pose-solver.ts     # Head rotation from landmarks
│   ├── expression-map.ts # ARKit→VRM blend shape mapping
│   ├── smoothing.ts       # Exponential smoothing filter
│   └── index.ts
├── vrm/
│   ├── loader.ts         # Three.js scene + VRMLoader
│   ├── expressions.ts    # Expression weight application
│   ├── bones.ts         # VRM bone rotation helpers
│   ├── idle-pose.ts      # Default T-pose for rest state
│   ├── types.ts          # VRM type definitions
│   └── index.ts
├── osa/
│   ├── client.ts         # Open Source Avatars registry client
│   ├── types.ts           # Zod-validated API types
│   └── index.ts
├── rendering/             # Three.js scene setup
└── utils/
    ├── math.ts            # lerp, clamp, radDeg conversions
    └── permissions.ts     # Camera permission helpers
```

Root-level design files:
```
DESIGN.md       # Canonical design system (YAML tokens + prose) — SOURCE OF TRUTH
STYLE_GUIDE.md  # Human-readable design reference
AGENTS.md        # This file — project rules
Spec.md          # Full project specification
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `three` | 3D rendering engine |
| `@pixiv/three-vrm` | VRM model loading, expressions, humanoid bones |
| `@mediapipe/tasks-vision` | Face + Pose landmarker (WASM, in-browser) |
| `react` + `react-dom` | UI framework |
| `@react-three/fiber` | React bindings for Three.js |
| `@react-three/drei` | Three.js helpers |
| `zod` | Schema validation |
| `vitest` | Testing framework |

### Data Flow

```
Webcam → MediaPipe FaceLandmarker → Raw Landmarks
                                         ↓
PoseLandmarker → Raw Landmarks    → Custom ARKit→VRM solver
                                         ↓
                                  VRM Expressions + Bone Rotations
                                         ↓
                                  Three.js Render Loop
```

### Important Design Decisions

1. **Custom mapping layer** — We implement ARKit→VRM expression mapping ourselves (Kalidokit is deprecated and targets the old MediaPipe API)
2. **Expression system uses VRM presets** — `vrm.expressionManager.setValue()` with the override system, not raw morph targets
3. **Face tracking at 30fps, pose at 15fps** — Halves pose CPU cost with minimal visual difference
4. **LRU VRM cache (5 models)** — Fast avatar switching without reloading
5. **All OSA data from static JSON** — No auth, no server, aggressive caching (1hr+)
6. **Warm Dark Editorial design system** — Defined in DESIGN.md (canonical), implemented in theme.ts (TS) and index.css (CSS). Three files must stay in sync. Lint with `bun run design:lint`.

## 4. Code Style

- **TypeScript strict mode** — No `any`, no `@ts-ignore`, no `as` casts unless genuinely necessary
- **ES Modules** — `import`/`export`, no `require()`
- **No semicolons** — Consistent with project template
- **2-space indentation**
- **Named exports** — No default exports except React components
- **Barrel exports** via `index.ts` for each module directory
- **Tests co-located** — `expression-map.ts` ↔ `expression-map.test.ts`

## 5. Commit Discipline

- Each commit should represent one logical change
- Use conventional commit format: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`
- Never force push
- Never rewrite git history

## 6. Codebase Wiki

The wiki at `.codebase-wiki/` is our living documentation — a searchable knowledge base that persists across sessions.

### When to Update

| Trigger | Action |
|---------|--------|
| After implementing a feature or bugfix | `wiki_ingest source=commits` |
| After adding a new module, service, or component | `wiki_entity name="..." summary="..." type="module"` |
| After making an architectural decision | `wiki_decision title="..." context="..." decision="..." status="accepted"` |
| After creating or updating a design pattern | `wiki_concept name="..." summary="..." applies_to=[...]` |
| Before starting work on an unfamiliar area | `wiki_query question="..."` to load context |
| When lint shows issues | `wiki_lint` then resolve errors, merge contradictions |
| Periodically (weekly or after big changes) | `wiki_ingest source=smart` for enriched updates |

### Ingest Sources

| Source | When to Use |
|--------|-------------|
| `commits` | After code changes — reads git history |
| `tree` | **ONE TIME ONLY** — initial seed. Never re-run on an existing wiki |
| `docs` | After adding/updating documentation files |
| `smart` | Periodic enrichment — regex-enriched, best coverage |
| `llm` | When you need deep agent-enriched analysis (slowest, most thorough) |

### Rules

- **Never run `tree` on an existing wiki** — it creates duplicate file-level pages that clutter lint reports
- **Resolve lint errors immediately** — broken links and contradictions pile up fast
- **Orphan warnings are acceptable** — pages get linked naturally over time as queries cross-reference them
- **Stale wiki pages are technical debt** — keep it current or it becomes misleading
- **Entity pages** = modules, services, components (things with source files)
- **Concept pages** = patterns, architectures, cross-cutting concerns (things that span modules)
- **Decision pages** = ADRs (irreversible choices with context)

## 7. Testing Commands

```bash
# Run all tests
bun test

# Run a specific test file
bun test src/tracking/expression-map.test.ts

# Run tests in watch mode
bun test --watch

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build

# Design system lint (validate DESIGN.md against spec)
bun run design:lint
```

## 8. Design System

Three files must stay in sync. Change one, change all three:

| File | Role | Audience |
|------|------|----------|
| **`DESIGN.md`** | Source of truth — YAML tokens + markdown prose | AI agents, linters, designers |
| **`src/theme.ts`** | TypeScript constants matching DESIGN.md tokens | TS/JSX consumers |
| **`src/index.css`** | CSS implementation (custom properties + utility classes) | Browser |

**Rule:** If you change a color, spacing value, or typography token, update DESIGN.md first, then sync theme.ts and index.css to match. Run `bun run design:lint` to verify.

Read `STYLE_GUIDE.md` for the visual reference and usage examples.

## 9. Hardware Target

Development machine is `dasua`:
- AMD Ryzen 5 2600 (6C/12T), RTX 2070 8GB, 62GB RAM
- Logitech C930e webcam (1080p MJPEG, 90° FOV, H.264 HW encoding)
- Arch Linux, Wayland, NVIDIA 595.71 drivers

Target performance: 60fps render, 30fps face tracking, 15fps pose tracking.
See `Spec.md` Appendix A for detailed hardware profiles and auto-detection strategy.