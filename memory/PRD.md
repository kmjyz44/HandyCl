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

## 2026-06-30 — Rebrand to Ono-Fix + compact home + new headline
- BRAND: HandyHub → Ono-Fix across UI, server.py/backend, app.json, manifest, +html, emails (test login emails @handyhub.com left unchanged on purpose). Domain hendyhub.netlify.app → ono-fix.com (incl. Finix identity url). Domain: ono-fix.com.
- Hero headline → "One Photo. One Solution." + shorter subtitle.
- Compacted: hero header paddings/fonts reduced (title 18, brand 16, subtitle 12, paddingTop 36/bottom 14); search bar narrower (paddingVertical 7, fontSize 14, radius 12); AI block already compact; category cards aspectRatio 1.35.
- esbuild + JSON + python syntax all clean. Needs Save to GitHub → Netlify/Railway.

## 2026-06-30 (cont.) — Minimal blue header + always-visible Install link
- Blue hero (guest) reduced to a thin nav bar: logo + Log in/Sign up only (paddingTop 26/bottom 8); headline moved OUT of blue.
- Headline "One Photo. One Solution." + sub-line now live in the white AI block title.
- "Install app" link now ALWAYS shown on web (Platform.web && !isStandalone), no longer gated on beforeinstallprompt. installApp(): uses native prompt if available, else platform-specific instructions (iOS Share→Add to Home Screen / Android ⋮→Install / desktop address-bar). isStandalone state hides it once installed.
- esbuild clean. Needs Save to GitHub → Netlify.

