# PG360 × ReactBits — UI Modernization Report

**Source:** https://reactbits.dev (130+ animated React components — Text Animations,
Animations, Components, Backgrounds).
**Goal:** map ReactBits pieces onto PG360's real screens to make the product feel
modern, without breaking content or hurting the SaaS's usability/perf.

---

## 1. How ReactBits fits our stack

| Our stack | ReactBits | Notes |
|---|---|---|
| Next.js 15 App Router, React 19 | ✅ Compatible | All animated pieces are client components — add `"use client"`. |
| TypeScript + Tailwind v4 | ✅ Use the **TS + Tailwind** variant | Some examples assume Tailwind v3; our tokens are CSS variables, so pass colors via `style`/CSS vars. The **CSS variant** sidesteps any v4 class drift. |
| framer-motion 12 (already installed) | ✅ Reuse | Many components use it; no new dep for those. |
| Install | `npx shadcn@latest add @react-bits/<Name>-TS-TW` **or** copy-paste | Copy-paste preferred — keeps it in our design system, no lock-in. |
| **WebGL backgrounds** (Aurora, Beams, Silk, Threads, Orb…) | ⚠️ Need `ogl`/`three` (+ sometimes `gsap`, `postprocessing`) | Heavier bundle. Lazy-load with `next/dynamic({ ssr: false })`. **Use at most ONE.** |
| License | MIT + Commons Clause | Fine to use inside our app; can't resell the components as a product. |

