# Shamsy order entry

A complete mobile-first order-entry application for a solar equipment distributor. Advisers create dealer orders in USD, record an order-specific SDG exchange rate, apply per-line discounts, and submit exceptions for owner approval. PostgreSQL—not the browser—is authoritative for every financial value and permission decision.

## Architecture

The application uses a deliberately narrow authority chain:

```text
Browser client
        ↓
strict Zod Route Handler (authenticated user session)
        ↓
SECURITY DEFINER PostgreSQL RPC (role and ownership rechecked)
        ↓
constraints + generated line totals + one atomic transaction
```

- Next.js App Router Server Components perform user-scoped reads.
- Client Components provide immediate calculations and preserve entered form state when a request fails.
- Route Handlers accept only dealer, exchange rate, product, quantity, discount choices, and a non-authoritative catalogue revision timestamp used to detect stale forms.
- Supabase RPCs load current product prices, calculate snapshots/totals, lock workflow rows, and commit related records atomically.
- RLS controls reads. Authenticated clients have no direct mutation grants on financial, catalogue, settings, approval, or profile tables.

This is a standalone Next.js application with one deployable. Feature-oriented folders keep a later move into a larger workspace straightforward.

## Tech stack

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, Auth, RLS, SSR session cookies
- Zod 4 request validation
- Vitest 5 unit and live integration tests
- Playwright end-to-end test
- Vercel-compatible Node deployment

## Project structure

```text
src/app/                    pages, protected layout, and mutation APIs
src/features/orders/        order form, workflow actions, input schemas
src/features/approvals/     owner approval action
src/features/settings/      owner current-rate control
src/lib/money.ts            pure integer financial rules and formatters
src/lib/supabase/           browser/server clients and session refresh
src/lib/auth/               authenticated profile/role loading
src/server/data.ts          RLS-scoped application reads
supabase/migrations/        schema, RLS, RPCs, constraints, reference seed
supabase/tests/             pgTAP schema checks
scripts/seed-users.mjs      guarded disposable-test auth provisioning
tests/integration/          real Supabase workflow/security test
tests/e2e/                  worked-example browser flow
docs/ARCHITECTURE-NOTES.md  domain and architecture decisions
```

## Local setup

Requirements: Node 24+, npm, Docker, and the Supabase CLI.

```bash
npm install
cp .env.example .env.local
npx supabase start
npx supabase db reset
npx supabase status
```

Copy the local API URL, anon key, and service-role key printed by `supabase status` into `.env.local`. Set unique test emails and distinct passwords of at least 16 characters, then provision the two local test users:

```bash
npm run seed:users
npm run dev
```

Open `http://localhost:3000`. Public signup is disabled; only explicitly provisioned users can sign in.

## Supabase setup and migrations

The first migration creates enums, tables, constraints, generated line values/totals, RLS policies, immutability triggers, and five authoritative RPCs:

- `save_order_draft`: creates or replaces an editable order and every line in one transaction; new products use catalogue prices, while products already on that draft retain their saved price snapshots.
- `save_and_finalize_order`: atomically creates or updates and confirms an approval-free order, avoiding a partially saved two-request workflow.
- `approve_order_line`: owner-only; obtains the approver from `auth.uid()` and locks the order before the line.
- `finalize_order`: checks the reviewed order version, rechecks ownership and every >5% approval, recomputes totals, then confirms atomically.
- `set_current_exchange_rate`: owner-only; changes only the default for new orders.

The second migration idempotently seeds the catalogue and singleton settings. Apply everything locally with `npx supabase db reset`, or to a linked hosted project with:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Never run unreviewed migrations against production. Use separate Supabase projects for preview and production.

The third migration removes automatic profile creation for new Auth identities. Creating an Auth user alone does not grant application access; an administrator must explicitly add the corresponding `profiles` row and role.

## Reference data and test accounts

The migration seeds exactly these dealers:

- Ahmed Trading — Khartoum
- Nile Solar — Omdurman
- Dongola Power — Dongola

It also seeds exactly the four requested active products at 51,500, 97,500, 81,000, and 207,000 cents, plus a minimum rate of 8,000 and current rate of 8,200.

`npm run seed:users` creates or resets the two disposable test accounts and assigns their roles in `profiles`. It has no default passwords, requires every `E2E_*` credential, and refuses remote projects unless a dedicated test-project override is set. Never use this script for production account provisioning.

## Environment variables

