# Affiliate API

Read-only API for an affiliate to pull their **own** sales & commission data
and build a custom dashboard.

- Admin must enable API access for the affiliate first.
- The affiliate generates an API key in their dashboard (`/affiliate`). The key
  is shown **once** — store it safely. Regenerating invalidates the old key.
- No buyer identity (name / email / IGN) is ever exposed.
- All money values are in **THB**.

## Authentication

Send the key in the `Authorization` header (or `X-Api-Key`):

```bash
curl -H "Authorization: Bearer afk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  https://aclassstore.com/api/affiliate/public/v1/dashboard
```

## Endpoint

```
GET /api/affiliate/public/v1/dashboard
```

Returns everything in one payload.

## Example response

```json
{
  "profile": {
    "display_name": "Judy Game Studio",
    "commission_pct": 10,
    "is_active": true
  },
  "totals": {
    "pending": 450.00,
    "requested": 0,
    "paid": 1250.50,
    "sales_count": 17,
    "currency": "THB"
  },
  "codes": [
    {
      "code": "JUDY-GAME-STUDIO",
      "type": "percent",
      "value": 98,
      "commission_pct": 10,
      "product": "AC Jump EVO",
      "is_active": true,
      "used_count": 17,
      "max_uses": null,
      "per_user_limit": null
    }
  ],
  "sales": [
    {
      "date": "2026-07-13T09:41:22.000Z",
      "product": "AC Jump EVO",
      "sale_amount": 850.00,
      "commission_pct": 10,
      "commission": 85.00,
      "status": "pending",
      "paid_at": null
    },
    {
      "date": "2026-07-10T14:03:55.000Z",
      "product": "AC Jump EVO",
      "sale_amount": 850.00,
      "commission_pct": 10,
      "commission": 85.00,
      "status": "paid",
      "paid_at": "2026-07-12T02:15:00.000Z"
    }
  ],
  "payouts": [
    {
      "amount": 1250.50,
      "method": "promptpay",
      "status": "paid",
      "requested_at": "2026-07-08T04:00:00.000Z",
      "paid_at": "2026-07-11T06:30:00.000Z"
    }
  ]
}
```

## Fields

### `profile`
| Field | Type | Notes |
|---|---|---|
| `display_name` | string \| null | Public-facing name, if set |
| `commission_pct` | number | Default commission rate (%) |
| `is_active` | boolean | `false` = account paused (no new commission) |

### `totals`
| Field | Type | Notes |
|---|---|---|
| `pending` | number | Commission not yet requested for withdrawal |
| `requested` | number | Commission in an open withdrawal request |
| `paid` | number | Commission already paid out |
| `sales_count` | number | Number of commissionable orders (excludes reversed) |
| `currency` | string | Always `"THB"` |

### `codes[]`
| Field | Type | Notes |
|---|---|---|
| `code` | string | The code |
| `type` | string | `"percent"` or `"fixed"` — the customer discount type |
| `value` | number | Customer discount amount (% or THB) |
| `commission_pct` | number \| null | Per-code commission override; `null` = use `profile.commission_pct` |
| `product` | string \| null | Scoped product name; `null` = all products |
| `is_active` | boolean | |
| `used_count` | number | Total redemptions |
| `max_uses` | number \| null | Total usage cap; `null` = unlimited |
| `per_user_limit` | number \| null | Uses per user; `null` = unlimited |

### `sales[]`  (most recent first, up to 1000)
| Field | Type | Notes |
|---|---|---|
| `date` | string (ISO 8601) | When the commission was recorded |
| `product` | string \| null | Product sold |
| `sale_amount` | number | Product revenue the commission is based on (ex-fee) |
| `commission_pct` | number | Rate applied to this sale (frozen) |
| `commission` | number | Commission earned on this sale |
| `status` | string | `pending` \| `requested` \| `paid` \| `reversed` |
| `paid_at` | string \| null | When paid out (ISO), if `status = paid` |

### `payouts[]`  (most recent first)
| Field | Type | Notes |
|---|---|---|
| `amount` | number | Payout amount |
| `method` | string \| null | Payout channel snapshot (e.g. `promptpay`) |
| `status` | string | `requested` \| `paid` \| `rejected` \| `cancelled` |
| `requested_at` | string \| null | ISO 8601 |
| `paid_at` | string \| null | ISO 8601, if paid |

## Errors

| HTTP | Body | Meaning |
|---|---|---|
| 401 | `{ "error": "Missing API key" }` | No key sent |
| 401 | `{ "error": "Invalid API key" }` | Key not recognized (e.g. regenerated) |
| 403 | `{ "error": "API access disabled" }` | Admin turned off API access |

## Notes

- CORS is open (`Access-Control-Allow-Origin: *`) so a browser dashboard can
  call it directly — but that exposes your key in client-side code. Prefer
  calling from your own server.
- The endpoint is read-only. There are no write operations.
