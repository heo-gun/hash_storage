# castor — Design System

**Direction**: Technical Minimalism. Dark-first. Dense, developer-focused.
**References**: Linear (dark canvas + single accent), Vercel (Geist + negative tracking).

---

## 1. Color Tokens

```
/* Canvas — near-black ladder (Linear-style 4-step) */
--canvas:       #060607
--surface-1:    #0d0e10
--surface-2:    #131418
--surface-3:    #1a1b20
--hairline:     #24262c   /* 1px borders */
--hairline-2:   #34373f   /* hover/focus borders */

/* Ink — text ladder */
--ink:          #f5f6f7   /* primary text */
--ink-muted:    #c8ccd4   /* secondary */
--ink-subtle:   #7e848e   /* captions, fine print */
--ink-dim:      #4d525c   /* watermark, decorative hash strings */

/* Accent — single brand color (amber-cyan would feel too "ProtonMail")
   Pick: muted cyan-teal that reads as "hash/checksum" */
--accent:       #6ee7d5   /* primary brand, CTAs, focus rings */
--accent-hover: #8ff0e1
--accent-press: #5dd4c1
--accent-dim:   #1f3c39   /* tinted surfaces */

/* Semantic */
--success:      #34d399
--warn:         #fbbf24
--danger:       #f87171
```

Only **one accent color**. No gradients except the signature hash-thread animation.

---

## 2. Typography

**Families** (Google Fonts):
- `Geist` (sans) — display, body, UI
- `Geist Mono` — hashes, code, technical labels (the *signature* typeface for castor)

**Scale** (Tailwind-friendly):

| Role          | Size  | Weight | Tracking | Use                        |
|---------------|-------|--------|----------|----------------------------|
| Display-XL    | 72px  | 600    | -3.6px   | Hero headline              |
| Display       | 56px  | 600    | -2.5px   | Section headline           |
| H1            | 32px  | 600    | -1.0px   | Sub-section                |
| H2            | 22px  | 600    | -0.4px   | Card heading               |
| Body-LG       | 18px  | 400    | -0.2px   | Hero subhead, lead         |
| Body          | 15px  | 400    | -0.05px  | Default                    |
| Body-SM       | 13px  | 400    | 0        | Captions                   |
| Mono          | 13px  | 400    | 0        | Hashes, code               |
| Mono-SM       | 11px  | 500    | +0.4px   | Tags, eyebrow labels (uppercase) |

**Rules**:
- Negative tracking mandatory on display/headlines
- Mono ONLY for hashes/code/keys — never body
- Eyebrow labels (above headlines) ALWAYS `Mono-SM uppercase` in `ink-subtle`

---

## 3. Spacing & Radius

Base 4px.

```
xxs=4  xs=8  sm=12  md=16  lg=24  xl=32  2xl=48  3xl=64  section=96  hero=160
```

Border radius:
```
xs=4  sm=6  md=8  lg=12  xl=16  pill=9999
```

- Form/buttons: `md` (8)
- Cards: `lg` (12)
- Hero illustration frame: `xl` (16)

---

## 4. Elevation

No drop shadows on dark canvas. **Hierarchy via surface step + hairline borders only.**

```
flat:    bg-canvas
lifted:  bg-surface-1, border: 1px hairline
high:    bg-surface-2, border: 1px hairline-2
```

Hover: shift to next surface level + hairline-2.

---

## 5. Motion

**Library**: Framer Motion (interactions) + D3 (data viz / hash animations).

**Easing**:
- Default: `[0.22, 1, 0.36, 1]` (Linear's signature ease)
- Quick: `[0.4, 0, 0.2, 1]`
- Spring: `{ type: "spring", stiffness: 260, damping: 28 }`

**Durations**:
- Micro (button press): 120ms
- Standard (hover/reveal): 240ms
- Page section reveal: 600ms with 80ms stagger
- Hash animation cycle: 4–6s loop

**Page entry**: each section uses `whileInView` with `opacity 0→1` + `y 16→0`.

**Signature animation** (hero):
- 3 distinct file icons enter from spread positions
- Each emits a SHA-256 hash string trail (D3 force-directed path)
- 2 paths converge → 1 S3 bucket icon
- Counter shows "3 files → 1 object" with monospace ticker
- Loops every 6s

---

## 6. Components

### `Nav`
- Fixed top, `bg-canvas/70 backdrop-blur-md`, border-bottom `hairline`
- 64px tall, max-w-7xl mx-auto, px-6
- Left: castor wordmark (Geist 600, -0.4 tracking) + small mono hash badge `7a3f…`
- Right: Features / Pricing / GitHub / **Sign in** (ghost) / **Get started** (accent pill)

### `Button`
- **Primary**: `bg-accent text-canvas`, 14px font-medium, h-10, px-5, radius `md`, hover `accent-hover`
- **Secondary**: `bg-surface-2 text-ink border hairline-2`
- **Ghost**: `text-ink-muted hover:text-ink hover:bg-surface-1`
- **Pill variants**: same colors but `radius pill`, h-11, px-6 (used in hero/landing CTAs)

### `Card`
- `bg-surface-1 border hairline radius-lg p-6`
- Hover: `border-hairline-2`
- Icon top-left in `bg-accent-dim` square, accent color icon

### `MonoChip`
- For displaying hashes inline: `bg-surface-2 text-accent font-mono text-xs px-2 py-0.5 rounded-xs`

### `EyebrowLabel`
- `text-mono-sm uppercase tracking-wide text-ink-subtle`
- Often paired with a small dot or accent line

---

## 7. Decorative Patterns

- **Hash string watermark**: Background of hero shows huge `7a3f8b2e1d9c4f5a...` strings at 5% opacity, Geist Mono, scrolling slowly (parallax)
- **Hairline grid**: 1px grid lines at 64px intervals on hero backdrop, ultra-low opacity
- **Code blocks**: `bg-surface-2 border hairline-2 radius-md p-4 font-mono text-sm`. Syntax highlighting in accent + ink-muted only (no rainbow).

---

## 8. Page Patterns

### Hero band
- Vertical padding `hero` (160)
- Eyebrow → Display-XL headline → Body-LG subhead → CTA pair
- Below: signature animation (~640×400 canvas)
- Hash watermark background

### Feature grid (3-up)
- Section padding `section` (96 vertical)
- Section eyebrow + Display + supporting paragraph
- 3 `Card` components in grid, gap `lg`

### Code/demo band
- Polarity flip: still dark, but `bg-surface-1`
- Two-column: copy left, terminal/code mockup right

---

## 9. Tone (English copy)

- Sentences end with periods, even one-liners
- Avoid superlatives ("best", "fastest"). Use specifics
- Prefer technical accuracy over marketing fluff
- Example tone: "Content-addressed by SHA-256. Stored once, referenced anywhere."

---

## 10. Don't

- ❌ No drop shadows on dark canvas
- ❌ No second accent color
- ❌ No light mode for landing (app mode can have it later)
- ❌ No emoji in marketing copy
- ❌ No rounded full corners on rectangular elements (only pills/avatars)
- ❌ No mono font for body paragraphs
