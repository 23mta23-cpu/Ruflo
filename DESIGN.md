# Design System: WERKR

> German home services marketplace — iOS · Android · Web  
> Single source of truth for all screen generation, component creation, and visual decisions.

---

## 1. Visual Theme & Atmosphere

**Soft Structuralism — "Meisterbetrieb Showroom"**

WERKR feels like stepping into a well-lit German craftsman's showroom: clean white surfaces, warm forest-green accents, honest gold hardware, and materials with real depth. Not clinical, not flashy — trustworthy and premium at the same time.

The atmosphere is **airy but structured**. Every surface is intentional. Cards have mass. Shadows are tinted to their background hue, not pure black. The visual hierarchy is communicated through weight and scale — never by screaming with size. A Handwerker trusts tools that feel solid; WERKR's UI should feel the same way.

- **DESIGN_VARIANCE:** 6 — Offset asymmetric. Predictable enough to trust, varied enough to feel designed. Primary action tiles dominate; secondary elements stay compact.
- **MOTION_INTENSITY:** 4 — Fluid CSS. Spring hover states, subtle entry reveals, scale feedback on press. No cinematic scroll hijacks.
- **VISUAL_DENSITY:** 5 — Balanced Daily App. Enough breathing room to feel premium; enough information density to be a real marketplace.

**Palette family:** Forest (deep green + bone + gold accent). NOT the AI-default warm beige + brass family.

---

## 2. Color Palette & Roles

### Backgrounds & Surfaces
- **Bone Canvas** (`#F9F8F5`) — Primary app background. Cool, clean, neutral base for all screens.
- **Pure Surface** (`#FFFFFF`) — Card fills, modals, input backgrounds. Never on canvas directly; always elevated by 1px border or shadow.
- **Warm Inset** (`#F2EFE9`) — Input insets, pressed states, secondary areas. Slightly warm to differentiate from pure surface.
- **Primary Tint** (`#EBF4EF`) — Forest-green tinted surfaces. Nachbarschaft tiles, success states, secondary action backgrounds.
- **Gold Tint** (`#F6ECD8`) — Warm gold tinted surface. Primary onboarding card, recommended badges, Handwerker hero tile hover states.
- **Amber Tint** (`#FEF3E2`) — New-provider accent, warning states.
- **Clay Tint** (`#FCEEE8`) — Error adjacency, Terrakotta accent contexts.

### Typography
- **Warm Ink** (`#1A1917`) — Primary text. Headlines, labels, prices, names. Warm near-black.
- **Warm Sub** (`#6C6862`) — Secondary text. Descriptions, metadata, timestamps. Readable without competing.
- **Warm Muted** (`#756F66`) — Tertiary. Placeholders, disabled states, fine print.

### Brand Accents
- **Waldgrün** (`#1B5C40`) — PRIMARY WERKR brand accent. Used for: CTAs, active tab states, verified badges, Nachbarschaft accents, primary button fills. Saturation: 76%. Never neon, never glowing.
- **Forest Border** (`#B8DFC8`) — Waldgrün-tinted borders for green-background containers.
- **Handwerk Gold** (`#8F6B1A`) — Secondary accent. Handwerker hero tile, star ratings, Meister badges, gold CTAs on dark surfaces. Used WITH Waldgrün, never competing.
- **Amber Deep** (`#C07010`) — Darker amber for text on goldBg surfaces, warning states.
- **Terrakotta** (`#C4622D`) — Tertiary accent. Dispute states, cancellations, "Achtung" notices. Use sparingly.

### System Colors
- **Warm Border** (`#E5E1DA`) — Standard 1px borders on white surfaces.
- **Border-Subtle** (`#F1F5F9`) — Very light dividers inside cards.
- **Success** (`#16A34A`) — Transient success toasts only. NOT for brand use.
- **Error Red** (`#DC2626`) — Inline form errors, dispute status. Never decorative.

### Color Rules
- **ONE accent per screen**: Waldgrün for customer flows, Gold for Handwerker highlight tiles. Never both competing on the same component.
- **Shadow tint rule**: shadows on white cards use `rgba(15,23,42,0.06)`; shadows on Waldgrün tiles use `rgba(28,107,69,0.2)`; shadows on dark (ink) tiles use `rgba(15,23,42,0.18)`.
- **No pure `#000000`**. Off-black is `#1A1917` (Slate-900). Never pure black borders, shadows, or text.
- **No AI-purple**. No neon gradients. No glows. No blue-purple gradient accents.

