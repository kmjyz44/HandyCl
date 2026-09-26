# Changelog

## 2026-06 — Admin Bookings: task detail modal + payment reminder
- `app/admin-bookings.tsx`: added a "Details" button on each card → full detail modal showing people (client/provider name, email, phone), schedule & address, and work & payment (hourly rate, estimated hours, HOURS WORKED, materials, AMOUNT DUE highlighted), plus description and an Open-chat shortcut.
- "Remind to pay" action on the card (for completed_pending_payment / completed) AND a "Send payment reminder to client" button in the modal → NEW endpoint `POST /api/admin/tasks/{id}/payment-reminder` notifies the client (in-app + email + Telegram + push) with the amount due and a deep link. Verified via curl (sent, amount computed).
- `admin_get_tasks` enrichment now also returns client/provider phone. api.ts: `adminPaymentReminder`.
- Requires Netlify + Railway redeploy.


## 2026-06 — Clients now get notifications like providers (opt-out by default)
- Previously new CLIENTS were created with all notification channels OFF, so they didn't receive chat/order emails or Telegram like providers. Registration now gives clients `notification_prefs = {}` (opt-out — all channels ON), same as providers.
- One-time startup migration `_migrate_client_notifications` (guarded by app_settings `client_notif_migrated`): flips existing strictly-all-off clients to opt-out. Clients with null/partial prefs already received by default.
- Verified: an admin chat message on a task produced a `chat_message` notification (with text) for BOTH the client and the provider. Clients with default prefs receive via in-app + email + Telegram + push.
- Backend-only → Railway redeploy (migration runs automatically on boot).


## 2026-06 — Chat message notifications to the recipient (Telegram + email + text)
- `send_task_message` previously only pinged admins. Now it also notifies the OTHER party via `notify_user` (in-app + email + SMS + Telegram + push per prefs) with the message TEXT (300-char preview) as the body and a deep link to the task/chat. client↔provider counterpart; admin messages notify both client & provider. Skips notifying the sender.
- So when a client writes and the provider hasn't replied, the provider gets the message text in Telegram + email with a tap-through link. Verified: DB shows `notification_type=chat_message`, title "New message from {sender}", body = message text, related task id.
- Backend-only → Railway redeploy. NOTE: fires per message; recipients can mute email/Telegram in notification prefs if it's too frequent.


## 2026-06 — Fix: pending-task banner now on the provider HOME screen
- The provider's landing/"Tasks" tab is `(tabs)/index.tsx` (ProviderHome, `if role==='provider'`), which had PaymentReminderBanner but NOT the new ProviderAlertBanner — so after login the unaccepted-task banner wasn't visible (pending_acceptance tasks are counted under "Mine", not "Available"). Added `<ProviderAlertBanner />` right under the greeting + import. Now visible immediately on login.
- Frontend-only; requires Netlify redeploy.


## 2026-06 — Fix: unaccepted-task banner didn't clear after accepting
- `components/ProviderAlertBanner.tsx`: added `useFocusEffect` (expo-router) to refetch `/provider/pending-alert` every time the screen regains focus. Previously it only polled every 30s, so after a provider accepted a task on task-detail and returned, the banner lingered until a manual refresh. Now it clears immediately on return.
- Frontend-only (Expo app builds on Netlify; preview is a CRA stub so not runtime-verifiable here). Requires Netlify redeploy.


## 2026-06 — Deep link in new-task notifications (Telegram/email/SMS/push)
- `notify_user` now builds an absolute deep link `{base}/task-detail?id={related_id}` for any notification with related_type task/booking and appends it: Telegram as a clickable `<a href>` "👉 Open the task", email/SMS as a tappable URL, push routes to the task. Base URL = `integration_keys.app_base_url` if set, else `https://ono-fix.com`.
- Applies automatically to the provider "new_task_pending" alert, the 12h unaccepted reminder, and other task/booking notifications — so the provider taps the message and lands on the task to Accept/Decline.
- Telegram uses HTML parse mode (link renders). Verified syntax + server reload; endpoint 200.
- Backend-only → requires Railway redeploy.


## 2026-06 — Unaccepted-task escalation: banner timer, 12h reminder, 24h auto-pause, account pause
- Banner (`components/ProviderAlertBanner.tsx`): for providers, shows an amber banner with a live COUNT-UP timer ("Xh Ym elapsed") when there's an unaccepted task → tap opens `/task-detail`. When the account is paused, shows a red "Your account is paused" banner → tap = reactivate. Mounted in tasks & bookings tabs and at top of ProviderProfile. Polls `/provider/pending-alert` every 30s, ticks locally each second.
- Backend endpoints: `GET /provider/pending-alert` (oldest unaccepted task + elapsed_seconds + pause state), `POST /provider/pause` (manual, reason=manual), `POST /provider/unpause` (clears pause; if reason=auto_unaccepted, auto-declines stale >24h tasks via `_auto_decline_task` and applies best-effort -10 loyalty_points). All curl-verified.
- Background loop `_unaccepted_task_loop` (every 15 min, registered in startup): at 12h sends a reminder via `notify_user` (email + Telegram + push per prefs), sets `reminder_12h_sent`; at 24h sets user `search_paused=True, paused_reason=auto_unaccepted` and notifies. Verified: it had already auto-paused the test provider (84-day-old tasks); unpause released 3 stale tasks.
- Search visibility: `/executors/by-service` $match now excludes `search_paused == True` (flag on users doc).
- New screen `app/account-pause.tsx` + "Account pause" menu row in ProviderProfile (testid `account-pause-menu-row`): toggle visibility, reactivate button, status card. api.ts: getProviderPendingAlert/providerPause/providerUnpause.
- Requires Netlify + Railway redeploy. NOTE: frontend flows not visually testable in preview (CRA stub); backend fully curl-verified.


## 2026-06 — Provider step-by-step guide (in My Profile + Help Center)
- NEW screen `app/provider-guide.tsx`: 6 illustrated steps using EXACT in-app button labels — (1) Get set up (onboarding checklist), (2) Add payout details (Zelle/Venmo + name), (3) Accept a new order ("Accept task"/"Decline task"), (4) Update status ("I'm on the way" → "Start work" → "Finish work"), (5) Create & send invoice ("Send invoice"), (6) Get paid. Plus a Tips card and a "Contact support" button (→ /support-chat).
- Illustrations generated via image tool (Gemini), hosted on Emergent static CDN.
- Entry points: provider "How to work on Ono-Fix" row in ProviderProfile (`(tabs)/my-profile.tsx`, testid `provider-guide-row`) AND a "Provider guide" card in `help-center.tsx` (testid `open-provider-guide-btn`). Registered in `_layout.tsx`.
- Frontend-only; English. Requires Netlify redeploy only.


