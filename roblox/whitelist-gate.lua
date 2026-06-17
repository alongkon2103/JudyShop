--!strict
--[[
  Judy Shop · Whitelist gate
  ===========================
  Drops into ServerScriptService. On Player join it calls Judy Shop's
  /api/checkwhitelist endpoint and kicks the player if they don't have
  active access.

  Setup
  -----
  1. In Roblox Studio: Game Settings → Security → tick
     "Allow HTTP Requests".
  2. Place this script in ServerScriptService.
  3. Set the two constants below: API_BASE_URL and API_KEY.
     API_KEY is the WHITELIST_API_KEY from Judy Shop's .env — keep it
     server-side only (never put it on a LocalScript).
  4. Publish.

  Optional knobs
  --------------
  - PRODUCT_SLUG  → restrict to a single product on Judy Shop.
                    Leave empty to match against this game's PlaceId.
  - KICK_MESSAGE  → what the kicked player sees.
  - GRACE_SECONDS → small slack so a player whose whitelist expires
                    mid-session isn't yanked instantly.

  Behaviour
  ---------
  - response.status == "active"   → allowed.
  - response.status == "expired"  → kicked with KICK_MESSAGE.
  - response.status == "not_found"→ kicked with KICK_MESSAGE.
  - response.trial == true        → allowed, optional in-game hint via
                                    `onPlayerAllowed(player, data)`.
  - HTTP error / API unreachable  → fail open (let the player in) OR
                                    fail closed (kick) — see FAIL_OPEN.
                                    Default is fail OPEN: we'd rather
                                    a paying customer get in than be
                                    locked out by a CDN hiccup.
]]

local Players       = game:GetService("Players")
local HttpService   = game:GetService("HttpService")

-- ─── Config ─────────────────────────────────────────────────────────
local API_BASE_URL  = "https://YOUR-DOMAIN.com"          -- ← change me
local API_KEY       = "REPLACE_WITH_WHITELIST_API_KEY"   -- ← change me
local PRODUCT_SLUG  = ""                                 -- "" = match by gameId
local KICK_MESSAGE  = "You don't have an active whitelist for this game.\nBuy access at " .. API_BASE_URL .. "/shop"
local GRACE_SECONDS = 30
local FAIL_OPEN     = true                               -- API down → allow
-- ────────────────────────────────────────────────────────────────────

local function buildUrl(username: string): string
  local params = {
    "username=" .. HttpService:UrlEncode(username),
  }
  if PRODUCT_SLUG ~= "" then
    table.insert(params, "productSlug=" .. HttpService:UrlEncode(PRODUCT_SLUG))
  else
    table.insert(params, "gameId="      .. HttpService:UrlEncode(tostring(game.PlaceId)))
  end
  return API_BASE_URL .. "/api/checkwhitelist?" .. table.concat(params, "&")
end

type WhitelistResponse = {
  status:      string,    -- "active" | "expired" | "not_found"
  username:    string,
  expires_at:  string?,   -- ISO timestamp or nil for lifetime / not_found
  lifetime:    boolean,
  duration:    string?,   -- "permanent" | "trial" | "30days" | etc.
  source:      string?,   -- "stripe" | "trial" | "manual" | "promo" | "refund_revert"
  trial:       boolean,
  product:     { id: string, slug: string, name_en: string, game_id: string? }?,
  checked_at:  string,
}

-- Returns response or nil on transport error. Network errors are
-- caught here so the caller doesn't need pcall.
local function fetchWhitelist(username: string): WhitelistResponse?
  local url = buildUrl(username)
  local ok, body = pcall(function()
    return HttpService:RequestAsync({
      Url     = url,
      Method  = "GET",
      Headers = {
        ["x-api-key"] = API_KEY,
        ["accept"]    = "application/json",
      },
    })
  end)
  if not ok then
    warn("[Whitelist] HTTP error for " .. username .. ": " .. tostring(body))
    return nil
  end

  local res = body :: { Success: boolean, StatusCode: number, Body: string }
  if not res.Success then
    warn(string.format(
      "[Whitelist] non-2xx for %s: status=%d body=%s",
      username, res.StatusCode, tostring(res.Body)
    ))
    return nil
  end

  local parsed: WhitelistResponse? = nil
  pcall(function()
    parsed = HttpService:JSONDecode(res.Body)
  end)
  return parsed
end

-- Hook a player into the game once they're allowed. Override this if
-- you want to show a "Trial mode — X min left" UI or similar.
local function onPlayerAllowed(player: Player, data: WhitelistResponse)
  if data.trial then
    print(string.format(
      "[Whitelist] %s is on a TRIAL (expires %s)",
      player.Name, tostring(data.expires_at)
    ))
    -- Example: tag the player so a HUD script can show "TRIAL" badge.
    player:SetAttribute("JudyShopTrial", true)
    if data.expires_at then
      player:SetAttribute("JudyShopExpiresAt", data.expires_at)
    end
  end
end

local function onPlayerDenied(player: Player, reason: string)
  print(string.format("[Whitelist] kicking %s — %s", player.Name, reason))
  player:Kick(KICK_MESSAGE)
end

-- Convert ISO-8601 to epoch seconds (best-effort; uses os.time + a
-- manual parse since Lua has no DateTime parser by default).
local function isoToEpoch(iso: string?): number?
  if not iso then return nil end
  local y, mo, d, h, mi, s = string.match(iso,
    "^(%d+)-(%d+)-(%d+)T(%d+):(%d+):([%d%.]+)")
  if not y then return nil end
  return os.time({
    year  = tonumber(y) :: number,
    month = tonumber(mo) :: number,
    day   = tonumber(d) :: number,
    hour  = tonumber(h) :: number,
    min   = tonumber(mi) :: number,
    sec   = math.floor(tonumber(s) :: number),
  })
end

local function isStillActive(data: WhitelistResponse): boolean
  if data.status ~= "active" then return false end
  if data.lifetime then return true end
  local exp = isoToEpoch(data.expires_at)
  if not exp then return true end -- response said active; trust it
  return os.time() < (exp + GRACE_SECONDS)
end

local function gatePlayer(player: Player)
  local data = fetchWhitelist(player.Name)

  if not data then
    if FAIL_OPEN then
      warn("[Whitelist] API unreachable — failing OPEN for " .. player.Name)
      return
    else
      onPlayerDenied(player, "API unreachable (FAIL_OPEN=false)")
      return
    end
  end

  if isStillActive(data) then
    onPlayerAllowed(player, data)
  else
    onPlayerDenied(player, data.status or "denied")
  end
end

Players.PlayerAdded:Connect(gatePlayer)

-- Cover players that joined before this script connected (Studio reruns).
for _, p in ipairs(Players:GetPlayers()) do
  task.spawn(gatePlayer, p)
end
