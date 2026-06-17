# Judy Shop · Demo Checklist

Pre-demo runbook. Run through this once before showing a customer for
the first time.

## ⚙️ 1. Prep environment (5 min)

```bash
# Apply pending migrations (audit log + trial fields)
npx prisma migrate dev --name pre_demo

# Sanity: ensure you're on TEST keys, not LIVE
grep STRIPE_SECRET_KEY .env   # should start with sk_test_
grep STRIPE_PUBLISHABLE  .env # should start with pk_test_

# Start dev server in one terminal
npm run dev

# Start Stripe webhook listener in another terminal (optional — /success
# also fulfills as a fallback, so demo can work without this)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 🧹 2. Reset demo data (30 sec)

If you've been using a username during dev, clear it so the trial counter
+ whitelist start clean:

```sql
-- In Prisma Studio (npx prisma studio) or psql:
DELETE FROM "TrialUsage" WHERE username ILIKE 'demo_user';
DELETE FROM "Whitelist"  WHERE username ILIKE 'demo_user';
DELETE FROM "Order"      WHERE username ILIKE 'demo_user';
```

## ✅ 3. Customer flow smoke test (3 min)

Open **incognito** so you don't carry session state from dev work.

1. Visit `http://localhost:3000/th` (Thai) → wordmark + mascot visible
2. Click **Shop** → product cards load with images + prices
3. Click a product → modal opens
4. Type your demo Roblox username → **green preview card with avatar appears within ~1s** ✓
5. Click **Pay now** with PromptPay → Stripe Checkout page
6. Use test card `4242 4242 4242 4242`, any future date, any CVC → submit
7. Redirected to `/success` → see receipt + download buttons
8. **Verify in admin** `/admin/whitelist` → new row with the username appears

## 🆓 4. Trial flow smoke test (1 min)

Use a **different** username (the buy-flow one already has access).

1. Open product modal again
2. Click **"ทดลองฟรี 10 นาที"** below the Pay button
3. Toast: `เปิด 10 นาทีให้แล้ว — ใช้ได้จนถึง HH:MM:SS`
4. Visit `/check` → enter username + select product → status `active`, badge **trial**
5. (Optional) try clicking trial again with the SAME username → toast:
   `คุณใช้สิทธิ์ทดลองวันนี้ไปแล้ว ลองอีกครั้งพรุ่งนี้`

## 🔧 5. Admin tooling smoke test (3 min)

1. Visit `/admin/login` → log in (default admin from `scripts/create-admin.ts`).
2. **Dashboard**: KPI tiles + revenue chart load with today's data point.
3. **Products**: list paginated, click row → edit → toggle trial → Save → toast.
4. **Whitelist**: search by username → result narrows; click Edit / Delete works.
5. **Transactions**: filter by `PAID` → click **Refund** on the test order from
   step 3 of customer flow:
   - Confirm modal appears with amount + username
   - Enter reason (optional) → **Confirm refund**
   - Toast: "Refund issued"
   - Re-check `/admin/whitelist` → the row is now revoked (expired)
6. **Audit log**: `/admin/audit` → see entries for product update, refund, etc.

## 🎮 6. Roblox API smoke test (1 min)

```bash
# Replace $KEY with WHITELIST_API_KEY from .env
curl -sS -H "x-api-key: $KEY" \
  "http://localhost:3000/api/checkwhitelist?username=demo_user&gameId=12345" \
  | jq
```

Expect:
```json
{
  "status": "active",
  "source": "stripe",      // or "trial"
  "trial": false,           // true if from trial flow
  "duration": "30days",     // or "trial"
  "product": { "name_en": "...", "game_id": "12345" }
}
```

For a username with no whitelist:
```bash
curl -sS -H "x-api-key: $KEY" \
  "http://localhost:3000/api/checkwhitelist?username=ghost_xyz" | jq
# → { "status": "not_found", "source": null, "trial": false, ... }
```

## ❌ 7. Error pages (30 sec)

Show that errors are branded, not Next default gray:

- Type a bogus URL: `http://localhost:3000/th/nonexistent` → branded 404
- Trigger a runtime error: in DevTools console run
  `fetch('/api/admin/login', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })` —
  this won't break the page, but if anything does throw, the user sees
  the branded error card with a retry button.

## 🌐 8. i18n flip (30 sec)

- Click the language switcher in the navbar → URL flips `/th/...` → `/en/...`
- Verify ProductModal, FAQ, Check page all show English correctly
- Footer FAQ + Check links still work

## 📋 Quick sanity items before demo starts

- [ ] DB migration applied (`npx prisma migrate dev`)
- [ ] `.env` uses **test** Stripe keys
- [ ] Admin password changed from default
- [ ] At least 1 product visible in `/shop`
- [ ] At least 1 announcement (or popup will be missing — that's OK)
- [ ] Demo username's `TrialUsage` + `Whitelist` rows cleaned
- [ ] Discord webhook (if you have one) muted so demo orders don't notify the channel
- [ ] Browser zoom = 100%, devtools closed, accessibility settings normal
- [ ] Network is reliable (test card declines on flaky network)
- [ ] Have **backup screenshot/screencast** of each step in case Stripe is slow

## 🚨 If something goes wrong mid-demo

| Symptom | Quick fix |
|---|---|
| `Prisma` error in console | `npx prisma migrate dev` — migrations not applied |
| Stripe page won't load | Network — fall back to your backup screencast |
| Roblox preview never resolves | Roblox API may be down — `?next=` URL works without it |
| Refund button missing | Order needs `PAID` status + `stripePaymentId` — webhook may not have fired |
| /check shows "API down" | Dev server might have crashed — check the terminal |

## After the demo

Capture feedback in a `feedback/<date>.md` so future iterations don't
re-discover the same friction.
