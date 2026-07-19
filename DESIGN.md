# Design System: Stitch Talk

**Product:** Stitch Talk — a chat-first design atelier for UI/UX designers  
**Source of truth:** Implemented in `app/globals.css` + app routes (atelier identity)  
**Project ID:** Local product system (not a Google Stitch project ID)

> Use this document when prompting Stitch (or any generator) to create new screens.
> Prefer **visual descriptions** + **exact hex codes**. Do not invent a second palette.

---

## 1. Visual Theme & Atmosphere

Stitch Talk feels like a **warm design studio desk**, not a SaaS dashboard and not a purple AI chat toy.

- **Mood:** Editorial, tactile, calm, craft-forward — “paper, ink, and a vermillion stitch.”
- **Density:** Daily-app balanced (~5/10). Comfortable whitespace; never cockpit-dense, never gallery-empty.
- **Variance:** Offset asymmetric (~7/10). Left-aligned heroes, thread spines, accent swatches — not centered generic card grids.
- **Motion:** Fluid CSS micro-motion (~6/10). Short springy eases; stitch-pulse loading; no cinematic page takeovers.
- **Philosophy:** Design the *feel* before anything is generated. UI should look like it was art-directed by a human designer for other designers.

**Texture of the room**

- Warm paper canvas with subtle vignette and a whisper of grain (multiply noise), never flat pure white.
- A **thread** metaphor runs through structure: dashed stitch lines, knot nodes on timelines, vermillion accent rules on cards.
- Surfaces raise slightly (cream paper cards) with soft, ink-tinted shadows — not glassmorphism, not neon glow.

**Tone of voice in UI**

- Direct, human, short. No “Elevate your workflow,” “Unleash,” or “Next-gen.”
- Labels like *thread*, *project*, *brief*, *pin a reference* — studio language, not enterprise jargon.

---

## 2. Color Palette & Roles

Warm neutrals only. **One primary accent** (vermillion thread). One craft secondary (deep teal) used sparingly for differentiation, never as a second CTA color.

### Surfaces

| Descriptive name | Hex | Role |
|------------------|-----|------|
| **Warm Paper** | `#F0EBE1` | Primary canvas / page background |
| **Raised Cream** | `#F7F3EB` | Cards, composer panels, menus, raised surfaces |
| **Sunken Paper** | `#E6E0D4` | Recessed areas, code chips, hover fills |
| **Hairline Rule** | `color-mix(ink 12% → transparent)` ≈ ink at 12% | Default borders, dividers |
| **Strong Rule** | `color-mix(ink 22% → transparent)` ≈ ink at 22% | Input borders, active outlines |

### Ink (text)

| Descriptive name | Hex | Role |
|------------------|-----|------|
| **Warm Charcoal Ink** | `#141210` | Primary text, primary solid buttons, marks |
| **Soft Umber** | `#3D3832` | Body secondary, assistant prose, descriptions |
| **Faint Driftwood** | `#7A7268` | Metadata, timestamps, hints, path parents |

Never pure black `#000000`. Never cool zinc/slate that fights the warm paper.

### Accent — Thread (singular)

| Descriptive name | Hex | Role |
|------------------|-----|------|
| **Vermillion Thread** | `#D6452F` | Primary CTA fill, stitch spine, active markers, focus ring source, kicker labels |
| **Thread Deep** | `#A83422` | Hover on thread CTAs, italic emphasis in headlines, link hover |
| **Thread Soft** | Thread ~14% on paper | Soft focus rings, selected tints, light washes |

### Craft secondary (non-CTA)

| Descriptive name | Hex | Role |
|------------------|-----|------|
| **Studio Teal** | `#1F4F48` | Project swatch variant, “gaps” callout panels, alternate top-edge on step cards |
| **Teal Soft** | Teal ~12% on paper | Background wash for insight / gap panels only |

### Semantic

| Descriptive name | Hex | Role |
|------------------|-----|------|
| **Alert Clay** | `#B42318` | Errors, destructive text |
| **Alert Soft** | Danger ~12% on paper | Error banners / field error backgrounds |

### Banned color patterns

