# Changelog

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
