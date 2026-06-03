# APP_REDESIGN — SMU Career Companion

> Visual redesign reference. Apply these changes on top of the existing layout and component structure. Do NOT restructure pages, move sections, or change navigation. Typography, colour, and surface treatment only — unless explicitly noted.

---

## What's Changing and Why

The current design uses Instrument Serif + DM Sans. The new direction takes inspiration from broadsheet journalism: high-contrast serif headlines, a neutral sans-serif for UI, warm paper-toned backgrounds, and sharp edges. The result should feel like a serious professional tool — authoritative, calm, data-dense — not a SaaS product or a university portal.

**Keep:** Page layout, component positions, navigation structure, card grid, table layouts, all functionality.
**Change:** Fonts, colours, border treatment, button shape, surface tones, badge style.

---

## Fonts

Replace current font imports in `app/globals.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Hanken+Grotesk:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

:root {
  --font-display:  'Newsreader', Georgia, serif;
  --font-body:     'Hanken Grotesk', sans-serif;
  --font-mono:     'DM Mono', monospace;
}
```

**Usage rules:**
- `--font-display` → all page titles, section headings, hero statements, card headings. Use italic variant for emphasis (`font-style: italic`).
- `--font-body` → all UI elements, nav, buttons, body copy, labels, table content
- `--font-mono` → skill tags, repo names, source badges, status labels, code

**Type scale (replace existing):**
```
Display:   3rem / 700 / Newsreader        — hero headings
H1:        2rem / 600 / Newsreader
H2:        1.5rem / 600 / Newsreader
H3:        1.125rem / 600 / Newsreader
Body:      1rem / 400 / Hanken Grotesk    — 16px
Small:     0.875rem / 400 / Hanken Grotesk — 14px
Label:     0.75rem / 600 / Hanken Grotesk  — 12px, uppercase, tracked 0.05em
Mono:      0.75rem / 500 / DM Mono         — 12px
```

---

## Colour Palette

Replace all colour tokens in `globals.css` and `tailwind.config.ts`:

```css
:root {
  /* Surfaces — warm paper tones, not clinical white */
  --color-background:            #F9F9F9;
  --color-paper:                 #F8EFE6;   /* primary warm background */
  --color-paper-dark:            #E5E1DA;   /* section breaks, secondary containers */
  --color-surface:               #FFFFFF;   /* cards, elevated containers */
  --color-surface-muted:         #F3F3F4;

  /* Ink — charcoal not pure black */
  --color-text-primary:          #1A1C1C;
  --color-text-secondary:        #46464B;
  --color-text-muted:            #77767C;

  /* Primary — deep charcoal ink */
  --color-primary:               #1D1F27;
  --color-primary-hover:         #05070E;

  /* Accent — SMU red, used sparingly */
  --color-accent:                #C22032;

  /* Borders */
  --color-border:                #C7C6CB;
  --color-border-strong:         #46464B;

  /* Semantic */
  --color-success:               #1A7F4B;
  --color-warning:               #B45309;
  --color-info:                  #204986;

  /* Source badge colours */
  --color-badge-wso:             #B45309;   /* amber */
  --color-badge-pl:              #1A7F4B;   /* green */
  --color-badge-tih:             #204986;   /* blue */
  --color-badge-generated:       #46464B;   /* muted */
}
```

**Tailwind config mapping:**
```ts
theme: {
  extend: {
    colors: {
      background: '#F9F9F9',
      paper: '#F8EFE6',
      'paper-dark': '#E5E1DA',
      surface: '#FFFFFF',
      'surface-muted': '#F3F3F4',
      primary: '#1D1F27',
      'primary-hover': '#05070E',
      accent: '#C22032',
      border: '#C7C6CB',
      'border-strong': '#46464B',
    },
    fontFamily: {
      display: ['Newsreader', 'Georgia', 'serif'],
      sans: ['Hanken Grotesk', 'sans-serif'],
      mono: ['DM Mono', 'monospace'],
    },
  }
}
```