| Variable | Runtime | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server | Supabase anon or publishable key; RLS remains active |
| `SUPABASE_SERVICE_ROLE_KEY` | local/test tooling only | provisions disposable test users and lets the integration suite verify trigger-level immutability; never expose or add to the deployed runtime |
| `E2E_BASE_URL` | tests only | application URL for Playwright |
| `E2E_ADVISER_*`, `E2E_OWNER_*` | seed/tests only | required disposable test-account credentials |

Only the two `NEXT_PUBLIC_*` values are required by the deployed application. `.env.example` contains placeholders; `.env.local` is gitignored.

## Running the application and checks

```bash
npm run dev             # development server
npm run lint            # ESLint, zero warnings allowed
npm run typecheck       # strict TypeScript
npm test                # unit/request-schema tests; live suite is skipped by default
npm run build           # production Webpack build
npm run verify          # lint + typecheck + unit tests + build
```

Webpack is selected explicitly for the production build because the current Turbopack CSS worker binds an internal port in restricted CI/sandbox environments. The output is still the standard Vercel Next.js application.

### Real Supabase integration tests

After `supabase db reset` and `npm run seed:users`, export the values in `.env.local` and run:

```bash
npm run test:integration
npx supabase test db
```

The live integration test signs in as both roles and verifies price tampering rejection, 7.25% finalization blocking, adviser approval denial, owner approval, exact totals, the 7,900 rate rejection, and historical-rate preservation. It intentionally targets a disposable/reset local database because confirmed financial records are immutable.

Both live suites refuse a non-local Supabase URL by default because they create immutable orders and temporarily mutate catalogue/settings data. For a dedicated, disposable remote test project only, opt in explicitly with `ALLOW_DESTRUCTIVE_TESTS=1`.

### Playwright E2E

Install the browser once, start from a reset/seeded database, then run:

```bash
npx playwright install chromium
RUN_E2E=1 npm run test:e2e
```

The spec uses a 375×812 viewport, runs the full worked example across adviser and owner sessions, tests direct HTTP tampering/authorization, confirms no horizontal overflow, changes the current rate to 9,000, and proves the old order remains at 8,200. Without `RUN_E2E=1`, the environment-dependent test is explicitly skipped rather than pretending a database exists.

## Business rules

- A line value is `unit_price_cents × quantity`.
- A line total is `line_value_cents − discount_cents`.
- Zero discount: normal.
- `0% < discount ≤ 3%`: sand, adviser may confirm.
- `3% < discount ≤ 5%`: red/high, adviser may confirm.
- `discount > 5%`: blocked until that exact line is owner-approved.
- Threshold comparisons multiply integers (`discount × 100` versus `line value × 3/5`); rounded display percentages never decide authority.
- Exchange rate is one whole SDG-per-USD integer on each order and must be between 8,000 and 100,000.
- Each product may occur once per order. This avoids splitting one commercial item across duplicate lines to game a per-line approval threshold.
- Confirmed orders and their lines are database-trigger-protected from update or deletion.

## Money representation and rounding

All stored USD amounts are PostgreSQL `bigint` cents. Client input is parsed from a decimal string into cents without `parseFloat`; the TypeScript boundary rejects unsafe integers. PostgreSQL generates `line_value_cents` and `line_total_cents`, and enforces aggregate consistency on `orders`.

SDG is stored as a whole integer. The supplied examples divide exactly. For other cent/rate combinations, the application rounds half-up to a whole SDG using integer arithmetic:

```text
sdg_total = (total_cents × exchange_rate + 50) / 100
```

A production product owner should confirm whether SDG minor units must instead be represented.

## Historical immutability

`orders.exchange_rate` is a snapshot entered for that order. Detail/history pages display it and `orders.sdg_total`; they never recalculate against `app_settings.current_exchange_rate`.

`order_lines.unit_price_cents` is loaded from the active product when it is first added to an order. Later draft edits retain that product's saved price, and historical pages use the snapshot and generated snapshot totals, never the current catalogue price. Changing settings or a product later cannot cascade into an order.

## Owner approval interpretation

The source requirement says a >5% order cannot be saved, but the owner needs a persisted object to review. This implementation follows the brief's stated safe interpretation:

- A draft with a >5% line is persisted as `pending_approval`.
- The specific line is `pending`; the order cannot be confirmed.
- Only a database profile with `role = owner` can approve it.
- When every exception is approved, the order returns to `draft` and may be finalized.
- Editing a non-confirmed order transactionally replaces its lines, so all earlier approvals are removed. Approval can never be reused after quantity or discount changes.

