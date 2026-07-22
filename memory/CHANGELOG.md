# Changelog

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
