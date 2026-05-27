# DESIGN SYSTEM — SMU Career Companion

> Reference this file in every UI prompt. All components, pages, and layouts must conform to this spec.

---

## Design Philosophy

This app is for SMU Masters students — smart, ambitious, time-poor. The design should feel like a **premium career intelligence tool**, not a university portal. Think Bloomberg Terminal meets Linear.app: data-dense but calm, institutional but modern, serious but not cold.

**One sentence brief:** *The career tool that actually respects your intelligence.*

**What it should NOT feel like:**
- The SMU website (blue-heavy, corporate, portal-like)
- A generic SaaS landing page (purple gradients, floating blobs)
- A student project (Bootstrap defaults, card soup)

---

## Colour Palette

SMU brand colours as the foundation, reinterpreted with restraint.

```css
:root {
  /* Base */
  --color-background:     #F7F6F3;   /* warm off-white, not pure white */
  --color-surface:        #FFFFFF;
  --color-surface-muted:  #EFEFEC;

  /* SMU-derived primaries — used sparingly */
  --color-primary:        #002147;   /* SMU navy — headlines, CTAs only */
  --color-primary-light:  #1A3A6B;   /* hover states */
  --color-accent:         #C8102E;   /* SMU red — single accent, badges, active states */

  /* Text */
  --color-text-primary:   #111110;
  --color-text-secondary: #6B6A67;
  --color-text-muted:     #A8A7A3;

  /* Borders */
  --color-border:         #E4E3DF;
  --color-border-strong:  #C9C8C4;

  /* Semantic */
  --color-success:        #1A7F4B;
  --color-warning:        #B45309;
  --color-info:           #1D4ED8;
}
```

**Rule:** Navy (`--color-primary`) appears on at most 2 elements per screen. Red (`--color-accent`) appears on at most 1. Everything else is neutral.

---

## Typography

```css
/* Import in layout.tsx or globals.css */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

:root {
  --font-display:  'Instrument Serif', Georgia, serif;   /* headlines, hero text */
  --font-body:     'DM Sans', sans-serif;                /* all UI, body copy */
  --font-mono:     'DM Mono', monospace;                 /* code, tags, labels */
}
```

**Usage:**
- `--font-display` → page titles, section headers, hero statements only
- `--font-body` → everything else (nav, cards, buttons, body text)
- `--font-mono` → skill tags, repo names, role labels, status badges

**Type scale:**
```
Display:   3rem / 700 weight  — hero headings
H1:        2rem / 600
H2:        1.375rem / 600
H3:        1.125rem / 500
Body:      0.9375rem / 400    — 15px
Small:     0.8125rem / 400    — 13px
Label:     0.75rem / 500      — 12px, uppercase, tracked
```

---

## Spacing & Layout

- Base unit: `4px`
- Page max-width: `1200px`, centered
- Content max-width: `800px` for text-heavy sections
- Page padding: `24px` mobile, `48px` desktop

**Grid:** 12-column. Cards sit in 4-col or 6-col spans. Never full-width cards.

**Radius:**
```css
--radius-sm:  4px    /* tags, badges */
--radius-md:  8px    /* cards, inputs */
--radius-lg:  12px   /* modals, large panels */
--radius-xl:  20px   /* hero elements only */
```

---

## Component Patterns

### Cards
- Background: `--color-surface`
- Border: `1px solid var(--color-border)`
- Shadow: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- Hover shadow: `0 4px 12px rgba(0,0,0,0.08)`
- Padding: `20px 24px`
- Transition: `box-shadow 150ms ease, transform 150ms ease`
- Hover transform: `translateY(-1px)`
- **No coloured card backgrounds.** Colour lives in badges and accents only.

### Buttons
```
Primary:   bg --color-primary, text white, hover --color-primary-light
Secondary: bg transparent, border --color-border, text --color-text-primary
Danger:    bg transparent, border --color-accent, text --color-accent
```
- Height: `36px` (default), `32px` (compact), `44px` (hero CTA)
- Font: `--font-body`, 14px, weight 500
- Radius: `--radius-md`
- No rounded-full pill buttons except for tags

### Tags / Badges
```css
/* Skill / role tags */
font-family: var(--font-mono);
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 3px 8px;
border-radius: var(--radius-sm);
background: var(--color-surface-muted);
color: var(--color-text-secondary);
border: 1px solid var(--color-border);
```

### Navigation
- Top nav: fixed, `64px` tall, background `rgba(247,246,243,0.92)`, `backdrop-filter: blur(12px)`
- Nav links: `--font-body`, 14px, weight 500, `--color-text-secondary`
- Active nav link: `--color-text-primary`, with a `2px` bottom border in `--color-accent`
- Logo: `--font-display`, 18px, `--color-primary`

### Inputs / Search
- Height: `40px`
- Border: `1px solid var(--color-border)`
- Focus border: `--color-primary`
- Background: `--color-surface`
- Font: `--font-body`, 14px
- Prefix icon: `--color-text-muted`

---

## Motion

Keep it subtle. This is a productivity tool, not a portfolio site.

```css
/* Default transition for interactive elements */
transition: all 150ms ease;

/* Page section entrance — stagger children */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-up {
  animation: fadeUp 300ms ease forwards;
}
```

- Stagger delay between list items: `50ms` increments
- No bounce, no spring, no dramatic slides
- Skeleton loaders on all async content (no spinners)

---

## Page-Specific Notes

### Homepage / Dashboard
- Hero: large `--font-display` headline (italic), muted subtitle in `--font-body`
- Three feature cards below the fold in a 3-column grid
- A "Recently Active" or "What to work on today" feed below

### Interview Prep
- Left sidebar: category list (Role type filter)
- Main panel: question card with difficulty badge, role tag, and expand-to-answer
- Progress tracker in top-right: simple horizontal bar, no gamification

### Job Board
- Table layout preferred over card grid — more data density
- Columns: Role / Company / Location / Posted / Tags / Apply
- Row hover: subtle `--color-surface-muted` background
- Filters as a compact top bar, not a sidebar

### GitHub Sweeper
- Repo cards in a 2-column grid
- Each card: repo name in `--font-mono`, AI summary in `--font-body`, skill tags, difficulty badge, and a "View on GitHub" link
- Difficulty badge colours: `green` (beginner), `amber` (intermediate), `navy` (advanced)

---

## What to Avoid

- ❌ Purple, teal, or gradient backgrounds
- ❌ Glassmorphism cards with heavy blur
- ❌ Emoji in UI (only in copy if contextually appropriate)
- ❌ Rounded-full buttons for primary actions
- ❌ Dark mode (not in scope for MVP)
- ❌ Animations longer than 400ms
- ❌ Font sizes below 12px
- ❌ More than 3 font weights on a single screen

---

## Tailwind Config Mapping

Add this to `tailwind.config.ts` to wire the design tokens:

```ts
theme: {
  extend: {
    colors: {
      background: '#F7F6F3',
      surface: '#FFFFFF',
      'surface-muted': '#EFEFEC',
      primary: '#002147',
      'primary-light': '#1A3A6B',
      accent: '#C8102E',
      border: '#E4E3DF',
      'border-strong': '#C9C8C4',
    },
    fontFamily: {
      display: ['Instrument Serif', 'Georgia', 'serif'],
      sans: ['DM Sans', 'sans-serif'],
      mono: ['DM Mono', 'monospace'],
    },
  }
}
```

---

*Last updated: May 2026. Maintained by project owner.*