The workflow should be confirmed with the product owner before processing live orders.

## Security model

- Password authentication uses server-managed Supabase SSR cookies with `HttpOnly`, `SameSite=Lax`, and `Secure` in production, and verifies identities with `auth.getUser()`.
- Roles live only in the explicitly provisioned `profiles` access list. Creating an Auth identity does not grant an application role.
- There is no profile update policy, so an adviser cannot self-promote.
- Advisers read only their orders; owners read the approval scope. Both read the reference catalogue/settings.
- No authenticated direct table writes are granted for orders or lines. Narrow RPCs recheck `auth.uid()`, database role, ownership, state, values, and row locks.
- All definer functions use an empty `search_path`, fully qualified objects, revoked public/anon execution, and authenticated-only grants.
- The frontend never submits price, line value, percentage, total, approval state, approver, or SDG total.
- The service-role key is used only by local provisioning and disposable database integration tests; browser and deployed runtime code never use it.

Hiding owner buttons is usability only. PostgreSQL remains the authorization boundary.

## Acceptance example

The unit and live integration suites assert the exact required oracle:

| Line | Value | Discount | Display | State | Total |
|---|---:|---:|---:|---|---:|
| SPF 6000 ES Plus × 4 | $2,060 | $40 | 1.94% | sand | $2,020 |
| Hope 5.0L-B1 × 2 | $1,620 | $70 | 4.32% | red | $1,550 |
| Hope 16.0LM-A1 × 1 | $2,070 | $150 | 7.25% | blocked | $1,920 |

Without the blocked line: `$3,570 × 8,200 = 29,274,000 SDG`.

After owner approval with all lines: `$5,490 × 8,200 = 45,018,000 SDG`.

Changing the current setting to 9,000 leaves that confirmed order at 8,200 and 45,018,000 SDG, not 49,410,000.

## Vercel deployment

1. Create separate hosted Supabase projects for preview and production.
2. Link/apply the migrations with `npx supabase db push`.
3. Create production Auth identities through the approved Supabase administrator workflow, then explicitly provision each `profiles` row and role. Do not run `npm run seed:users` against production.
4. In Supabase Auth, keep public signup disabled and set Site URL/redirect allow-list entries for the Vercel domains.
5. Push this repository to GitHub and import it into Vercel as a Next.js project.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the appropriate Vercel environments.
7. Use `npm run build` (or let Vercel use the package script) and deploy.
8. Point the test-only environment variables at a dedicated disposable preview project, then run `ALLOW_DESTRUCTIVE_TESTS=1 RUN_E2E=1 E2E_BASE_URL=https://YOUR-PREVIEW.example npm run test:e2e` before promoting production. Never run this mutation-bearing suite against production data.

No server-only secret is required by the deployed app. Database transactions run through the signed-in user's JWT and checked RPCs.

## Product decisions

- Owner-created orders and owner approval are permitted; four-eyes separation was not requested.
- Pending orders can be edited, but doing so clears every approval and requires fresh review.
- One product per order line group is enforced to prevent threshold splitting.
- Product/dealer management and catalogue repricing UI are outside the current scope.
- Whole SDG half-up rounding is an explicit product choice.
- Exchange rates are constrained to 8,000–100,000 SDG/USD so the supported maximum order remains within JavaScript's safe-integer range; the supplied 8,200/9,000 cases are unaffected.
- Weak-network support means durable input during a failed request, loading/duplicate-submit guards, and small request count—not offline synchronization.

## Further controls for financial production use

- Append-only approval/audit events and, where appropriate, a financial ledger
- Organization/environment IDs and dealer tenant isolation from day one
- Idempotency keys for save/finalize mutations
- Explicit optimistic concurrency/version fields
- Smaller, separately reviewable transaction boundaries where a future workflow no longer needs today's atomic save operation
- More exhaustive adversarial RLS, concurrency, and comprehensive browser E2E tests
- Offline-aware drafts, retry queues, and robust weak-network conflict handling
- Structured observability, error monitoring, and audit metadata
- Backup/restore drills and retention policies
- RTL/i18n-ready strings and accessibility testing
- Production credential lifecycle and least-privilege provisioning automation
- A formally approved correction/reversal workflow rather than historical edits
