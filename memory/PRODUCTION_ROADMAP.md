# HandyCl → Production Readiness Plan (TaskRabbit-level)

> Аналіз: 2026-01, після логіну в admin / client / provider акаунти на `hendyhub.netlify.app`.

## 🟢 Що вже зроблено за останню сесію
- Adminка категорій: повний CRUD (create/edit/delete/activate-deactivate/remove cover image)
- Стиснення фото в браузері (≤300 KB → виправлено timeout)
- Auto-fallback на Unsplash для категорій без фото
- Логіка комісії: `client_total = executor_rate × (1 + commission/100)`
- Snapshot pricing у бронюваннях (зміни тарифу не змінюють минулі замовлення)
- Гість бачить landing-hero без bottom-bar
- DB-only категорії з'являються на головній

---

## 🔴 P0 — Блокери продакшену (мають бути до запуску)

### 1. Платежі (Stripe Connect Express)
- Виконавець підключає Stripe-акаунт через onboarding-форму (KYC + банк)
- Клієнт платить → Stripe утримує commission на платформу, решта йде на акаунт виконавця (`transfer_data[destination]`)
- Webhook для обробки `payment_intent.succeeded`, `account.updated`, refund events
- Сторінки: `/provider/stripe-connect`, `/booking/{id}/pay`, `/admin/transactions`

### 2. Marked-up ціни в UI клієнта
- Зараз `client_total` обчислюється тільки при бронюванні
- Треба показувати на: картках послуг, профілях виконавців, попередньому розрахунку
- Endpoint `/api/pricing-preview` уже готовий — потрібно інтегрувати у клієнтський UI

### 3. Provider KYC + Verification
- Завантаження документів (паспорт, ідент. код)
- Background check status (admin manually verifies)
- Поля: `is_verified`, `verification_documents`, `verification_status`
- Без цього клієнти не довіряють платформі

### 4. Email-сповіщення (SendGrid або Resend)
- Підтвердження бронювання → клієнту
- Нове завдання → виконавцю
- Платіж пройшов → обидва
- Password reset (зараз тільки в коді, треба live SMTP)

### 5. Real чат через WebSocket
- Зараз `task-chat.tsx` працює polling (повільно, lag)
- Перехід на FastAPI WebSocket або Socket.IO
- Push-сповіщення про нове повідомлення

### 6. Push-нотифікації
- Web Push API (для веб-користувачів)
- Expo Notifications (для мобільних білдів)
- Critical events: нове завдання, нова оферта, оплата

### 7. Cancellation & Refund Policy
- Бронювання можна скасувати тільки X годин до початку
- Автоматичне утримання cancellation fee
- Admin tool для refund через Stripe

---

## 🟡 P1 — Важливо для зростання

### 8. Public profiles виконавців з SEO
- `/p/{provider-id}` сторінка з фото, рейтингом, відгуками, послугами
- Open Graph meta для шеру в месенджерах
- Sitemap для Google

### 9. Search & Filters
- Full-text search по послугах + назвах виконавців
- Фільтри: ціна, рейтинг, відстань, верифікація
- Sort: relevance / price / rating

### 10. Geo-based discovery
- "Виконавці поряд": пошук по радіусу від адреси клієнта
- MongoDB `2dsphere` index на coordinates (можливо вже є)
- Service area виконавця обмежує куди він може приймати

### 11. Admin dashboard analytics
- Графіки: bookings/day, revenue/month, retention cohorts
- Conversion funnel: visit → search → book → pay → review
- Active providers count, average rating

### 12. Reviews + Photos
- Клієнт може додати 1-5 фото до відгуку
- Сортування виконавців за оцінкою
- Verified reviews badge (тільки від тих хто реально оплатив)

### 13. Insurance / Trust Badge
- TaskRabbit Happiness Pledge style
- "До $XXX гарантії" — символічно, але підвищує конверсію

### 14. Provider tools — Calendar/Availability
- Календар на тиждень/місяць
- Блокування слотів коли зайнятий
- Recurring availability (Mon-Fri 9-18)

### 15. Internationalization (i18n)
- Зараз UA hardcoded. Треба окрема система перекладів (`react-i18next`)
- Auto-detect мови з браузера
- EN + PL + UA мінімум

---

## 🟢 P2 — Polish / Nice-to-have

### 16. Performance
- Code-splitting (lazy load admin panel, bookings list)
- Service worker для offline cache
- Image lazy-loading (`loading="lazy"`)
- Web Vitals: LCP < 2.5s, CLS < 0.1

### 17. Accessibility
- aria-labels на всі кнопки
- Контраст ≥ 4.5:1 (зараз місцями `Привіт, Клієнт` сірим — слабко)
- Keyboard navigation

### 18. Legal pages
- Terms of Service, Privacy Policy, Cookie Policy
- GDPR consent banner для EU користувачів
- DPA (Data Processing Agreement)

### 19. Onboarding tours
- Перший вхід → tooltip-тур по 3-4 кроки
- Admin/Provider/Client різні тури

### 20. Referral program
- Запросити друга → отримати $10 кредит
- Виконавець ділиться посиланням, отримує bonus за приведеного клієнта

---

## 🎯 Рекомендований порядок робіт

**Фаза 1 (1-2 тижні): Платежі + Trust**
1. Stripe Connect Express інтеграція
2. Provider KYC (ID upload + admin verify)
3. Email сповіщення (SendGrid)
4. Display marked-up prices to clients
5. Cancellation policy + admin refund

**Фаза 2 (1 тиждень): Comms**
6. WebSocket чат
7. Push-сповіщення (Web Push)
8. Real-time order updates

**Фаза 3 (1-2 тижні): Growth**
9. Public profiles + SEO
10. Search & filters
11. Reviews with photos
12. Analytics dashboard

**Фаза 4 (Polish):**
13. i18n, legal pages, accessibility, performance

---

## 📊 UX issues помічені під час логіну (швидкі win-и)

| Місце | Проблема | Виправлення |
|---|---|---|
| Client home | "Привіт, Клієнт 👋" замість імені | Підставляти `user.full_name` або `email.split('@')[0]` |
| Provider home | "Ваші завдання на сьогодні" з 0/0/0 | Показати CTA "Знайти перше завдання →" якщо порожньо |
| Admin /services | Категорії і послуги в одній вкладці | OK для MVP, потім розділити на `/admin/categories` і `/admin/services` |
| Категорія без фото | Random Unsplash картинка | Дати адміну "пропонований" набір фото при створенні |
| Mobile: bottom bar | Емодзі 🔍📋 у вкладках | Замінити на чіткі іконки Ionicons |
| Login | Немає "Забули пароль?" | Додати посилання на `/forgot-password` (вже є route) |
