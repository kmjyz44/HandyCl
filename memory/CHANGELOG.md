# Changelog

## 2026-06 — Address expansion (State → City → Street/Num → Unit → ZIP)
- Verified `POST /api/users/saved-addresses` accepts full payload (label, street, city, state, unit, zip) — 422 error resolved.
- Fixed `BookingCreate` model: added `state`, `unit`, `zip` fields (were silently dropped by Pydantic).
- `create_booking` now persists `state`, `unit`, `zip` on both the booking and task documents (needed for Finix ZIP compliance).
- Frontend (`my-profile.tsx`, `index.tsx`, `AddressAutocomplete.tsx`) already send these fields; booking prefill from default saved address works.
- Backend verified end-to-end via curl (client@handyhub.com). Frontend Expo Web not driven by Playwright in preview.

### Still pending
- Twilio SMS: DB `integration_keys` has NO twilio_* fields. User chose to defer. Needs Account SID / Auth Token / From Number.
