# LifeLink color contrast ledger

Generated for the visual/motion pass on 2026-11-27. Ratios use the WCAG relative-luminance formula on sRGB hex values. Normal text must reach **4.5:1**; large text (≥24px, or ≥18.66px bold) and non-text UI boundaries must reach **3:1**.

## Token source of truth

`src/styles/tokens.css` owns every color. `src/styles/fonts.css` owns the three self-hosted font families and their size-adjusted fallbacks. Components must use semantic aliases; raw brand hex values are allowed only inside `tokens.css` and gradient definitions.

Brand:

| Token | Value | Intended use |
| --- | --- | --- |
| `--crimson-50` | `#FFF5F7` | Soft tint, hover wash |
| `--crimson-100` | `#FFE8ED` | Tint border, selected soft background |
| `--crimson-200` | `#FFD0DA` | Decorative only |
| `--crimson-300` | `#F5A9B8` | Decorative only |
| `--crimson-400` | `#E85570` | Decorative only |
| `--crimson-500` | `#DF1B3B` | Bright accent on dark surfaces |
| `--crimson-600` | `#C8102E` | Primary action, active state, identity |
| `--crimson-700` | `#8B0018` | Primary hover/active, dark-on-light text |
| `--crimson-800` | `#6D1026` | Deep vessel accent |
| `--crimson-900` | `#3A0713` | Deepest crimson shade |

Paper:

| Token | Value |
| --- | --- |
| `--paper-0` | `#FFFFFF` |
| `--paper-50` | `#FAF8F9` |
| `--paper-100` | `#F3EFF1` |
| `--paper-200` | `#E8DCE0` |
| `--paper-300` | `#D3BEC6` |

Text:

| Token | Value | Use |
| --- | --- | --- |
| `--text-strong` | `#1D1015` | Headings, primary values |
| `--text-body` | `#3A2A31` | Body copy |
| `--text-muted` | `#51434A` | Secondary copy, table text |
| `--text-subtle` | `#67565E` | Captions only |
| `--text-on-dark` | `#F6EEF1` | Headings on ink surfaces |
| `--text-on-dark-body` | `#D8C5CC` | Body on ink surfaces |
| `--text-on-dark-muted` | `#B9A8B0` | Secondary on ink surfaces |

Red is reserved for primary actions, urgency, active state, and identity. Status colors are used only for their semantic states. The DEMO DATA notice uses the refined amber tint (`--warning` on `--warning-soft`) with an info icon, never loud yellow.

## Text contrast

| Foreground | Background | Ratio | Requirement | Result |
| --- | --- | ---: | ---: | --- |
| `--text-strong` `#1D1015` | `--paper-0` `#FFFFFF` | 18.47 | 4.5 | Pass |
| `--text-strong` | `--paper-50` `#FAF8F9` | 17.46 | 4.5 | Pass |
| `--text-strong` | `--paper-100` `#F3EFF1` | 16.20 | 4.5 | Pass |
| `--text-body` `#3A2A31` | `--paper-0` | 13.50 | 4.5 | Pass |
| `--text-body` | `--paper-50` | 12.77 | 4.5 | Pass |
| `--text-body` | `--paper-100` | 11.85 | 4.5 | Pass |
| `--text-muted` `#51434A` | `--paper-0` | 9.33 | 4.5 | Pass |
| `--text-muted` | `--paper-50` | 8.82 | 4.5 | Pass |
| `--text-muted` | `--paper-100` | 8.18 | 4.5 | Pass |
| `--text-subtle` `#67565E` | `--paper-0` | 6.84 | 4.5 | Pass |
| `--text-subtle` | `--paper-50` | 6.47 | 4.5 | Pass |
| `--text-on-dark` `#F6EEF1` | `--ink-950` `#10070C` | 17.41 | 4.5 | Pass |
| `--text-on-dark` | `--ink-900` `#180D13` | 16.66 | 4.5 | Pass |
| `--text-on-dark` | `--surface-dark-2` `#22121A` | 15.75 | 4.5 | Pass |
| `--text-on-dark-body` `#D8C5CC` | `--ink-950` | 12.35 | 4.5 | Pass |
| `--text-on-dark-muted` `#B9A8B0` | `--ink-950` | 8.78 | 4.5 | Pass |
| `--text-on-dark-muted` | `--ink-900` | 8.40 | 4.5 | Pass |
| `--text-on-dark-muted` | `--surface-dark-2` | 7.94 | 4.5 | Pass |

## Action and status contrast

| Foreground | Background | Ratio | Requirement | Result |
| --- | --- | ---: | ---: | --- |
| White `#FFFFFF` | `--crimson-600` `#C8102E` | 5.88 | 4.5 | Pass |
| White | `--crimson-500` `#DF1B3B` | 4.82 | 4.5 | Pass |
| White | `--danger` `#A30D26` | 7.95 | 4.5 | Pass |
| White | `--crimson-700` `#8B0018` | 9.95 | 4.5 | Pass |
| `--success` `#146C36` | `--success-soft` `#E8F7F0` | 5.88 | 4.5 | Pass |
| `--warning` `#8A4B00` | `--warning-soft` `#FDF3DC` | 6.16 | 4.5 | Pass |
| `--info` `#2856A8` | `--info-soft` `#E8F0FD` | 6.13 | 4.5 | Pass |
| `--danger` `#A30D26` | `--danger-soft` `#FFECEE` | 6.99 | 4.5 | Pass |
| `--teal` `#0F6C66` | `--teal-soft` `#EAFAF7` | 5.81 | 4.5 | Pass |
| `--violet` `#6337BA` | `--violet-soft` `#F4EFFF` | 6.69 | 4.5 | Pass |
| `--neutral` `#45536B` | `--neutral-soft` `#F0F3F7` | 6.98 | 4.5 | Pass |
| `--crimson-600` | `--paper-0` | 5.88 | 3.0 non-text | Pass |
| `--crimson-700` | `--paper-0` | 9.95 | 3.0 non-text | Pass |

## Contrast rules for implementation

- Do not use `--crimson-200`, `--crimson-300`, or `--crimson-400` for text; they are decorative only.
- `--paper-200` and `--paper-300` are hairline/border tokens, not text backgrounds under small copy.
- On dark cinematic surfaces use `--text-on-dark*` values only; never reuse light-surface muted tokens there.
- Placeholder text uses `--text-muted` at full opacity so it still passes AA.
- Focus ring uses `--ring` on light surfaces and `--ring-dark` on dark surfaces; both exceed 3:1 against their adjacent backgrounds.
- Decorative gradients are never the sole background behind body copy; copy sits on a solid token or a dark panel whose ratio is listed above.
- Every token pair used by a new component must be added to this ledger before the component ships.

## Automated verification

`scripts/ui-audit.mjs` runs axe color-contrast checks at all five audit viewports. It reports any element-level failure that is not covered here. The final UI audit report links back to this ledger and records the runtime result.