- AI purple / indigo neon (`#7C3AED`, violet gradients, blue-purple glows)
- Pure white canvas (`#FFFFFF`) as the main app background
- Pure black text or chrome
- Oversaturated accent > ~80% — Thread is confident but earthy
- Rainbow multi-accent CTAs

---

## 3. Typography Rules

Four roles. Do not collapse to a single generic sans.

| Role | Family | Use |
|------|--------|-----|
| **Display** | **Bricolage Grotesque** | Page titles, card names, brand moments, assistant headings. Weight 600. Tracking tight (~-0.02em to -0.035em). |
| **UI** | **Figtree** | Navigation, buttons, labels, forms, body UI. Weights 400–650. |
| **Reading** | **Source Serif 4** | Long-form assistant replies / markdown prose only. Not for dashboards or chrome. |
| **Mono** | **JetBrains Mono** | Brief prompts, indices (`01`), timestamps optional, code. Size smaller than body. |

### Hierarchy character

- **H1 / hero:** Display, clamp roughly `2.1rem → 3.15rem`, line-height ~1.08–1.15, italic *emphasis* in Thread Deep for one key word only.
- **H2 / page title:** Display ~`1.75–2.15rem`, weight 600.
- **Section titles:** Display ~`1.25–1.65rem`.
- **Body:** UI or Reading depending on context; ~`0.95–1.1rem`, line-height 1.5–1.65, max measure ~65ch for long copy.
- **Meta / kicker:** Uppercase, wide letter-spacing (~0.08–0.14em), size ~0.68–0.75rem, color Faint Driftwood or Thread.
- **Buttons:** UI, weight ~550–600, slight negative tracking.

### Banned type

- Inter (and “Inter-like default AI UI”)
- Generic system stacks as the *identity* face
- Georgia / Times / Garamond as product chrome (Source Serif 4 is allowed **only** for assistant reading surfaces)
- Giant screaming display sizes without hierarchy
- Gradient-filled headline text

---

## 4. Component Stylings

### Buttons

- **Shape:** Pill-shaped (`border-radius: 999px`). Min height ~40px; large CTAs ~48px.
- **Primary (ink):** Warm Charcoal fill, Raised Cream text. Hover shifts slightly toward Thread.
- **Primary action (thread):** Vermillion Thread fill, near-white text, soft thread-tinted shadow under the button (not a neon outer glow). Hover → Thread Deep. Active: 1px downward press.
- **Ghost / secondary:** Transparent or Raised Cream, Strong Rule border, Soft Umber text. Hover raises border contrast.
- **Icon buttons:** Softly rounded squares (~12px radius), 40–42px hit target.
- **Disabled:** Opacity ~0.4, no pointer.
- **Rule:** One primary CTA per view region. No dual competing filled buttons.

### Cards / containers

- **Project cards:** Raised Cream, hairline rule, soft ink-tinted shadow, generously rounded (~20px). Left **color swatch bar** (6px) in Thread / Teal / Ink / Sand — identity without icons-as-emoji.
- **Hover:** Lift 2px, slightly stronger shadow, border darkens gently.
- **Thread list rows:** Single shared container with internal hairline dividers (not separate floating cards per row).
- **Assistant message cards:** Raised Cream, large soft radius with a slightly tighter bottom-left; **3px Thread gradient rule** at top of card as a signature stitch.
- **User messages:** Warm Thread-tinted gradient wash, right-aligned, annotation / sticky-note feel.
- **Empty panels:** Dashed Strong Rule border, centered composition, one primary CTA.

### Inputs / forms

- Labels **above** fields (never placeholder-only).
- Field: Raised Cream or transparent on paper, Strong Rule stroke, medium rounding (~12px), min height 44px.
- Focus: border shifts toward Thread; **3px Thread Soft ring** (no neon glow).
- Errors: Alert Clay text + Alert Soft background near the field.
- Composer (chat): Floating Raised Cream panel, large radius (~24px), soft float shadow; attach + textarea + send as a single tool strip.

### Navigation — Studio bar

