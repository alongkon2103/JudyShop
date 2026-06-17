# Judy Shop — Web

Next.js 14 (App Router) + TypeScript + Tailwind CSS storefront for Judy Shop —
ร้านขายสิทธิ์เข้าเกม TikTok Interactive ส่งทันทีหลังชำระเงิน.

## Quick start

```bash
npm install
npm run dev
# -> http://localhost:3000
```

Scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with `eslint-config-next` |
| `npm run type-check` | Strict TypeScript check (no emit) |

## Project structure

```
src/
├── app/                       # Next.js App Router
│   ├── layout.tsx             # Root layout — fonts, Navbar, Footer
│   ├── globals.css            # Tailwind + theme tokens
│   ├── page.tsx               # / (Home)
│   ├── shop/page.tsx          # /shop (Product grid)
│   └── admin/page.tsx         # /admin (placeholder)
│
├── components/
│   ├── ui/                    # Reusable primitives
│   │   ├── Button.tsx         # Polymorphic <button|a>
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx          # Accessible portal-less modal
│   │   └── Container.tsx
│   ├── layout/                # Site chrome (used by root layout)
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Logo.tsx
│   │   └── SocialIcons.tsx
│   └── features/              # Feature-scoped components
│       ├── home/              # Hero + feature strip
│       ├── shop/              # ProductCard, ProductGrid
│       └── product/           # ProductModal, PlanRow, PaymentMethodCard
│
├── data/                      # Mock catalogue (swap for API later)
│   └── products.ts
│
├── lib/                       # Pure utilities
│   ├── cn.ts                  # clsx + tailwind-merge
│   └── format.ts              # Currency formatters
│
├── constants/                 # Site-wide config
│   └── site.ts
│
├── types/                     # Shared TS types
│   ├── index.ts
│   └── product.ts
│
└── hooks/                     # (Reserved for custom hooks)
```

### Why this structure

- **`app/` thin, `features/` thick.** Route files only compose feature
  components — easy to find where a page lives without scrolling.
- **`features/<domain>/`** keeps related UI together (e.g. the product modal
  + its sub-rows live in `features/product/`). When a feature grows, it stays
  self-contained instead of polluting `components/ui`.
- **`ui/` is for primitives only** — no business logic. Reusable across
  features.
- **`data/` is the seam.** Swap mock data for a fetch/db call without touching
  the UI tree.
- **`types/` and `constants/`** are split so domain types don't import runtime
  values (and vice versa).
- **`@/*` path alias** keeps imports stable when files move.

## Theming

Brand palette + neon utilities live in `tailwind.config.ts` and `globals.css`:

- `bg-brand-bg / bg-brand-bgDeep` — page backgrounds
- `text-brand-purple-*`, `text-brand-pink-*`, `text-brand-cyan-*`
- `.neon-text` — multi-layer text glow
- `.glass-panel` — frosted card surface
- `shadow-neon`, `shadow-neon-pink`, `shadow-neon-cyan`

## Images

Currently using `placehold.co` and `images.unsplash.com` as dummy assets. Add
real assets to `public/images/` and update `src/data/products.ts`. Remote hosts
are allowlisted in `next.config.mjs`.

## Routes

| Path | Description |
| --- | --- |
| `/` | Hero + feature strip |
| `/shop` | Game catalogue grid → click a card to open the purchase modal |
| `/admin` | Placeholder for admin dashboard |

Per design decision: no `/orders` page (no user login planned).

## Next steps

- Wire `data/products.ts` to a real backend
- Implement PromptPay / Card payment integration in `ProductModal`
- Build out `/admin` dashboard
- Replace dummy hero illustrations with branded artwork
