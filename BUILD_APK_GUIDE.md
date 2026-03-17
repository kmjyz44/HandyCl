# 📱 Створення APK для HandyHub

## Важливо розуміти! 🔄

### **Один APK = Всі ролі**

Це **ОДИН** додаток для всіх користувачів:
- 👤 Клієнти
- 🔧 Виконавці  
- 👨‍💼 Адміністратори

**Всі встановлюють один і той же APK файл!**

### Як це працює:

1. **Реєстрація з роллю:**
   ```
   Новий користувач → Обирає роль → Реєструється
   ```

2. **Інтерфейс залежить від ролі:**
   - Клієнт бачить: сервіси, букінги, виконавців
   - Виконавець бачить: завдання, портфоліо, повідомлення
   - Адмін бачить: дашборд, всі користувачі, налаштування

3. **Синхронізація в реальному часі:**
   ```
   📱 Всі додатки
       ↓
   🌐 Backend API (один для всіх)
       ↓
   💾 MongoDB (одна база даних)
   ```

**Приклад потоку:**
```
1. Клієнт створює завдання "Ремонт" → зберігається в DB
2. Адмін призначає виконавця → оновлюється в DB
3. Виконавець отримує нотифікацію → бачить в додатку
4. Виконавець закриває завдання → оновлюється в DB
5. Клієнт залишає відгук → зберігається в DB
6. Всі бачать оновлення в реальному часі!
```

---

## 🛠️ Створення APK

### Метод 1: Через EAS Build (Рекомендовано)

#### Крок 1: Створіть Expo акаунт
```bash
# Якщо немає акаунту:
npx expo register

# Або увійдіть:
npx expo login
```

#### Крок 2: Налаштуйте проект
```bash
cd /app/frontend
eas build:configure
```

#### Крок 3: Створіть APK
```bash
# Production APK (для користувачів)
eas build --platform android --profile production

# Preview APK (для тестування)
eas build --platform android --profile preview
```

**Результат:**
- Процес займе 15-20 хвилин
- Ви отримаєте посилання на завантаження APK
- Один APK файл для всіх користувачів!

---

### Метод 2: Локальна збірка (без EAS)

#### Вимоги:
- Java JDK 17
- Android SDK
- Gradle

#### Крок 1: Встановіть Android SDK
```bash
# Ubuntu/Debian
sudo apt install -y openjdk-17-jdk android-sdk
```

#### Крок 2: Експортуйте для Android
```bash
cd /app/frontend
npx expo export --platform android
```

#### Крок 3: Створіть APK
```bash
cd android
./gradlew assembleRelease

# APK буде в:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 Що буде в APK?

**Включено:**
- ✅ Весь код додатку
- ✅ Всі екрани для всіх ролей
- ✅ Підключення до Backend API
- ✅ Налаштування синхронізації
- ✅ Telegram інтеграція
- ✅ Stripe платежі

**НЕ включено (працює через API):**
- ❌ База даних (MongoDB на сервері)
- ❌ Backend логіка (FastAPI на сервері)
- ❌ Дані користувачів (на сервері)

---

## 📲 Розповсюдження APK

### Для тестування (внутрішні користувачі):

1. **Завантажте APK** з EAS Build
2. **Поділіться файлом** через:
   - Google Drive
   - Dropbox
   - Telegram
   - Email
   - USB кабель

3. **Інструкція для користувачів:**
   ```
   1. Завантажте HandyHub.apk
   2. Відкрийте файл
   3. Дозвольте установку з невідомих джерел
   4. Встановіть додаток
   5. Зареєструйтесь і оберіть роль!
   ```

### Для production (всі користувачі):

**Опція 1: Google Play Store**
```bash
# Створіть AAB (Android App Bundle)
eas build --platform android --profile production

# Завантажте в Play Console
# https://play.google.com/console
```

**Опція 2: Прямий download з вашого сайту**
- Розмістіть APK на своєму сервері
- Створіть landing page з кнопкою "Завантажити"
- Користувачі скачують напряму

---

## 🔐 Безпека і Оновлення

### Підписання APK:
```bash
# EAS автоматично підписує APK
# Або створіть власний keystore:
keytool -genkey -v -keystore handyhub.keystore \
  -alias handyhub -keyalg RSA -keysize 2048 -validity 10000
```

### Over-the-Air (OTA) оновлення:
```bash
# Публікуйте оновлення без перевипуску APK
eas update --branch production --message "New features"

# Користувачі отримають оновлення автоматично!
```

---

## 🎯 Тестові Акаунти

**Для демонстрації і тестування створіть:**

**👨‍💼 Адмін:**
- Email: admin@handyhub.com
- Password: admin123
- Роль: Admin

**👤 Клієнт:**
- Email: client@example.com
- Password: client123
- Роль: Client

**🔧 Виконавець:**
- Email: provider@example.com
- Password: provider123
- Роль: Provider

**Всі ці акаунти вже створені в базі даних!**

---

## 🧪 Тестування APK

### Перед розповсюдженням:

1. **Встановіть на реальний пристрій:**
   ```bash
   adb install handyhub.apk
   ```

2. **Протестуйте всі ролі:**
   - Увійдіть як клієнт → створіть букінг
   - Увійдіть як адмін → призначте виконавця
   - Увійдіть як виконавець → прийміть завдання

3. **Перевірте синхронізацію:**
   - Встановіть на 2-3 пристрої
   - Зробіть зміни на одному
   - Переконайтесь що зміни відображаються на інших

---

## 🔧 Troubleshooting

### APK не встановлюється:
```
Рішення: Увімкніть "Unknown Sources" в налаштуваннях
Settings → Security → Unknown Sources
```

### Дані не синхронізуються:
```
Перевірте:
1. Backend працює: curl https://handyhub-preview-1.preview.emergentagent.com/api/test
2. Інтернет на пристрої
3. URL в app.json правильний
```

### Помилка "Network Error":
```
Перевірте:
1. Backend URL: https://handyhub-preview-1.preview.emergentagent.com
2. CORS налаштовано на backend
3. SSL сертифікат валідний
```

---

## 📊 Моніторинг Користувачів

### Як побачити хто підключений:

**Через Backend API:**
```bash
# Всі користувачі
curl https://handyhub-preview-1.preview.emergentagent.com/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# По ролях
curl "https://handyhub-preview-1.preview.emergentagent.com/api/admin/users?role=provider"
```

**Через MongoDB:**
```bash
mongo handyhub
db.users.find({}, {name: 1, email: 1, role: 1})
```

---

## ✅ Чек-лист перед публікацією

- [ ] Backend працює і доступний
- [ ] MongoDB налаштована
- [ ] Stripe API key додано
- [ ] Telegram bot налаштований
- [ ] APK протестовано на реальних пристроях
- [ ] Всі ролі працюють коректно
- [ ] Синхронізація працює між пристроями
- [ ] Нотифікації працюють
- [ ] Платежі працюють (Stripe)
- [ ] SSL сертифікат валідний

---

## 🎉 Готово!

**Тепер у вас є:**
- ✅ Один APK для всіх ролей
- ✅ Синхронізація в реальному часі
- ✅ Backend API
- ✅ База даних MongoDB

**Розповсюджуйте HandyHub APK своїм користувачам! 🚀**

---

**Питання?** Перевірте:
- `/app/DEPLOYMENT_GUIDE.md` - Повна інструкція
- `/app/README.md` - Загальна документація
- Backend логи: `sudo journalctl -u handyhub-backend -f`
