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
