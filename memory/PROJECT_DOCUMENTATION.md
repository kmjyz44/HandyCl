# Ono-Fix — Технічна документація проєкту

_Останнє оновлення: червень 2026_

Ono-Fix — маркетплейс побутових послуг (handyman marketplace) для ринку США: клієнти публікують завдання, виконавці (Service Providers) відгукуються, узгоджують час, виконують роботу й отримують оплату. Платформа має адмін-панель, лояльність/реферали, блог із SEO, розсилки та кілька зовнішніх інтеграцій.

Юридична особа: **Nexus Security Solutions LLC dba Ono-Fix**.
Публічний домен: **https://ono-fix.com**

---

## 1. Загальна архітектура

```
   Користувач (браузер / PWA)
            │
            ▼
   ┌──────────────────────┐        /api/*, /blog, /sitemap.xml  (проксі)
   │  Netlify (Frontend)   │ ───────────────────────────────────────────┐
   │  ono-fix.com          │                                             │
   │  Expo Router / RN Web │                                             ▼
   └──────────────────────┘                                   ┌────────────────────┐
                                                               │ Railway (Backend)   │
                                                               │ FastAPI + Uvicorn   │
                                                               │ backend-production- │
                                                               │ a461.up.railway.app │
                                                               └─────────┬──────────┘
                                                                         │
                                                                         ▼
                                                               ┌────────────────────┐
                                                               │ MongoDB (Railway)   │
                                                               │ база даних          │
                                                               └────────────────────┘
```

- **Frontend** і **Backend** — дві окремі служби, що деплояться незалежно.
- Фронтенд — це SPA (Single Page App). Щоб Google бачив блог, шляхи `/blog`, `/blog/*`, `/sitemap.xml`, `/robots.txt` **проксіюються** з Netlify на серверний рендер FastAPI.

---

## 2. Технологічний стек

### Frontend
- **Expo SDK 54** + **React Native 0.81.5** + **React 19.1** (через **react-native-web 0.21**).
- **Expo Router 6** — файлова маршрутизація (папка `app/`).
- **Zustand 5** — стан застосунку (`store/authStore.ts`).
- **Axios 1.13** — HTTP-клієнт (`utils/api.ts`).
- **expo-secure-store** — зберігання токена сесії.
- **@expo/vector-icons (Ionicons)** — іконки.
- Складання веб-білду: `npx expo export --platform web` → каталог `dist/`.

### Backend
- **FastAPI 0.110** + **Uvicorn 0.25** (єдиний файл `backend/server.py`, ~16 460 рядків, **328 API-роутів**).
- **Motor 3.3** (async драйвер MongoDB) + **PyMongo 4.5**.
- **Pydantic 2.12** — моделі/валідація.
- **python-jose** (JWT), **passlib[bcrypt]** (хешування паролів).
- **stripe 14.3**, **python-telegram-bot 22.6**, **reportlab** (PDF), **feedparser** (Soro RSS), **pywebpush** (push), **httpx/aiohttp/requests**.
- **emergentintegrations 0.1.2** — доступ до LLM через Emergent Universal Key.

### База даних
- **MongoDB**, ім'я БД: `test_database` (ключ `DB_NAME`).
- ~35 колекцій (див. розділ 6).

---

## 3. Хостинг, домен, репозиторій

| Компонент | Платформа | URL / деталі |
|---|---|---|
| Домен | — | `https://ono-fix.com` |
| Frontend | **Netlify** | білд `npm run build` → `dist/`, Node 22 |
| Backend | **Railway** | `https://backend-production-a461.up.railway.app` |
| База даних | **MongoDB на Railway** | рядок підключення у змінній `MONGO_URL` (Railway env) |
| Код | GitHub | публікується через кнопку **"Save to GitHub"** |

**Деплой:** «Save to GitHub» пушить весь репозиторій. Netlify пересобирає фронтенд; Railway пересобирає бекенд (переконайтеся, що ввімкнено auto-deploy з GitHub, інакше запускати редеплой у Railway вручну).

**Netlify redirects (`public/_redirects`):**
```
/blog       → …railway.app/api/blog-render          200
/blog/*     → …railway.app/api/blog-render/:splat    200
/sitemap.xml→ …railway.app/api/seo/sitemap.xml       200
/robots.txt → …railway.app/api/seo/robots.txt        200
/api/*      → …railway.app/api/:splat                200
```
`netlify.toml`: SPA-fallback `/* → /index.html`, кеш статичних ассетів на 1 рік.

---

## 4. Змінні середовища (де що лежить)

> Реальні значення секретів НЕ зберігаються в цій документації. Вони — у `.env` (локально) та в дашбордах Netlify/Railway.

**Backend (`backend/.env` / Railway env):**
| Ключ | Призначення |
|---|---|
| `MONGO_URL` | Рядок підключення до MongoDB (у проді — Railway Mongo) |
| `DB_NAME` | Ім'я БД (`test_database`) |
| `CORS_ORIGINS` | Дозволені джерела (`*`) |
| `EMERGENT_LLM_KEY` | Універсальний ключ для LLM (OpenAI/Claude/Gemini) |
| `ENABLE_TELEGRAM_POLLING` | Вмик./вимк. polling Telegram-бота |

