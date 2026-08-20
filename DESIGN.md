# Design System: Master Planning MRP CODISA

## Visual Theme & Philosophy

- **Register**: `product` (Data-dense master planning dashboard)
- **Aesthetic**: OLED Pure Black Precision, Monospaced Financial Data, Emerald & Slate Accents
- **Theme Modes**: OLED Black (`#000000`), Dark Slate (`#0b101b`), Crisp Light (`#f4f6f9`)

## Color Tokens

### OLED Pure Black (Default Theme)
- `--bg`: `#000000` (Pure Black for deep contrast and energy efficiency)
- `--surface`: `#0a0d14` (Top headers, sidebar)
- `--surface-card`: `#111622` (KPI metric cards, modals, table container)
- `--surface-hover`: `#182030` (Hover state for rows and navigation items)
- `--border`: `#1e2638` (Subtle boundary borders)
- `--border-focus`: `#3b82f6` (Active input focus ring)

### Functional & Semantic Palette
- **Primary (Emerald Precision)**: `#10b981` | BG: `rgba(16, 185, 129, 0.12)` | Border: `rgba(16, 185, 129, 0.35)`
- **Accent (Amber Risk Warning)**: `#f59e0b` | BG: `rgba(245, 158, 11, 0.12)`
- **Danger (Stockout Risk / Critical)**: `#ef4444` | BG: `rgba(239, 68, 68, 0.12)` | Border: `rgba(239, 68, 68, 0.35)`
- **Info / Transit (Lead Time 72h)**: `#3b82f6` | BG: `rgba(59, 130, 246, 0.12)` | Border: `rgba(59, 130, 246, 0.35)`
- **Core Stars (GMROI Quadrant 1)**: `#10b981`
- **Cash Cows (GMROI Quadrant 2)**: `#3b82f6`
- **Opportunities (GMROI Quadrant 3)**: `#a855f7`
- **Drainers (GMROI Quadrant 4)**: `#ef4444`

## Typography

- **UI & Display Font**: `'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif`
- **Data, Numbers & SKU Font**: `'JetBrains Mono', monospace`
- **Scale**:
  - Headings: `1.6rem` (H1), `1.35rem` (H2), `1.15rem` (H3), `0.9rem` (H4)
  - KPIs: `1.45rem` bold monospaced
  - Table Content: `0.85rem` monospaced for numeric columns
  - Labels & Microcopy: `0.75rem` uppercase tracking

## Component Patterns

1. **Matrix Day Selector**: Compact segmented button group (Lun, Mar, Mié, Jue) with instant banner feedback.
2. **MRP Table with Inline Inputs**: Excel-like fast numerical inputs (`.stock-input`, `.transit-input`, `.order-input`) with `.override-active` visual highlights for manual adjustments.
3. **Coverage Status Pills**: Color-coded badges (`.pill-success`, `.pill-warning`, `.pill-danger`, `.pill-neutral`).
4. **Command Palette (`Ctrl + K`)**: Modal search overlay with keyboard navigation (`↑`, `↓`, `Enter`, `ESC`).
5. **Chart.js v4 Integrations**: Dynamic theme-aware palette injection for GMROI 4 quadrants, category distributions, and capital efficiency bars.