- **Not** a marketing mega-header. A thin **orientation strip**.
- Jobs only: quiet mark → projects; **breadcrumb path** (where am I); **account pill** (who am I).
- Mark: outlined tile (not a heavy black logo block), 32px, hairline border.
- Path: parents in Faint Driftwood (links); current page in Charcoal Ink, semibold.
- Account: pill with first name + ink avatar initials; dropdown on Raised Cream with float shadow.
- Align bar content to the same max width as page content (~56rem).
- Primary create actions (**New project**, **New thread**) live in the **page header**, not competing in the bar.

### Chat / thread spine

- Continuous **dashed vermillion stitch** down the left of the conversation.
- **Knots** at each message: hollow for assistant, filled Thread for user.
- Generating state: three short horizontal **stitch dashes** pulsing — not three bouncing dots.

### Modals / sheets

- Centered Raised Cream sheet, large radius, float shadow.
- Scrim: Warm Charcoal ~48% + light blur.
- Optional **stitch edge** detail on top of brief/print-style sheets (repeating Thread dashes).
- Escape + scrim dismiss; clear close control.

### Loaders

- Prefer stitch-pulse or skeleton shapes matching layout.
- Avoid generic circular spinners as the brand loading motif.

---

## 5. Layout Principles

### Structure

- **Product model:** Landing → Auth → **Projects** → **Project (threads)** → **Chat thread**.
- Authenticated pages: studio bar + content column.
- Content max width ~**56rem** for app lists; chat reading column ~**42rem**.
- Landing can breathe wider (~68rem) for nav/footer only; hero still left-aligned and constrained (~42rem).

### Spacing rhythm

Use the 4/8-based scale: `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4.5 rem`.

- Page top padding generous (~2–3rem).
- Section gaps clear; avoid cramped multi-widget dashboards.
- Touch targets ≥ 44px.

### Grid & composition

- Project grid: 1 column mobile → **2 columns** from ~720px. Not a forced 3-equal marketing card row inside the app.
- Landing “how it works”: up to 3 steps is allowed only as **editorial step tiles** with distinct top-edge colors — not identical SaaS feature cards with stock icons.
- Heroes: **left-aligned**, not dead-centered marketing blobs.
- No overlapping text/image layers. Every element owns a clear spatial zone.
- Full-height shells use `100dvh` (never brittle `100vh`-only thinking on mobile).

### Responsive

- **&lt; 640–768px:** Single column everywhere; collapse multi-col grids; hide nonessential path chrome if needed; account name may collapse to avatar-only.
- No horizontal scroll.
- Sticky studio bar and chat composer respect safe areas.

---

## 6. Motion & Interaction

- **Default ease:** Smooth deceleration `cubic-bezier(0.22, 1, 0.36, 1)` (~200ms micro, ~380ms entrances).
- **Spring-ish overshoot** only sparingly: `cubic-bezier(0.34, 1.4, 0.64, 1)`.
- **Hover:** Soft lift on cards (`translateY(-2px)`), border/shadow expansion — not scale explosions.
- **Press:** Buttons translate down ~1px or scale ~0.96 on send.
- **Lists:** Optional short fade/slide-in on new messages; staggered reveals 30–50ms if used.
- **Loading:** Infinite stitch-pulse on active generation.
- **Animate only** `transform` and `opacity`. No layout thrash animations.
- **Respect** `prefers-reduced-motion` (collapse motion to near-instant).

No custom mouse cursors. No perpetual floating orbs. No gradient shimmer logos.

---

## 7. Product UI Patterns (for generating new screens)

When asking Stitch for a new screen, preserve this information architecture:

| Screen | Purpose | Primary action |
|--------|---------|----------------|
| **Landing** | Explain value; get the designer in | One CTA: Start free / Get started |
| **Login / Signup** | Minimal fields; enter studio | Sign in / Create account |
| **Projects (dashboard)** | List projects as workspaces | New project |
| **Project hub** | List design threads | New thread |
| **Chat thread** | Conversation + brief | Generate brief |

**Simplicity rules**

- One clear primary action per screen.
- Empty states always explain *what goes here* + one CTA.
- Breadcrumbs over multi-level sidebars.
- No junk drawers of nav items.

