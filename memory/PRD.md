# HandyCl / HandyHub — Production Marketplace

## Original Problem Statement (UA)
"В мене є проект на гітхаб, потрібно доробити його до продакшену."

Full feature set requested across the iterations:
1. Admin panel: category CRUD with cover photos, recommended prices, platform commission %.
2. Guest booking flow: TaskRabbit-style landing where guests browse services + executors before registering.
3. Commission logic: client_total = executor_rate / (1 - commission/100); platform takes the difference (Variant B).
4. Task workflow: `pending_acceptance` status with Accept/Decline for the executor; client sees status updates.
5. Strict geolocation: clients only see executors who serve their location.
6. Notifications & integrations: Email (SendGrid), SMS (Twilio), Push, Stripe payments.
7. Payout: executors enter a debit card OR bank routing/account number; money is auto-transferred after each completed job.

## Repository
- GitHub: https://github.com/kmjyz44/HandyCl (master branch)
- Backend (Railway): https://backend-production-a461.up.railway.app
- Frontend (Netlify): https://handycl.netlify.app
- Stack: Expo Router (React Native) → Web via Netlify · FastAPI + MongoDB on Railway

## Architecture (current)
- `server.py` (root) — deployed by Railway via root `Dockerfile` + `railway.json`
- `backend/server.py` — OLDER duplicate kept locally; not deployed. Scheduled for removal once verified safe.
- `app/(tabs)/*.tsx` — Expo Router screens
- `app/payout-setup.tsx` — NEW: executor payout method onboarding (card/bank)
- `app/admin-integrations.tsx` — admin integration keys UI
- `utils/api.ts` — Axios client
- `utils/alert.ts` — cross-platform alert helper

## Implemented (chronological)

### 2026-01: Admin Categories
- Backend: `POST/PUT/DELETE /api/admin/categories` (JSON body, base64 cover image, soft+hard delete)
- Pydantic models: `CategoryCreateRequest`, `CategoryUpdateRequest`
- New fields: `image`, `commission_rate`, `recommended_price`, `updated_at`
- 9 built-in categories auto-seeded

### 2026-01: Guest Booking Flow
- Landing hero on `/` with brand + "Як це працює" + Login/Register
- `/executors/by-service` allows unauthenticated guests
- Auto-submit pending booking right after guest registers

### 2026-01: Commission (Variant B)
- `compute_client_pricing(executor_rate, category)` → returns {client_total, platform_take, executor_take}
- Snapshotted onto bookings as `commission_rate_snapshot`, `commission_amount`, `platform_take`, `executor_take`
- Search results show client_total (executor_rate + commission)

### 2026-01: Pending Acceptance Workflow
- `POST /api/tasks/{id}/accept` — provider accepts (status → assigned)
- `POST /api/tasks/{id}/decline?reason=...` — provider declines (status → declined, provider_id cleared)
- Front: Accept/Decline buttons on task-detail when status is pending_acceptance

### 2026-02-12: Stripe Payout Onboarding + Notifications (THIS COMMIT — a3a3e7a)
- `/api/version` endpoint with build SHA + feature flags so we can verify Railway is serving the right code
- Dockerfile `ARG CACHE_BUST` to defeat Railway's Docker layer cache when redeploying
- Multi-channel `notify_user(...)` helper:
  - In-app notification (Mongo `notifications`)
  - Email via SendGrid (uses `db.integration_keys.sendgrid_api_key`)
  - SMS via Twilio (uses `db.integration_keys.twilio_*`)
  - Both respect admin toggles `enable_email_notifications` / `enable_sms_notifications`
  - Fire-and-forget so the API request doesn't block on email/SMS
- Status changes that now trigger client/provider notifications:
  - New booking with chosen provider → provider gets "pending acceptance"
  - Provider accept → client gets "Виконавець прийняв замовлення"
  - Provider decline → client gets "Виконавець відхилив замовлення"
  - Provider on_the_way / started / completed → client notified
- Payout accounts:
  - `PayoutAccount` model extended with `card_*` fields, `account_holder_name`, `verification_status`
  - `POST /api/tasker/payout-accounts` supports `account_type=card` with Luhn validation + brand detection
  - `DELETE /api/tasker/payout-accounts/{id}`
  - `POST /api/tasker/payout-accounts/{id}/default`
  - Only LAST 4 DIGITS of card/account are stored (PCI-safer); full numbers go through validation then are discarded.
- New screen `app/payout-setup.tsx`:
  - Tabs: "Дебетова картка" (Visa/MC/Amex/Discover detection via BIN) | "Банк (ACH)"
  - Lists saved accounts; supports Set Default + Remove
  - Linked from Earnings tab CTA card

## Critical operational notes
- ⚠️ **DEPLOYMENT SYNC**: Changes pushed to `master` are deployed by Railway via root Dockerfile.
  When Railway gets stuck on an old image, bump `ARG CACHE_BUST=` in the Dockerfile and push.
  Verify with `curl https://backend-production-a461.up.railway.app/api/version`.
- ⚠️ Two `server.py` files exist (root + `/backend/`). Root is the deployed one. The duplicate
  was intentionally NOT deleted in this iteration (user opted to defer the refactor).
- ⚠️ Stripe Connect onboarding (actual money movement) is still pending — current payout
  setup collects + validates details and stores only last4. Provider sees status
  `pending_verification` until admin enables Stripe Connect for real payouts.

## Test credentials (auto-seeded on startup)
- Admin: admin@handyhub.com / Admin2024!
- Provider: provider@handyhub.com / Admin2024!
- Client: client@handyhub.com / Admin2024!

## Prioritised backlog
- **P0** Push commit `a3a3e7a` to GitHub master → verify Railway picks it up via `/api/version`
- **P0** Stripe Connect Express onboarding: replace the "store-then-pretend" payout flow with
  real Stripe Connected Account creation + external_account attach via Stripe.js tokens.
  (Frontend would tokenize card via Stripe.js before sending to backend.)
- **P0** Stripe Checkout for client payment — already wired but reads `settings.stripe_api_key`
  from `db.settings`. Switch to read from `db.integration_keys` so admin keys UI is the
  single source of truth.
- **P1** Banner/prompt forcing new providers to set their geo-location
- **P1** "Distance / Remote" tag for out-of-area executors if strict filtering is relaxed
- **P2** Consolidate root `server.py` and `backend/server.py` into one file
- **P2** Admin audit log of category/key changes
- **P2** Web push (VAPID) and Telegram bot notifications (keys already collectable in admin UI)
