# Device Enrollment (fixing the always-expired iOS share token)

## Root cause

The share extension isn't hitting a bug — the design guarantees this failure.
**The iOS app stores a session JWT, not an API token.**

1. `AuthManager.handleLogin()` saves the token returned by `/api/auth/login`
   into the keychain. That token comes from `createToken()` in
   `server/utils/auth.ts`, which hardcodes `TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000`.
   **There is no refresh path anywhere in the codebase.** On day 8 it is dead.
2. `AuthManager.fetchUserInfo()` calls `logout()` on any 401, which **wipes the
   keychain**. The extension loses its token entirely and cannot recover.
3. The share extension can only read the keychain — it has no way to
   re-authenticate. It stays broken until the user manually opens the app and
   logs in again.
4. `api_tokens`, `/api/tokens`, and `validateApiToken()` all exist and work.
   **The app never uses them.** And they wouldn't fully fix it either:
   `server/api/tokens/index.ts` caps lifetime at `MAX_TOKEN_LIFETIME_MS = 90 days`
   — a weekly failure traded for a quarterly one.

### Blocker if switching to API tokens

`/api/auth/me` calls `getCurrentUser()`, which only parses session JWTs. It does
**not** accept `bkmk_` tokens (only `requireAuth()` does). Any client
authenticating with an API token will 401 itself out on launch. Move
`me.get.ts` to `requireAuth`.

### Two latent bugs found while reading

- `AppConfig.appGroupIdentifier = "group.me.hoshor.bkmk.share"` but both
  entitlements files declare `group.com.bkmk.share`. Every
  `UserDefaults(suiteName:)` call silently returns nil, so `userEmail` never
  actually shares between app and extension. The keychain code happens to
  hardcode the correct group, so tokens do share — but this will bite.
- `KeychainHelper` declares an unused
  `private let accessGroup = "$(AppIdentifierPrefix)com.bkmk.share"` that is
  shadowed by three hardcoded locals. Delete it.

## Approach: enrollment + rotating refresh token

An enrollment never expires. It is killed only by explicit revocation.

```sql
device_enrollments
  id                    text pk
  user_id               text not null
  device_name           text not null
  platform              text
  refresh_token_hash    text not null   -- no expiry; revocation only
  previous_refresh_hash text null       -- rotation grace window, see below
  rotated_at            timestamp null
  last_seen_at          timestamp null
  created_at            timestamp
  revoked_at            timestamp null
```

Separate from `api_tokens` on purpose — different security model, different
lifetime rules, different UI. The existing 90-day manual integration tokens stay
exactly as they are.

## Flows

### Enroll (chosen: login mints the enrollment)
The app's existing password and OAuth login paths also return a device refresh
token when the client sends a device-name header (e.g. `X-Device-Name: Ryan's iPhone`).
No new screens, reuses the OAuth flow that already works, and the app keeps its
current login UI.

Response becomes `{ user, accessToken, expiresIn, refreshToken }`.

### Refresh
`POST /api/devices/refresh { refreshToken }` → new short-lived access token **and
a rotated refresh token**. Presenting an already-rotated token is a theft signal:
revoke the whole enrollment.

### Revoke
New **Devices** section on `pages/profile.vue`, alongside the existing link to
`/tokens`. Lists device name, platform, last seen; one button to revoke.

## Client changes

### Share extension (`ShareViewController.swift`)
- Before the `/api/scrape` call, refresh if the access token is missing or
  within N minutes of expiry. It is already making a network call.
- **Never call `logout()`.** On 401: refresh once, retry once, and only then show
  "Open Bkmk to sign in."

### Main app (`AuthManager.swift`)
- Refresh on launch and on 401.
- Clear the keychain **only** when a refresh returns an explicit revoked
  response. Never on a plain 401, never on a network error. The current
  log-out-on-any-401 in `fetchUserInfo()` is what makes this feel permanently
  broken rather than occasionally stale.

### `KeychainHelper.swift`
- Store the refresh token and the access token (with its expiry) under the
  shared access group. `kSecAttrAccessibleAfterFirstUnlock` is already correct —
  the extension must be able to read it before first unlock after a reboot.
- Fix the app-group identifier mismatch; take the group from one constant.

## ⚠️ The rotation race

The app and the extension share a keychain and **will** refresh concurrently.
Naive rotation means each invalidates the other's token, reuse-detection fires,
and the enrollment revokes itself — turning an occasional annoyance into a hard
logout.

Mitigate with the `previous_refresh_hash` grace window: for ~60s after a
rotation, presenting the immediately-prior token returns **the same new pair**
rather than being treated as theft. Only a token older than that counts as
reuse.

This is the single most important detail to get right. Everything else here is
routine.

## Verification

- Enroll, then set the device clock forward past the old 7-day boundary: the
  share extension still saves.
- Kill the network mid-share: no logout, and the next share works.
- Share from the extension and refresh in the app simultaneously: enrollment
  survives.
- Revoke from `/profile`: the next share fails with a clear re-auth message, not
  a silent no-op.