**Already built (don't re-add):** Lenis smooth scroll, hero parallax atmosphere,
KPI **Count Up**, 3D card **tilt**, `Reveal` (scroll reveal), CSS dot-grid, marquee,
floating card. So from ReactBits, **skip** Count Up, basic Tilted Card, Dot Grid,
and basic Scroll Reveal — we have equivalents.

---

## 2. Recommendations by screen (marketing — pg360.software)

> The marketing site is where effects belong. Keep the admin/tenant app restrained
> (see §3).

### Hero  ([page.tsx → Hero], [hero-preview.tsx], [hero-atmosphere.tsx])
| ReactBits | Use it for | Priority | Caution |
|---|---|---|---|
| **Aurora** *or* **Beams** *or* **Silk** | Replace/augment the static blob background with a living teal↔clay gradient field | ⭐⭐⭐ | WebGL — lazy-load, one only, drop on mobile |
| **Split Text** *or* **Blur Text** | Word-by-word reveal of the `<h1>` ("Run your PG like a five-star property") | ⭐⭐⭐ | Keep exact words; gate reduced-motion |
| **Shiny Text** / **Gradient Text** | The "five-star" emphasis word (we have a clay gradient — Shiny adds a sheen) | ⭐⭐ | subtle |
| **Star Border** / **Magnet** | The "Start free" CTA (animated border / magnetic pull) | ⭐⭐ | one CTA only |

### Trust marquee  ([page.tsx → Marquee])
| **Scroll Velocity** | Make the stats strip speed up / skew with scroll velocity and reverse on scroll-up | ⭐⭐⭐ | replaces our CSS marquee |
| **Logo Loop** | If you add "trusted by"/payment logos later | ⭐ | — |

### Features grid  ([page.tsx → Features])
| **Magic Bento** *or* **Spotlight Card** | Cursor-follow spotlight glow + particles on the 6 feature cards — the single biggest "modern" upgrade here | ⭐⭐⭐ | Magic Bento is richer; Spotlight Card is lighter |
| **Glare Hover** / **Pixel Card** / **Chroma Grid** | Alternative card hover treatments | ⭐ | pick one style, stay consistent |
| **Scroll Float** | Per-word scroll-scrubbed reveal on the section heading | ⭐⭐ | — |

### Portal spotlight (phone mockup)  ([page.tsx → PortalSpotlight])
| **Tilted Card** | Tilt the phone mockup on hover | ⭐⭐ | we have tilt logic to reuse |
| **Profile Card** | Restyle the tenant ("Arjun Nair") card as a premium profile card | ⭐ | optional |
| **Scroll Stack** | Stack the WiFi / bill / complaint cards and reveal on scroll | ⭐⭐ | nice signature |

### How it works  ([page.tsx → HowItWorks])
| **Stepper** / **Animated List** | Animate the 3 steps in sequence | ⭐⭐ | we have a hairline connector to keep |
| **Scroll Stack** | Steps stack-and-release as you scroll | ⭐⭐ | don't reuse same effect as Features |

### Pricing  ([page.tsx → Pricing])
| **Star Border** | Animated border on the "Most popular" (Pro) plan | ⭐⭐⭐ | clean, low-risk win |
| **Spotlight Card** | Cursor glow on the three plan cards | ⭐⭐ | reuse from Features for consistency |

### Testimonials  ([page.tsx → Testimonials])
| **Card Swap** *or* **Stack** | Draggable / auto-swapping testimonial cards | ⭐⭐ | keep all 3 quotes |
| **Rolling Gallery** / **Carousel** | Horizontal momentum scroller | ⭐ | mobile-friendly |

### Final CTA  ([page.tsx → FinalCta])
| **Aurora** / **Beams** (contained) | Living gradient inside the dark CTA block | ⭐⭐ | reuse the hero bg, scoped |
| **Shiny Text** | The CTA heading | ⭐ | — |

### Global nav + footer  ([site-header.tsx], [site-footer.tsx])
| **Pill Nav** / **Gooey Nav** / **Card Nav** | Modern animated top nav with active-section indicator | ⭐⭐ | keep links/labels identical |
| **Staggered Menu** / **Bubble Menu** | Mobile menu drawer | ⭐⭐ | — |
| **Flowing Menu** | Footer link list with hover marquee | ⭐ | — |
| **Click Spark** | Spark burst on button clicks (site-wide) | ⭐ | the only "cursor" effect I'd risk on a SaaS |

---

## 3. App (admin / tenant) — restrained picks only

The portal is a daily tool; heavy effects hurt it. Safe, high-value touches:

| ReactBits | Where | Priority |
|---|---|---|
| **Aurora / Silk / Dark Veil** (subtle, behind the card) | Login page, Suspended page — these are "moments" | ⭐⭐ |
| **Spotlight Card** | Admin dashboard `StatCard`s (very subtle glow) | ⭐ |
| **Animated List** | Notification dropdown items, tenant lists entering | ⭐⭐ |
| **Fade Content / Animated Content** | Wrap page sections for a gentle enter | ⭐ |
| **Counter** | Could replace our count-up in StatCards | ⭐ (we already have one) |

**Do NOT** put WebGL backgrounds, cursor trails, glitch/scramble text, or
scroll-jacking inside operational pages (payments, tenants, rooms, settings).

---

## 4. Use sparingly / avoid for a SaaS

Cool demos, wrong tool here: **Splash Cursor, Blob Cursor, Image Trail, Crosshair,
Target Cursor, Meta Balls, Ballpit, Hyperspeed, Galaxy, Letter Glitch, Glitch Text,
Decrypted/Scramble Text, ASCII Text, Faulty Terminal, Lanyard, Fluid Glass, Model
Viewer.** They scream "portfolio site," distract from conversion, and several are
GPU-heavy. Skip unless you want one deliberate flagship moment.

---

## 5. Shortlist — the 8 highest-ROI picks (in build order)

1. **Split Text / Blur Text** → hero `<h1>` reveal *(big first impression)*
2. **Aurora** (lazy, mobile-off) → hero background *(the "wow")*
3. **Magic Bento / Spotlight Card** → Features grid *(most-scrolled section)*
4. **Scroll Velocity** → trust marquee *(cheap, lively)*
5. **Star Border** → Pricing "Most popular" + hero CTA *(low effort, premium feel)*
6. **Scroll Stack** → How-it-works or Portal cards *(a signature scroll moment)*
7. **Card Swap / Stack** → Testimonials *(interactive social proof)*
8. **Pill Nav + active-section indicator** → site header *(ties the page together)*

This dovetails with the scroll-effects roadmap already in motion (Phase 0 + Hero
are done): items 1–2 finish the Hero, then 3–8 roll down the page.

---

## 6. Guardrails (non-negotiable)

- **`prefers-reduced-motion`**: ReactBits components don't all honor it — wrap each
  in our reduced-motion check (same pattern as `Reveal`/`SmoothScroll`).
- **Performance**: at most **one** WebGL background; `next/dynamic({ ssr:false })`
  + lazy mount; animate only `transform`/`opacity`; watch CLS on this conversion page.
- **Mobile**: disable WebGL backgrounds, parallax-heavy and pinned effects on small
  screens — they fight touch scroll and drain battery.
- **Consistency**: pick **one** card-hover style and **one** background, and reuse
  them — don't mix Magic Bento + Pixel Card + Chroma Grid on the same page.
- **Content**: every effect is additive — copy, numbers, and sections stay exactly
  as they are on the live domain.

---

*Prepared for PG360. Components referenced are from reactbits.dev (David Haz,
MIT + Commons Clause).*