## 2026-06 — Payout recipient name (for Zelle/Venmo)
- Added `payout_name` (full name or company) to provider payout contacts. Model `ProviderPayoutContacts` + PUT/GET `/tasker/payout-contacts` updated (stored on user doc). Verified via curl (save→get round-trip).
- Client payment instructions (`/payments/...` manual split) now append the payout name to the provider's Zelle/Venmo/PayPal handle (falls back to the pro's account name) so clients know exactly who to pay.
- Frontend `app/payout-setup.tsx`: new "Full name or company name" input at top of the Zelle/Venmo card with a green hint that Zelle/Venmo may require the recipient name. api.ts type updated. Compiles.
- Requires Netlify + Railway redeploy.


## 2026-06 — Payouts = Zelle/Venmo only + payout step in provider onboarding
- `app/payout-setup.tsx`: removed the Debit card / Bank (ACH) section (tabs + card/bank form + saved-accounts list). Payouts are now Zelle/Venmo (+PayPal if admin-enabled) only. Updated header sub-copy and removed the "save details manually" divider. Stripe/Finix connect cards remain gated by `enabledMethods` (hidden unless admin enables). Frontend compiles.
- Provider onboarding gained a new step "Set up how you get paid" → routes to `/payout-setup`. `utils/onboardingSteps.ts`: added `payout` key/def (cash icon, green). Backend `GET /provider/onboarding-status`: added `payout` step, done when user has zelle_handle/venmo_handle/paypal_email. Verified via curl: 7 steps now, payout detected.
- Requires Netlify + Railway redeploy.


## 2026-06 — Admin Bookings management screen + task block + new-order email alert
- NEW admin screen `app/admin-bookings.tsx`: one combined task list with "filter by provider" (searchable modal) + status filter chips, manual refresh. Each task card shows client, provider, date/time, price, status badge, Blocked tag.
- Per-task actions: Open shared chat (routes to existing `/task-chat`, admin already has full read/write access even in closed chats), Change status (modal with full TaskStatus list), Block/Unblock, Delete. Registered in `_layout.tsx`; linked from admin tools grid in `(tabs)/services.tsx` as "Bookings".
- NEW backend `POST /api/admin/tasks/{id}/block?blocked=` — sets `admin_blocked`; `send_task_message` now blocks client/provider (admin can still post) when `admin_blocked` is true. Verified via curl (block→true, unblock→false).
- Reused existing: `GET /admin/tasks` (status/provider filters), `PATCH /admin/tasks/{id}/status`, `DELETE /admin/tasks/{id}`.
- New-order notifications: admin Telegram alert already existed on booking creation; ADDED admin/moderator EMAIL alert too (via `_send_email_now`). api.ts: `adminBlockTask`.
- Requires Netlify + Railway redeploy.


