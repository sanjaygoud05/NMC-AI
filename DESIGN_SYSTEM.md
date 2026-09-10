# Design System Reference

A comprehensive design system for the Requests & Approvals application.
Based on a "Profound-inspired" dark theme with a calm, professional aesthetic.

---

## Core Philosophy

- **Calm & Professional**: Muted colors, subtle contrasts
- **Dark-first**: Near-black backgrounds with refined surfaces
- **Accessible**: High contrast text, clear hierarchy
- **Consistent**: Semantic tokens used everywhere

---

## Color Palette

### Background & Surfaces

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `0 0% 0%` | Main app background (pure black) |
| `--card` | `0 0% 0%` | Card surfaces, elevated content |
| `--muted` | `0 0% 12%` | Muted backgrounds, hover states |
| `--border` | `0 0% 14%` | Borders, dividers |
| `--border-hover` | `0 1% 28%` | Border hover state |
| `--input` | `0 0% 14%` | Input field backgrounds |

### Text

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--foreground` | `0 0% 98%` | Primary text |
| `--muted-foreground` | `0 0% 55%` | Secondary text, placeholders |
| `--card-foreground` | `0 0% 98%` | Text on card surfaces |

### Brand / Accent

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--primary` | `160 60% 50%` | Primary actions, links, accents |
| `--primary-foreground` | `0 0% 4%` | Text on primary color |
| `--accent` | `0 0% 12%` | Subtle accent backgrounds |
| `--accent-foreground` | `0 0% 85%` | Text on accent surfaces |

### Status Colors

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--status-approved` | `160 60% 50%` | Approved states, success |
| `--status-rejected` | `0 60% 55%` | Rejected states, errors |
| `--status-pending` | `40 55% 50%` | Pending/waiting states |
| `--status-draft` | `0 0% 45%` | Draft states |
| `--status-submitted` | `200 55% 50%` | Submitted states |
| `--status-in-review` | `280 40% 55%` | In-review states |

### Destructive

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--destructive` | `0 60% 50%` | Destructive actions |
| `--destructive-foreground` | `0 0% 98%` | Text on destructive |

---

## Sidebar Colors

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--sidebar-background` | `0 0% 0%` | Sidebar background (pure black) |
| `--sidebar-foreground` | `0 0% 75%` | Sidebar text |
| `--sidebar-primary` | `160 60% 50%` | Active items |
| `--sidebar-primary-foreground` | `0 0% 4%` | Text on active |
| `--sidebar-accent` | `0 0% 10%` | Hover states |
| `--sidebar-accent-foreground` | `0 0% 90%` | Text on hover |
| `--sidebar-border` | `0 0% 14%` | Sidebar borders |
| `--sidebar-ring` | `160 60% 50%` | Focus rings |

---

## Typography

### Font Family
- **Primary**: `'Inter', system-ui, -apple-system, sans-serif`

### Font Scale

| Class | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-3xl font-bold` | 30px | 700 | 1.2 | Page titles |
| `text-2xl font-semibold` | 24px | 600 | 1.3 | Section headers |
| `text-lg font-semibold` | 18px | 600 | 1.4 | Card titles |
| `text-base` | 16px | 400 | 1.5 | Body text |
| `text-sm` | 14px | 400 | 1.5 | Secondary text |
| `text-xs` | 12px | 400/500 | 1.4 | Labels, captions |

### Tracking
- `tracking-tight` for large headings
- Default tracking for body text

---

## Spacing

Based on Tailwind's default scale:
- `gap-1` / `p-1`: 4px
- `gap-2` / `p-2`: 8px
- `gap-3` / `p-3`: 12px
- `gap-4` / `p-4`: 16px
- `gap-6` / `p-6`: 24px
- `gap-8` / `p-8`: 32px

### Page Layout
- Main content padding: `p-6` (24px)
- Card padding: `p-6` (24px)
- Section gaps: `space-y-8` (32px)
- Card gaps: `gap-4` (16px)

---

## Visual Patterns

### Dot Grid Background

```css
.bg-dot-pattern {
  background-image: radial-gradient(circle at center, hsl(0 0% 22%) 1px, transparent 1px);
  background-size: 14px 14px; /* Dense grid */
}
```

Usage: Applied to main content area for subtle texture.

### Cards

- Background: `bg-card`
- Border: `border border-border`
- Border radius: `rounded-lg` (0.5rem)
- Hover: Border lightens to `--border-hover`
- No heavy shadows in dark theme

```tsx
<Card className="border-border bg-card card-interactive">
  <CardContent>...</CardContent>
</Card>
```

### Interactive Hover Effect

Use `.card-interactive` class for border-only hover effects:
```css
.card-interactive:hover {
  border-color: hsl(var(--border-hover));
}
```

### Empty States

Centered content with:
- Muted icon in circular background
- Primary text for title
- Muted text for description
- Optional action button

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="rounded-full bg-muted/50 p-4 mb-4">
    <Icon className="h-8 w-8 text-muted-foreground" />
  </div>
  <p className="text-foreground font-medium">Title</p>
  <p className="text-sm text-muted-foreground mt-1">Description</p>
</div>
```

---

## Component Patterns

### Page Header

```tsx
<div className="flex flex-col gap-6">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-foreground">
      Page Title
    </h1>
    <p className="text-muted-foreground mt-2">
      Page description
    </p>
  </div>
  {/* Optional controls */}
</div>
```

### Metric Cards

- Large value with `text-4xl font-bold`
- Label with `text-sm text-muted-foreground`
- Change indicator with trend colors

### Buttons

| Variant | Usage |
|---------|-------|
| `default` | Primary actions |
| `secondary` | Secondary actions |
| `outline` | Tertiary actions |
| `ghost` | Subtle actions |
| `destructive` | Dangerous actions |

### Badges (Status)

```tsx
// Use semantic status colors
<Badge className="bg-status-approved/20 text-status-approved">Approved</Badge>
<Badge className="bg-status-rejected/20 text-status-rejected">Rejected</Badge>
<Badge className="bg-status-pending/20 text-status-pending">Pending</Badge>
```

---

## Animation

### Entry Animations

```css
.animate-fade-up {
  animation: fade-up 0.4s ease-out forwards;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Stagger Pattern

Apply delays for sequential reveals:
```tsx
style={{ animationDelay: '50ms' }}
style={{ animationDelay: '100ms' }}
style={{ animationDelay: '150ms' }}
```

### Transitions

- Default: `transition-all duration-200`
- Smooth easing: `ease-out`
- Hover transforms: `hover:translate-x-1`, `hover:-translate-y-0.5`

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text
- Focus rings: `ring-2 ring-primary/50 ring-offset-2 ring-offset-background`
- Interactive elements have visible focus states
- Color is not the only indicator of state

---

## Usage Guidelines

### DO
- Use semantic tokens (`bg-background`, `text-foreground`)
- Apply dot pattern to main content areas
- Use consistent spacing scale
- Apply entry animations with stagger

### DON'T
- Use raw HSL values in components
- Mix light and dark patterns
- Override colors with arbitrary values
- Skip focus states on interactive elements

---

## File Structure

```
src/
├── index.css           # Design tokens & global styles
├── components/
│   ├── ui/             # Base UI components (shadcn)
│   ├── layout/         # AppLayout, AppSidebar
│   ├── shared/         # PageHeader, EmptyState
│   └── dashboard/      # MetricCard, TimeRangeSelector, FilterChips
└── pages/              # Page components
```