**Frontend (`frontend/.env`):**
| Ключ | Значення |
|---|---|
| `REACT_APP_BACKEND_URL` | базовий URL бекенду (у проді — Railway; у прев'ю — preview URL) |

**Ключі інтеграцій** (Stripe, Infobip, Resend, Telegram, Finix тощо) зберігаються **в БД** (колекція `integration_keys`) і керуються з **Admin → Integrations**, а не в `.env`.

---

## 5. Структура фронтенду (маршрути `app/`)

**71 екран.** Основні:

**Вкладки (`app/(tabs)/`)** — `index` (пошук/бронювання), `services`, `executors` (список Pros), `bookings`, `tasks`, `community` (Blog), `messages`, `dashboard`, `earnings`, `availability` (календар виконавця), `my-profile`, `payment-settings`, `service-area`, `users` (адмін), `settings`, `support-inbox`.

**Окремі екрани:** `login`, `register`, `verify-email`, `verify-phone`, `forgot-password`, `create-task`, `task-detail`, `task-chat`, `executor/[id]`, `service/[id]`, `blog/[id]`, `provider-agreement`, `provider-onboarding`, `provider-requirements`, `identity`, `payout-setup`, `rewards`, `my-ranking`, `notifications`, `notification-settings`, `terms`, `privacy`, `refund-policy`, `pricing`, `how-it-works`, `safety`, `contact`, `help-center`, `about`, `payment-success`/`cancelled`.

**Адмін-екрани:** `users`, `admin-integrations`, `admin-payments`, `admin-payment-stats`, `admin-email`, `admin-sms`, `admin-sms-consents`, `admin-coverage`, `admin-service-area`, `admin-waitlist`, `admin-redemptions`, `admin-support-requests`, `admin-chat`.

**Ключові файли:** `store/authStore.ts` (сесія), `utils/api.ts` (усі API-виклики).

---

## 6. База даних — колекції

| Колекція | Призначення |
|---|---|
| `users` | Користувачі (клієнти, виконавці, адміни) |
| `executor_profiles` | Профілі виконавців (навички, ставка, радіус, координати) |
| `tasks` | Завдання клієнтів |
| `bookings` | Бронювання |
| `offers` | Пропозиції виконавців на завдання |
| `messages` | Чат по завданнях |
| `availability_slots` | Слоти доступності (за конкретними датами) |
| `reviews` | Відгуки |
| `payment_transactions` | Платіжні транзакції |
| `payout_accounts` | Рахунки для виплат |
| `categories` | Категорії послуг |
| `blog_posts` / `blog_comments` / `blog_likes` | Блог (вкл. статті Soro) |
| `notifications` | Сповіщення |
| `points_transactions` / `referrals` / `gift_cards` | Лояльність, реферали, подарункові картки |
| `ranking_adjustments` | Коригування рейтингу виконавців |
| `terms_acceptances` / `provider_agreement_acceptances` / `completion_confirmations` / `sms_consents` | Юридичні згоди (з хешем документа, датою, IP) |
| `email_verifications` / `phone_verifications` / `password_recovery` | Верифікація/відновлення |
| `email_campaigns` / `sms_campaigns` | Розсилки |
| `waitlist` / `support_requests` | Лист очікування, підтримка |
| `integration_keys` / `settings` | Ключі інтеграцій та налаштування додатку |
| `user_sessions` / `sessions` | Сесії |
| `push_subscriptions` / `telegram_link_codes` | Push і прив'язка Telegram |

---

## 7. Зовнішні інтеграції

| Інтеграція | Призначення | Де налаштовується |
|---|---|---|
| **Stripe** | Платежі + **Stripe Identity** (верифікація виконавців) | Admin → Integrations |
| **Finix** | Обробка карткових платежів (Card / Apple Pay / Google Pay) | Admin → Integrations |
| **Infobip** | SMS + верифікація телефону | Admin → Integrations |
| **Resend** | Транзакційні листи (верифікація, сповіщення) | Admin → Integrations |
| **Telegram Bot** | Сповіщення в Telegram | Admin → Integrations |
| **Soro AI** | Автогенеровані SEO-статті блогу через RSS | Admin → Integrations |
| **Emergent LLM Key** | LLM (напр., аналіз фото завдання) | `EMERGENT_LLM_KEY` |

> Примітка: Stripe **приховано** з методів оплати клієнта (за запитом); виплати/Identity працюють окремо.

---

## 8. Автентифікація та безпека

- **JWT** (python-jose), паролі — **bcrypt** (passlib). Токен зберігається у `expo-secure-store`.
- Email/phone-верифікація (коди), відновлення пароля.
- Ролі: `client`, `provider`, `admin`, `moderator`.
- Юридичні згоди фіксуються з версією документа, SHA-256 хешем тексту, датою/часом та IP (E-SIGN / UETA).

---

## 9. Ключові бізнес-модулі

1. **Пошук і бронювання** — пошук виконавців за послугою/локацією, показ доступності на 7 днів наперед.
2. **Онбординг виконавця** — 6 кроків: Service Provider Agreement, Stripe Identity, профіль, ставки, зона, виплати.
3. **Чат по завданню** — клієнт ↔ виконавець ↔ підтримка; стає read-only після відхилення/скасування або повної оплати.
4. **Оплата** — Finix/manual методи; підтвердження виконання + Settlement Agreement/Waiver of Lien.
5. **Блог/SEO** — Soro RSS → серверний HTML на `/blog`, sitemap для Google.
6. **Лояльність** — бали, реферали, подарункові картки, рейтинг виконавців.
7. **Адмін-панель** — користувачі, платежі, розсилки (email/SMS), карта покриття, лист очікування, підтримка, інтеграції.

---

## 10. Локальна конфігурація служб (Emergent preview)

- Backend: `0.0.0.0:8001` (supervisor), усі роути з префіксом `/api`.
- Frontend: `:3000` (supervisor), hot-reload.
- Preview Mongo: `mongodb://localhost:27017`, БД `test_database`.
- Перезапуск: `sudo supervisorctl restart backend|frontend`.

> Прод відрізняється: фронтенд на Netlify, бекенд + Mongo на Railway.
