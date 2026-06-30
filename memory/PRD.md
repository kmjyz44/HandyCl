# HandyHub - Service Marketplace PRD

## Original Problem Statement
Create a "HandyHub" service marketplace (similar to TaskRabbit). The project includes web application with React frontend and FastAPI backend, plus future Android APK delivery.

## Target Users
- **Clients**: Book home services
- **Providers/Taskers**: Offer and complete services
- **Admins**: Manage platform, users, settings

## Core Requirements
- Three distinct user roles with full-featured dashboards
- Multi-language support (English, Spanish, Ukrainian)
- Payment integrations (Stripe, Zelle, Venmo)
- Commission system, user verification, promo codes
- Push notifications via Firebase
- Geofencing for service zones
- **Note**: Admin requires plaintext password visibility (implemented)

## Technical Stack
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Shadcn UI
- **Auth**: Custom JWT with plaintext password storage
- **i18n**: Custom LanguageContext with translations.js

## Completed Features

### March 13, 2025 - Bug Fixes (Session 3)
- ✅ **User's code files integrated** - NewDashboardPage.js, apiClient.js, server.py, translations.js from files_1.zip
- ✅ **Booking confirmation error fixed** - [object Object] error resolved (service.name vs service.title mismatch)
- ✅ **Photo upload functionality added** - Click-to-select photo upload with preview and delete buttons
### 2026-06-26: Email via Resend (default) + SendGrid, selectable in admin
- Backend: `_send_email_resend()` (httpx → https://api.resend.com/emails) + unified `_send_email()` dispatcher. Provider chosen by `integration_keys.email_provider` (default "resend"), with automatic fallback to the other provider. ALL email paths (register verification, resend-verification, notifications, support contact) now use `_send_email`.
- Integration keys: added `resend_api_key` (masked), `resend_from_email`, `email_provider`. Admin UI (admin-integrations.tsx) shows a "Resend (default)" section (provider selector + key + from) above "SendGrid (fallback)".
- Verified: testing_agent backend 7/7 — save/mask/retrieve, provider switch, default=resend, register sends via Resend ('Resend email sent' logged), register never fails on email errors.
- CAVEAT: Resend test sender `onboarding@resend.dev` only delivers to the Resend account owner email. To email ALL users, verify a domain in Resend and set `resend_from_email` to a verified-domain address.


### 2026-06-25: Fix — register error showed "Request failed with status code 400"
- RCA: register 400 was actually "Email already registered" (Nexus.ss.llc@gmail.com was registered in a prior attempt), but `register.tsx` displayed `error.message` (generic axios string) instead of `error.response.data.detail`.
- Fix: register.tsx catch now reads `error.response.data.detail` and shows a clear UA message ("Цей email вже зареєстрований. Спробуйте увійти або скористайтесь іншим email.").
- Verified: testing_agent backend 4/4 — fresh email→200; duplicate (same & uppercase)→400 "Email already registered"; accepted_terms=false→400 Terms message. Frontend display needs live verification after deploy.
- USER WORKAROUND (pre-deploy): the email is already registered (verification is optional, account works) → log in with it; OR delete that user in Admin→Users; OR use a different email.


### 2026-06-25: Fix — email verification "User not found" (case mismatch)
- RCA: register() stored email AS-TYPED (mixed case), but /auth/verify-email & /auth/resend-verification `.lower()`-ed it before an exact-match lookup → never matched → 404 "User not found" + verify failing.
- Fix: register() now stores email lowercased; added `_ci_email()` case-insensitive regex helper used by login, verify-email, resend-verification (also fixes legacy mixed-case rows). verify/resend update users by `user_id` from the verification record. resend returns `email_sent` flag.
- Verified: testing_agent backend 100% (8/8) — mixed-case register→resend(any case, not 404)→verify→login all pass; case-insensitive duplicate check; unknown email still 404.
- NOTE: actual email DELIVERY depends on SendGrid prod config — BOTH `sendgrid_api_key` AND `sendgrid_from_email` (a VERIFIED sender) must be set in admin Integration Keys, and `enable_email_notifications` on. Not testable on preview (SendGrid unconfigured there).


### 2026-06-25: Admin can change user ROLE (5 roles) + Support role
- Backend: added `SUPPORT` to `UserRole`; new `PUT /api/admin/users/{user_id}/role` (admin-only) accepts client/provider/admin/moderator/support. Admin CAN promote others to admin. Blocks self-role-change (400), invalid role (400), non-admin caller (403). Moderator auto-gets full `moderator_modules`; leaving moderator clears them. Added `require_admin_or_support` dependency; `/admin/support-requests` GET+PUT now allow admin OR support.
- Frontend: `utils/api.ts` `changeUserRole`; `app/(tabs)/users.tsx` role badge + "Роль" button → modal with 5 roles (admin hidden for self; self card shows "Це ваш акаунт"); moderator shows "Модулі" button.
- Menu access (`app/(tabs)/_layout.tsx`): dashboard/users/services → admin OR moderator; payment-settings/profile → admin; messages("Чати") → support; new `support-inbox` tab ("Підтримка", reuses admin-support-requests) → support OR admin.
- Verified: testing_agent backend 100% (14/14) — all role transitions, gating, support-request access. Frontend syntax clean (esbuild); needs live verification on Netlify after Save to GitHub (Expo not rendered in preview pod).


### 2026-06-25: Modern in-app notifications (toasts) + confirm dialog
- New `components/ToastHost.tsx` — animated, cross-platform toast system (`toast.success/error/info`), top-anchored, auto-dismiss, stacked, with icons/colors per type.
- New `components/ConfirmHost.tsx` — modern animated modal confirm dialog (`confirmDialog(): Promise<boolean>`), destructive variant (red trash icon) for delete/block.
- Rewired `utils/alert.ts`: `showAlert` → toast (auto success/error/info detection incl. Ukrainian keywords); `showConfirm`/`showAlertWithButtons` → modal confirm. This upgrades ALL ~70 existing call sites across 12 screens automatically (no per-screen changes needed).
- Mounted `<ToastHost/>` + `<ConfirmHost/>` once in `app/_layout.tsx`.
- Converted remaining direct `Alert.alert([...])` calls in `app/(tabs)/users.tsx` (set/remove moderator, block/unblock, errors) to the new helpers; removed unused `Alert` import.
- Syntax-validated via esbuild (no errors). Visual verification pending on live Netlify after "Save to GitHub" (Expo app not served in preview pod).


- ✅ **Error handling improved** - Better error message display in booking confirmation

### March 13, 2025 - Bug Fixes (Session 2)
- ✅ **MultiStepBookingModal** - Complete i18n rewrite, now translates based on selected language
- ✅ **Client Profile Menu** - Add Payment and Add Address buttons now open functional forms
- ✅ All booking modal content translates: step labels, task types, urgency, buttons

### March 13, 2025 - Bug Fixes (Session 1)
- ✅ Fixed client dashboard language selector - now visible in header
- ✅ Fixed client dashboard full i18n - all text translates with language switch
- ✅ Fixed client profile menu - click functionality works (expand/collapse)
- ✅ Fixed admin users panel - passwords shown as plaintext without toggle

### Previous Implementations
- ✅ Multi-language system (EN/ES/UK) with admin controls
- ✅ Payment settings panel (Stripe/Zelle/Venmo toggles)
- ✅ Push notification settings (Firebase keys)
- ✅ Chat & Notifications panels for all roles
- ✅ Provider invoice generation
- ✅ Admin geofencing/service zones
- ✅ Client multi-step booking form (5 steps)
- ✅ Provider profile management
- ✅ Admin dashboard with users, bookings, services management

## Test Credentials
- **Admin**: admin@handyhub.com / admin123
- **Provider**: provider.test@handyhub.com / test123
- **Client**: test@example.com / test123

## Key Files
- `/app/frontend/src/pages/NewDashboardPage.js` - Main dashboard component
- `/app/frontend/src/components/MultiStepBookingModal.js` - Booking form with i18n
- `/app/frontend/src/i18n/translations.js` - All translations
- `/app/frontend/src/i18n/LanguageContext.js` - Language provider
- `/app/backend/server.py` - All API endpoints
- `/app/backend/models.py` - Data models

## Pending Tasks (P1)
- Implement client payment page (PaymentGateway.js) with real Stripe/Zelle/Venmo integration
- Full internationalization audit across all components
- Add Provider dashboard language selector

## Future Tasks (P2-P3)
- Fix Android APK build process (currently broken)
- Complete mobile app UI implementation
- Persist payment methods and addresses to database

## Known Issues
- Mobile Expo build fails (not actively developed)
- Payment/Address forms store data locally only (not persisted to backend)

## Testing Status
- Last test: iteration_9.json - 70/70 tests passed (100%)
- Frontend: Playwright e2e specs
- Backend: pytest tests

## 2026-06-27 — UI: компактні фільтри в дашборді виконавця
- Виправлено баг RNW: чіпи-фільтри (Усі/Призначено/В роботі/Очікує оплати/Оплачено) у вкладці «Мої завдання» розтягувалися у велетенські овали (borderRadius:999 + stretch), займаючи ~250px і ховаючи список завдань.
- Рішення: обгортка View з maxHeight:44, contentContainerStyle alignItems:center, фіксована висота чіпа 34px (borderRadius:17), alignSelf:center.
- Файл: app/(tabs)/index.tsx (ProviderDashboard).
- Перевірка: візуально після редеплою на Netlify (preview-под обслуговує CRA-заглушку, не Expo).


## 2026-06-28 — Finix (Етап 1: адмін-конфіг) + дизайн-фікси
- Finix додано як платіжний метод, керований адміном: модель IntegrationKeysUpdate (enable_finix + finix_api_username/password/application_id/platform_merchant_id/environment), пароль маскується, секція в admin-integrations.tsx, метод у /payments/methods (показ лише коли enabled+configured). Перевірено curl. Toggle OFF за замовч. до готовності Етапу 2.
- Дизайн: виправлено баг велетенських овалів-фільтрів (RNW stretch) на двох екранах — дашборд виконавця (index.tsx) та 'Перевірка оплат' (admin-payments.tsx). Потребує редеплою на Netlify.
- Бекенд: додано commission-wallet-intent / commission-wallet-confirm (PaymentIntent для комісії, без Connect) — для inline Apple/Google Pay; гейтинг методів виконавця адміном у payout-setup.tsx.

### Finix Етап 2 (наступне, потребує дій користувача):
- Бізнес-апрув Finix + sandbox-ключі (API username/password, App ID APxxx, Platform Merchant ID MUxxx).
- Онбординг кожного виконавця як sub-merchant (Identity+Merchant, KYC).
- Frontend: Finix.js токенізація + Apple/Google Pay; backend: split Transfer + вебхуки transfer.settled / merchant.provisioned.
- Apple Pay на вебі: верифікація домену Netlify (.well-known файл з Finix Dashboard).


## 2026-06-28 — Finix Етап 2: ПОВНА інтеграція (бекенд протестовано в sandbox)
БЕКЕНД (перевірено curl у Finix sandbox — реальні виклики):
- _finix_cfg/_finix_base_url/_finix_headers — конфіг з integration_keys (env sandbox/live).
- POST /payments/finix/onboard-executor — створює SELLER Identity + BANK_ACCOUNT + Merchant (+ авто-verification у sandbox). Зберігає finix_identity_id/merchant_id/onboarding_state на user. ПЕРЕВІРЕНО.
- GET /payments/finix/executor-status.
- POST /payments/finix/charge — приймає Finix.js токен (TK) -> створює buyer Identity+PI -> Transfer зі split_transfers (executor_take виконавцю, platform_take платформі). Валюта USD. Використовує ГОТОВІ суми з booking (комісія НЕ перераховується). ПЕРЕВІРЕНО end-to-end: transfer SUCCEEDED, booking->paid, txn записано.
- POST /webhook/finix — оновлення статусів transfer/merchant.
- /payments/methods повертає finix (+application_id/environment для Finix.js) лише коли enabled+configured.
ФРОНТЕНД (НЕ перевірено в поді — Expo білдиться лише на Netlify):
- payout-setup.tsx: кнопка 'Підключити виплати Finix' + статус; поля PayPal/Zelle/Venmo тепер показуються лише для увімкнених адміном методів (1a).
- task-detail.tsx: метод 'finix' відкриває модал з Finix.js v2 PaymentForm (cdn.finix.com/v/2), токенізація -> /payments/finix/charge -> review.
- api.ts: finixOnboardExecutor/finixExecutorStatus/finixCharge.
СТАН: enable_finix=OFF (увімкнути після редеплою+перевірки). Ключі/IDs збережено в integration_keys.
ВІДКРИТЕ: у sandbox merchant онбордиться як PROVISIONING і стає APPROVED асинхронно (у проді — через вебхук). Apple/Google Pay на вебі — після підв'язки домену (зараз домену нема).


## 2026-06-28 — Картка в профілі + статистика платежів + сповіщення + фікс маскування
БЕКЕНД (перевірено curl):
- POST /users/payment-methods: тепер приймає card_number/expiry/card_holder, ВАЛІДАЦІЯ Luhn + термін дії + ім'я, визначає бренд, зберігає ЛИШЕ brand/last4/expiry/holder (без повного PAN). Невірний номер/прострочена → 422 зі зрозумілим повідомленням. (раніше модель вимагала last4 → 422, картка не зберігалась — ВИПРАВЛЕНО).
- GET /admin/payment-stats?year=&month=&sort=: список платежів (клієнт→виконавець, завдання, дата, сума, комісія, метод), загальні суми, розбивка по місяцях, available_years. Сорт date/amount asc/desc.
- PUT /admin/integration-keys: ЗАХИСТ — пропускає значення з '•' (масковані), щоб повторне збереження форми не псувало секрети (Finix/Stripe/Twilio ключі).
- finix/charge: при успіху шле сповіщення (notify_user) клієнту + виконавцю + усім адмінам ('payment_received').
ФРОНТЕНД (перевірка на Netlify):
- app/admin-payment-stats.tsx — новий екран статистики (фільтри рік/місяць, сорт, summary, розбивка, список). Кнопка в services.tsx (admin panel).
- my-profile.tsx: показ помилки картки (detail), відображення brand+last4.
- api.ts: getPaymentStats.
FINIX 'не налаштовано' на Railway: треба ввести API Username+Password у ЖИВІЙ адмінці (IDs недостатньо; configured вимагає 4 ключі). Після редеплою mask-protection не псуватиме ключі.

## 2026-06-28 — Finix: повна KYC-форма онбордингу + НАСКРІЗНИЙ ТЕСТ (sandbox)
НАСКРІЗНИЙ ТЕСТ ПРОЙДЕНО (curl, sandbox, реальні виклики):
- Онбординг виконавця з повним KYC (ім'я, dob, SSN, адреса, банк) -> merchant -> APPROVED (~21с, у проді через вебхук).
- Тестовий клієнт оплатив $100 тестовою карткою -> Finix transfer SUCCEEDED.
- РОЗПОДІЛ підтверджено на боці Finix: 9000¢ виконавцю + 1000¢ платформі (90/10).
- booking -> paid (finix); створено 4 сповіщення payment_received (клієнт+виконавець+адміни).
ФРОНТЕНД (перевірка на Netlify):
- payout-setup.tsx: кнопка 'Підключити виплати Finix' тепер відкриває KYC-форму (ім'я, DOB MM/DD/YYYY, SSN 9 цифр, адреса, банк account+routing) з валідацією; submit -> api.finixOnboardExecutor(payload). Якщо вже онбордений -> 'Перевірити статус'.
- Бекенд onboard-executor вже приймав payload-поля (без змін цього разу).
ПРИМІТКА: merchant у sandbox стає APPROVED асинхронно (~20-60с). У проді статус оновлює вебхук merchant.provisioned/underwriting -> /webhook/finix.

## 2026-06-28 — Фікси (картка, Stripe-гейтинг) + фундамент US-локалізації
ФІКСИ (бекенд перевірено curl):
- Картка в профілі: + миттєва клієнтська валідація Luhn/термін (my-profile.tsx handleAddPayment) — раніше не зберігалась/без помилки. Бекенд-валідація вже була.
- Stripe-гейтинг: list_payment_methods читав enable_stripe_method, а адмін-UI писав enable_stripe_payments -> вимкнення не діяло. Виправлено: тепер чита enable_stripe_payments. Перевірено: enable=true показує stripe, false ховає (і блок 'Підключити Stripe' у виконавця теж).
US-ЛОКАЛІЗАЦІЯ (фундамент, перевірка на Netlify):
- utils/i18n.tsx: LanguageProvider + useT() + словники EN/UA, persist localStorage, default EN. Перемикач у settings.tsx (lang-en/lang-uk).
- utils/format.ts: formatMoney($), formatDate(MM/DD/YYYY), formatTime(12h), formatDateTime, formatDistance(mi/ft), kmToMiles.
- _layout.tsx обгорнуто LanguageProvider.
- ПЛАН: повний переклад 40 файлів + застосування $/дати/одиниць — ПОЕТАПНО, екран за екраном (велика робота, не тестується в поді). Адреси: прості текстові поля US (State+ZIP) — згодом.

## 2026-06-28 — Photon-адреси + старт перекладу (home)
- Photon (komoot) автозаповнення адрес US: components/AddressAutocomplete.tsx (debounce, фільтр US, dropdown). Інтегровано в create-task.tsx (поле Address). Без API-ключа. Перевірено, що Photon віддає US-адреси.
- Переклад home (app/(tabs)/index.tsx): SKILL_CATEGORIES (назви+скіли, id збережено!), STATUS_LABELS, days/months масиви, дашборд виконавця (greeting, stats New/Mine/Done, таби Available/My tasks, чіпи, empty states, $/hr). EN.
- ЗАЛИШОК index.tsx (~69 рядків): клієнтський booking-flow, укр. міста (Київ/Харків...) -> треба US-міста або через Photon. + 39 інших файлів.
- ПОРЯДОК далі: tasks.tsx (список) -> task-detail -> payment -> profile. Категорії дублюються в 6 файлах — варто винести в спільний catalog (TODO).

## 2026-06-28 — Переклад: tasks.tsx (список завдань) DONE
- app/(tabs)/tasks.tsx повністю EN: CATEGORIES, STATUS_LABELS, таби (Available/Mine/Confirm/Done), картки завдань, ціни ($, /hr, hours), 2-крокове підтвердження (Executor/Admin), empty states, doneSummary (Hours/Amount/Tips/Total $). 0 UA рядків.
- Наступне за порядком: task-detail.tsx -> payment flow -> profile. Потім решта файлів + укр.міста в index.tsx.

## 2026-06-28 — US Adaptation: FULL UI + backend translation to English (COMPLETE)
- Re-audited with Unicode-aware grep (prior agent's [А-Яа-я] grep gave false "0" due to C-locale byte ranges). ~40 frontend files + server.py still had Ukrainian — now ALL translated to US English.
- FRONTEND (40 .tsx/.ts files): task-detail, payment-success/cancelled, payout-setup, my-profile (incl. full skill catalog: names/tools/descriptions), index (booking flow + hero + steps), dashboard, booking-detail, bookings, earnings, create-task, profile, executors, executor/[id], availability, notifications, community, messages, support-inbox, admin-integrations, admin-payments, admin-support-requests, admin-payment-stats, users, help-center, blog-create, blog/[id], _layout, verify-phone, task-chat, verify-email, support-chat, login, register, services, PaymentReminderBanner, EmailVerificationBanner, ConfirmHost, api.ts. All validated with @babel/parser (jsx+typescript) — ALL_OK 40/40.
- FORMATTING: currency грн/₴ → $; rates → $X/hr; hours → hr; dates uk-UA → en-US (MM/DD), 12h clock; distances км → mi; DAYS arrays → Mon..Sun / Monday..Sunday; month arrays → English.
- index.tsx US DEFAULTS: userCountry default 'US' (was 'UA'), quickCities default = US cities (New York, LA, Chicago, Houston, Phoenix, Philadelphia); IP fallback 'US'; UA city map transliterated to Latin (Kyiv/Kharkiv/...).
- BACKEND server.py: notifications (push/in-app), HTTPException details, PDF earnings/tax report (headers, $, MM/DD), help/faq seed, seed category names+descriptions, seed account names, Twilio/Stripe/Finix error messages, card validation messages — all EN. Verified via curl: /api/payments/methods labels EN, /api/help/faq EN. server.py synced to backend/server.py.
- LEFT INTENTIONALLY UA: utils/i18n.tsx (UA dictionary for language toggle), utils/alert.ts (UA keyword detection for toast type), SKILL_TO_CATEGORY UA-key lookup in server.py (harmless; English ids also map).
- NOTE: Preview pod serves a CRA wrapper, not Expo — visual verification must happen on Netlify after "Save to GitHub".

## 2026-06-28 (cont.) — Legal pages wiring + category DB localization fix
- Terms of Use & Privacy Policy: pages already existed (app/terms.tsx, app/privacy.tsx, US-adapted, testids terms-screen/privacy-screen). Wired menu links: profile.tsx (Terms+Privacy rows), my-profile.tsx (Terms + NEW Privacy row), register.tsx already linked. Registered routes in app/_layout.tsx.
- Community Blog (P1) CONFIRMED COMPLETE: backend /api/blog/posts CRUD (list/create/get/like/comment/delete) + frontend community.tsx/blog-create.tsx/blog/[id].tsx.
- Help Center (P1) CONFIRMED COMPLETE: /api/help/faq, /help/support-info, /help/support-request, /help/admin-contact + help-center.tsx, support-chat.tsx, admin-support-requests.tsx.
- BACKEND TEST iteration_14: 15/15 after fix. Test file: /app/backend/tests/test_localization_backend.py (Cyrillic-detector regression test against preview URL).
- FIX (HIGH): _seed_default_categories() was idempotent on category_id and never updated existing rows → 9 legacy Ukrainian default categories persisted in MongoDB. Changed seed to HEAL is_default rows (upsert name/description/icon/color/emoji when changed). Verified: GET /api/admin/categories returns all English, HAS_CYRILLIC=False. This will also self-heal the production DB on next deploy/restart.

## REMAINING BACKLOG
- P2: HTML email templates (Resend/SendGrid) — emails currently plain text.
- P2: Apple Pay / Google Pay validation via Finix.js — BLOCKED in preview (needs live Netlify domain verification).
- Code-quality: server.py is ~11.9k lines; consider extracting i18n strings/routes into modules.

## 2026-06-28 (cont.) — Bugfix: booking address autocomplete (index.tsx)
- BUG: in the home booking flow, tapping an address suggestion did not fill the "Street and number" field, and suggestions were in Ukrainian ("Іллінойс", "Сполучені Штати").
- ROOT CAUSE: index.tsx used a custom Nominatim search with accept-language=uk and fragile comma-split parsing; the inline suggestion list mis-extracted street (only housenumber) and the flow was inconsistent.
- FIX: replaced the custom street input + suggestion list with the proven <AddressAutocomplete/> component (Photon, lang=en, US-filtered, keyboardShouldPersistTaps, builds line1=housenumber+street). onSelect now sets booking.address/city/lat/lng. Also switched the remaining geolocation Nominatim calls (city geocode + "Detect my location" reverse geocode) to accept-language=en.
- Verified: babel syntax OK; Photon returns English + proper street for the reported query. Visual confirmation pending on Netlify.

## 2026-06-28 (cont.) — NEW FEATURE: AI "Identify service by photo" (home page)
- Client snaps/uploads a photo on the home page → AI detects the likely service, estimated hours, estimated price, and shows available pros; one-tap "Book this service" prefills the booking flow.
- INTEGRATION: OpenAI GPT-4o vision via emergentintegrations + EMERGENT_LLM_KEY (added to backend/.env). Used send_message (one-shot structured JSON). Testing playbook saved at /app/image_testing.md.
- BACKEND: POST /api/ai/analyze-task-photo (PUBLIC — works for guests). Input {image_base64, city?}. Constrains GPT-4o to DB category ids; returns {detection:{category_id,category_name,skill,confidence,summary}, estimate:{hours_min/max,hours_label,price_min/max,currency:USD,hourly_rate}}. Price = category.recommended_price * hours * (1 + commission_rate%). Robust JSON parse + fallbacks (invalid id -> 'other', clamps hours 0.5–12).
- FRONTEND (index.tsx): camera icon inside search bar + "Identify by photo" AI button below it (both open camera/gallery picker, base64). New 'photo_result' step shows photo, detected skill+category, confidence %, est. time, est. price ($), available pros (top 3, if city known), and Book/Choose-manually CTAs. Prefills booking (category, skill, description, photo) and routes into existing address→datetime→taskers→confirm flow. api.analyzeTaskPhoto added.
- VERIFIED (backend, localhost): faucet photo -> "Faucet repair" conf 0.9 ~1–2hr $46–92 (2.8s); empty image -> 400; ambiguous/finished-room photo -> low-confidence 'other' (graceful). Frontend babel-validated; visual check pending on Netlify.
- DEPLOY NOTE: production backend env must include EMERGENT_LLM_KEY (added to backend/.env). Frontend needs "Save to GitHub" -> Netlify rebuild.

## 2026-06-29 — Bugfixes (login UX + card saving + Alert.alert) & Finix config diagnosis
- FIX (P0) Silent card-save failure on Web: my-profile.tsx used native Alert.alert (renders nothing on RN Web) for Luhn/expiry validation + success/error. Removed Alert from RN import; added a module-level Alert shim that routes Alert.alert(...) -> showAlertWithButtons (in-app toast/modal). Fixes ALL ~40 call sites in the file at once, incl. add-card flow. esbuild-compiled OK.
- FIX (P0) Login error UX + Forgot password: login.tsx now maps 401 -> friendly "Invalid email or password. If you forgot it, tap Forgot password? below." (previously raw "Request failed with status code 401" leaked). Added "Forgot password?" link. Created /app/app/forgot-password.tsx (2-step: request code -> enter code + new password). api.passwordRecoveryRequest/Verify added.
- BACKEND: /auth/password-recovery/request now actually emails the 6-digit code via _send_email (Resend) and NO LONGER leaks dev_code in the response. Verified via curl (returns generic message). server.py synced to backend/server.py.
- FINIX DIAGNOSIS: live site shows "Card/Apple/Google Pay (Finix) (not configured)" because the Finix sandbox keys live ONLY in the pod DB, never entered in the production Railway/Atlas DB. Verified pod keys are VALID: GET /identities -> 200, platform merchant MUuSC7mqYPnqZBveXKgSAn9s onboarding_state=APPROVED, processing_enabled=True. Admin CAN already edit all Finix fields (admin-integrations.tsx + GET/PUT /admin/integration-keys; password masked, replace via "Clear field"). RESOLUTION = admin must enter the keys on the LIVE site (cannot write to prod DB from pod).
- FINIX SANDBOX KEYS (entered in pod; user must paste on live admin):
  enable_finix=true, finix_environment=sandbox
  finix_api_username=USqQTpm6Y1smxUqmu1sGodjD
  finix_api_password=9076d085-6e05-4b8b-bb7e-f976cb8fdbe9
  finix_application_id=AP3gELgwSZfCFF1T8D4486zY
  finix_platform_merchant_id=MUuSC7mqYPnqZBveXKgSAn9s
  finix_platform_identity_id=IDsNDraM4RXV235pZYjxHLHx
- NOTE: frontend changes (1-3) verified only via esbuild compile; real UI verification requires Netlify deploy (pod runs the CRA placeholder, not the Expo app). User must "Save to GitHub".

## 2026-06-29 (cont.) — Finix executor onboarding fixes (live testing)
- CONTEXT: user enabled Finix on the LIVE admin (form now appears for providers). Hit two onboarding errors while testing with fake data.
- FIX 1 (payout-setup.tsx): Finix KYC error was shown via toast that rendered BEHIND the modal ("background error"). Now errors show INLINE inside the modal (fx.errBox). Added client check: account_number != routing_number (Finix rejects equal values: "account_number must not be equal to bank_code"), routing must be 9 digits, SSN exactly 9. Routing placeholder -> "122105155 (test)". esbuild OK.
- FIX 2 (server.py finix_onboard_executor): Finix rejected the IDENTITY because it used the provider's stored phone verbatim ("+380..." Ukrainian) -> "Business Phone should be valid phone number (e.g. 4156665555)". Added phone normalization: strip non-digits, drop leading US '1', use 10-digit number; fallback "4155551234" if not a valid US 10-digit. Applied to both phone + business_phone. The KYC form intentionally has NO phone field (uses profile phone).
- VERIFIED (pod backend, real Finix sandbox): set provider phone to "+380501234567", called POST /payments/finix/onboard-executor with acct 123123122 / routing 321321321 -> identity ID2mFsBQtrctSD1ATWg9XbNh, merchant MU4dRBJ6Gt3vqqsyKaSp6okc, state APPROVED + processing_enabled. server.py synced to backend/server.py.
- ⚠️ DEPLOY REQUIRED: FIX 2 is BACKEND (Railway) and FIX 1 is FRONTEND (Netlify). User MUST "Save to GitHub" to redeploy both; until then the LIVE site keeps showing the phone error.

## 2026-06-29 (cont.) — Finix client card form blank (task-detail.tsx)
- BUG: "Pay by card / wallet" (Finix) modal opened but the card fields area was BLANK and the Pay button hung with a spinner forever. ROOT CAUSE: race — init() ran before the <div id="finix-card-form"> existed / before finix.js loaded, so PaymentForm never mounted (finixFormRef stayed null); clicking Pay called .submit() on null (optional chaining) → no-op → spinner stuck.
- FIX: robust mount — ensure finix.js script loaded, then POLL (every 100ms up to ~5s) until both window.Finix and the #finix-card-form div exist before `new Finix.PaymentForm(el, env, appId, {paymentMethods:['card'], showAddress:false, onSubmit})`. submitFinix now guards: if form not mounted, show "still loading, tap Pay again" instead of hanging. Confirmed Finix.js v2 constructor signature (element, environment, applicationId, options) via official migration docs.
- NOTE: client MUST enter the card in the Finix form (sandbox test card 4111 1111 1111 1111, 12/30, CVV 123). Card is tokenized by Finix (TK token) → backend exchanges → /transfers split. esbuild OK. FRONTEND fix → needs Save to GitHub → Netlify.

## 2026-06-29 (cont.) — FINIX PAYMENT FIXED + TESTED END-TO-END
- ROOT CAUSE of blank card form (task-detail.tsx): (1) WRONG CDN — used https://cdn.finix.com/v/2/finix.js which returns EMPTY (window.Finix undefined); correct is https://js.finix.com/v/2/finix.js. (2) `new Finix.PaymentForm(...)` throws "is not a constructor" — Finix.js v2 PaymentForm is a FACTORY, must be called WITHOUT `new`. Verified both in a real browser via a standalone test page: with js.finix.com + factory call, the form renders ALL fields (Name, Card, MM/YY, CVC, Country, ZIP).
- FIX: task-detail.tsx now loads js.finix.com and calls Finix.PaymentForm(el, env, appId, {paymentMethods:['card'], showAddress:false, onSubmit}) without new; robust polling mount (waits for SDK + div) + button no longer hangs (guards null form ref).
- FIX (server.py): merchant onboarding_state stale at PROVISIONING (sandbox approves async). Added _finix_refresh_merchant_state() — finix_executor_status and finix_charge now refresh the live merchant state from Finix when not APPROVED, self-healing the block.
- TESTED END-TO-END (pod backend + real Finix sandbox): onboarded provider merchant MU4dRBJ6Gt3vqqsyKaSp6okc; created PAYMENT_CARD instrument (4111...); POST /payments/finix/charge {booking_test_finix_001} -> {ok:true, transfer TRqDGc5RrMgU7Bc6DXSUvSLG, state SUCCEEDED, amount $100, split executor $80 / platform $20}. Booking -> payment_status=paid, gateway=finix; payment_transactions recorded with executor_amount 8000 / platform_amount 2000. ✅
- SAVED CARD (my-profile "Add card"): backend verified working via curl (POST then GET returns the new card). The form intentionally has no CVV (it's a reference card, not used for Finix payment — Finix collects card at pay time in its own secure form). Display should work post-deploy; render code maps paymentMethods correctly.
- ⚠️ ALL fixes need "Save to GitHub": frontend (task-detail finix, payout-setup, my-profile, login, forgot-password) -> Netlify; backend (phone normalize, recovery email, merchant-state refresh, finix CDN n/a) -> Railway.

## 2026-06-29 (cont.) — Finix Pay button hangs / card not submitting (REAL submit bug)
- After CDN+factory fix, the Finix card FORM renders fully (Name/Card/Exp/CVC/Country/ZIP) on live, but tapping the green Pay button spun forever — tokenization callback never fired.
- ROOT CAUSE (confirmed via OFFICIAL Finix docs https://docs.finix.com/.../tokenization-forms): we passed `onSubmit` in PaymentForm options AND ALSO called `form.submit()` from our own button with NO callback. Per docs there are TWO mutually-exclusive approaches: Option 1 = pass onSubmit (Finix auto-creates its own submit button); Option 2 = custom button, do NOT pass onSubmit, call `form.submit(callback)` where callback=(err,res)=>{ token=res.data.id }. We mixed both → manual submit() with no cb never invoked the handler → hang.
- FIX (task-detail.tsx): removed onSubmit from options; moved tokenization handler to component scope `handleFinixToken`; Pay button now calls `finixFormRef.current.submit(handleFinixToken)`. Matches the official "Custom Submit Button Example" exactly.
- NOTE: Could not auto-test tokenization (Finix secure iframes block programmatic input for PCI). Verified: form renders + mounts (childCount=1) in real browser; backend charge+split proven SUCCEEDED earlier. Final card-entry test must be done on the deployed Netlify site. If it still hangs, fallback = Option 1 (onSubmit auto-button, remove custom button).
- ⚠️ Needs Save to GitHub (frontend → Netlify).

## 2026-06-30 — Payment UX when pro hasn't connected Finix payouts
- After the submit fix, charge correctly reached backend and returned "The pro has not connected Finix payouts yet" (correct business rule — that booking's provider has no finix_merchant_id on the LIVE/Railway DB).
- ENHANCEMENT (server.py finix_charge): on this failure (no merchant OR not APPROVED), now (1) returns a friendly client-facing message + HTTP 409, and (2) fires asyncio notify_user(provider, "payout_setup_required", ...) → in-app + email + SMS prompting the pro to complete Earnings → Connect Finix payouts.
- VERIFIED via curl: reset provider finix fields → charge → HTTP 409 friendly detail; notification doc created for provider (notification_type=payout_setup_required). Frontend already surfaces error.response.data.detail, so client sees the friendly text. Backend change → needs Save to GitHub (Railway).

## 2026-06-30 (cont.) — Live "Finix payment error" (generic) debugging
- Progress: provider onboarded on live (user sees executor in Finix cabinet), tokenization + submit now work; charge reaches backend but transfer step fails returning a GENERIC "Finix payment error" (frontend fallback) → means backend returned NO detail (likely a 500/502 or proxy timeout).
- Pod regression: re-onboarded provider (merchant auto-APPROVED after a few seconds via state refresh) + charged with PAYMENT_CARD PI → SUCCEEDED $100 split $80/$20. So refactored charge code is correct; live failure is environment-specific.
- Could NOT reproduce live error (no Railway log access; Finix secure iframes block programmatic card entry so can't mint a TK token in automation).
- FIX (server.py finix_charge): wrapped TK-exchange + /transfers in try/except — re-raises HTTPException, converts any other exception to HTTP 502 with detail=f"Finix payment failed: {str(ex)}" + logs full traceback. Transfer HTTP errors already return detail "Finix: <err>" + log body. After deploy, the red error on live will show the REAL Finix cause.
- NEXT: user Save to GitHub → retry payment once → send the new (detailed) red error text to pinpoint root cause.

## 2026-06-30 (cont.) — ROOT CAUSE of "split amount not defined" FOUND + FIXED
- Live error surfaced (thanks to better error reporting): "The split amount is not defined for this order".
- ROOT CAUSE: for hourly / at-completion bookings, the split is computed at task completion (complete_task: provider_payout=executor share, platform_fee=commission, final_price=client total, commission added ON TOP, default 15%) and stored on the TASK doc — but the booking only gets status+actual_hours, NOT platform_take/executor_take. finix_charge read only the booking → 0 → raised.
- FIX (server.py finix_charge): when booking lacks platform_take/executor_take, fall back to the linked task's provider_payout (executor_take) + platform_fee (platform_take). Authoritative server-computed values.
- TESTED end-to-end (pod + real Finix sandbox) with the user's exact scenario (15.34h×$25 + materials, +15%): charge SUCCEEDED, amount $568.04, split executor $493.95 / platform $74.09 — matches the app's "Total due" exactly. transfer TR3PR8q7gsRLmMgmXx6enyo5.
- ⚠️ Backend fix → needs Save to GitHub → Railway. This is the fix for the user's live payment failure.

## 2026-06-30 — Photo-first redesign + multi-photo/multi-option AI + PWA
- Hero copy: "Snap it. We'll match you with the right pro." + AI-focused subtitle.
- NEW big AI block as the primary CTA on home (above search): 3-step row (Take a photo → AI finds it → Get matched) with vector icons, a multi-photo tray (add up to 5, remove), "Take a photo"/"Gallery" buttons, and "Identify N photos with AI".
- Multi-photo + multi-option: backend /ai/analyze-task-photo now accepts images[] (+ legacy image_base64), sends all photos to GPT-4o, returns ranked `candidates[]` (1-3) each with detection+estimate (top-level kept for back-compat). photo_result screen shows a photo strip + selectable candidate cards (radio); choosing one sets the booking category/skill/description; estimate tiles + pros reflect the selected option.
- TESTED backend: posted a real plumbing photo → 2 candidates returned (Plumbing inspection 90% ~1-3hr $46-138; Pipe repair 80% ~2-4hr $92-184). ✅
- PWA: added public/manifest.json (standalone, theme #2563eb, icons, shortcut "Scan a problem" → /?scan=1), public/pwa-icon.png, app/+html.tsx (injects manifest + apple meta + registers /sw.js), added fetch handler to public/sw.js for installability. Home reads ?scan=1 → auto-opens camera. Android: full install + camera shortcut; iOS Safari: Add to Home Screen works, camera opens on tap (Apple limitation).
- Files: app/(tabs)/index.tsx, server.py (analyze endpoint), utils/api.ts, public/manifest.json, public/sw.js, app/+html.tsx. esbuild-clean.
- ⚠️ Frontend/PWA verified via compile + backend test only (pod preview runs CRA placeholder, not the Expo app). Visual + install must be checked on Netlify after Save to GitHub.

## 2026-06-30 (cont.) — PWA install button + camera-first launch + compact home
- Compacted home: AI block padding/icons/buttons reduced (~30% shorter), hero paddings+fonts smaller, category cards aspectRatio 1→1.35 (shorter) so the lower grid is visible.
- PWA install UX: added visible "Install app" pill in the AI block (web only, shown when installable / iOS). Android/Chrome → native beforeinstallprompt; iOS → Alert with "Share → Add to Home Screen" instructions. Hidden when already running standalone.
- Installed icon launches camera-first: manifest start_url = "/?scan=1" (+ existing "Scan a problem" shortcut). Home reads ?scan=1 → attempts to open camera (reliable one-tap via the big "Take a photo" button; browsers may block auto-open without a gesture).
- Files: app/(tabs)/index.tsx (install state/handlers + button + style trims), public/manifest.json (start_url). esbuild-clean. Needs Save to GitHub → Netlify (PWA install requires the live https site + SW + manifest).
