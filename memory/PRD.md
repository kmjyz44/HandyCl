# HandyCl — Admin Categories Management (Production Iteration)

## Original Problem Statement (UA)
"В мене є проект на гітхаб, потрібно доробити його до продакшену. Поки що треба доробити адмінку:
редагування і додавання категорій, зміна/додавання фото обкладинки категорії,
призначення рекомендованої ціни для виконавця, встановлення % комісії для платформи."

## Repository
- GitHub: https://github.com/kmjyz44/HandyCl (master branch)
- Backend (Railway): https://backend-production-a461.up.railway.app
- Frontend (Netlify): https://handycl.netlify.app
- Stack: Expo React Native (web build) + FastAPI + MongoDB

## Architecture (current iteration scope)
- `server.py` — root file deployed by Railway (Dockerfile + railway.json)
- `backend/server.py` — kept in sync for local/dev usage
- `app/(tabs)/services.tsx` — Expo admin panel with Services + Categories tabs
- `utils/api.ts` — Axios API client used by the Expo admin app

## What's been implemented (2026-01, iteration 2)
- Backend now seeds 9 built-in categories (Збірка меблів, Прибирання, Ремонт будинку,
  Переїзд та доставка, Зовнішні роботи, Особиста допомога, IT та техніка,
  Заходи та свята, Інше) into MongoDB on first startup with default
  `commission_rate=15%` and `recommended_price` per category — admins now see
  the existing categories in `/api/admin/categories` and can edit them.
- Guest landing hero on the home page: HandyHub brand, slogan
  "Знайдіть надійного майстра поряд", Login/Register buttons, and a
  "Як це працює" 1-2-3 explanation that booking works without registration.
- Authenticated clients still get the personalised greeting.

## What's been implemented (2026-01)
### Backend (`server.py` + `backend/server.py`)
- `POST /api/admin/categories` — accepts JSON body; supports large base64 cover image
- `PUT /api/admin/categories/{id}` — JSON body, partial updates
- `DELETE /api/admin/categories/{id}` — soft delete by default, `?hard=true` for hard delete
- `GET /api/admin/categories` — admin-only, includes inactive categories
- New Pydantic models: `CategoryCreateRequest`, `CategoryUpdateRequest`
- New persisted fields: `image`, `commission_rate`, `recommended_price`, `updated_at`

### Admin UI (`app/(tabs)/services.tsx`)
- "Recommended Price for Executor ($)" input in category modal
- Cover image preview on category cards
- Commission % and recommended price shown on each card
- Inactive badge for soft-deleted categories
- Loads via admin endpoint (sees both active + inactive)
- Improved validation + backend-error surfacing in Alert

### API client (`utils/api.ts`)
- `createCategory` / `updateCategory` send JSON body (no more query params — fixes large base64 image)
- `adminGetCategories` added
- `deleteCategory(id, hard?)` supports soft/hard delete

## End-to-end verification (production)
All endpoints verified live against Railway with admin credentials:
- CREATE → 200 OK, returns category with all new fields
- UPDATE (recommended_price, commission_rate) → 200 OK
- ADMIN LIST → 200 OK
- HARD DELETE → 200 OK

## Test credentials (existing, seeded by backend)
- Admin: admin@handyhub.com / Admin2024!
- Provider: provider@handyhub.com / Admin2024!
- Client: client@handyhub.com / Admin2024!

## Prioritized backlog (next sessions)
- P0: Wire `recommended_price` into the booking/quote flow so executors see it when pricing a job
- P0: Wire `commission_rate` (per-category) into payout calculation (currently only stored)
- P1: Bulk reorder / drag-sort of categories
- P1: Image size validation/compression before upload (currently raw base64)
- P2: Audit log of admin actions
- P2: Payment gateway integration (Stripe Connect) for live payouts
- P2: Email notifications (SendGrid/Resend) for bookings & password reset