**Signature motifs to reuse**

1. Vermillion thread / stitch line  
2. Warm paper grain atmosphere  
3. Display + UI + (reading serif only in chat)  
4. Pill CTAs  
5. Project left swatch  
6. Studio orientation bar (mark · path · account)

---

## 8. Hero & Marketing (Landing only)

- Left-aligned editorial hero on paper.
- Kicker: uppercase Thread label + short rule line.
- One italicized emotional word in the headline (e.g. *feel*).
- Maximum **one** primary filled CTA; optional quiet ghost secondary (e.g. demo studio).
- **Banned on landing:** “Scroll to explore,” bouncing chevrons, centered glass hero, 3 identical icon feature cards, fake metrics (`99.9%`, “10k designers”).

---

## 9. Anti-Patterns (Banned)

Explicit **never** list for Stitch / AI generation:

- No emojis as UI icons (use consistent stroke SVG only)
- No Inter / Roboto / “default AI SaaS” stacks as brand type
- No pure black `#000000` or pure white `#FFFFFF` as the main chrome pair
- No AI purple, neon blue, or multicolor mesh gradients
- No outer neon glows on buttons or cards
- No glassmorphism-everywhere frosted mega panels
- No shadcn/default gray admin look as the product identity
- No 3-column equal generic feature grids in the app shell
- No heavy multi-item top nav that does nothing
- No dead avatar that links to the same page
- No overlapping text and images
- No custom cursors
- No AI copy clichés: *Elevate, Seamless, Unleash, Next-Gen, Supercharge, Delve*
- No fake metrics, fake testimonials, or invented KPIs
- No `LABEL // 2025` typography gimmicks
- No “John Doe” / “Acme Corp” placeholders when real mock names exist (use studio-like names: Aurora Health, Alex Rivera)
- No circular spinners as the only loading language (prefer stitch pulse / skeletons)
- No serif type in dashboard chrome (serif only for chat reading surfaces)

---

## 10. Prompting Cheatsheet (for Stitch)

Paste a short version of this when generating screens:

```text
Design a [screen name] for Stitch Talk, a design-atelier product for UI/UX designers.

Atmosphere: warm paper studio, editorial, craft — not SaaS purple AI.
Canvas: Warm Paper #F0EBE1. Cards: Raised Cream #F7F3EB.
Ink: #141210 / #3D3832 / #7A7268.
Single accent: Vermillion Thread #D6452F (CTAs, stitch, focus). Secondary craft teal #1F4F48 sparingly.
Type: Bricolage Grotesque (display), Figtree (UI), JetBrains Mono (meta). Source Serif 4 only for long chat prose.
Buttons: pill-shaped; primary actions in Thread red; secondary ghost with warm border.
Cards: soft ink-tinted shadows, ~20px rounding, optional left swatch.
Nav: thin studio bar — quiet mark, breadcrumb path, account pill. Page owns primary CTA.
Motif: dashed stitch lines and knot nodes where timelines appear.
No Inter, no pure black/white chrome, no neon purple, no emoji icons, no fake metrics.
Keep UX simple: one primary action, clear empty states, mobile single-column.
```

---

## 11. Token Reference (implementation)

| Token | Value |
|-------|-------|
| `--paper` | `#f0ebe1` |
| `--paper-raised` | `#f7f3eb` |
| `--paper-sunken` | `#e6e0d4` |
| `--ink` | `#141210` |
| `--ink-soft` | `#3d3832` |
| `--ink-faint` | `#7a7268` |
| `--thread` | `#d6452f` |
| `--thread-deep` | `#a83422` |
| `--teal` | `#1f4f48` |
| `--danger` | `#b42318` |
| `--radius-sm` | `6px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `20px` |
| `--radius-pill` | `999px` |
| `--dur` | `200ms` |
| `--dur-slow` | `380ms` |
| `--content-max` | `42rem` (chat) |
| App content width | `56rem` |
| Landing shell | `68rem` |

---

*End of design system. When in doubt: warmer paper, fewer accents, quieter chrome, clearer path.*