---

## 3. Typography Rules

### Platform Context: React Native (Expo)
React Native uses the system font stack by default. WERKR does not load custom fonts to minimize bundle size and ensure instant text rendering on all devices. Typography is expressed through **weight, size, spacing, and letter-spacing** — not novelty typefaces.

### iOS System Font (SF Pro)
- Clean, legible, native. Premium weight variation available (100–900).
- Leverage `-0.2` to `-0.4` letter-spacing on display sizes for tighter premium feel.

### Android Font (Roboto / system)  
- Use `fontWeight: '700'` or `'800'` for display — Roboto at high weights looks refined.
- Ensure `letterSpacing` values are consistent; Android renders them differently.

### Web Prototype (werkr-prototype.html)
- Font family: `'Plus Jakarta Sans', system-ui, sans-serif` (Google Fonts CDN already loaded)
- Do NOT use Inter, Roboto, Arial, or Open Sans.
- Serif fonts: completely banned on WERKR.

### Typography Scale

| Role | Size | Weight | Letter Spacing | Line Height | Color |
|------|------|--------|----------------|-------------|-------|
| Display Hero | 28–34px | 800 | -0.5 | 1.1 | `C.ink` |
| Screen Title | 22–26px | 800 | -0.3 | 1.2 | `C.ink` |
| Section Header | 17–18px | 700 | -0.1 | 1.3 | `C.ink` |
| Card Title | 15–16px | 700 | 0 | 1.3 | `C.ink` |
| Body / Description | 13–14px | 400 | 0 | 1.5 | `C.sub` |
| Label / Caption | 11–12px | 600 | +0.5 | 1.3 | `C.muted` |
| Micro Badge | 9–10px | 800 | +0.8 | 1.0 | accent |
| Price / Number | 18–24px | 800 | -0.3 | 1.0 | `C.ink` |

### Typography Anti-Patterns
- **No label below input** — label is always ABOVE the input field.
- **No placeholder-as-label** — placeholder text is hint text, never the field label.
- **No uppercase on body text** — uppercase only for micro-badges and category labels (11px max).
- **No emoji in UI text** — use Ionicons SVG icons exclusively.
- **No giant H1s as design move** — hierarchy through weight contrast, not raw scale.
- **No mixed font families** — system font everywhere. One family.

---

## 4. Shadow System

WERKR shadows are always tinted to the container's background hue — never pure black. Elevation communicates hierarchy.

```
shadow.xs  — 0 1px 2px rgba(15,23,42,0.04)   elevation: 1   — hairline lift
shadow.sm  — 0 2px 6px rgba(15,23,42,0.06)   elevation: 2   — standard card
shadow.md  — 0 4px 12px rgba(15,23,42,0.08)  elevation: 4   — modal, focused card
shadow.lg  — 0 6px 18px rgba(15,23,42,0.10)  elevation: 6   — drawer, bottom sheet
```

**Special tinted shadows:**
- Dark (ink) tiles: `shadowColor: '#1A1917', shadowOpacity: 0.18, shadowRadius: 14`
- Waldgrün tiles: `shadowColor: '#1B5C40', shadowOpacity: 0.16, shadowRadius: 10`
- Gold primary card: `shadowColor: '#8F6B1A', shadowOpacity: 0.14, shadowRadius: 12`

---

## 5. Spacing System

WERKR uses an 8-point grid. All spacing values are multiples of 4 or 8.

| Token | Value | Use |
|-------|-------|-----|
| `space.xs` | 4px | Icon-text gap, badge padding |
| `space.sm` | 8px | Tight component internal padding |
| `space.md` | 12px | Standard gap between elements |
| `space.lg` | 16px | Card internal padding (compact) |
| `space.xl` | 20px | Card internal padding (standard), section horizontal padding |
| `space.2xl` | 24px | Section bottom margin |
| `space.3xl` | 32px | Major section gaps |
| `space.4xl` | 48px | Screen top padding |

