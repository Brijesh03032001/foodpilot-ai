# FoodPilot — Sky Market frontend

An AI-native outdoor food-truck marketplace with two faces:

- **Order (Customer)** — Discover, Truck detail, Concierge chat, Order Builder,
  Review & Confirm, Confirmation.
- **Owner (Business)** — Dashboard, Sales Analytics, Review Intelligence, Owner
  Copilot.

Built as a static mockup driven by **real project data** (`data/*.json`), ready to
be wired to a FastAPI backend over the existing `app/` chains and agents.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript
- **Tailwind CSS v4** with the Sky Market design tokens (`app/globals.css`)
- **shadcn/ui** (`base-nova` style, built on Base UI) for primitives
- **Framer Motion** (`motion`) for animation
- **d3** for the owner sales charts (hand-rolled, animated)
- Fonts: **Manrope** (UI) + **DM Serif Display** (editorial headings)

## Run it

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000. From the repo root you can also use the
`.claude/launch.json` config (`foodpilot-web`).

## Where things live

```
web/
  app/
    page.tsx                 # marketing landing (matches the design mockup)
    (customer)/              # Order face — shared top nav + mobile bottom nav
      discover/ trucks/[id]/ concierge/ order/ order/review/ order/confirmation/
    (owner)/owner/           # Owner face — petrol sidebar operating system
      page.tsx analytics/ reviews/ copilot/
  components/
    bits/                    # chips, rating, mascot, truck photo/card, thinking
    customer/ owner/ shell/ marketing/ brand/
  lib/
    foodpilot-data.json      # curated dataset generated from data/*.json
    data.ts types.ts store.tsx format.ts
    query-parser.ts order-parser.ts concierge.ts copilot.ts   # mock "AI" brains
```

## Data

`lib/foodpilot-data.json` is generated from the real project JSON (trucks, menus,
modifiers, orders, reviews). Sales, sentiment, and complaint numbers are computed
from that data, so the mockup stays honest (e.g. *Dinosaurs — 5 orders, $147.62,
AOV $29.52*; sentiment *104 / 0 / 46*).

The "AI" is stand-in logic (`query-parser`, `order-parser`, `concierge`,
`copilot`) that mirrors each phase's behavior — parsed-intent chips, nested order
resolution with applied/rejected modifiers, tool traces, and grounded evidence —
so every screen can later swap its mock call for a real endpoint.

## Design system

Everything follows `FoodPilot_Sky_Market_Design_System.md`: light and airy, Petrol
for structure, Tangerine reserved for commerce actions, Turquoise for AI/maps/
charts, food photography richer than the quiet UI. Light + dark themes supported.