## 2026-07-01 — SEO finalize + blue-hero headline + Install button fix + Railway redirects
- HEADLINE: moved "One Photo. One Solution." + sub-line back onto the blue guest hero (heroTitle 18→15, subtitle 12→11, tighter paddings). AI block title changed to "Identify it with AI" (kept sub + Install pill).
- INSTALL BUTTON FIX (P1): root cause — index.tsx imported `Alert` from react-native (no-op on RN Web), so installApp()'s fallback instructions (the common case: desktop / iOS / no beforeinstallprompt) silently did nothing. Now uses `showAlertWithButtons` (in-app modal) → button works everywhere.
- SEO (completed): added `<Head>` (title/description/canonical) to terms, privacy, login, register (index already had one; +html.tsx already carries JSON-LD/GA4/GSC/OG). Reduced Unsplash category thumbnails w=800→500, q=80→75 (auto=format serves WebP/AVIF) for LCP/CWV.
- BACKEND URL FIX: public/_redirects was pointing /sitemap.xml + /api/* to onrender.com; user confirmed backend is on Railway → repointed to https://backend-production-a461.up.railway.app/api/... (static public/robots.txt kept, served by Netlify).
- VERIFIED: babel parse OK for all 5 edited .tsx; backend /api/seo/sitemap.xml (incl. category URLs) + /api/seo/robots.txt curl-OK. Frontend visual verification pending on Netlify after Save to GitHub (pod serves CRA placeholder, not Expo).

## 2026-07-01 (cont.) — "Install app" REAL fix: PWA installability criteria
- ROOT CAUSE of no native install: the PWA icon `pwa-icon.png` was 512×513 (NON-square), yet manifest declared it as both 192x192 AND 512x512 → Chrome rejects mismatched/non-square icons → `beforeinstallprompt` NEVER fires → only the instructions modal showed.
- FIX 1 (icons): generated real square icons via PIL — `pwa-icon-192.png` (192²), `pwa-icon-512.png` (512²), `pwa-icon-maskable.png` (512² with 20% safe-zone padding, purpose:maskable). manifest.json now references correct-sized icons with separate `any` + `maskable` purposes. apple-touch-icon → /pwa-icon-192.png.
- FIX 2 (service worker): sw.js empty fetch handler `() => {}` → real pass-through `event.respondWith(fetch(...))` (satisfies installability + enables future offline).
- FIX 3 (timing): Chrome can fire beforeinstallprompt BEFORE React mounts. Added a global capture in +html.tsx (`window.__onoFixInstallPrompt`) + appinstalled cleanup. index.tsx useEffect reads the pre-captured prompt on mount; installApp() falls back to the global prompt and marks standalone on acceptance.
- Now Chrome/Edge/Android show the native one-click install; iOS still uses the Add-to-Home-Screen instructions modal (Apple has no prompt API). Needs Save to GitHub → Netlify (PWA requires live https + SW + manifest; not testable in the CRA-placeholder pod).

## 2026-07-01 (cont.) — REAL root cause: PWA icons were .gitignored → 404 on live
- User screenshot showed the fallback "Install Ono-Fix / tap ⋮ menu" instructions instead of a native prompt. Diagnosed against LIVE ono-fix.com: manifest.json deployed correctly BUT all icon PNGs (/pwa-icon-192.png etc.) returned 200 text/html size=34901 = Netlify SPA fallback (index.html) = files NOT in the build.
- ROOT CAUSE: `.gitignore` line 39 `*.png` ignored ALL png globally → the generated PWA icons were never committed/deployed → Chrome couldn't validate icons → beforeinstallprompt never fired. (My installApp code was correct; it correctly fell back to instructions because installPrompt was null.)
- FIX: added negation rules to .gitignore (`!public/pwa-icon.png`, `-192`, `-512`, `-maskable`, `!public/favicon.png`, `!public/og-image.png`). Verified `git check-ignore` now returns nothing for them and `git status` lists them as new untracked files ready to commit.
- ACTION REQUIRED: user must "Save to GitHub" so the icon PNGs get committed + deployed. After that, native install prompt will work on Chrome/Edge/Android.

## 2026-07-01 (cont.) — Brand logo icons + focused-scan installed app (Option A)
- APP ICON: user provided the OnoFix logo (house+camera+wrench emblem + wordmark). Generated a clean, centered emblem-only square icon (via Gemini image edit from the reference logo, artifacts stray marks removed) → public/onofix-icon-192.png, onofix-icon-512.png (purpose any), onofix-icon-maskable.png (512 with ~35% safe-zone padding), favicon.png. manifest.json + +html.tsx (apple-touch-icon, favicon, OG image) now reference the new icons. Removed old pwa-icon-*.png. .gitignore simplified to `!public/*.png`.
- FOCUSED SCAN LAUNCH (Option A): when running as an installed PWA (isStandalone), the home renders a focused scanner: branded scan header (camera badge + Ono-Fix + tagline) + the AI photo block (camera/gallery/AI analyze) only; the search bar, category grid, popular tasks and how-it-works are hidden. A "Browse all services" button (setShowFullHome) reveals the full home inside the app. In a normal browser the full home is unchanged. photo_result → book flow continues normally. New styles: scanHeader/scanLogo/scanBrand/scanTagline/browseAllBtn. testid: browse-all-services-btn.
- VERIFIED: babel parse OK (index.tsx, +html.tsx), manifest.json valid JSON, icons tracked in git. ⚠️ Visual + install + focused-scan behavior only verifiable on the installed live app (isStandalone is false in a browser/pod). Needs Save to GitHub → Netlify.

## 2026-07-01 (cont.) — Install debug via Chrome DevTools Protocol + search no-results
- User reported install still shows instructions (10th time) + "search doesn't work". Loaded LIVE ono-fix.com in real Chromium via Playwright CDP:
  - `Page.getAppManifest` → errors: [] (manifest valid, Chrome parsed it).
  - `Page.getInstallabilityErrors` → installabilityErrors: [] (Chrome confirms the PWA IS INSTALLABLE — zero blockers).
  - Service worker: registered, activated, scope https://ono-fix.com/, controls page (controller:true after load/reload).
  - Icons load at correct dimensions (192x192, 512x512), manifest v=20260701b live.
  - SEARCH WORKS: typed "clean" → input value "clean", grid filtered to Cleaning. The report was likely an empty-result with no feedback.
- CONCLUSION: install is technically 100% correct (Chrome-verified). beforeinstallprompt is NOT dispatched in headless automation, so we cannot programmatically fire it here. On the user's device the most likely causes: (a) app ALREADY installed (Chrome then never re-fires the prompt), or (b) tapped before Chrome dispatched the event (fires a few seconds post-load).
- IMPROVEMENTS (index.tsx): installApp() now waits up to ~3s polling for window.__onoFixInstallPrompt before falling back (fixes "tapped too early"); button shows an ActivityIndicator + "Preparing…" while waiting; Android fallback message now says the app may already be installed (check home screen). Added search NO-RESULTS empty state ("No services match …" + "Identify by photo" CTA), and Popular tasks/How-it-works are hidden while a search query is active. New styles noResults*. testids: search-no-results, no-results-photo-btn.
- Needs Save to GitHub → Netlify. Guidance to user: check home screen for existing Ono-Fix icon; else fully reopen ono-fix.com, wait ~10s, tap Install.

## 2026-07-01 (cont.) — Address autocomplete restricted to selected city/state
- BUG (user screenshot): city="Niles" but the "Street and number" suggestion showed "9701 Deer Run Road, Waxhaw, North Carolina" — street results came from anywhere in the US. Also "Detect my location" sometimes returned a different-state address (IP-based desktop geolocation inaccuracy).
- ROOT CAUSE: components/AddressAutocomplete.tsx queried Photon with only the raw street text + a fixed US-center bias and no city/state constraint → cross-state results.
- FIX (AddressAutocomplete.tsx): added a `city` prop. It resolves the city → its US state + center coords (Photon place lookup, prefers exact name match; e.g. "Niles" → Illinois). Street queries now (1) append ", {city}, {state}" to the query, (2) bias lat/lon to the city center, (3) STRICTLY filter results to the resolved state, and (4) sort same-city matches first. Added a "No streets found in {city}" empty state. When no city is set (e.g. create-task single-address field), behavior is unchanged (US-only).
- index.tsx: pass `city={booking.city}` to the booking AddressAutocomplete; detectLocation() now uses `enableHighAccuracy:true, maximumAge:0` for better GPS accuracy on mobile.
- VERIFIED via real Photon API (curl): "Niles" resolves to Illinois; street query "Main St, Niles, Illinois" biased to Niles/IL returns only Illinois streets (Main Street, Niles) — the North Carolina result is eliminated. babel parse OK for both files. Visual check pending on Netlify after Save to GitHub.

## 2026-07-01 (cont.) — Per-skill photos (with captions) + per-skill experience
- BUG: provider photos & experience were GLOBAL (profile-level portfolioPhotos / bio) → showed identically under every skill.
- User decision: leave the hourly rate as-is (untouched); make photos & experience PER SKILL.
- FRONTEND (my-profile.tsx service detail modal): ProviderSkill type gained `photos: {uri,caption}[]` + `experience`. Each skill now has its own: up to 10 work photos each with an editable caption (add/remove), and an "Experience with this service" textarea. Single "Save changes" button persists rate+photos+experience for that skill (new saveSkillDetails + skillToPayload used by all save helpers so nothing is dropped). Web uploads are canvas-downscaled to ≤1200px @ jpeg 0.7 to keep the Mongo doc small. Old global WORK PHOTOS + "Experience description" (bio modal) removed from the skill modal.
- FRONTEND (executor/[id].tsx public profile): "Skills" section → "Services": each service rendered as a card with its rate, per-skill experience text, and a horizontal gallery of captioned photos. Normalizer handles legacy string skills and object skills.
- BACKEND: no change needed — skills stored as List[Union[str,Dict]] (arbitrary dicts persisted as-is).
- VERIFIED end-to-end via curl on preview backend: PUT /api/profile/executor with a skill containing experience+photos[{uri,caption}] → GET returns them intact. babel parse OK (my-profile.tsx, executor/[id].tsx). Visual check pending on Netlify after Save to GitHub.

## 2026-07-01 (cont.) — FIX: "Pros" (executors list) page not loading / empty
- BUG: client opens the Pros/executors list → page doesn't render, no executors shown.
- ROOT CAUSE (pre-existing): skills are stored as OBJECTS ({id,name,hourly_rate,...}), but the executors LIST rendered them as React children directly — `app/(tabs)/executors.tsx:323` did `<Text>{skill}</Text>` and `app/(tabs)/index.tsx:1907` did `skills.slice(0,3).join(' · ')`. Rendering an object as a child throws "Objects are not valid as a React child", crashing the whole list. Any provider who added skills via my-profile (objects) triggered it. Confirmed via GET /api/executors: skills come back as list of dicts.
- FIX: executors.tsx renders `typeof skill === 'string' ? skill : skill?.name`; index.tsx taskers list maps skill names before join. Also fixed a currency leftover in the taskers card: `{rate} ₴` → `${rate}` (app is USD). The tasker_profile step already handled objects (no change).
- VERIFIED: GET /api/executors returns 200 with 3 executors (authed; 401 unauth as expected). babel parse OK for both files. Cleaned the bogus test photo injected earlier into the seeded provider. Visual check pending on Netlify after Save to GitHub.

## 2026-07-01 (cont.) — Work-photo preview in executors list card
- Enhancement (approved): executors list cards now show up to 3 work-photo thumbnails to boost trust/CTR.
- executors.tsx: aggregates photos across all of an executor's per-skill `photos[]` (falls back to legacy portfolio_photos), shows first 3 as a row (styles workPhotosRow/workPhotoThumb); hidden when none. Type updated for object skills. babel OK. Needs Save to GitHub.

## 2026-07-01 (cont.) — FIX "View profile" (Profile not found) + portfolio redesign + remove list photos
- Diagnosed on LIVE via Playwright: /executor/{id} showed "Profile not found" even for a real executor (LEO, user_a880ffe9c979, has_profile=true).
- ROOT CAUSE: utils/api.ts `getExecutorProfile` called `/executors/{id}/profile` (404) with fallback `/executors/{id}` (404). Correct endpoint is `/profile/executor/{id}` (curl → 200). Both wrong URLs 404 → threw → page rendered "Profile not found". Also `getExecutorAvailability` (`/executors/{id}/availability` → 404) and `getExecutorPricing` (`/executors/{id}/pricing` → 404) were awaited in the main try, aborting the whole load.
- FIX: getExecutorProfile → `/profile/executor/{id}`. executor/[id].tsx loadExecutorData: profile is primary (its payload already includes `availability`); reviews + pricing wrapped in independent try/catch (non-blocking); removed the Alert+router.back that hid the error on web.
- LIST CARD: removed the oversized work-photo thumbnails from executors.tsx list cards (user: too big, covered everything).
- PORTFOLIO REDESIGN (executor/[id].tsx): added a prominent "Portfolio · N photos" 2-column gallery grid (aggregates all per-skill photos + legacy, with captions) right under the profile header. Removed duplicate photo rendering from per-service cards (now name/rate/experience only) and removed the old bottom portfolio_photos section.
- VERIFIED: curl — /profile/executor/{id} 200; /executors/{id}/availability & /pricing 404 (now non-blocking); /reviews/provider/{id} 200. babel OK for executor/[id].tsx, executors.tsx, utils/api.ts. Visual check pending on Netlify after Save to GitHub.

## 2026-07-01 (cont.) — "Book this pro" + Show-all-reviews toggle + Contact→Book
- Bugs: (1) "Show all reviews (N)" button did nothing; (2) "Contact" button should be "Book this pro" and start a booking flow assigned to that specific executor.
- executor/[id].tsx: "Show all reviews" now toggles showAllReviews (reviews.slice(0, showAllReviews?len:5)); button label toggles Show all/Show fewer. Replaced Contact → "Book this pro" (calendar icon); bookExecutor() navigates to /(tabs)?bookProvider=<id>&providerName=&providerRate=&providerPicture=.
- index.tsx (home booking flow): reads useLocalSearchParams; when bookProvider present → sets forcedProvider + booking.selectedTasker, starts at category ('home'), shows a "Booking <name>" banner (dismissable). Datetime "Continue" → when forcedProvider, skips the taskers list and goes straight to 'confirm' (label "Review booking"); goBack from confirm returns to datetime. submitBooking already sends provider_id: selectedTasker.user_id → booking assigned to that pro.
- TESTED via testing_agent (iteration_15.json, backend-only since Expo isn't served in pod — preview URL shows Emergent placeholder): 6/6 PASS. POST /api/bookings with provider_id → status pending_acceptance, visible to client+provider, commission snapshot populated. GET /profile/executor/{id} 200. Legacy /executors/{id}[/profile] 404. Reviews endpoint 200 with {reviews,average_rating,total_reviews} — preview DB has 0 reviews (the live "(16)" is real Railway data; badge uses reviews.length so it matches).
- Frontend UI (relabels, navigation params, accordion) validated via babel; visual verification pending on Netlify after Save to GitHub.
- Note (deferred): get_executor_profile 404s for executors who never completed a profile → those would still show "Profile not found"; consider returning a minimal profile. Also duplicate UA/EN skill names in seeded LEO data (cleanup offered).

## 2026-07-01 (cont.) — Book-this-pro: constrain dates to the pro's available days
- Enhancement (approved): when booking a specific pro, the Date & time step greys out days the pro is off.
- executor/[id].tsx bookExecutor(): passes `providerDays` = unique active availability weekdays, converted from Monday-indexed day_of_week (0=Mon) to JS getDay (0=Sun) via (d+1)%7.
- index.tsx: providerAvailableDays state parsed from params; on entry jumps calDayIdx to the first available day; the datetime week strip disables + greys (opacity 0.35) days whose getDay() isn't in the list; added a hint banner "Showing <name>'s available days only". Fallback: if the pro has no availability set (e.g. LEO = null), no restriction (all days selectable). Cancel-provider banner clears the day restriction.
- babel OK for both files. Purely UI on top of the already-verified booking backend; visual verification pending on Netlify after Save to GitHub.

## 2026-07-01 (cont.) — Address step restructured: State → City → Street → Apt/Unit
- Per user: address flow order = State (default Illinois) → City → Street & number → Apt/Unit (optional, for multi-unit buildings).
- Booking model gained `state` (default 'Illinois') + `unit`. Added US_STATES (50) constant + a bottom-sheet state picker Modal (selectField + stateSheet styles). City chips + free text kept. Street uses AddressAutocomplete now with an explicit `state` prop.
- AddressAutocomplete: new `state` prop takes precedence over the city-resolved state; street results are strictly filtered to that state (query includes ", city, state"; verified via Photon curl → Chicago/Illinois returns only Illinois). onSelect also sets booking.state.
- Submit: address string now "street[, unit], city, state" for both the local task and createBooking; also sends state/unit (backend BookingCreate ignores unknown fields — no 422). Confirm step shows the full address. Address continue requires state+city+street.
- VERIFIED via curl: POST /api/bookings with the new full address + state/unit → 200, address stored complete ("123 Main St, Apt 4B, Chicago, Illinois"). Photon returns only Illinois for state-restricted query. babel OK (index.tsx, AddressAutocomplete.tsx). Visual pending on Netlify.

## 2026-07-01 (cont.) — FIX: Unit field unreachable + street pick dropped house number
- Bug1 (Apt/Unit input unreachable under mobile keyboard): address-step ScrollView paddingBottom 32→280 (+showsVerticalScrollIndicator false) so the last field scrolls above the keyboard.
- Bug2 (picking a street put only the street NAME, no house number): components/AddressAutocomplete.tsx pick() — when the chosen Photon feature has no `housenumber`, parse the leading number from the user's typed text and prepend it (`<number> <street>`); the field + onSelect now use the street line (parts.line1), not the full city/state formatted string.
- TESTED via testing_agent (iteration_16.json, backend/external-API only — Expo not served in pod): 6/6 PASS. Photon confirms "9701 Dee Road, Niles, IL" returns 0 features with housenumber → fallback is required & correct; "233 S Wacker Dr, Chicago" returns housenumber (happy path); state restriction → 4/4 Illinois; POST /api/bookings stores/returns the composed address byte-exact. Regression test added: /app/backend/tests/test_photon_and_composed_address_booking.py.
- Note: Photon needs a browser User-Agent (403 without) — non-issue in the real app (browsers send UA). UI scroll + field value need live visual confirmation on Netlify.

## 2026-07-01 (cont.) — Executor profile: clickable services accordion + About
- Per user: the bio area should be an "About" self-description; services should be clickable → each opens to reveal that service's real description (per-skill experience) + photos of completed work.
- executor/[id].tsx: added "About" label above bio. Removed the aggregated top Portfolio gallery. Services section is now an accordion — each service row is a TouchableOpacity (chevron up/down); tapping expands to show that skill's experience text (or "No description yet") + a 2-col photo grid with captions; tapping a photo opens the existing fullscreen image Modal. State: expandedSkill. New styles: aboutLabel, servicesHint, skillExpanded, skillEmptyText. babel OK. Needs Save to GitHub.

## 2026-06-01 — Payout setup: Finix-only mode (hide manual methods when admin enables Finix)- USER DECISION: when admin has ENABLED Finix, the executor should see ONLY the Finix card — all manual payout options hidden (regardless of onboarding state). Manual methods return only if the admin DISABLES Finix.
- FIX (app/payout-setup.tsx): wrapped the entire manual block — "or save details manually" divider, "Alternative payout methods" (PayPal/Zelle/Venmo), saved-accounts list, Debit-card/Bank-ACH tabs, and the manual card/bank form — in `{!enabledMethods.includes('finix') && (...)}`. Stripe Connect card + the Finix onboarding card remain (gated by their own admin flags).
- BUGFIX (same file): `Platform` was used (Stripe web-redirect logic + useEffect) but NOT imported from react-native → the screen would ReferenceError/crash on mount. Added `Platform` to the react-native import.
- VERIFIED: esbuild compiles clean (only unrelated expo tsconfig warning). Visual verification pending on Netlify (pod serves CRA placeholder, not the Expo app) after Save to GitHub.

## 2026-06-01 — FIX (P0): "Confirm payment" opened review WITHOUT paying
- BUG (user): on the "Pay for task" modal, tapping "Confirm payment" WITHOUT selecting a method redirected to the executor review page even though no payment was made.
- ROOT CAUSE: the button used `onPress={submitPayment}` — React Native passes the press event object as the first arg (`forceMethod`). Being truthy, it bypassed the `if (!method)` guard, fell through all method branches to the LEGACY fallback (`payTask` in a silent try/catch) which closed the modal and opened the review modal → review reached with no real payment.
- FIX (app/task-detail.tsx): (1) Confirm button now `onPress={() => submitPayment()}` (no event leak) and is DISABLED until a method is selected (label shows "Select a method" until then). (2) onMethodTap no longer auto-submits — it only highlights the method; payment starts only via the explicit "Confirm payment" button. Flow is now: pick method → Confirm payment → (Finix card form → Pay) → review opens ONLY after a successful charge (handleFinixToken success path, unchanged).
- VERIFIED: esbuild compiles clean. Visual check pending on Netlify (pod serves CRA placeholder) after Save to GitHub.

## 2026-07-28 — FIX: blog showed author EMAIL instead of name (privacy)
- BUG (user): community/blog posts displayed the author's email (e.g. nexus.ss.llc@gmail.com) instead of their name. Requirement: never show email/contact info, only the name.
- ROOT CAUSE (server.py): create_blog_post/add_blog_comment set author_name = getattr(user,'full_name') or getattr(user,'username') or user.email — but the User model only has `name` (no full_name/username) → always fell back to the EMAIL.
- FIX: (1) create paths now use _blog_safe_name(current_user.name) (never email). (2) Added _resolve_blog_author_names(docs) called in GET /blog/posts (list), GET /blog/posts/{id} (post + its comments) — it re-derives author_name from the users collection by author_id and strips anything containing '@'. This SELF-HEALS legacy posts already stored with the email. Unknown author or email-like name → "Ono-Fix user".
- VERIFIED via curl on pod (local DB seed): legacy post with email author_name + matching user → "Leo."; orphan post (no user) → "Ono-Fix user"; no email ever exposed. server.py synced to root /app/server.py; backend restarted clean.
- Deploy: prod (Railway) fixes on next Save to GitHub; existing posts auto-corrected on read.

## 2026-07-28 — FIX: "Suspend account" (provider) returned 400 → removed (duplicated calendar)
- BUG: tapping Suspend account errored 400. ROOT CAUSE: frontend sent {is_suspended:true} to PUT /profile/executor, but ExecutorProfileUpdate has no such field → Pydantic dropped it → empty update → 400 "No fields to update". is_suspended was also never read anywhere in the backend (non-functional).
- DECISION (user): remove the option — it duplicates availability/calendar (a pro simply shows no availability to go invisible).
- FIX (app/(tabs)/my-profile.tsx): removed the "Suspend account" menu row + its handler. Settings menu now: Notifications → Account security → About → Log out → Delete account. esbuild clean.

## 2026-07-28 — FIX (P0): "Confirm payment" opened review WITHOUT paying (task-detail.tsx)
- Root cause: button used onPress={submitPayment} → RN passes the event object as forceMethod (truthy) → bypassed the !method guard → legacy fallback opened the review modal with no real payment.
- Fix: onPress={() => submitPayment()}; button DISABLED until a method is selected (label "Select a method"); onMethodTap only highlights (no auto-submit). Review opens only after a successful Finix charge. esbuild clean.

## 2026-08-01 — Loyalty rewards switched Tremendous → Giftbit (admin config + default key)
- User decision: use GIFTBIT (not Tremendous) for gift-card rewards. Provided testbed key.
- BACKEND (server.py): IntegrationKeysUpdate gained enable_giftbit / giftbit_api_key (secret, masked) / giftbit_environment (testbed|production) / giftbit_default_brand. Added giftbit_api_key to the masked secret_fields. Added GIFTBIT_DEFAULT_API_KEY constant + seed in _get_integration_keys() (self-heals: sets key + environment=testbed + enable_giftbit=True once if missing → auto-populates prod on deploy). Synced to root server.py.
- ADMIN UI (admin-integrations.tsx): new "Giftbit (loyalty rewards — gift cards)" section with enable toggle + environment + API key (secret) + default brand.
- VERIFIED (pod): key seeded, GET /admin/integration-keys returns masked e3c5••••••••6322, enable_giftbit=true, env=testbed.
- ⚠️ KEY INVALID: the provided key e3c59edf...6322 returns HTTP 401 ERROR_UNAUTHORIZED on BOTH https://api-testbed.giftbit.com/papi/v1 and https://api.giftbit.com/papi/v1 (/funds, /brands, /ping). Giftbit access tokens are long JWT-style strings, not 32-char hex → user must regenerate a real key (Dashboard → username → API Keys → Generate New Key). Phase 2 (redemption via POST /campaign) is BLOCKED until a valid key is entered.
- Giftbit integration facts (from playbook): base URLs testbed/production above; Bearer auth; send = POST /papi/v1/campaign {contacts[], price_in_cents, brand_codes[], subject, message, id(idempotent)}; no webhooks → poll GET /gifts + GET /campaign/{id}. Store amounts in integer cents.

## 2026-08-01 (cont.) — Giftbit VALID token installed
- User supplied a proper JWT-style Giftbit token. VERIFIED on testbed: GET /funds → USD available 1,000,000,000 cents (virtual); GET /brands (USD) → amazonus (Amazon.com), walmart (Walmart), visavirtualus (Visa Incentive Virtual Card).
- Updated GIFTBIT_DEFAULT_API_KEY constant (self-heals prod seed) + overwrote pod DB integration_keys.giftbit_api_key. Admin GET shows masked eyJ0••••••••/BQ=, enable_giftbit=true, env=testbed. Synced to root server.py.
- READY for Phase 2 redemption (POST /papi/v1/campaign with brand_codes, price_in_cents, idempotent id). Brands to offer: Visa (visavirtualus) recommended as the flexible default; Amazon/Walmart optional.

## 2026-08-01 — Loyalty Phase 1 COMPLETE (points + referrals + Rewards UI)
BACKEND (server.py, synced to root):
- Constants: 1pt/$1, 100pts=$1, referral activation $100 → 500pts. GIFT_CARD_TIERS 25/50/100/200/500 → 2500/5000/10000/20000/50000 pts.
- Helpers: _ensure_referral_code (ONO+hex), _award_points (atomic $inc + points_transactions ledger), _process_referral_progress (advance/rollback friend spend, award/revoke referrer 500pt bonus + notify), _accrue_order_points (idempotent per booking via loyalty_awarded flag; +pts to client, +lifetime_spent, feeds referral progress), _reverse_order_points (refund/cancel → deduct pts + roll back referral).
- Hooks: Finix charge success (6704 block) + _finalize_payment_if_both_confirmed (manual paid) → accrue; admin refund approve → reverse. Register accepts referral_code → sets referred_by + creates pending referrals doc.
- Endpoints: GET /loyalty/balance (points, usd, next_tier, tiers[can_redeem], code, link), GET /loyalty/transactions, POST /loyalty/referrals/generate, GET /loyalty/referrals/stats, GET /loyalty/gift-cards/history, POST /loyalty/gift-cards/redeem (Phase 1 → 503 "launching soon" after validating points).
- Collections: users.{balance_points,lifetime_spent,referral_code,referred_by}, points_transactions, referrals, gift_cards.
- VERIFIED: direct helper test — order1 $50→+50 (referral pending), order2 $60→friend 110 + referrer +500 (active), idempotent re-accrue no double, reverse order1 → friend -50 + referrer -500 + referral back to pending. Endpoints via curl: balance/stats/generate/transactions/history OK; redeem w/o points → 400 with points-needed msg.

FRONTEND (compiles clean via esbuild; visual check pending on Netlify — pod serves CRA stub):
- NEW app/rewards.tsx: dark hero balance card + progress-to-next-tier bar, gift-card tiers list w/ Redeem (locked until enough pts), referral card (code + Copy + Share + invited/activated/earned stats), recent activity ledger. Route registered in _layout.
- NEW components/RewardsBanner.tsx: compact dark banner on client home (only for clients) → tap to /rewards, shows pts + progress. Inserted after EmailVerificationBanner in (tabs)/index.tsx.
- my-profile.tsx: client menu new "Rewards" section → /rewards; provider menu "Invite friends" stub row rewired to /rewards.
- register.tsx: captures ?ref= param + optional "Referral code" input → passed to /auth/register.
- utils/api.ts: getLoyaltyBalance/Transactions, getReferralStats, generateReferralCode, getGiftCardHistory, redeemGiftCard.

PHASE 2 (pending): wire /loyalty/gift-cards/redeem to Giftbit POST /campaign (deduct points, create gift_cards doc, poll status). Giftbit testbed key already installed & valid. Default brand recommendation: visavirtualus.

## 2026-08-01 — Loyalty Phase 2 COMPLETE (Giftbit redemption — Visa card to email)
BACKEND (server.py, synced to root):
- Added _giftbit_base_url(env) (testbed vs production) + _giftbit_send_gift(keys,email,name,value,campaign_id): POST /papi/v1/campaign {id(idempotent=card_id), price_in_cents, brand_codes:[visavirtualus default or giftbit_default_brand], delivery_type:GIFTBIT_EMAIL, subject, message, contacts:[{email,firstname,lastname}]}. Raises 502 on non-200 or contacts_failure_count>0.
- GIFTBIT_DEFAULT_BRAND = "visavirtualus" (Visa Incentive Virtual Card) → emailed to client.
- Rewrote POST /loyalty/gift-cards/redeem: validates tier; requires enable_giftbit+key (else 503); ATOMIC deduct via find_one_and_update({balance_points:{$gte:pts}}) to prevent race/negative (else 400 with points-needed); creates gift_cards doc (pending) + redemption ledger; calls Giftbit; on failure REFUNDS points (+ reversal ledger, card=failed); on success card=delivered + stores giftbit_campaign_id (uuid) + notify_user (inapp/push/email).
- VERIFIED on real Giftbit TESTBED: grant 3000pts → redeem $25 → HTTP200, real campaign uuid returned, balance 3000→500, gift_cards history shows $25 delivered w/ uuid. Guards: 0 pts → 400 "need 2500 more"; invalid value → 400.
FRONTEND: rewards.tsx onRedeem now confirms (web) before spending, shows server message on success. No other change (Phase 1 UI already wired to api.redeemGiftCard).

## 2026-08-01 — FIX: referral not linked + points not awarded (Client5→Client7 report)
DIAGNOSIS (live data via admin API): Client7 (user_21cfff077e66) task_b8e04677d429 booking_85e3f61e5956 was FULLY PAID via zelle (exec_conf+admin_conf true) but loyalty_awarded=None → 0 points; referred_by=None → referral never linked. Loyalty endpoints ARE deployed on Railway (200).
ROOT CAUSES:
1. Referral link pointed to https://ono-fix.com/?ref=CODE (home), but only register.tsx read the ?ref param → lost on navigation home→register.
2. _accrue_order_points read final_price from the BOOKING, but for manual/Zelle orders the price lives on the linked TASK → amount=0 → early return, no points, no flag.
FIXES (pod, synced to root; needs Save to GitHub to deploy):
- _accrue_order_points now falls back to the linked task's final_price/total_amount/price when the booking has none.
- Referral links now point to /register?ref=CODE (3 spots). _layout.tsx captures ?ref= from URL into localStorage('ono_ref') on any page; register.tsx initial referralCode falls back to localStorage.
- NEW admin endpoints: POST /admin/loyalty/backfill {client_email?} — awards points for already-paid orders missing loyalty_awarded (idempotent); POST /admin/loyalty/link-referral {referred_email, referrer_code} — retroactively links a client to referrer + recomputes progress from their paid orders + awards referrer bonus if >=$100.
- VERIFIED on pod: backfill awarded points incl a task-only-priced booking (113 pts for $63.25+$50); link-referral B→A with $113 spent → active + referrer +500.
POST-DEPLOY ACTION NEEDED (run on live with admin token): POST /admin/loyalty/link-referral {referred_email: client7@handyhub.com, referrer_code: ONO6AD637 (client5)} then POST /admin/loyalty/backfill (all) to credit Client7 (~63 pts) and any other already-paid orders.

## 2026-08-01 — FIX: "Minimum charge" (1/1.5/2 hr) selector was unreachable
- User couldn't find the minimum-hours toggle. ROOT CAUSE: the selector lived in the bioModalVisible modal in (tabs)/my-profile.tsx, but setBioModalVisible(true) is never called anywhere → modal orphaned after a profile-menu refactor. minimum_hours (executor_profiles) is profile-level and already shown to clients (executor/[id].tsx + booking).
- FIX: added a "MINIMUM CHARGE" section (chips 1 / 1.5 / 2 hrs, note "applies to all your services") into the per-skill editor (serviceDetailVisible General tab, right under HOURLY RATE) — exactly where the user looked. saveSkillDetails now also passes minimum_hours to saveProfile. Value loads from profile on mount. esbuild clean. (Orphaned bioModalVisible left in place, harmless.)

## 2026-08-01 — FIX: "Close task" showed $25/hr instead of provider's $48 (display only)
- Live task task_c87407847fcb: provider_hourly_rate=48.0 (correct), hourly_rate=None. task-detail.tsx "Close task" earnings preview used `task.hourly_rate || 25` → showed $25.
- NOT a payout bug: completeTask sends only actual_hours + materials_cost; backend computes final price from stored provider_hourly_rate (48). Only the preview was wrong.
- FIX (task-detail.tsx): hourlyRate = task.provider_hourly_rate || task.hourly_rate || 25 (line 637); "Hours worked × $rate" row now uses hourlyRate (was task.hourly_rate||0 → showed $0). esbuild clean.

## 2026-08-02 — FIX: Zelle split showed $48 & 0% platform instead of actual invoice + admin commission
DIAGNOSIS (live task_d0968420631b, TV mounting, completed_pending_payment): final_price=110.4, provider_payout=96.0, platform_fee=14.4 (correct completion values), BUT booking snapshot stale (executor_take=48, platform_take=0, total_price=48). Also category "TV mounting" has NO commission_rate → 0% (vs "Electrical" 15%).
ROOT CAUSES:
1. get_manual_instructions read the booking-time snapshot (executor_take/platform_take/total_price = 1-hour estimate) instead of the completed task's authoritative provider_payout/platform_fee/final_price.
2. compute_client_pricing defaulted commission_rate to 0 when a category had none — no fallback to the admin global rate (settings.admin_commission_percentage=15).
FIXES (server.py, synced to root):
- get_manual_instructions: if the linked task has final_price>0 AND provider_payout>0, use amount=final_price, executor_take=provider_payout, platform_take=platform_fee (skip the recompute-from-rate fallback).
- finix_charge: same — prefer the completed task's provider_payout/platform_fee/final_price whenever present (was only used when booking split was 0).
- compute_client_pricing: when a category has no commission_rate, fall back to settings.admin_commission_percentage (else 0).
VERIFIED on pod: manual-instructions for a completed task → total 110.40, platform 14.40 (15%), pro 96.00 (was 48/0). pricing-preview?executor_rate=48 (no category) → 15%, platform 8.47.
NOTE: split is computed live per request → after deploy, existing live completed tasks show the correct split immediately (no backfill).

## 2026-08-02 — FIX: "Pay for task" modal double-charged commission + showed "0 hr × $25"
- task-detail.tsx "Pay for task" modal computed clientTotal = totalBase * 1.15 where totalBase = final_price. But final_price ALREADY includes commission (provider_payout + platform_fee) → double 15% ($110.40 shown as $126.96). Also hours line used task.hourly_rate (→ $25 default) and showed "0 hr × $25 = $0" when actual_hours=0.
- FIX: clientTotal = final_price when present (no extra ×1.15); ×1.15 estimate kept only for the no-final_price fallback. Hours line now uses rate = provider_hourly_rate || hourly_rate || hourlyRate, only shown when actual_hours>0, else falls back to "Labor = $provider_payout". Now consistent with the task-body Total due (final_price) and the Zelle/Finix split. esbuild clean.

## 2026-08-04 — NEW FEATURE: Admin email broadcast (send mail from admin panel)
- Admin can now send email to (a) any CUSTOM address(es) (comma/newline separated), (b) SPECIFIC users picked from the system (searchable checkbox list), or (c) a GROUP: all users / clients only / providers only.
- BACKEND (server.py): `_send_email_now()` (broadcast sender — same Resend→SendGrid selection as `_send_email` but IGNORES the enable_email_notifications toggle so admin campaigns always attempt delivery). `_run_email_campaign()` background worker updates sent/failed counters. Endpoints: `GET /api/admin/email-recipients` (lightweight user list + counts), `POST /api/admin/send-email` (queues campaign, returns campaign_id + recipients_count), `GET /api/admin/email-campaigns` (history, newest 50). All admin-gated. Campaign rows stored in `db.email_campaigns`.
- FRONTEND: new `app/admin-email.tsx` (compose subject+message, 3 recipient tabs, group radio with live counts, user search+select, custom textarea, "Will send to: N" summary, Send button, Recent broadcasts history with sent/failed + refresh). Route registered in `_layout.tsx`; nav button "Email" (mail icon) added to admin panel `services.tsx`. api.ts: getEmailRecipients / adminSendEmail / getEmailCampaigns.
- VERIFIED via curl (preview backend): recipients counts (all 38 / clients 26 / providers 4), custom send (2), group clients (26), users type (1), invalid type→422, empty subject→422, no valid custom→422, non-admin→403, campaigns history populates with live sent/failed counts. Frontend esbuild-clean.
- CAVEAT: actual delivery depends on Resend/SendGrid config in the LIVE (Railway) integration_keys. In the pod, Resend test sender only delivers to the account owner → non-owner recipients count as "failed" (mechanism is correct). Verify a domain in Resend + set resend_from_email to email all users.
- ⚠️ Frontend needs "Save to GitHub" → Netlify (pod serves CRA placeholder, not Expo). Backend needs Save to GitHub → Railway.

## 2026-08-05 — NEW FEATURE: Provider ranking-hours + provider→provider referral bonus
- USER REQUIREMENTS (confirmed): (1) When a PROVIDER refers another PROVIDER (via referral code/link) and the referred pro completes their FIRST PAID task, BOTH get +5 GLOBAL ranking hours (counts in EVERY category), once. (2) Providers see per active category: worked hours, bonus hours, review stars, their position in the client list, hours needed to reach 1st/2nd. (3) Admin can add/subtract ranking hours per category OR globally, from the user list. (4) Bonus/manual hours shown separately (labeled "bonus"). (5) Rules written into Terms.
- BACKEND (server.py): `_compute_category_ranking` now returns (hours_map, adj_map, bonus_map) — bonus aggregates new collection `db.ranking_adjustments` (category==given OR '*' global). ranking_score = worked + review_adj + bonus. New helpers: `_skill_category`, `_category_ratings`, `_get_category_provider_ids`, `_category_ranking_rows`, `_add_ranking_adjustment`, `_process_provider_referral_bonus` (called from `_accrue_order_points`; idempotent via referrals.provider_bonus_awarded; both parties must be role=provider). Const PROVIDER_REFERRAL_BONUS_HOURS=5.0.
- ENDPOINTS: GET `/api/provider/ranking` (provider-only, 403 else) → categories[] {worked_hours,bonus_hours,review_adjustment,total_score,average_rating,reviews_count,position,total_providers,leader_score,hours_to_first,hours_to_second} + referral_code/link/bonus. GET `/api/admin/providers/{id}/ranking` (admin) → categories + global_bonus_hours + history[]. POST `/api/admin/providers/{id}/ranking-adjust` {hours(+/-),category('*'=all),reason} (admin; hours=0→422, unknown user→404, non-admin→403).
- FRONTEND: NEW `app/my-ranking.tsx` (per-category cards: position badge, worked/bonus/score/stars, progress bar to 1st, hours-to-1st/2nd, referral CTA with copy link, link to Terms). Linked from provider profile (my-profile.tsx "My ranking" row). Route registered in _layout.tsx. Admin: users.tsx gained a "Ranking" button on provider rows → modal (category chips incl. All, current standing, +Add/−Subtract hours, reason, adjustment history). api.ts: getProviderRanking, adminGetProviderRanking, adminAdjustProviderRanking.
- RULES: terms.tsx section 10 extended with "Provider referral bonus" (+5 global, once, reversible) and "Bonus and adjustment hours" clauses.
- VERIFIED: testing_agent iteration_23 — 10/10 backend tests PASS (access control, ranking shape, global+category adjust math (cleaning bonus +15), subtraction, admin history newest-first, executors/by-service regression now includes category_bonus_hours+ranking_score, multi-provider ordering + hours_to_first math, referral bonus to BOTH + idempotency). Frontend esbuild-clean (pod serves CRA placeholder; visual verification pending on Netlify).
- ⚠️ Needs "Save to GitHub": backend → Railway, frontend → Netlify. Referral link uses existing ?ref= capture (_layout.tsx) + registration referral_code (already working).

## 2026-08-05 (cont.) — Ranking UX polish: moved "My ranking" to Stats tab + rewards copy + rules
- Moved the provider "My ranking" entry from the Profile tab menu to the BOTTOM of the STATS tab (my-profile.tsx renderPerformance → new "Ranking" section row, data-testid stats-my-ranking-link). Removed the old row from renderService.
- "Rewards & invite friends" row (provider profile) now has a subtitle explaining both bonus types: invite a pro → +5 ranking hours (both); invite a client → points & gift cards.
- Rewards screen (app/rewards.tsx): added a two-line bonus note in the referral card — client referral = points→gift cards; provider referral = +5 ranking hours in every category after their first paid task. (new styles refBonusNote/refBonusLine)
- Terms (app/terms.tsx): renamed section 10 → "Reviews, Ratings, Provider Ranking & Rewards"; added clauses for Loyalty points (Clients, 1pt/$1, gift-card tiers), Client referral reward (500 pts at $100 spend), and a summary contrasting provider (hours) vs client (points+gift cards) referrals. No section renumbering.
- esbuild-clean (my-profile, rewards, terms). Frontend-only; visual verification on Netlify after Save to GitHub.
- KNOWN (not requested this round): provider Stats "Earnings" still renders the ₴ (UAH) symbol in my-profile.tsx (~line 1324) — should be $ per US adaptation. Flagged for a future fix.

## 2026-08-05 (cont.) — Infobip SMS integration (default provider) + SMS broadcast + SMS auth
- USER REQUEST: SMS broadcast + SMS authentication via Infobip. Provided sender 18335925136, API key (default), Base URL https://9j8ygd.api.infobip.com.
- BACKEND (server.py): NEW Infobip sender `_send_sms_infobip` (POST {base}/sms/3/messages, header `Authorization: App <key>`, payload messages[{sender,destinations[{to}],content{text}}]; strips leading '+'; success=2xx & groupName not in UNDELIVERABLE/REJECTED/EXPIRED). `_send_sms` is now a DISPATCHER (`_send_sms_dispatch`) selecting by `sms_provider` (infobip default → plivo fallback). Plivo kept as `_send_sms_plivo`. Added `_send_sms_now` (ignores enable toggle) + `_run_sms_campaign`. Phone verification (/api/auth/verify-phone flow) now sends OTP via Infobip automatically (uses `_send_sms`; we still generate/verify our own 6-digit code). Defaults: INFOBIP_DEFAULT_BASE_URL/API_KEY/SENDER.
- ENDPOINTS: GET /api/admin/sms-recipients (users with phones + counts), POST /api/admin/send-sms (recipient_type custom/users/group; background send; sms_campaigns row), GET /api/admin/sms-campaigns (history). IntegrationKeysUpdate + get_integration_keys extended: sms_provider, infobip_base_url, infobip_api_key (masked secret), infobip_sender (pre-filled defaults; api key masked in GET).
- FRONTEND: NEW app/admin-sms.tsx (SMS broadcast composer: message + char counter, group/users/custom recipients, history). Route in _layout.tsx; "SMS" nav button (chatbubbles) in services.tsx admin panel. admin-integrations.tsx: NEW "Infobip (SMS — default)" section (sms_provider, base URL, api key, sender) with enable_sms_notifications toggle + test-SMS; Plivo demoted to "fallback". api.ts: getSmsRecipients/adminSendSms/getSmsCampaigns.
- VERIFIED (curl on preview): direct Infobip /sms/3/messages → HTTP 200 PENDING_ACCEPTED (real send works; balance endpoint 403 = key scoped to send-only, harmless). admin/send-sms custom → campaign completed sent=1 failed=0 (real Infobip delivery). sms-recipients counts (19/9/3). Empty body→422, non-admin→403. integration-keys returns infobip prefilled + masked key. Backend synced to /app/server.py. Frontend esbuild-clean (admin-sms, admin-integrations).
- ⚠️ Needs "Save to GitHub": backend→Railway, frontend→Netlify. Admin must ensure the numeric sender 18335925136 is APPROVED in Infobip for the destination countries, else Infobip rejects.

## 2026-08-05 (cont.) — Provider phone verification + SMS delivery root-cause
- ADDED phone verification (and email) rows to the PROVIDER profile (my-profile.tsx renderService, after "Account details"): data-testid provider-verify-phone-row / provider-verify-email-row → routes to /verify-phone, /verify-email. Previously only the CLIENT profile had these.
- ROOT CAUSE of "SMS not arriving" (Client5 & others): Infobip DELIVERY REPORT shows status REJECTED / REJECTED_SOURCE ("Invalid Source address") with error EC_TF_NUMBER_NOT_VERIFIED = "Toll-free number is not verified" (permanent). The sender 18335925136 is a US toll-free number that has NOT completed Toll-Free Verification in the Infobip account → Infobip rejects ALL sends. This is an ACCOUNT-SIDE config issue, not a code bug. USER ACTION: complete Toll-Free Verification in the Infobip portal (Numbers → Toll-free → Verify), or use an already-verified / approved sender. Until then no SMS (OTP or broadcast) will be delivered.
- CODE IMPROVEMENTS: `_send_sms_infobip` now strips ALL non-digits from destination/sender (spaces/dashes broke formatting) and supports verify_delivery=True → polls GET {base}/sms/1/reports once (~2.5s) after send so permanent rejections surface immediately. `_send_sms`/`_send_sms_dispatch` thread verify_delivery. send-phone-code (OTP) now calls with verify_delivery=True → the verify-phone screen shows the real reason (e.g. "Toll-free number is not verified") instead of a silent success. Added `_infobip_status_msg` helper.
- VERIFIED: direct _send_sms('+1 331 771 3444', verify_delivery=True) → sent=False, error="Infobip rejected the SMS: Toll-free number is not verified (EC_TF_NUMBER_NOT_VERIFIED)". Backend synced; my-profile esbuild-clean.
- ⚠️ Save to GitHub → Railway/Netlify.

## 2026-08-12 — Manual gift-card redemption flow (Giftbit ON/OFF) + $50 minimum + admin alerts
- USER REQUEST: toggle to turn OFF Giftbit and switch to MANUAL flow: client accumulates ≥$50 → Redeem → request goes to admin → admin buys card → enters code in admin → Ono-Fix auto-sends email+SMS to client. Minimum $50. Admin alerted (email/Telegram) about redemption requests.
- TOGGLE: reuse existing `enable_giftbit` (admin-integrations "Giftbit" section, label updated: "Auto-issue via Giftbit (OFF = manual: admin enters code in Rewards requests)"). ON → auto Giftbit issue (unchanged). OFF → manual flow.
- MINIMUM $50: removed the $25 tier from GIFT_CARD_TIERS (now 50/100/200/500). Added MIN_REDEEM_USD=50. Invalid value → 400 "Minimum redemption is $50".
- BACKEND (server.py):
  - `POST /loyalty/gift-cards/redeem`: deducts points atomically; if giftbit enabled → auto; else MANUAL → gift_card status "requested" (fulfillment "manual"), alerts admins via `_notify_admins` (email+Telegram), notifies client "request received", returns {manual:true, status:"requested"}.
  - `GET /admin/loyalty/redemptions?status=` → list with client name/email/phone + counts.
  - `POST /admin/loyalty/redemptions/{card_id}/fulfill` {code, brand?, note?} → status "delivered", stores code, sends code to client via email (`_send_email_now`) + SMS (`_send_sms_now`). Double-fulfill → 400.
  - `POST /admin/loyalty/redemptions/{card_id}/reject` {reason?} → refunds points, status "rejected", notifies client.
  - NEW helpers `_notify_admins_email` (emails all admins/moderators + support_email) and `_notify_admins` (email + Telegram).
- FRONTEND: NEW app/admin-redemptions.tsx ("Rewards requests": tabs requested/delivered/all, cards with client info, "Enter code & send" modal [code/brand/note], "Reject & refund"). Route in _layout.tsx; "Rewards" nav button (gift) in services.tsx admin panel. api.ts: adminListRedemptions/adminFulfillRedemption/adminRejectRedemption. rewards.tsx onRedeem shows "Request received" title when res.manual.
- VERIFIED (curl preview): disable giftbit → redeem $50 → status "requested"; $25 → 400 (min); admin list shows request; fulfill code → email_sent=true sms_sent=true, code stored, status delivered; double-fulfill → 400; reject → refunded 5000 pts (balance restored to 5000). Giftbit re-enabled on preview after test. Frontend esbuild-clean.
- NOTE: SMS to client depends on Infobip toll-free verification (still pending) — email will always work; SMS once the sender is verified.
- ⚠️ Save to GitHub → Railway/Netlify.

## 2026-08-16 — "Task not completed" checkbox → clone follow-up task on Finish work
- USER REQUEST: On provider task tab, when a task is "Started", add a "Task not completed" checkbox. Checking it + Finish work → payment is calculated as usual, AND a clone of the task is created in "Accepted" (assigned) status for BOTH client and provider. Must not break anything.
- FEASIBILITY: Easy & safe — implemented as purely ADDITIVE logic; the existing completion/payment path is unchanged (flag defaults to false).
- BACKEND (server.py): TaskComplete gained `create_followup: bool = False`. New helper `_clone_task_as_followup(task, provider_id, now)` creates a fresh booking + task (new IDs) in ASSIGNED status, copying client/provider/category/address/hourly_rate, title prefixed "(Follow-up) ", resetting all timeline/payment/completion fields (started_at/completed_at=None, payment_status="pending", final_price/payout cleared), tags is_followup=True + followup_of_booking/task. `complete_task` runs the normal completion FIRST (payment calc untouched), then if create_followup → clones and notifies both parties (task_assigned). Response adds followup_task_id/followup_created.
- FRONTEND (task-detail.tsx): added "Task not completed" checkbox in the Finish-work invoice modal (data-testid task-not-completed-checkbox) with hint; submitInvoice passes create_followup; success alert appends "A follow-up task was added to Accepted tasks" when followup_created.
- VERIFIED (real endpoint + DB): started task completed with create_followup=true → ORIGINAL status completed_pending_payment, final_price $94.30 / payout $82 (identical to normal calc); CLONE task status=assigned, title "(Follow-up) …", same client/provider, is_followup=true, started_at/completed_at=None, payment_status=pending, final_price=None, hourly_rate preserved; CLONE booking status=assigned + followup_of_booking link. Normal complete (flag false) skips the clone entirely. Frontend esbuild-clean. Test data cleaned up.
- ⚠️ Save to GitHub → Railway/Netlify.

## 2026-08-16 (cont.) — Follow-up badge in lists + follow-up scheduling
- FOLLOW-UP BADGE: client list (app/(tabs)/bookings.tsx) and provider list (app/(tabs)/tasks.tsx) now show an orange "Follow-up" / "Follow-up visit" badge (Ionicons "repeat") when booking/task is_followup === true. Styles followupBadge/followupBadgeText added to both. data-testid="followup-badge".
- FOLLOW-UP SCHEDULING: TaskComplete gained followup_date/followup_time (optional). `_clone_task_as_followup(..., followup_date, followup_time)` sets scheduled_date/scheduled_time on the clone task and date/time+scheduled_* on the clone booking when provided. task-detail.tsx invoice modal: when "Task not completed" is checked, an orange "Schedule the follow-up visit (optional)" panel with Date (MM/DD/YYYY) + Time (10:00 AM) TextInputs appears (data-testid followup-date-input / followup-time-input); submitInvoice passes them.
- VERIFIED (real endpoint + DB): complete with create_followup + followup_date 08/25/2026 + followup_time 2:00 PM → clone task status=assigned, is_followup=true, scheduled_date/time set; clone booking date+time+scheduled_* set. esbuild-clean (bookings, tasks, task-detail). Test data cleaned up.
- ⚠️ Save to GitHub → Railway/Netlify.
