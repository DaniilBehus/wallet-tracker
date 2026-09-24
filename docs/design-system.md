# Interface design system

[← Back to README](../README.md#architecture) · [Next: architecture notes →](../spec/architecture.md)

Wallet uses one mobile-first dark theme across Add, Month, Upcoming, Schedules and AI expense entry. The reference image informed the deep green depth and fine curved lines at the top of the app. The lines remain outside content surfaces; they never sit behind labels, input text or chart values. There is no image background repeated across screens.

| Role | Token | Value |
|---|---|---|
| App background | `--bg` | `#071C1B` |
| Cards | `--surface` / `--surface-raised` | `#102B2A` / `#163532` |
| Main / secondary text | `--text` / `--muted` | `#F0F7F4` / `#A7C0BA` |
| Primary action | `--accent` | `#48D6C4` |
| Dividers / input outlines | `--line` / `--line-strong` | `#2B514B` / `#5A8E84` |

`public/style.css` provides the layout; [`public/theme.css`](../public/theme.css) provides the palette and component treatment. Main amounts are heavier and larger than supporting labels. Cards use 18 px corners, compact controls use 12 px corners, and related fields are grouped with consistent spacing. Primary actions are solid mint, not glow-dependent. Errors use a separate soft coral, and focus has a visible mint outline. The bottom navigation uses simple single-colour SVG icons plus text labels. Chart bars and donut slices have adjacent category names and numeric values, so colour is never their only label.

Contrast was calculated against the actual token pairs: body text on the app background **16.22:1**, muted text on cards **7.77:1**, placeholder text in fields **6.80:1**, primary-button text on mint **9.02:1**, and input border against its field **4.36:1**. The thinner card divider is decorative, not a sole control boundary.

The [real UI screenshots](../README.md#screenshots) were regenerated after the redesign. The [AI screenshots](ai-feature.md) use deterministic demo data, not a live model. Browser checks cover 320 px, 375 px and desktop layouts, long category names, a €1,000,000 total, empty lists, validation errors, open forms, keyboard focus and horizontal overflow. Loading and AI error states are covered by [browser tests](../qa/e2e/).
