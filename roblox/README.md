# Judy Shop · Roblox integration

This folder ships the server-side Lua glue that connects a Roblox game
to the Judy Shop whitelist API.

## Quick setup (per game)

1. Open the game in **Roblox Studio**.
2. **Game Settings → Security** → tick **Allow HTTP Requests**.
3. Copy `whitelist-gate.lua` into **ServerScriptService**.
4. Open the script and edit the four constants at the top:

   ```lua
   local API_BASE_URL  = "https://shop.example.com"
   local API_KEY       = "<value of WHITELIST_API_KEY from .env>"
   local PRODUCT_SLUG  = ""    -- leave empty to match by game.PlaceId
   local KICK_MESSAGE  = "You don't have an active whitelist for this game."
   ```

5. **Publish** the game. Test by joining with a Roblox account that you
   know is (or isn't) in the whitelist.

## What the script does

| Player state                                       | Outcome                               |
|----------------------------------------------------|---------------------------------------|
| API returns `status: "active"`                     | allowed in                            |
| API returns `status: "active"` and `trial: true`   | allowed in + `JudyShopTrial` attribute set so your HUD can show "TRIAL" |
| API returns `status: "expired"` / `"not_found"`    | kicked with `KICK_MESSAGE`            |
| HTTP call fails (CDN, Roblox outage, your server)  | by default **fails open** so paying customers aren't locked out by transient errors. Flip `FAIL_OPEN = false` if you'd rather fail closed. |

## API key security

- The API key lives only on the server. **Never put it in a LocalScript**
  — those are downloadable by every player.
- Rotate the key (`.env` → `WHITELIST_API_KEY`) when it leaks. The web
  app reads the env at request time, so a redeploy is enough.

## Rate limits

`/api/checkwhitelist` is rate-limited:

- 60 requests / minute / IP (this is the Roblox game server's IP)
- 600 requests / minute / API key (across all your games combined)

Both are far above what a typical join volume needs. If you hit them you'll
get HTTP 429 with a `Retry-After` header.

## Customising

`onPlayerAllowed(player, data)` is the extension point. Examples:

```lua
local function onPlayerAllowed(player, data)
  if data.trial then
    player:SetAttribute("JudyShopTrial", true)
    -- show a Hud "Trial — Xm left" via a RemoteEvent
  end
  if data.source == "stripe" and data.lifetime then
    player:AddToVipGroup()   -- whatever your game has
  end
end
```

## Testing locally without publishing

Run the API locally (`npm run dev` on the Judy Shop project, exposes
`http://localhost:3000/api/checkwhitelist`) and point the Lua script at
your dev tunnel (ngrok, cloudflared, tailscale Funnel — Roblox can't
hit `localhost`).

For a non-Roblox test, this curl reproduces what the script does:

```bash
curl -sS \
  -H "x-api-key: $WHITELIST_API_KEY" \
  "https://shop.example.com/api/checkwhitelist?username=judy_player&gameId=12345"
```
