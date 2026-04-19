# 🆕 HandyHub - Нові Функції

## Огляд Нових Можливостей

### 1. 👥 Вибір Виконавця Клієнтом
Клієнти можуть переглядати виконавців з рейтингами та обирати потрібного.

### 2. 📅 Календар Доступності Виконавця
Виконавці встановлюють коли і де вони доступні для роботи.

### 3. 💰 Динамічне Ціноутворення
Виконавець встановлює базову ціну, адмін додає свій відсоток (комісію).

### 4. ⚙️ Керування Функціями Адміном
Адмін може вмикати/вимикати функції через налаштування.

---

## 📋 API Endpoints

### **Календар Доступності**

#### `POST /api/availability`
**Виконавець створює слот доступності**

**Request Body:**
```json
{
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "location": "Київ, Печерський район"
}
```

**Response:**
```json
{
  "slot_id": "slot_abc123",
  "user_id": "user_xyz",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "location": "Київ, Печерський район",
  "is_active": true,
  "created_at": "2024-02-14T10:00:00Z",
  "updated_at": "2024-02-14T10:00:00Z"
}
```

**Notes:**
- `day_of_week`: 0=Понеділок, 1=Вівторок, ..., 6=Неділя
- Час в форматі `HH:MM` (24-годинний формат)

---

#### `GET /api/availability/{user_id}`
**Отримати календар доступності виконавця (публічно)**

**Response:**
```json
{
  "user_id": "user_xyz",
  "slots": [
    {
      "slot_id": "slot_abc123",
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "17:00",
      "location": "Київ, Печерський район",
      "is_active": true
    }
  ]
}
```

---

#### `GET /api/availability`
**Отримати свій календар доступності (потрібна автентифікація)**

---

#### `PUT /api/availability/{slot_id}`
**Оновити слот доступності**

**Request Body:**
```json
{
  "start_time": "10:00",
  "end_time": "18:00",
  "is_active": false
}
```

---

#### `DELETE /api/availability/{slot_id}`
**Видалити слот доступності**

---

### **Ціноутворення**

#### `GET /api/pricing/{executor_id}`
**Отримати фінальну ціну виконавця (з комісією адміна)**

**Response:**
```json
{
  "executor_id": "user_xyz",
  "base_rate": 500.0,
  "final_rate": 575.0,
  "commission_percentage": 15.0,
  "commission_applied": true
}
```

**Пояснення:**
- `base_rate`: Базова ціна виконавця (500 грн/год)
- `commission_percentage`: Комісія адміна (15%)
- `final_rate`: Фінальна ціна для клієнта (500 + 15% = 575 грн/год)
- `commission_applied`: Чи застосовується комісія

---

### **Доступні Виконавці**

#### `GET /api/executors/available`
**Отримати список доступних виконавців з фільтрами**

**Query Parameters:**
- `day_of_week` (optional): День тижня (0-6)
- `location` (optional): Локація (пошук по підстроці)
- `min_rating` (optional): Мінімальний рейтинг

**Examples:**
```bash
# Всі доступні виконавці
GET /api/executors/available

# Доступні у понеділок
GET /api/executors/available?day_of_week=0

# В Києві з рейтингом >= 4.0
GET /api/executors/available?location=Київ&min_rating=4.0
```

**Response:**
```json
{
  "executors": [
    {
      "user_id": "user_xyz",
      "name": "Іван Петренко",
      "email": "ivan@example.com",
      "role": "provider",
      "average_rating": 4.8,
      "total_reviews": 25,
      "profile": {
        "bio": "Досвідчений майстер",
        "skills": ["електрика", "сантехніка"],
        "experience_years": 5,
        "hourly_rate": 500
      },
      "availability": [
        {
          "slot_id": "slot_abc",
          "day_of_week": 1,
          "start_time": "09:00",
          "end_time": "17:00",
          "location": "Київ, Печерський"
        }
      ],
      "pricing": {
        "hourly_rate": 575.0,
        "original_rate": 500.0
      }
    }
  ],
  "total": 1
}
```

**Notes:**
- Якщо функція `allow_client_executor_selection` вимкнена, повертає 403
- Виконавці відсортовані за рейтингом (від найвищого)
- Ціна вже включає комісію адміна

---

### **Налаштування Адміна**

#### `GET /api/admin/settings`
**Отримати налаштування додатку**

**Response:**
```json
{
  "setting_id": "app_settings",
  "stripe_api_key": "sk_test_...",
  "telegram_bot_token": "123456:ABC...",
  "ai_enabled": false,
  "allow_client_executor_selection": true,
  "apply_admin_commission": true,
  "admin_commission_percentage": 15.0,
  "updated_at": "2024-02-14T10:00:00Z"
}
```

---

#### `PUT /api/admin/settings/features`
**Оновити функції та комісію**

**Request Body (всі параметри опціональні):**
```json
{
  "allow_client_executor_selection": true,
  "apply_admin_commission": true,
  "admin_commission_percentage": 15.0
}
```

**Examples:**

**Вимкнути вибір виконавця клієнтом:**
```json
{
  "allow_client_executor_selection": false
}
```

**Встановити комісію 20%:**
```json
{
  "apply_admin_commission": true,
  "admin_commission_percentage": 20.0
}
```

**Вимкнути комісію:**
```json
{
  "apply_admin_commission": false
}
```

---

#### `GET /api/admin/availability/{user_id}`
**Адмін переглядає доступність виконавця**

