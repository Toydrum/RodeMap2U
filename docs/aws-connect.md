# Connecting RodeMap2U to AWS — the go-live runbook

Audience: the agent (or human) who will flip the app from the on-device mock
cloud to real AWS. Everything AWS-shaped in the client is already built and
verified against the mock; **connecting is configuration, not coding**. Read
[`backend-contract.md`](./backend-contract.md) for WHAT the backend must do;
this file is HOW to stand it up and wire it.

## 0. TL;DR

| Piece | Status | What connecting takes |
|---|---|---|
| Client auth (Cognito adapter, `/account` ritual) | ✅ shipped 0.0.48, dormant | **Stage 1 below — possible TODAY** with just a user pool (paste 3 strings) |
| Client API transport (`http-api.ts`, all 26 ops) | ✅ shipped 0.0.48, dormant | Stage 2 — needs the deployed API (`infra/` track) |
| Backend (DynamoDB + Lambda router + HTTP API) | ⏳ `infra/` CDK track, pending | `cdk deploy` once it lands (or manual per §3) |
| Mandatory login (`requireAuth`) | wired, inert | §4 — flip ONLY after the «conectar mi bosque» phase ships |

The entire flip lives in **`src/app/core/config.ts`**. No other file changes.
The five values are **public identifiers, not secrets** — user pool ids and
SPA client ids are safe to commit (the app client has no secret by design).

```ts
export const APP_CONFIG = Object.freeze({
  backend: 'aws',                          // ← the migration
  requireAuth: false,                      // ← stays false until §4
  aws: Object.freeze({
    region: 'us-east-1',                   // your region
    userPoolId: 'us-east-1_XXXXXXXXX',     // Stage 1
    userPoolClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // Stage 1
    apiBaseUrl: 'https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com', // Stage 2 — WITHOUT /v1 (http-api.ts appends it)
  }),
});
```

## 1. How the seam works (why this is safe)

- `app.config.ts` picks the adapters ONCE at boot from `APP_CONFIG.backend`:
  `MockAuthProvider`/`MockApi` (mock) vs `CognitoAuthProvider`/`HttpApi` (aws).
- `cognito-auth.provider.ts` is the only file that touches `aws-amplify`, and
  only via dynamic `import()` — the SDK stays a lazy chunk. **Gate after every
  build:** `main-*.js` must NOT match `cognito-idp|amazonaws\.com`.
- Boot never touches the network: `AuthService.hydrate()` reads one IndexedDB
  meta key. Amplify loads on the first real auth action. Offline PWA behavior
  is unchanged.
- Signing in/out NEVER mutates local forest data (verify-auth asserts it).
- No OAuth/Hosted UI anywhere → **no callback/redirect URLs to register**,
  and the GitHub Pages `/RodeMap2U/` subpath + 404.html quirk is irrelevant.

## 2. Stage 1 — connect identity (possible today)

As of 0.0.48 no component calls the API yet (`/account` and Settings use only
`AuthService`), so a user pool alone gives you the full account ritual against
real Cognito: sign-up with real emailed codes, sign-in, the child
temp-password challenge, recovery, delete.

### 2.1 Create the user pool

Console or CLI; the settings below are NORMATIVE (they mirror the checklist in
`cognito-auth.provider.ts` — the client already assumes them):

```bash
aws cognito-idp create-user-pool \
  --pool-name rodemap-users \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --account-recovery-setting "RecoveryMechanisms=[{Priority=1,Name=verified_email}]" \
  --username-configuration CaseSensitive=false \
  --verification-message-template "DefaultEmailOption=CONFIRM_WITH_CODE" \
  --schema "Name=accountType,AttributeDataType=String,Mutable=true" \
  --deletion-protection ACTIVE
```

Rules encoded there — do not deviate:
- **Sign-in by username** (3–20 `[a-z0-9_]`); email is an optional, verifiable
  attribute. Guardian-created minors will have NO email (their guardian is the
  recovery channel — Stage 2 feature).
- Password policy = `PASSWORD_POLICY` in `src/app/core/auth/auth-types.ts`
  (min 8, upper+lower+digit, **no symbol requirement**). If you change one,
  change both — the mock, the UI hint and the pool must agree.
- Verification/recovery by **CODE**, never emailed links (`CONFIRM_WITH_CODE`).
- `custom:accountType` exists but is **backend-written only** (PostConfirmation
  trigger in Stage 2 sets `adult`; `AdminCreateUser` sets `minor`). The client
  never writes it; without a trigger it's simply absent and the client
  defaults the hint to `adult` — fine for Stage 1.
- Deletion protection ON: the pool holds real users; losing it loses them.

### 2.2 Create the app client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <POOL_ID> \
  --client-name rodemap-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --refresh-token-validity 30 \
  --token-validity-units "RefreshToken=days"