## 2026-06 — Role-based pricing display (clients see commission-included, pros see net)
- Bug: Pro profile & Pros list showed the provider's RAW net rate to everyone. Clients must see the price WITH platform commission; providers/admins see their own net rate.
- `/profile/executor/{user_id}` now takes optional auth. For viewers who are NOT the profile owner or an admin, prices are marked up to the client total via new helper `_apply_client_pricing_to_profile` (per-skill uses that skill's category commission; top-level uses global). Adds `prices_include_commission` flag and preserves net in `provider_hourly_rate`.
- `/executors/by-service` now also marks up each `profile.skills[].hourly_rate` for non-admin viewers (per-category commission, cached via `_skill_commission`), preserving net in `provider_hourly_rate`. Top-level `final_hourly_rate` (client) / `base_hourly_rate` (net) unchanged.
- Formula reused from `compute_client_pricing`: client = net / (1 - commission%/100). Verified via curl: net 30 (cleaning 15%) → client 35.29; owner/admin → 30. Guest top rate 60 → 70.59.
- Frontend `app/executor/[id].tsx`: renders `skill.hourly_rate` as-is (now role-correct) + shows "Prices shown include the Ono-Fix service fee." caption to clients (testid `price-includes-fee-note`). Provider's own profile (`get_my_executor_profile`) unaffected — still raw.
- Requires Netlify + Railway redeploy.


## 2026-06 — Custom service-search analytics + admin "Search Insights" screen
- Backend: `/executors/by-service` now fire-and-forget logs each meaningful search (service_name, category+resolved category_name, city, lat/lng, date, user_id or guest, source) into `search_events` via `_log_search_event`. Empty/browse-all calls ignored.
- NEW endpoint `GET /api/admin/search-analytics?days=N` (admin-only): total searches, top services (by category_name, raw service_name fallback), top regions/cities, per-day trend, 40 recent searches. Verified via curl (logged 2 guest searches → aggregated correctly).
- Frontend: new admin screen `app/admin-search-stats.tsx` (7/30/90-day range, total card, top-services & top-cities bar charts, daily trend bars, recent list). Registered in `_layout.tsx`; linked from admin tools grid in `(tabs)/services.tsx` as "Search Insights". api.ts `getSearchAnalytics`.
- Design note: user chose CUSTOM in-app analytics (owns data, in admin panel) over Google/PostHog. GA4 activation deferred. Future voice-search will log with source!="pros_search" and show up here too.
- Requires Netlify + Railway redeploy to go live.


## PARKED / BACKLOG — Voice AI service search (deferred by user 2026-06)
User wants but postponed. Spec agreed:
- Flow: mic → Whisper STT → GPT-5 intent parse → CONFIRMATION screen ("You're looking for: 4 cameras in Niles — correct?") → results via existing `/executors/by-service` → book (existing flow).
- Parse into: service (map to a real category_id/skill from `/categories`), quantity, city/location, extra requirements.
- Languages to recognise: English, Spanish, Ukrainian.
- Mic button placement: home (index) + Pros tab.
- Models: GPT-5 (text intent extraction/classification/location/confirmation copy) + Whisper STT, both via Emergent LLM key (no new API keys).
- Reuse: `/categories` (feed list to LLM for accurate mapping), `/executors/by-service` (params: skill/category, city, lat/lng, date, timeFrom). Frontend records audio via MediaRecorder (web).
- Effort estimate given: ~1 focused build session for MVP + a testing round.


## 2026-06 — Admin: manual "Send welcome email" resend per user
- NEW endpoint `POST /api/admin/users/{user_id}/send-welcome` (admin-only): (re)sends the role-based welcome email to a specific user immediately, even if automatic welcome emails are toggled OFF (`_send_welcome_email(..., force=True)`). 404 on unknown user, 400 if no email. Verified via curl.
- Frontend: "Send welcome email" button added to the admin user-detail modal (`app/(tabs)/users.tsx`, testid `admin-send-welcome-btn`); api.ts `adminSendWelcomeToUser`. Useful for existing users who registered before welcome emails existed.
- Requires Netlify + Railway redeploy to go live.


## 2026-06 — Automatic welcome emails (client + provider), admin-editable
- NEW: on registration each user gets a role-based welcome email covering how the platform works, house/platform rules and the rewards/loyalty system. Client + provider have separate templates. Hooked into `/auth/register` and Google OAuth new-user path (fire-and-forget via `_send_welcome_email`, sent through `_send_email_now` Resend/SendGrid pipeline).
- Templates + master on/off toggle stored in `app_settings` (setting_id `welcome_emails`), admin-editable anytime. Defaults live in `WELCOME_EMAIL_DEFAULTS` (English — US market). `{name}` placeholder supported.
- Backend endpoints (admin-only): `GET /api/admin/welcome-emails`, `PUT /api/admin/welcome-emails` (any subset of enabled/client_subject/client_body/provider_subject/provider_body), `POST /api/admin/welcome-emails/test` (sends a preview of a role to the admin's own inbox). All verified via curl on preview.
- Frontend: new screen `app/admin-welcome-emails.tsx` (master toggle, Client/Provider tabs, subject+body editors, "Send test to me", Save), registered in `_layout.tsx`, linked from admin tools grid in `(tabs)/services.tsx` as "Welcome Emails". api.ts: getWelcomeEmails / updateWelcomeEmails / testWelcomeEmail.
- NOTE: default copy is English (matches US adaptation); admin can rewrite in any language via the editor. Requires Netlify (frontend) + Railway (backend) redeploy to go live.


## 2026-06 — Admin Telegram link generator + iPhone connect helper
- NEW backend endpoint `POST /api/admin/telegram/link/{user_id}` (admin-only): generates a one-time code + `https://t.me/{bot}?start={code}` deep link for ANY user, so admin can send the link directly (bot username = `onofix_bot`, auto-resolved via getMe). Returns `already_connected` + `user_name`. Verified via curl on preview.
- Admin panel (`app/(tabs)/users.tsx`): added "Telegram connect link" box at top of the user-detail modal — "Generate link" → shows link with Copy / Open / New link buttons + a "Connected" pill when the user already linked. testids: admin-tg-generate-btn, admin-tg-link-text, admin-tg-copy-btn, admin-tg-open-btn, admin-tg-regen-btn.
- iPhone helper (`app/notification-settings.tsx`): added a "Copy" button next to the manual connect code (navigator.clipboard on web) so iOS users who hit the popup-blocker can copy the code and paste it to the bot. testid: telegram-copy-code.
- CONTEXT: user confirmed Telegram works fine on Android (prod webhook active); issue is only iOS popup blocking. Admin-generated link bypasses the in-app button entirely.
- ⚠️ Requires Netlify + Railway redeploy (Save to GitHub) to appear in production. Backend synced /app/backend/server.py → /app/server.py.


## 2026-06 — Blog: "Order a service" CTA at end of every article + prod Soro sync
- Added a gradient CTA block ("Need this done for you? … Order a service →" linking to `/`) at the bottom of every server-rendered blog article (`blog_render_article` in server.py) to convert Google/readers into bookings.
- Removed the confusing "View on the web" pill from the in-app Blog feed (`(tabs)/community.tsx`) — now ONE blog: the in-app "Blog" tab, with `/blog` served silently for Google/SEO only.
- OPS: production Railway backend was redeployed with the new code; I set the Soro RSS URL + ran Sync via the prod admin API. Confirmed on ono-fix.com: /blog and /blog/{slug} live, Soro article "AI Home Services Start With One Simple Photo" shows in the shared blog feed (total=2).
- FIX: restored curated backend/requirements.txt (a prior `pip freeze` had dropped the `--extra-index-url` line → Railway build failed on emergentintegrations). Now original 19 deps + feedparser==6.0.14.
- ⚠️ CTA + removed pill require a Railway backend + Netlify redeploy to appear in production.


## 2026-06 — Blog UX: "Blog" label + web link; Soro RSS cache-bust fix
- FIX: Soro RSS is served via Vercel with a 1h cache (`x-vercel-cache: HIT`) → backend was fetching a stale/empty feed. `_soro_sync_rss` now appends a `nocache` query param + no-cache headers, so sync always gets the latest feed. Verified: 1 article ("AI Home Services Start With One Simple Photo") imported, renders at /api/blog-render/{slug} with full HTML + SEO, listed in sitemap, and shows in the in-app Community feed (source=soro).
- DECISION (user 1a + 2a): keep Soro articles inside the existing Community feed (same blog_posts collection) AND make the blog a visible, clearly-labeled menu item.
- FRONTEND: renamed the "Community" tab → "Blog" (`(tabs)/_layout.tsx`); community screen Stack title + intro → "Blog" with updated subtitle; added a web-only "View on the web ↗" pill in the feed header that opens the public SEO page `${origin}/blog` in a new tab (`(tabs)/community.tsx`).
- ⚠️ Requires Netlify redeploy for label/link + /blog proxy to go live in production.


## 2026-06 — Feature: Soro AI RSS → server-rendered SEO blog (Google-indexable)
- GOAL: Get Soro-written articles indexed by Google. The Netlify SPA can't be reliably crawled, so the FastAPI backend now fetches the Soro RSS feed and serves REAL server-rendered HTML pages.
- BACKEND (`/app/backend/server.py`):
  - `Settings`: added `soro_rss_url`, `soro_rss_last_sync`. `BlogPost`: added `slug`, `content_html`, `cover_image`, `source`.
  - `_soro_sync_rss()` fetches RSS (httpx) + parses (feedparser), upserts into `blog_posts` keyed by `guid`; slug taken from the article link's last path segment (matches Soro links). `_sanitize_article_html()` strips scripts/styles/iframes/on* handlers.
  - `_soro_rss_loop()` background task auto-syncs every 3h (startup task added).
  - HTML routes: `GET /api/blog-render` (index) and `GET /api/blog-render/{slug}` (article) with full SEO meta (title/description/canonical/OG/Twitter + JSON-LD Article schema, datePublished). 404 page for missing articles.
  - Admin: `PUT /api/admin/integrations/soro/rss`, `POST /api/admin/integrations/soro/sync-rss`; `GET /api/admin/integrations/soro` now returns rss_url, rss_last_sync, soro_posts_count.
  - Sitemap `/api/seo/sitemap.xml` now includes `/blog` + every published article `/blog/{slug}`.
- FRONTEND: admin-integrations.tsx — new "RSS feed → SEO blog" section (Save RSS / Sync now, status line); utils/api.ts `adminSetSoroRss`, `adminSyncSoroRss`.
- NETLIFY (`/app/public/_redirects`): proxy `/blog` and `/blog/*` → backend `/api/blog-render*`; added `/robots.txt` proxy.
- SEEDED user's RSS URL (`.../api/rss/20aa89d9-...`) into settings. Feed was EMPTY at build time (Soro not yet published) — pages auto-populate on next sync once Soro publishes.
- TESTED via curl on preview: list HTML, article HTML (script sanitized, JSON-LD present), sitemap includes slug, admin sync returns ok, 404 works.
- ⚠️ Requires Netlify redeploy ("Save to GitHub") for `/blog` proxy + frontend UI to go live in production.


## 2026-06 — Fix: empty "Pros" tab for clients without an address
- ROOT CAUSE: `/executors/available` (Pros browse tab) filtered pros by service-area coverage. When a client had no saved lat/lng, it fell back to the platform's default service-area centre (e.g. Chicago) and hid every pro whose zone didn't cover that centre → empty list for new clients like client5.
- FIX: removed the default-centre fallback. Now, when the client has no coordinates, all pros with a configured work zone are shown (coverage is still enforced at booking time). Coverage filtering only applies when the client actually has lat/lng. Bare city string no longer hides geo-configured pros.
- Verified on preview: client with no location now returns all 3 configured pros (was 0). Pros with NO configured work zone remain hidden (cannot be booked). Requires Railway backend redeploy to take effect in production.


## 2026-06 — Performance: DB indexes + asset caching
- DIAGNOSIS (prod measurements): network fine (ping 42ms). Slowness is backend: /api/categories ~0.8s and /api/executors/by-service ~3.1s. Root causes: (1) NO DB indexes anywhere (full collection scans), (2) high Railway↔MongoDB latency (~0.8s baseline on trivial queries → DB likely in a different region than the backend), (3) JS bundle 617KB gzip served with Cache-Control max-age=0 (re-downloaded every visit).
- FIX 1: `_ensure_indexes()` on startup — indexes for users(user_id/email/role), executor_profiles(user_id), bookings(provider_id+category+status, client_id, booking_id, status), reviews(provider_id, booking_id), tasks(provider_id+status, task_id, client_id), categories, notifications, messages, user_sessions(session_token), offers, telegram_link_codes, waitlist. Idempotent. Preview result: executors endpoint 3.1s → 0.14s.
- FIX 2: netlify.toml — immutable 1-year Cache-Control for /_expo/static/* and /assets/* (hashed files) → fixes repeat-visit re-downloads.
- USER ACTION (biggest win): co-locate MongoDB Atlas region with the Railway service region; ensure Railway plan isn't cold/tiny. Redeploy backend (Railway) + frontend (Netlify).


## 2026-06 — Experience-based executor ranking (per category)
- New ranking in `GET /executors/by-service` (computed on-the-fly, no schema change / backfill):
  score(category) = Σ actual_hours from completed/paid bookings in that category + review adjustment.
  Review map: 5★+5, 4★+3, 3★+1, 2★−1, 1★−2 hours; PLUS extra −5 when a 1-2★ review has written text (negative review). Score may go negative.
- New providers (registered < 3 days) are BOOSTED to the top of the list (globally, newest-first among them) so they can earn a rating.
- Helpers: `_compute_category_ranking(category, provider_ids)` (2 aggregations: bookings hours + reviews→bookings category join), `_is_new_provider_boosted(created_at)`. Constants `_RANKING_DONE_STATUSES`, `_REVIEW_STAR_HOURS`, `_NEW_PROVIDER_BOOST_DAYS=3`.
- Endpoint now returns per executor: `category_hours` (raw worked hours, for display), `ranking_score`, `ranking_position`, `is_new_boost`. Sort applies experience ranking when a category is passed (price/newest/oldest admin sorts still honored).
- Frontend `app/(tabs)/index.tsx` tasker cards: "#N" rank badge (top 3), "X hrs experience in [category]" line, and "New pro — be their first client!" for boosted new providers.
- Tested via seeded data: new pro top → 100h → 80h; review deltas verified (100−2−5=93; 80+5=85). Needs Netlify redeploy for the UI badges.


## 2026-06 — Telegram: webhook-free long polling (fixes env mismatch)
- ROOT CAUSE of "connect not working": bot webhook pointed to the preview backend while the deployed app runs on Railway → link codes stored in Railway DB, but /start hit preview → mismatch.
- FIX: added `_telegram_poll_loop()` (started in `startup_event`) — deletes any webhook, then long-polls `getUpdates` and feeds updates to the shared `_process_telegram_update()`. No webhook URL / secret / "Register webhook" step needed; whichever backend runs the app also polls, so codes always match.
- Extracted linking logic into `_process_telegram_update()` (used by both the poll loop and the legacy `/telegram/webhook/{secret}` endpoint). Supports `/start <code>` AND a bare pasted code.
- Env gate `ENABLE_TELEGRAM_POLLING` (default "true"). Set to "false" in preview `/app/backend/.env` so preview doesn't fight production for the same bot (getUpdates 409). Production needs NO env var — defaults on.
- Frontend `NotificationSettingsModal`: connect alert now shows the link code so the user can paste it to the bot if the deep-link START doesn't carry it.
- Verified on preview: deleteWebhook + getUpdates return 200, loop iterates, disabled-flag respected. Linking handler verified earlier (bare code sets telegram_chat_id).
- ACTION FOR USER: redeploy backend (Railway) + frontend (Netlify). Then Profile → Notifications → Connect Telegram → paste the shown code to the bot. No admin webhook step.


## 2026-06 — Per-user notification channel switches
- User model: added `notification_prefs: Dict[str,bool]` (opt-out model — missing key = enabled).
- `notify_user` rewritten to honour prefs: filters email/sms/push and now also sends **telegram** (to the user's own telegram_chat_id) when enabled. In-app stays always-on (notification center).
- Provider booking-flow Telegram calls gated with `_pref_on(provider, "telegram")` (5 sites).
- New endpoints: `GET/PUT /users/notification-prefs` (body: subset of {email,sms,push,telegram}). Tested via curl: default all-true, disable sms+telegram, re-enable sms.
- Frontend `app/(tabs)/my-profile.tsx` → Profile tab → SETTINGS → "Notifications" with 4 Switches (push/email/telegram/sms). `utils/api.ts`: getNotificationPrefs / updateNotificationPrefs. data-testids: notif-toggle-{channel}. (Expo builds on Netlify — needs redeploy to see live.)


## 2026-06 — Telegram admin notifications + account linking
- Rewrote `send_telegram_notification` to use httpx + resolve token from `integration_keys` (primary) → `settings` (fallback). Fixes mismatch where admin-UI token (integration_keys) was ignored by the sender (settings).
- Added `_notify_admins_telegram(text)` → sends to global `telegram_admin_chat_id` + every admin/moderator user with a linked `telegram_chat_id`. Respects `enable_telegram_notifications`.
- Hooked admin alerts into: `POST /bookings` (new order created) and both chat endpoints `POST /messages`, `POST /tasks/{id}/messages` (new chat message; skipped when sender is admin/moderator).
- Linking flow (deep-link + webhook): `POST /telegram/link/start` (returns t.me deep link with one-time code), `GET /telegram/link/status`, `POST /telegram/unlink`, `POST /telegram/webhook/{secret}` (handles `/start <code>` → stores chat_id), `POST /admin/telegram/setup` (getMe + setWebhook, stores bot username + webhook secret), `GET /admin/telegram/status`.
- IntegrationKeysUpdate: added telegram_bot_username, telegram_admin_chat_id, telegram_webhook_secret (secret masked).
- Frontend: `admin-integrations.tsx` Telegram section now has admin chat id field + "Register webhook" / "Connect my Telegram" / "Refresh status" buttons + status box. `utils/api.ts` new methods + exported `BACKEND_BASE_URL`.
- Tested via curl/DB: endpoint guards (no token→400, bad secret→403), and full webhook linking (`/start <code>` set telegram_chat_id + consumed code). Real send/getMe/setWebhook require the user's bot token. NOTE: production backend is on Railway (EXPO_PUBLIC_API_URL) — backend redeploy required, frontend redeploy on Netlify.


## 2026-06 — Pro-profile work photos on booking screen
- `app/(tabs)/index.tsx` `tasker_profile` step: (a) added a work-photos strip filtered to the category the client is booking (`booking.categoryId` vs `skill.category_id`), shown at top; hidden when the pro has no photos for that category (option 2a).
- (b) Skills are now tappable cards that expand to show the skill's experience/description + a horizontal strip of that skill's work photos (mirrors `app/executor/[id].tsx`).
- Added state `expandedTaskerSkill` + styles: servicesHint, skillCard/Header/Title/Rate, skillExpanded, skillCardExp, skillEmptyText, catPhotoThumb, catPhotoCaption. data-testids: tasker-category-photos, tasker-skill-{i}, tasker-skill-toggle-{i}.
- NOTE: Expo app has no local node_modules in preview (builds via Netlify). Verified by code review; requires Netlify redeploy to see live.


## 2026-06 — Waitlist auto-notifications + Plivo diagnostic
- Added `_notify_waitlist_matches(user_id)` in `backend/server.py`: when a provider updates skills or service area, un-notified waitlist clients whose category + location are now covered get an Email (Resend only, per product decision). Idempotent via `notified_at` marker on each waitlist entry.
- Hooked trigger (fire-and-forget) into `POST /profile/executor` and `PUT /profile/executor`, gated by `_WAITLIST_TRIGGER_FIELDS` = {skills, service_zones, service_radius_km, service_cities, latitude, longitude}.
- New waitlist fields: `notified_at`, `matched_provider_id`, `notify_email_sent`.
- Tested via API: NYC/cleaning match → notified; LA/cleaning → not notified (out of 30mi radius); NYC/moving → not notified (no matching skill). Idempotency verified.
- PLIVO DIAGNOSTIC: default Auth ID/Token (MANDEWMTDLZJCTZJJINC) are VALID (account "Leonid Zhovtiak", $10 credit). BLOCKER: account has 0 rented numbers and `plivo_src` is unset in DB → SMS cannot send until a 10DLC/Toll-Free sender number is rented in Plivo and saved as `plivo_src` in Admin → Integrations.


## 2026-06 — Address expansion (State → City → Street/Num → Unit → ZIP)
- Verified `POST /api/users/saved-addresses` accepts full payload (label, street, city, state, unit, zip) — 422 error resolved.
- Fixed `BookingCreate` model: added `state`, `unit`, `zip` fields (were silently dropped by Pydantic).
- `create_booking` now persists `state`, `unit`, `zip` on both the booking and task documents (needed for Finix ZIP compliance).
- Frontend (`my-profile.tsx`, `index.tsx`, `AddressAutocomplete.tsx`) already send these fields; booking prefill from default saved address works.
- Backend verified end-to-end via curl (client@handyhub.com). Frontend Expo Web not driven by Playwright in preview.

### Still pending
- Twilio SMS: DB `integration_keys` has NO twilio_* fields in preview. User chose to defer. Added `POST /api/admin/test-sms` diagnostic + admin UI button. SMS consent checkbox added to verify-phone screen.

## 2026-06 — Minimum billable hours + Open Graph
- New billing rule: minimum 1 hour per job; provider can raise their personal minimum to 1.5 or 2 hours via profile. Time beyond minimum billed per-minute. billable = max(minimum_hours, actual_hours).
- Backend: added `minimum_hours` to ExecutorProfile models; task completion reads it from executor_profiles and stores billable_hours + minimum_hours on the task. Verified 12/12 via testing agent (iteration_17).
- Executor listing + public profile GET expose `minimum_hours`.
- Frontend: min-charge shown in taskers list, tasker_profile step, and executor/[id] pricing card; provider sets minimum_hours (1/1.5/2) in profile Bio modal; carried through "book this pro" params.
- Terms §6 updated: providers must inform clients of the minimum charge before starting.
- Open Graph: generated 1200x630 social banner (/public/onofix-og.png); +html.tsx now references it with og:image:width/height/alt and twitter:image:alt.
- Booking address: saved-address quick-select block added to the address step (auto-fills State/City/Street/Unit/ZIP).

## 2026-06 — Company pages, footer & branding
- New info pages (expo-router, registered in _layout): `/about`, `/how-it-works` (Client/Pro tabs + 8 generated illustrations + video placeholder via HOW_VIDEOS), `/pricing`, `/contact`.
- Contact/About company info: Nexus Security Solutions LLC, owner Zhovtiak Leonid, 9701 Dee Rd, Niles, IL 60714, emails Nexus.ss.llc@gmail.com + finscan@finscan.store (temporary). Central constants in `/app/constants/company.ts`.
- New `components/SiteFooter.tsx` (dark footer: brand, 7 links About/HowItWorks/Pricing/FAQ→help-center/Contact/Privacy/Terms, "operated by Nexus Security Solutions LLC" fine print). Added to home page (hidden in focused PWA scan mode).
- Profile menu (my-profile): new "Company" section linking About/HowItWorks/Pricing/Contact; small "operated by Nexus Security Solutions LLC" fine-print at bottom.
- All files compile (Babel). NOT UI-tested: preview pod serves the Emergent CRA placeholder, not the Expo app — verify visually after deploy.

## 2026-06 — Service-area gating + waitlist
- Admin-configurable working zone: allowed states + cities + radius centers (lat/lng/miles). Default = Chicago center + 30 mi radius. Admin can expand/narrow. Stored in db.settings {setting_id:"service_area"}.
- Booking gate: `create_booking` returns 451 OUTSIDE_SERVICE_AREA when the location isn't covered. Frontend pre-checks and shows an "out_of_area" coming-soon step, saving the person to the waitlist.
- New endpoints: GET /service-area (public), GET/PUT /admin/service-area, POST /waitlist (public), GET /admin/waitlist, GET /admin/waitlist/export (CSV). Verified via curl (Miami→451, Chicago coords→200, Illinois state match→200).
- Booking payload now includes latitude/longitude (booking.lat/lng) so radius matching works.
- New admin pages: /admin-service-area (configure zone), /admin-waitlist (list + client-side CSV export); links added to Admin Panel header (services.tsx). Registered in _layout.
- Helper `_is_location_allowed` / `isInServiceArea` mirrors logic on backend & frontend (state OR city OR within-radius).

## 2026-07-05 — Blog fix (P0) + Full admin/moderator blog moderation
- FIXED "Could not publish" blog bug: `blog-create.tsx` now compresses each picked photo via `compressBase64Image(raw,1024,0.8)` before upload (phone photos were 5–10MB each → payload bloat → timeout). Reused the existing util already used in services.tsx.
- `blog-create.tsx` now also supports EDIT mode via `?edit=<post_id>` (prefills + PUT).
- Backend: added PUT /blog/posts/{id} (author/admin/moderator edit) and POST /blog/posts/{id}/pin (admin/moderator toggle). delete_blog_post now also allows moderators. New helper require_admin_or_moderator.
- Block/ban: block_user & unblock_user now allow admin+moderator (was admin-only). block_user now reads a JSON body {reason, duration_hours} (was query params — mismatched with frontend). Login now rejects blocked users (403) with auto-lift of expired temp blocks.
- Blog detail (`blog/[id].tsx`): pin/edit/delete header actions + "Ban author" button for admin/moderator; moderator role label added.
- Fixed blog auth: liked_by_me lookups used wrong collection db.sessions → db.user_sessions.
- Verified via curl: admin create/pin/edit/delete post OK; block→login 403→unblock→login 200 OK.
- NOTE: Expo app is NOT served on the preview URL (preview serves the /app/frontend CRA stub). Frontend changes verified by code review + backend curl; browser e2e must be done on the deployed Netlify build.

## 2026-07-05 — Booking notification root-cause + provider location filter
- ROOT CAUSE of "pro didn't get email when booked": submitBooking in index.tsx was FIRE-AND-FORGET — it showed "success" locally and ran api.createBooking in the background with a silent .catch. Any server rejection (validation/network/service-area) meant the booking was never created → the pro was never booked → no in-app/email/push notification fired. Confirmed: target pro had 0 real provider-bookings in DB, only the test one. Backend email itself works (Resend 200, message id returned).
- FIX (index.tsx): submitBooking now AWAITS api.createBooking; shows success only on real success, and surfaces the exact error on failure. Added provider_id presence guard.
- BUG: providers who declared a location only via user.city (e.g. "Kyiv") with no coords/service_cities were caught by the "no location → show to everyone" fallback and appeared for US clients.
- FIX (get_executors_by_service): location filter now treats user.city as declared config, uses miles-consistent _haversine_miles, and only shows truly unconfigured providers (no city/zones/coords) everywhere. Verified via curl: Kyiv-coords pro ABSENT from Chicago search, Kyiv-city (no coords) pro ABSENT, Chicago pro PRESENT.
- Synced /app/server.py ↔ /app/backend/server.py.

## 2026-07-05 (cont) — Hide unconfigured providers + verify provider order visibility
- Per user request: providers who have NOT configured a service area (no service_cities/zones, no user.city, no coords+radius) are now HIDDEN from ALL clients in get_executors_by_service (previously shown everywhere). Verified via curl: configured Chicago pro present, unconfigured pros hidden.
- Verified provider order visibility end-to-end: booked provider@handyhub.com → provider GET /api/tasks returns the task (status pending_acceptance). Backend logic is correct; a pro sees orders assigned to their provider_id.
- Nexus not seeing orders is explained by (1) the fire-and-forget booking bug (bookings never persisted server-side; now fixed) and/or (2) Nexus's account role must be 'provider' (a client role only sees client tasks).
- IMPORTANT: all these fixes live in this codebase; the user's LIVE app (Netlify frontend + Railway backend) must be REDEPLOYED for them to take effect.

## 2026-07-05 (cont2) — Location filter on the "Browse pros" tab (root cause of Kyiv pro showing)
- ROOT CAUSE of "Kyiv pro shows to Chicago clients": the Executors browse tab (app/(tabs)/executors.tsx) calls GET /executors/available, which had NO client-location filtering — it listed every provider. (get_executors_by_service already filtered, so the booking flow was fine when city was passed.)
- Added shared helper `_provider_service_match(executor, city, lat, lng) -> (has_config, covers)`. Refactored get_executors_by_service to use it.
- /executors/available now derives the client location (current_user.latitude/longitude, else the configured service-area center) and: (a) hides providers with NO service area configured, (b) hides providers whose area doesn't cover the client.
- Verified on preview: provider set to Kyiv → ABSENT from both /executors/available and /executors/by-service for a Chicago client; reset to Chicago → PRESENT in both; unconfigured providers hidden.
- NOTE: also verified LIVE Railway data — provider@handyhub.com there has profile coords=Kyiv(r=5) but user.city=Niles; the live backend runs OLD code (no filter on /executors/available) so it still shows. Requires Railway backend redeploy.

## 2026-07-05 (cont3) — Provider search: server-side geocoding fixes "pro not found"
- ROOT CAUSE of "provider not found even though location/skill/date match": when the client's address had NO coordinates (the browser-side Nominatim geocoder is frequently blocked/rate-limited, especially for guests), the search sent city-name only. Providers configured by coordinates+radius (e.g. Nexus: coords 42.05,-87.85 r=50mi) could not be matched by city name → excluded. Reproduced on LIVE: by-service with coords → Nexus present; city-only (no coords) → 0.
- FIX: added server-side geocoder `_geocode_place` (Open-Meteo geocoding API — reachable, no key; Photon/Nominatim are blocked/rate-limited from the pod). get_executors_by_service now geocodes the client city to coords when lat/lng are missing, so radius matching works.
- Verified on preview (all 3 criteria): 
  1) Location — Norridge/Chicago (no coords) → provider FOUND via geocode; Kyiv → NOT found.
  2) Skill — service_name=Electrical → found; Plumbing → not found (provider lacks it).
  3) Availability by date — filtered CLIENT-side in api.getExecutorsBySkill against availability_slots (providers with no slots are included).
- NOTE: frontend sends the skill as `service_name` (api maps skill→service_name). Requires Railway backend redeploy to take effect on the live app.

## 2026-07-05 (cont4) — Availability filter moved to backend (fix + robustness)
- The client-side availability filter in api.getExecutorsBySkill used `new Date(dateStr).getDay()` which is timezone-dependent (UTC parse of an ISO date shifts the weekday by one in US timezones) — a source of "No pros found" even when the pro is available.
- MOVED availability filtering to the backend get_executors_by_service (new `date` & `time` query params). day_of_week = datetime.strptime(date).isoweekday() % 7 (Sun=0..Sat=6, matches the provider availability UI's getDay convention). Providers with NO configured slots are still shown; providers with slots must have an active slot for the day (and covering the time if given).
- api.getExecutorsBySkill now forwards date & timeFrom to the backend and no longer does the fragile client-side filter.
- Verified on preview (provider with a Tue 08:00–16:30 slot): Tue→present, Fri→absent, Tue+10:00→present, Tue+18:00→absent, no date→present.
- All 3 booking criteria now enforced server-side & verified: location (with server geocoding), skill/category, availability by date/time.

## 2026-07-05 (cont5) — AI photo detection: skill mismatch made pros disappear
- ROOT CAUSE: AI photo analysis returns skill as a specific TASK (e.g. "Switch replacement"), not the canonical skill name. Provider skills are broad ("Electrical"). The by-service skill filter does substring matching, so "switch replacement" never matched "electrical" → provider excluded. Manual selection sends the canonical skill ("Electrical") so it worked.
- FIX: added `_resolve_canonical_skill(ai_skill, summary)` with a task-keyword→skill map (switch/outlet/wiring→Electrical, faucet/leak/pipe→Plumbing, tile→Tiling, tv mount→TV mounting, etc.).
  - analyze-task-photo now returns detection.skill = canonical skill (+ detection.detected_task = original AI task for display).
  - get_executors_by_service also resolves the incoming service_name via the same helper before matching (idempotent for real skill names, so manual flow unaffected).
- Verified on preview: service_name="Switch replacement" → provider present; "Faucet repair" → absent (no plumbing); manual "Electrical" → present.
- Requires Railway backend redeploy.

## 2026-07-05 (cont6) — Push delivered but not shown: sw.js renotify/tag bug
- SYMPTOM: test push reported "Subscriptions: 2. Delivered: 2" (backend + push service OK) but NO system notification appeared on the phone.
- ROOT CAUSE: public/sw.js set `renotify: true` with `tag: data.tag || undefined`. The backend push payload has no `tag`. Chrome REJECTS showNotification when renotify:true is used without a non-empty tag → the notification silently fails to display even though the push was delivered.
- FIX: sw.js now always sets a non-empty tag (`data.tag || 'ono-fix-'+ts`), added requireInteraction:false, rebranded title HandyHub→Ono-Fix.
- Requires Netlify redeploy + the device to pick up the new service worker (skipWaiting/clients.claim help; user may fully close & reopen the installed PWA once).

## 2026-07-05 (cont7) — "No pros on your date → view pros available on other dates"
- When the date/time search returns 0 pros, index.tsx now does a fallback search (same region + skill, NO date/time). If that has results, the empty state shows "No pros available for your date" + "N pros available on other dates" with a "View pros on other dates" button (viewOtherDates) and a "Change date & time" button. A yellow banner is shown when browsing other-date pros.
- If no pros exist in region+skill at all, the original "No pros found → Change address" empty state is kept.
- Frontend-only; relies on the already-verified backend availability filter (date→slot filter, no date→all region pros). Needs Netlify redeploy.

## 2026-06 (cont8) — "Other dates" pro click → calendar restricted to that pro's days
- Completes the fallback flow: when browsing pros available on OTHER dates (showingOtherDates), tapping a pro now sets forcedProvider, computes their working weekdays and routes to the Date & time step restricted to those days (instead of opening the profile).
- Added module-level helpers in app/(tabs)/index.tsx: WEEKDAY_LABELS + getProviderAvailableDays(slots) — converts availability_slots.day_of_week (Mon-indexed 0=Mon..6=Sun) to JS getDay (0=Sun..6=Sat), only is_active slots. The by-service endpoint already $lookups availability_slots into each tasker.
- Each pro card in the "other dates" list now shows "Available: Mon, Wed, Fri" (green calendar line) below the min-hours hint.
- On tap: jumps calDayIdx to the first allowed day, setStep('datetime'); the existing datetime "Review booking" → confirm path handles forcedProvider.
- Frontend-only. tsc noise (jsx/module-resolution) is config, not code. Needs Netlify redeploy for visual confirmation.

## 2026-06 (cont9) — Task Price display fix + Executor appointment scheduling (backend + provider UI)
- FIX (Price empty card): task-detail.tsx Price section only rendered when final_price existed OR no price at all — so an assigned task WITH an estimated price showed a blank card. Now, before completion it shows the agreed rate ("Your rate: $X/hr" for provider / "Hourly rate" for client) + note that the final total is billed by hours. Frontend-only.
- FEATURE — Appointment date/time confirmation & calendar blocking (backend + provider screen; client screen deferred, per user):
  - Backend POST /api/tasks/{task_id}/schedule (provider only): sets confirmed_date/confirmed_start_time/confirmed_end_time/duration_hours/schedule_confirmed, mirrors to booking, notifies client (type 'task_scheduled', 12h times). Same endpoint reschedules (returns rescheduled=true). Duration supports 0.5h steps. Strict validation: start_time regex HH:MM, duration>0, and rejects windows overflowing past 23:59.
  - Backend get_executors_by_service: BUSY EXCLUSION — pre-fetches confirmed tasks for the searched date and hides any executor whose confirmed window overlaps the requested time. Also FIXED day-of-week indexing: slots store Mon=0..Sun=6, filter now uses isoweekday()-1 (was isoweekday()%7 = Sun=0, a mismatch that could hide/return wrong weekdays).
  - Frontend provider (task-detail.tsx): Date&time row shows confirmed window + "Confirmed" badge + duration, or "Requested by client — not confirmed yet"; "Set appointment time"/"Reschedule" button opens a modal (day strip + start-time chips + 0.5h duration stepper + live end-time summary). api.scheduleTask added.
  - Frontend provider calendar (availability.tsx): fetches the pro's confirmed tasks and renders orange "Booked" blocks on the day grid (tap → task-detail) + orange dot on booked days in the day strip.
- TESTED: testing_agent iteration_22.json — 10/10 backend pytest PASS (0.5h math, reschedule, validation 400s, client/foreign 403, client notification, day-of-week Mon=0 filter, busy exclusion at overlapping vs non-overlapping time). Post-review hardening (strict time regex + overflow reject) re-verified via curl. Frontend compiles (esbuild) but Expo web is not served in preview → needs Netlify redeploy for visual confirmation.
- NEXT: client-side view of confirmed appointment + reschedule notification surfacing.

## 2026-06 (cont10) — Client-side confirmed appointment + in-chat scheduling button
- Extracted the scheduling UI into a shared component components/ScheduleModal.tsx (day strip + start-time chips + 0.5h duration stepper + live end-time). task-detail.tsx now uses it (removed the duplicated inline modal + local state/helpers).
- CLIENT view (task-detail.tsx, shared Date&time block, role-aware): client sees the confirmed window with a green "Confirmed by pro" badge + duration, or "Waiting for the pro to confirm the time" when not yet set. Client already receives the in-app/email/SMS/push 'task_scheduled' notification from the backend when the pro confirms/reschedules.
- CHAT (task-chat.tsx): loads the task; shows an appointment banner (both roles) — "Appointment: <date> · 9:00 AM–11:00 AM" or "No appointment time confirmed yet". For the assigned executor it shows a "Set time"/"Change time" button that opens the same ScheduleModal, so rescheduling can be agreed and set right inside the conversation. Reuses POST /api/tasks/{id}/schedule (backend already tested 10/10).
- All changed files compile (esbuild). Backend unchanged this round. Needs Netlify redeploy for visual confirmation.

## 2026-06 (cont11) — Admin Coverage Map (heat coverage + category filters + stats)
- User choices: free OpenStreetMap/Leaflet (no Google key), existing app categories (dynamic from DB), "active pro" = has configured work zone (coords+radius) AND not blocked.
- Backend GET /api/admin/coverage?category= (require_admin): returns active providers as {lat,lng,radius_miles,categories}, global per-category counts, and coverage_points built from the configured service-area zone centers + geocoded cities, each with count + level (green>=3 / yellow 1-2 / red 0). Category filter narrows the providers + point counts; category chip counts stay global. Reuses _get_service_area, _geocode_place, _haversine_miles, SKILL_TO_CATEGORIES.
- Frontend: new public/admin-coverage.html (interactive Leaflet iframe — blue circles for pro zones, colored city labels with counts + ⚠️ for 0; receives data via postMessage, announces 'coverage-ready'). New app/admin-coverage.tsx (category filter chips, iframe map, uncovered-markets alert, "by category" + "by city" stat cards). api.adminGetCoverage added. Linked from admin panel (services.tsx nav → 'Coverage'), registered in _layout.tsx.
- Did NOT touch existing public/coverage-map.html (single-provider read-only map used elsewhere).
- TESTED via curl: /admin/coverage returns 1 active pro (repairs, 30mi @ Niles) → Chicago yellow(1); ?category=cleaning → 0 shown, Chicago red(0). All frontend files compile (esbuild). Needs Netlify redeploy for visual confirmation (Expo web not served in preview).

## 2026-06 (cont12) — SMS verification screen: compliance copy update
- app/verify-phone.tsx: label "Phone Number", placeholder "+1 (___) ___-____", full carrier-compliance consent checkbox text ("I agree to receive SMS messages from Ono-Fix for account verification, appointment updates, job notifications, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. I have read and agree to the Privacy Policy and Terms of Service."), inline + separate tappable Privacy Policy | Terms of Service links (route /privacy, /terms), button relabeled "Send Verification Code". Frontend-only; compiles; needs Netlify redeploy.

## 2026-06 (cont13) — SMS opt-in proof stored + single-screen consent
- Backend POST /api/auth/send-phone-code now REQUIRES sms_consent=true (else 422) and stores an audit-grade proof-of-consent record in collection sms_consents: {user_id, phone, consent, consent_version, consent_text, ip_address (X-Forwarded-For aware), user_agent, source, created_at}. Also snapshots sms_opt_in/sms_opt_in_at/sms_opt_in_ip/sms_consent_version on the user. Constants SMS_CONSENT_VERSION='2026-06-v1' + SMS_CONSENT_TEXT as server fallback.
- Frontend verify-phone.tsx sends {sms_consent, consent_version, consent_text}; layout compacted (smaller icon/margins) so the full consent copy + rates + STOP/HELP + Privacy Policy | Terms links + "Send Verification Code" button all fit on one screen without scrolling.
- api.sendPhoneCode signature extended.
- TESTED (curl): no-consent → 422; with-consent → 200; verified sms_consents record + user snapshot persisted with IP 203.0.113.9. (SMS itself not delivered — Twilio keys not configured, unrelated.) Frontend compiles. Needs Netlify redeploy.

## 2026-06 (cont14) — Admin "SMS Opt-in Log" screen
- Backend GET /api/admin/sms-consents?q=&limit= (require_admin): returns sms_consents records (newest first) enriched with user_name/user_email, plus total count. `q` filters by phone or user name/email.
- Frontend app/admin-sms-consents.tsx: searchable list; each card shows phone, user, timestamp, IP, consent version + "Opted in" badge; tap to expand full consent text, user agent, source. api.adminGetSmsConsents added. Linked in admin panel (services.tsx → 'SMS Opt-ins'), registered in _layout.tsx.
- TESTED (curl): list returns the stored opt-in (phone/email/IP/version/time); ?q=<phone> filters correctly. Frontend compiles. Needs Netlify redeploy for visual confirmation.

## 2026-06 (cont15) — Fix Coverage Map "Unmatched Route"
- Root cause: public/admin-coverage.html was a new static file not present in the deployed Netlify dist, so the /* -> index.html SPA fallback served the Expo app (Expo Router -> "Unmatched Route") inside the iframe.
- Fix: serve the Leaflet coverage-map shell from the BACKEND at GET /api/admin/coverage-map (HTMLResponse, _COVERAGE_MAP_HTML). admin-coverage.tsx iframe now points to `${API_URL}/api/admin/coverage-map` (API_URL from EXPO_PUBLIC_API_URL, Railway fallback). Removes dependency on frontend static-file deploy; data still pushed via postMessage.
- Verified on preview backend: /api/admin/coverage-map -> 200 text/html; screenshot with injected sample data renders blue pro circles + green "Chicago: 2" + red "Aurora: 0 ⚠️" + legend.
- REQUIRES redeploy of BOTH backend (Railway, so the route exists on prod — currently 404) and frontend (Netlify, so iframe uses the new src).

## 2026-06 (cont16) — Fix custom category cover image not showing on home grid
- Root cause: GET /categories (list) intentionally strips the heavy base64 cover image (returns only has_image flag), but the home grid read cover from dbCat.image -> DB-category photos never rendered (custom cats like "CCTV install" fell back to a bland icon card).
- Fix: app/(tabs)/index.tsx now lazily fetches the full image via GET /categories/{id} for any DB category with has_image=true and merges it into dbCategories, so custom categories show their uploaded cover. List stays lightweight.
- Verified API: list returns has_image (no image); /categories/{id} returns full image. Admin category modal already supports image upload (services.tsx). Frontend compiles. Needs Netlify redeploy. User must ensure a cover image is uploaded for the CCTV category and add services under it (0 services until then).

## 2026-06 (cont17) — Custom categories for providers + keyword cover fallback
- Provider skill catalog (app/(tabs)/my-profile.tsx): now merges admin-created DB categories into the built-in SKILL_CATEGORIES via allSkillCategories memo (loads api.getCategories). DB-only categories expose a single synthetic skill = category name so providers can add them (set rate, agree, save). Updated Add-Skills modal, Skill Detail (findSkillCategory replaces unsafe SKILL_CATEGORIES.find(...)!), Service Detail, and skillsByCategory to use the merged list. Skills persist with category_id so search/matching works.
- Home grid cover image (app/(tabs)/index.tsx): added KEYWORD_COVERS + coverByKeyword so admin categories with no uploaded image and no id fallback still get a relevant photo by name keyword (cctv/surveillance/security camera/alarm/video doorbell -> Unsplash CCTV photo). coverImage = dbCat.image || FALLBACK_COVERS[id] || coverByKeyword(name).
- Both files compile (esbuild). Frontend-only. Needs Netlify redeploy. (Preview DB has no custom category; verified logic via code + prior API checks.)