**Response:**
```json
{
  "executor": {
    "user_id": "user_xyz",
    "name": "Іван Петренко",
    "email": "ivan@example.com",
    "role": "provider"
  },
  "slots": [
    {
      "slot_id": "slot_abc",
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "17:00",
      "location": "Київ",
      "is_active": true
    }
  ]
}
```

---

## 🔄 Сценарії Використання

### **Сценарій 1: Виконавець Налаштовує Доступність**

```bash
# 1. Виконавець встановлює базову ціну в профілі
PUT /api/profile/executor
{
  "hourly_rate": 500
}

# 2. Додає розклад (Понеділок 9:00-17:00)
POST /api/availability
{
  "day_of_week": 0,
  "start_time": "09:00",
  "end_time": "17:00",
  "location": "Київ, Печерський"
}

# 3. Додає Вівторок
POST /api/availability
{
  "day_of_week": 1,
  "start_time": "10:00",
  "end_time": "18:00",
  "location": "Київ, Шевченківський"
}
```

---

### **Сценарій 2: Адмін Встановлює Комісію**

```bash
# 1. Адмін вмикає комісію 15%
PUT /api/admin/settings/features
{
  "apply_admin_commission": true,
  "admin_commission_percentage": 15.0
}

# Тепер:
# - Виконавець отримує: 500 грн/год
# - Клієнт платить: 575 грн/год (500 + 15%)
# - Адмін отримує: 75 грн/год комісії
```

---

### **Сценарій 3: Клієнт Обирає Виконавця**

```bash
# 1. Клієнт переглядає доступних виконавців у вівторок
GET /api/executors/available?day_of_week=1

# 2. Фільтрує по локації
GET /api/executors/available?location=Київ&min_rating=4.0

# 3. Бачить ціну з комісією: 575 грн/год

# 4. Створює букінг з обраним виконавцем
POST /api/bookings
{
  "service_id": "service_123",
  "provider_id": "user_xyz",  # Обраний виконавець
  "booking_date": "2024-02-20",
  "booking_time": "10:00"
}
```

---

### **Сценарій 4: Адмін Вимикає Вибір Виконавця**

```bash
# 1. Адмін вимикає функцію
PUT /api/admin/settings/features
{
  "allow_client_executor_selection": false
}

# 2. Тепер клієнти НЕ можуть викликати:
GET /api/executors/available
# Повертає: 403 "Client executor selection is disabled by admin"

# 3. Адмін вручну призначає виконавців для завдань
```

---

### **Сценарій 5: Адмін Керує Доступністю Виконавця**

```bash
# 1. Адмін переглядає доступність виконавця
GET /api/admin/availability/user_xyz

# 2. Адмін оновлює слот виконавця
PUT /api/availability/slot_abc123
{
  "is_active": false  # Деактивує слот
}

# 3. Або видаляє слот
DELETE /api/availability/slot_abc123
```

---

## 💡 Поради по Використанню

### **Для Виконавців:**
1. ✅ Встановіть базову ціну в профілі (`hourly_rate`)
2. ✅ Додайте розклад доступності на тиждень
3. ✅ Вказуйте точні локації роботи
4. ✅ Оновлюйте доступність щотижня

### **Для Клієнтів:**
1. ✅ Використовуйте фільтри для пошуку виконавців
2. ✅ Перевіряйте рейтинг та відгуки
3. ✅ Зверніть увагу на доступність виконавця
4. ✅ Ціна вже включає комісію - це фінальна ціна

### **Для Адміна:**
1. ✅ Встановіть комісію один раз
2. ✅ Контролюйте чи ввімкнена функція вибору виконавця
3. ✅ Переглядайте доступність виконавців
4. ✅ Можете оновлювати/видаляти слоти виконавців

---

## 🔢 Формула Розрахунку Ціни

```
Фінальна ціна = Базова ціна + (Базова ціна × Комісія% / 100)

Приклад:
- Базова ціна: 500 грн/год
- Комісія: 15%
- Фінальна ціна: 500 + (500 × 15 / 100) = 575 грн/год
```

**Розподіл:**
- Виконавець отримує: 500 грн
- Платформа (адмін) отримує: 75 грн
- Клієнт платить: 575 грн

---

## 🎯 Налаштування за Замовчуванням

При першому запуску:
```json
{
  "allow_client_executor_selection": true,
  "apply_admin_commission": false,
  "admin_commission_percentage": 0.0
}
```

**Рекомендовані налаштування:**
- **Комісія:** 10-20% (стандарт для платформ)
- **Вибір виконавця:** Увімкнено (краща користувацька експірієнс)

---

## 📊 База Даних Collections

### `availability_slots`
```javascript
{
  slot_id: "slot_abc123",
  user_id: "user_xyz",
  day_of_week: 1,
  start_time: "09:00",
  end_time: "17:00",
  location: "Київ, Печерський",
  is_active: true,
  created_at: ISODate("2024-02-14T10:00:00Z"),
  updated_at: ISODate("2024-02-14T10:00:00Z")
}
```

### `settings` (оновлено)
```javascript
{
  setting_id: "app_settings",
  // ... інші налаштування
  allow_client_executor_selection: true,
  apply_admin_commission: true,
  admin_commission_percentage: 15.0
}
```

---

## ✅ Готово!

Всі нові функції реалізовані і готові до використання!

**Backend Endpoints:**
- ✅ Календар доступності (CRUD)
- ✅ Динамічне ціноутворення
- ✅ Фільтрація виконавців
- ✅ Адмін налаштування features

**Тепер потрібно:**
1. Оновити Frontend (React Native)
2. Додати UI для календаря доступності
3. Додати екран вибору виконавця
4. Адмін панель для налаштувань

---

**Створено для HandyHub 🛠️**
