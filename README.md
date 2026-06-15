# PG360 — PG & Hostel Management SaaS 🏠

A multi-tenant PG / hostel management platform for the Indian market. Owners manage
rooms, tenants, rent, complaints and P&L — and **every tenant gets their own login**
to see their room (incl. the WiFi password), bill, and raise issues.

Built with **Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4**, and
**Supabase** (Postgres + Auth + RLS) as the backend.

> **Design language:** _"Terracotta & Ink"_ — warm paper, deep ink, a clay accent and
> a deep-teal money tone. Display type is **Fraunces** (editorial serif), UI type is
> **Hanken Grotesk**. The goal is a premium, calm, distinctly-not-generic dashboard.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app boots in **DEMO mode** with rich seeded data (no Supabase needed). On the
login page, pick a role chip — the password is `demo1234`:

| Role         | Email               | Sees                                   |
| ------------ | ------------------- | -------------------------------------- |
| Super admin  | `owner@pg360.app`   | Platform overview, all PGs, onboarding |
| PG owner     | `ravi@sunrisepg.in` | Dashboard, rooms, tenants, payments    |
| Tenant       | `arjun@tenant.in`   | My Room (WiFi), My Bill, complaints    |

## What's built (Phase 1)

- **Marketing landing** — hero with live product preview, features bento, tenant-portal
  spotlight, pricing (₹5k / ₹8k / ₹10k), how-it-works, testimonials.
- **Auth + role routing** — one login, redirect by role, middleware + server-side guards.
- **Super Admin** — platform stats, PG accounts table, create-PG (provisions the owner
  login), suspend / activate.
- **Admin (PG owner)** — 4 KPIs, Rooms (live bed status + WiFi), Tenants (+ detail with
  payment history & checkout settlement), Payments + **Payments Due** screen with a live
  rent calculator, Complaints inbox with status control.
- **Tenant portal** — **My Room** with the prominent copyable WiFi password, roommates,
  My Bill (itemised + history), Raise & track complaints, Call / WhatsApp admin.

## Architecture

```
src/
  app/
    (marketing)/        public landing + chrome
    (auth)/login/       login (server action + useActionState)
    (super-admin)/      /platform · guarded to super_admin
    (admin)/            /dashboard · guarded to admin/staff
    (tenant)/           /portal   · guarded to tenant
  components/           ui kit · app shell · marketing · per-role dialogs
  lib/
    types.ts            domain types (mirror the SQL schema)
    store.ts            in-memory DEMO backend (HMR-safe)
    demo-data.ts        the seed
    auth.ts             session (cookie in demo; swap to Supabase Auth)
    guards.ts           requireRole() server guard
    supabase/           typed server + browser clients (ready to use)
    actions/            server actions (platform / admin / tenant)
supabase/
  migrations/           0001_schema.sql · 0002_rls.sql  (source of truth)
  seed.sql              domain seed
scripts/seed.mjs        live Supabase seed (creates auth users + data)
```

### Demo mode vs live Supabase

The UI, flows and seeded data run **entirely in-memory** so the product is demoable with
zero setup. The **canonical schema and RLS policies live in `supabase/migrations`** and
are the production source of truth. To go live, see [`supabase/README.md`](supabase/README.md):
add your keys to `.env.local`, run the migrations, run `scripts/seed.mjs`, then point the
data-access functions in `src/lib/store.ts` at the Supabase clients in `src/lib/supabase/`.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # eslint
```

## Roadmap

- **Phase 2 (Sellable):** bookings, food menu + opt-in/out, expenses, P&L, CSV reports,
  realtime notifications, payment-screenshot upload, MSG91 OTP + reminders.
- **Phase 3 (Sticky):** Expo tenant app, Aadhaar vault, full analytics, staff audit,
  N8N automations, bulk WhatsApp.