**Horizontal screen padding:** always `paddingHorizontal: 20` (consistent with Expo's safe area).

---

## 6. Component Patterns

### 6.1 Hero Tile (Primary Action — "Handwerker finden")
The primary action tile is DARK — it anchors the visual hierarchy and commands attention.

```
backgroundColor: C.ink (#1A1917)
borderRadius: 16
padding: 20
shadowColor: C.ink, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8
```

**Inside structure:**
- Row: [gold icon circle 38px] + [title 16px/800 white] + [arrow circle 30px gold tint]
- Bottom: micro-text "Sanitär · Elektro · Maurer · und mehr" in rgba(255,255,255,0.35)

**Rules:** Full-width. Never side-by-side with another equal tile. The ONLY dark surface on the home screen.

### 6.2 Secondary Compact Strip (Nachbarschaft, B2B links)
Compact horizontal row for secondary discovery features. Not a tile — a strip.

```
backgroundColor: C.primaryBg
borderRadius: 12
padding: 14
borderWidth: 1, borderColor: C.primaryBd
flexDirection: 'row'
```

**Inside:** [icon 34px circle with rgba(28,107,69,0.12)] + [title/sub text flex: 1] + [chevron right in C.primary]

### 6.3 Double-Bezel Card (Onboarding Primary)
The "recommended" path gets a nested shell architecture for depth.

```
/* Outer shell */
borderWidth: 1.5, borderColor: '#EAD99A'
backgroundColor: '#FFFCF0'   (warm off-white)
borderRadius: 18
shadowColor: '#8F6B1A', shadowOpacity: 0.14, shadowRadius: 12

/* Inner content pad */
padding: 22
```

**Rules:** Only for the single most important action on a screen. One per screen max.

### 6.4 Standard Card (Provider listings, contracts, messages)
```
backgroundColor: C.surface (#FFFFFF)
borderWidth: 1, borderColor: C.border
borderRadius: 12
padding: 14
shadowColor: '#1A1917', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2
```

**Anti-pattern:** Do NOT put a card inside a card. Do NOT use cards just to add visual interest — cards communicate elevation hierarchy.

### 6.5 Buttons

**Primary (Waldgrün fill):**
```
backgroundColor: C.primary (#1B5C40)
borderRadius: 12
paddingVertical: 14, paddingHorizontal: 24
Text: 15px, fontWeight: '700', color: '#FFFFFF'
Active: scale(0.97), opacity: 0.92
```

**Primary (Dark/Gold — on dark tiles):**
```
backgroundColor: 'rgba(184,147,10,0.2)'
borderWidth: 1, borderColor: 'rgba(184,147,10,0.3)'
Text: C.gold
```

**Ghost / Secondary:**
```
borderWidth: 1.5, borderColor: C.border
backgroundColor: transparent
Text: C.sub
borderRadius: 10
```

**Destructive:**
```
backgroundColor: C.redBg
borderWidth: 1, borderColor: C.red (opacity 0.3)
Text: C.red
```

**Rules:**
- Button text NEVER wraps to 2 lines. Shorten the label, not the button.
- No outer glows or neon shadows on buttons.
- `cursor: 'pointer'` on web.
- Disabled state: `opacity: 0.5`, no press feedback.
- Loading state: replace text with `ActivityIndicator`, same height.

### 6.6 Avatar / Initials
```
Provider avatar: 44px circle, backgroundColor: C.goldBg, text: C.gold, fontSize: 18, fontWeight: '700'
Customer avatar: 40px circle, backgroundColor: C.primaryBg, text: C.primary
```

Real photos: circular clip, 44px. Always provide initials fallback.

### 6.7 Badge / Chip
```
Meisterbrief: backgroundColor: C.goldBg, borderColor: #EAD99A, text: C.amber, 10px/800, uppercase, tracking 0.7
Verifiziert:  backgroundColor: C.primaryBg, borderColor: C.primaryBd, text: C.primary, 10px/700, uppercase
Neu:          backgroundColor: C.amberBg, text: C.amber, 10px/700, uppercase
Status Open:  backgroundColor: C.primaryBg, text: C.primary
Status Done:  backgroundColor: '#F0FDF4', text: '#15803D'
Status Cancel: backgroundColor: C.redBg, text: C.red
```

### 6.8 Input Fields
```
Label: above input, 12px/600, C.sub, marginBottom: 6
Input: backgroundColor: C.bgWarm (#F2EFE9), borderRadius: 10, padding: 13, fontSize: 15, color: C.ink
       borderWidth: 1.5 on focus (borderColor: C.primary)
Placeholder: color: C.muted
Error text: below input, 12px, C.red, marginTop: 4
Hint text: below input, 11px, C.muted
```

No floating labels. No placeholder-as-label. Error is inline, below field.

### 6.9 Loading States
- Skeleton shimmer: matching the exact shape of the content to be loaded (not a generic spinner)
- Shimmer gradient: from `C.skeletonBase (#E5E1DA)` to `C.skeletonHighlight (#F9F8F5)`
- Full-screen loading: `ActivityIndicator` in `C.primary` centered on `C.bg`
- Button loading: replace label with `ActivityIndicator size="small"`, same button dimensions

### 6.10 Empty States
Composed, specific. Never just "Keine Daten".
- Icon (Ionicons, 48px, `C.muted`)
- Headline: 15px/700, `C.ink`
- Body: 13px, `C.sub`, max 2 lines
- Optional CTA button

---

## 7. Layout Principles

### Home Screen Tile Hierarchy (Asymmetric Bento)
```
NEVER: Two equal-width tiles side by side (the "3-equal-cards" anti-pattern with 2 tiles)
ALWAYS: Asymmetric hierarchy

Structure:
[ HERO TILE — full width, dark, primary action (Handwerker) ]
[ Compact strip — secondary action (Nachbarschaft) — only for private accounts ]
```

### Asymmetric Bento Rules
- The PRIMARY action always has more visual weight (larger, darker, or richer background)
- Secondary elements are compact, strip-style or smaller
- A section with 2 items should use 70/30 or 60/40 split, never 50/50
- Never 3 equal cards horizontally. Ever.

### Section Structure
```
Screen title + subtitle
[Search bar / filter]
[Hero tile]
[Secondary strips]
[Section header (17px/700)]
  [Horizontal scroll or vertical list]
[Section header]
  [Content]
```

### Screen Horizontal Padding
Always `paddingHorizontal: 20`. Full-bleed only for background colors — content inside always padded.

### Mobile-First Collapse (Web prototype)
- Below 768px: all multi-column → single column
- Tile rows → vertical stacks  
- Provider cards → full-width list items
- No horizontal overflow (except intentional `ScrollView` with `horizontal`)

### Touch Target Minimum
All interactive elements: minimum 44×44px. Increase `hitSlop` for small icons: `{ top: 10, bottom: 10, left: 10, right: 10 }`.

---

## 8. Motion & Interaction

WERKR motion is **spring-based and purposeful**. Every animation communicates something: hierarchy, feedback, or state change. No animation exists just to look cool.

### Press Feedback (EVERY interactive element)
```
AnimatedButton: scale(0.96) on press, duration: 100ms, ease-out spring
All TouchableOpacity: activeOpacity: 0.75 (not 0.5, not 1.0)
```

### Entry Reveals (only on first load, not repeated)
```
Cards entering: translateY(8) → 0, opacity 0 → 1, duration: 300ms, spring stiffness: 280, damping: 28
Stagger: 60ms per card
```

### State Transitions
```
Tab switch: immediate (no animation — tabs feel instant)
Modal open: translateY(full) → 0, duration: 320ms, spring overshoot minimal
Skeleton → content: opacity cross-fade, 200ms
```

### Hover States (Web only)
```
Cards: boxShadow increase, translateY(-2px), 200ms ease-out
Buttons: brightness(1.05), 150ms
Tiles: no scale (layout-shift risk) — only shadow/brightness
```

### Rules
- **No scroll hijacks** (`window.addEventListener('scroll')` banned)
- **No infinite loops** on content cards — only on status indicators (live dot, loading)
- **Reduced motion**: all transitions collapse to instant under `prefers-reduced-motion`
- **No layout animations** on native — only `opacity` and `transform`

---

## 9. Provider & Customer Flow Visual Differentiation

### Customer Screens (`app/(tabs)/`, `app/angebot.tsx`, etc.)
- Accent: **Gold** for primary tiles, **Waldgrün** for CTAs and confirmation states
- Background: `C.bg` (Slate-White)
- Hero tile: dark (`C.ink`) with gold icon

### Provider Screens (`app/(provider)/`)
- Accent: **Waldgrün** throughout (earnings, status, completion)
- Background: `C.bg`
- Cards: left accent border in `C.primary` for active contracts
- Earnings numbers: `18–24px/800, C.ink` (Handwerker sees money prominently)

### B2B Accounts
- Nachbarschaft tile: hidden (never show for `accountType === 'business'`)
- Company name badge: shown on profile with `Ionicons name="business-outline"`
- USt-IdNr: shown in invoice details with `§13b UStG` note
- Visual treatment: same as consumer, no separate B2B color scheme

---

## 10. Anti-Patterns (Banned — WERKR Hard Rules)

### Visual
- **No equal-width tile pairs** — always asymmetric hierarchy (Hero + compact secondary)
- **No pure black** (`#000000`) — use `C.ink (#1A1917)` as darkest value
- **No neon or outer glows** — shadows are always soft, tinted, inward
- **No AI-purple** (`#6366F1`, `#8B5CF6`, or any purple family) — not in WERKR's palette
- **No gradient text on headlines** — weight and color communicate hierarchy
- **No glass cards on every surface** — glass only for modal overlays when appropriate
- **No emoji as UI icons** — Ionicons SVG icons exclusively
- **No 3 equal cards in a row** — use asymmetric bento or horizontal scroll

### Typography
- **No generic serif fonts** — WERKR is sans-serif everywhere
- **No `Inter` as web font** — use Plus Jakarta Sans for web prototype
- **No uppercase on body text** — uppercase only for micro-badges (9–11px max)
- **No oversized H1s** as design move — 22–26px for screen titles, 34px max for hero

### Content & Copy
- **No "Elevate", "Seamless", "Unleash", "Next-Gen"** — concrete German verbs and nouns
- **No fake-perfect numbers** (`99%`, `10.000 Kunden`) — use real data or remove
- **No generic names** ("Max Muster", "Hans Schmidt") — use realistic German names
- **No "Scroll to explore"** or scroll indicators — content pulls users naturally
- **No placeholder URLs / broken images** — use initials-avatar fallback or real assets

### Structure
- **No cards inside cards** — flat hierarchy within a card
- **No equal-weight competing CTAs** — one primary, one secondary max per screen
- **No full-screen modal for simple confirmations** — use `showAlert()` or inline confirm
- **No sticky nav bars eating viewport** — bottom tab bar is the primary nav
- **No duplicate labels for the same action** — one label per intent, consistent across screens
- **No `em-dash (—)` anywhere** — use comma, period, or hyphen (-) instead

### Code
- **No `C.green` or `C.greenBg`** in new screens — always `C.primary` and `C.primaryBg`
- **No client-side monetary division** — DB stores euros, `Math.round(price * 100)` only in Edge Functions for Stripe
- **No `contracts.status='completed'` client-side** — only `release-escrow` Edge Function may set this
- **No `stripe_onboarded=true` client-side** — only `stripe-webhook` may set this

---

## 11. Screen Audit Checklist

Before shipping any screen, verify:

- [ ] No equal-width competing tiles (asymmetric hierarchy enforced)
- [ ] No `C.green` / `C.greenBg` (use `C.primary` / `C.primaryBg`)
- [ ] All interactive elements have press feedback (`activeOpacity` or `AnimatedButton`)
- [ ] All interactive elements min 44×44px touch target
- [ ] Spinner shown AND hidden correctly (no stuck loaders)
- [ ] Error state handled inline (not swallowed)
- [ ] Loading state matches content shape (skeleton, not spinner where possible)
- [ ] Empty state has content (icon + headline + body)
- [ ] No emoji in UI text
- [ ] Prices shown in euros with 2 decimal places (e.g. `€ 240,00`)
- [ ] Push notifications fire for all state changes that affect the other party
- [ ] TypeScript check passes: `npx tsc --noEmit`

---

*Generated by stitch-design-taste skill on 2026-06-22. Update when brand tokens or component patterns change.*