```

- **`--no-generate-secret` is mandatory** — a browser SPA cannot hold a
  secret, and the amplify adapter doesn't send one.
- `ALLOW_USER_SRP_AUTH` is the only sign-in flow the adapter uses. Do NOT
  enable `USER_PASSWORD_AUTH` (weaker) or any OAuth flow.
- `--prevent-user-existence-errors ENABLED`: unknown users answer as
  `NotAuthorizedException` (no account-enumeration oracle — kid-safety
  doctrine). The UI then shows the generic wrong-credentials copy; that is
  intended.

### 2.3 Paste + flip + verify

1. Edit `src/app/core/config.ts`: `region`, `userPoolId`, `userPoolClientId`,
   `backend: 'aws'`. Leave `apiBaseUrl: ''` and `requireAuth: false`.
2. `npx ng build` → confirm the lazy-chunk gate:
   `Select-String dist/rodemap2u/browser/main-*.js -Pattern 'cognito-idp|amazonaws\.com'`
   must return nothing.
3. **Manual smoke against the real pool** (`tools/verify-auth.mjs` is
   mock-only — the demo family and the `123456` code do not exist on AWS):
   - Create an account from `/account` with a real inbox → the code arrives by
     email → confirm → profile shows.
   - Reload the app OFFLINE (DevTools → Network → Offline): still signed in
     from the cached identity, zero network at boot.
   - Sign out → local trees untouched (count them in Mi bosque before/after).
   - Wrong password → calm copy, no console errors.
4. Bump `core/version.ts`, commit, push, verify the live bundle hash.

Notes for this stage:
- Cognito's default email sender is fine for testing (~50 mails/day). For
  launch volume, wire Amazon SES into the pool (a Stage 2/infra concern).
- Device clocks >5 min off fail SRP with `NotAuthorizedException`; the error
  table maps it, but if a tester hits mysterious sign-in failures, check the
  clock first.

## 3. Stage 2 — connect the API (needs the `infra/` track)

The client transport is already complete (`core/api/http-api.ts`: bearer
idToken, one 401 forceRefresh retry, 250 ms/1 s backoff, offline fast-fail).
What must exist on AWS — implemented by the `infra/` CDK app (pending), specified
end-to-end in `backend-contract.md`:

1. **DynamoDB** table `rodemap` (single-table, on-demand, TTL on `ttl`, GSI1 +
   GSI2 — key schema in contract §6).
2. **Router Lambda** implementing `RodemapApi` (`src/app/core/api/contracts.ts`
   is imported by the Lambda via tsconfig path alias — one source of truth) +
   a PostConfirmation trigger writing the profile item and `custom:accountType`.
3. **HTTP API** (API Gateway v2) with a **JWT authorizer**:
   - issuer `https://cognito-idp.<region>.amazonaws.com/<poolId>`
   - audience = the app client id (this validates **ID tokens** — the client
     sends idToken, whose `aud` is the client id; access tokens would fail).
   - Routes per `API_PATHS`, stage path `/v1` (http-api.ts calls
     `${apiBaseUrl}/v1/...`).
4. **CORS on the HTTP API** — the app calls cross-origin from GitHub Pages and
   from dev servers:
   ```
   AllowOrigins:  https://toydrum.github.io, http://localhost:4200, http://localhost:8826
   AllowMethods:  GET, POST, PATCH, DELETE
   AllowHeaders:  authorization, content-type
   MaxAge:        86400
   ```
   Missing CORS is the #1 "it works in mock but not on AWS" failure — the
   browser blocks the response and `http-api.ts` reports `offline`.

Once `infra/` exists: `cd infra && npm ci && npx cdk bootstrap && npx cdk deploy`
→ the stack outputs print the exact `APP_CONFIG.aws` values → paste
`apiBaseUrl` (invoke URL **without** `/v1`) into `config.ts`. If you build the
backend by hand instead, treat contract §5–§7 as the acceptance spec and run
the mock (`mock-api.ts`) side-by-side as the reference implementation.

## 4. Mandatory login (`requireAuth: true`)

Owner decision 2026-07-06: login becomes mandatory at AWS go-live — but the
flip has a hard prerequisite: the **«conectar mi bosque»** phase (local-forest
→ account adoption + sync) must be shipped, otherwise existing users would be
walled off from their own local data with no bridge. When flipping:
- `authRequiredGate` (already on every route) starts redirecting guests to
  `/account?volver=<url>`; after sign-in the user lands back where they were.
- Test: open any deep link signed-out → ritual → sign in → returned to it.
- Rollback is the same boolean.

## 5. Rollback (any stage)

Set `backend: 'mock'` (and `requireAuth: false`) in `config.ts`, rebuild,
push. Local forests were never touched. Notes:
- Amplify's tokens live in localStorage under `CognitoIdentityServiceProvider.*`
  keys — harmless residue; sign-out clears them if you care.
- The cached identity (`auth.identity` meta key) may show a "signed in" user
  whose account only exists on AWS; the mock treats it as stale and one
  sign-out cleans it.
- Real users created on Cognito keep existing (the pool is stateful; deletion
  protection stays ON).

## 6. Where each piece of truth lives

| Question | File |
|---|---|
| The five config values + both flags | `src/app/core/config.ts` |
| Pool settings the client assumes | `src/app/core/auth/cognito-auth.provider.ts` (header) + §2 here |
| Password policy | `src/app/core/auth/auth-types.ts` (`PASSWORD_POLICY`) |
| Every endpoint, shape, error code, cap | `src/app/core/api/contracts.ts` (normative) |
| Permissions matrix, DynamoDB design, Lambda authz | `docs/backend-contract.md` |
| Reference backend behavior (executable) | `src/app/core/api/mock-api.ts` + `mock-auth.provider.ts` |
| Auth UX flows the pool must satisfy | `src/app/features/account/account.ts` (step machine) |
| Mock-path regression battery | `tools/verify-auth.mjs` (mock-only; see §2.3 for the real-pool smoke) |
