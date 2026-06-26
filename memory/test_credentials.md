# HandyCl — Test Credentials

These accounts are auto-seeded by the backend on every startup
(`server.py` seed routine). They exist on the production Railway DB as well.

| Role     | Email                       | Password      |
|----------|-----------------------------|---------------|
| Admin    | admin@handyhub.com          | Admin2024!    |
| Provider | provider@handyhub.com       | Provider2024! |
| Client   | client@handyhub.com         | Client2024!   |

## Endpoints
- Backend (prod): https://backend-production-a461.up.railway.app
- Login: `POST /api/auth/login` with `{"email": "...", "password": "..."}` returns `session_token`
- Send subsequent requests with header: `Authorization: Bearer <session_token>`

## Admin Categories (this iteration)
- `GET    /api/admin/categories`              — list all (incl. inactive)
- `POST   /api/admin/categories`              — create (JSON body)
- `PUT    /api/admin/categories/{id}`         — update (JSON body)
- `DELETE /api/admin/categories/{id}?hard=true|false` — delete (default soft)

Body fields: `name`, `description`, `icon`, `image` (base64 data URL),
`parent_id`, `commission_rate` (float %), `recommended_price` (float $).