**Colour rules:**
- Page backgrounds use `--color-paper` (#F8EFE6), not white — the warm tone is intentional
- Cards and elevated surfaces use `--color-surface` (#FFFFFF)
- Section dividers and secondary containers use `--color-paper-dark` (#E5E1DA)
- `--color-accent` (#C22032) for: active nav underline, CTAs, risk score critical state, progress fills
- `--color-primary` (#1D1F27) for: primary buttons, headings, nav active state
- Never use gradients

---

## Shape Language

The current design uses `border-radius: 8px` on cards and buttons. Replace with:

```css
--radius-sm:  0px    /* tags, badges, chips — sharp */
--radius-md:  0px    /* cards, inputs, buttons — sharp */
--radius-lg:  0px    /* modals, panels — sharp */
--radius-pill: 2px   /* only for category filter pills and source badges */
```

**This is the biggest visual shift.** Sharp edges give the journalistic, authoritative feel. The current rounded corners make it feel like a consumer app. Zero radius throughout except for small pills.

---

## Surfaces & Elevation

No shadows anywhere. Use borders and tonal layers instead:

```css
/* Cards */
background: var(--color-surface);           /* white */
border: 1px solid var(--color-border);      /* #C7C6CB */
border-radius: 0px;

/* Hover state — no shadow, just border darkens */
border: 1px solid var(--color-border-strong);

/* Section containers / panels */
background: var(--color-paper-dark);        /* #E5E1DA */
border: 1px solid var(--color-border);

/* Page background */
background: var(--color-paper);             /* #F8EFE6 */
```

Remove all `box-shadow` rules from the codebase. Replace with border color transitions.

---

## Navigation

```css
/* Site header */
background: var(--color-paper);             /* warm paper, not white */
border-bottom: 1px solid var(--color-border);
backdrop-filter: none;                      /* remove blur — flat printed feel */
height: 56px;

/* Logo */
font-family: var(--font-display);
font-size: 1.125rem;
font-weight: 700;
font-style: italic;                         /* italic serif masthead */
color: var(--color-primary);

/* Nav links */
font-family: var(--font-body);
font-size: 0.875rem;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--color-text-secondary);

/* Active nav link */
color: var(--color-primary);
border-bottom: 2px solid var(--color-accent);   /* red underline */

/* Profile badge */
font-family: var(--font-mono);
font-size: 0.6875rem;
background: var(--color-paper-dark);
border: 1px solid var(--color-border);
border-radius: 0px;
padding: 2px 6px;
```

---

## Buttons

```css
/* Primary */
background: var(--color-primary);           /* #1D1F27 charcoal */
color: #FFFFFF;
font-family: var(--font-body);
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
border-radius: 0px;                         /* sharp */
padding: 10px 20px;
border: none;
transition: background 150ms ease;

/* Primary hover */
background: var(--color-primary-hover);     /* #05070E near black */

/* Secondary */
background: transparent;
border: 1px solid var(--color-border-strong);
color: var(--color-primary);
border-radius: 0px;

/* Secondary hover */
background: var(--color-paper-dark);
```

---

## Inputs & Search

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: 0px;
height: 40px;
font-family: var(--font-body);
font-size: 0.9375rem;
color: var(--color-text-primary);

/* Focus */
border: 2px solid var(--color-primary);
outline: none;
box-shadow: none;                           /* no glow */
```

---

## Tags, Badges & Chips

```css
/* Skill / category tags */
font-family: var(--font-mono);
font-size: 0.625rem;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.08em;
padding: 2px 6px;
border-radius: 2px;                         /* slight pill only here */
border: 1px solid currentColor;
background: transparent;

/* Source badges */
.badge-wso      { color: var(--color-badge-wso);  border-color: var(--color-badge-wso); }
.badge-pl       { color: var(--color-badge-pl);   border-color: var(--color-badge-pl); }
.badge-tih      { color: var(--color-badge-tih);  border-color: var(--color-badge-tih); }
.badge-generated{ color: var(--color-badge-generated); border-color: var(--color-badge-generated); }

/* Status badges (Job Board) */
.badge-applied   { color: #204986; border-color: #204986; }
.badge-interview { color: #B45309; border-color: #B45309; }
.badge-offer     { color: #1A7F4B; border-color: #1A7F4B; }
.badge-rejected  { color: #77767C; border-color: #77767C; }
.badge-saved     { color: #46464B; border-color: #46464B; }
```

---

## Page-Specific Adjustments

### Dashboard
- Background: `--color-paper` (#F8EFE6)
- Risk Score card: white surface, charcoal circular score, red for Critical/High states
- "What to work on today" heading: Newsreader italic, not sans-serif

### Interview Prep
- Question cards: white surface, 1px border, 0px radius
- Category filter pills: 2px radius, uppercase Hanken Grotesk label-sm
- "Mark as practised" checkbox: sharp, no rounded corners
- Progress bar fill: `--color-accent` red

### Job Board
- Table rows: alternating `--color-surface` and `--color-surface-muted`
- Row borders: 1px `--color-border` horizontal only (no vertical borders)
- All status badges: outlined style as defined above

### GitHub Sweeper
- Repo cards: white surface, 1px border, 0px radius
- Difficulty badges: outlined, sharp
- Tab toggle (Repo / Skills): uppercase labels, active tab charcoal fill, inactive outlined

### Onboarding
- Step titles: Newsreader italic
- Progress bar: charcoal fill, `--color-paper-dark` track
- Form cards: white surface, 1px border, 0px radius
- Select dropdowns: 0px radius, 1px border

---

## What NOT to Change

- Page layouts, grid structures, column counts
- Navigation item labels or order
- Component positions within pages
- Any functionality or data logic
- Dark mode (still not in scope)
- Mobile breakpoints (keep existing)
- shadcn/ui component structure — only override visual styles via CSS variables and Tailwind

---

## Implementation Order

Apply in this order to avoid cascading conflicts:

1. Update Google Fonts import in `globals.css`
2. Update CSS custom properties (colour tokens + font tokens) in `globals.css`
3. Update `tailwind.config.ts` colour and font mappings
4. Remove all `box-shadow` rules globally — replace with border transitions
5. Set `border-radius: 0px` globally as default — add 2px exceptions only for pills/badges
6. Update button styles in shadcn/ui `components/ui/button.tsx`
7. Update card styles in shadcn/ui `components/ui/card.tsx`
8. Update input styles in shadcn/ui `components/ui/input.tsx`
9. Update nav in `components/layout/site-header.tsx`
10. Verify page backgrounds are `--color-paper` not white

---

*Reference design: Veritas News / Ground News aesthetic — broadsheet journalism adapted for a career intelligence tool.*
*Last updated: June 2026*
