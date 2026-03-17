# 📱 HandyHub - Інструкція по Запуску та Деплою

## 🚀 Швидкий Старт (Поточне середовище - Emergent)

### ✅ Що вже запущено:
- ✅ **Backend API**: https://handyhub-preview-1.preview.emergentagent.com/api
- ✅ **MongoDB**: Локально на порту 27017
- ✅ **Frontend (Expo)**: Готовий до запуску

---

## 📱 Варіант 1: Тестування на Android через Expo Go (Найпростіший)

### Крок 1: Встановіть Expo Go на телефон
1. Відкрийте **Google Play Store** на Android телефоні
2. Знайдіть і встановіть додаток **"Expo Go"**
3. Відкрийте Expo Go

### Крок 2: Запустіть Expo сервер (Вже запущено)
Додаток вже працює на:
- **Frontend URL**: https://handyhub-preview-1.preview.emergentagent.com
- **Expo Dev Server**: Перевірте QR код нижче

### Крок 3: Підключіться до додатку
1. **Через QR код**:
   - Відкрийте Expo Go на телефоні
   - Натисніть "Scan QR Code"
   - Скануйте QR код з веб-інтерфейсу Expo

2. **Через URL** (якщо QR не працює):
   - Відкрийте Expo Go
   - Введіть URL: `exp://app-updates-10.preview.emergentagent.com:8081`

### Крок 4: Використовуйте тестові акаунти

**Адмін:**
- Email: `admin@handyhub.com`
- Password: `admin123`

**Клієнт:**
- Email: `client@example.com`
- Password: `client123`

**Виконавець:**
- Email: `provider@example.com`
- Password: `provider123`

---

## 🏗️ Варіант 2: Збірка Standalone Android APK

### Підготовка:

1. **Встановіть EAS CLI** (якщо потрібно):
```bash
npm install -g eas-cli
```

2. **Увійдіть в Expo**:
```bash
eas login
```

3. **Налаштуйте проект**:
```bash
cd /app/frontend
eas build:configure
```

### Створення APK:

```bash
# Development build
eas build --platform android --profile development

# Production build
eas build --platform android --profile production
```

Після збірки (10-20 хвилин) ви отримаєте посилання на завантаження APK файлу.

---

## 🖥️ Варіант 3: Деплой на Власний Сервер

### Вимоги до сервера:
- Ubuntu 20.04 або новіше
- 2GB RAM мінімум
- Node.js 18+
- Python 3.11+
- MongoDB 5.0+
- Nginx

### Крок 1: Підготовка сервера

```bash
# Оновлення системи
sudo apt update && sudo apt upgrade -y

# Встановлення Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Встановлення Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Встановлення MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Встановлення Nginx
sudo apt install -y nginx

# Встановлення Yarn
npm install -g yarn
```

### Крок 2: Завантаження коду

```bash
# Клонуйте репозиторій
cd /home
git clone https://github.com/kmjyz44/HandyHub.git
cd HandyHub

# Або завантажте через SSH/FTP з вашого локального комп'ютера
```

### Крок 3: Налаштування Backend

```bash
cd /home/HandyHub/backend

# Створіть віртуальне середовище
python3.11 -m venv venv
source venv/bin/activate

# Встановіть залежності
pip install -r requirements.txt

# Налаштуйте .env файл
nano .env
```

**Вміст .env:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=handyhub_production
CORS_ORIGINS=*
```

### Крок 4: Налаштування Frontend (Expo)

```bash
cd /home/HandyHub/frontend

# Встановіть залежності
yarn install

# Оновіть app.json - змініть backendUrl
nano app.json
```

**В app.json змініть:**
```json
{
  "expo": {
    "extra": {
      "backendUrl": "https://ваш-домен.com"
    }
  }
}
```

### Крок 5: Налаштування Nginx

```bash
sudo nano /etc/nginx/sites-available/handyhub
```

**Вміст конфігурації:**
```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8001;
    }
}
```

```bash
# Активуйте конфігурацію
sudo ln -s /etc/nginx/sites-available/handyhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Крок 6: Запуск сервісів (Systemd)

**Backend Service:**
```bash
sudo nano /etc/systemd/system/handyhub-backend.service
```

```ini
[Unit]
Description=HandyHub Backend API
After=network.target mongodb.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/HandyHub/backend
Environment="PATH=/home/HandyHub/backend/venv/bin"
ExecStart=/home/HandyHub/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Запустіть backend
sudo systemctl daemon-reload
sudo systemctl start handyhub-backend
sudo systemctl enable handyhub-backend
sudo systemctl status handyhub-backend
```

**Expo Service (для development):**
```bash
sudo nano /etc/systemd/system/handyhub-expo.service
```

```ini
[Unit]
Description=HandyHub Expo Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/HandyHub/frontend
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/yarn start --tunnel
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Запустіть Expo
sudo systemctl daemon-reload
sudo systemctl start handyhub-expo
sudo systemctl enable handyhub-expo
```

### Крок 7: SSL (HTTPS) - Опціонально

```bash
# Встановіть Certbot
sudo apt install -y certbot python3-certbot-nginx

# Отримайте SSL сертифікат
sudo certbot --nginx -d ваш-домен.com

# Автоматичне оновлення
sudo certbot renew --dry-run
```

---

## 📊 Моніторинг та Логи

### Перевірка статусу сервісів:
```bash
# Backend
sudo systemctl status handyhub-backend

# Expo
sudo systemctl status handyhub-expo

# MongoDB
sudo systemctl status mongod

# Nginx
sudo systemctl status nginx
```

### Перегляд логів:
```bash
# Backend logs
sudo journalctl -u handyhub-backend -f

# Expo logs
sudo journalctl -u handyhub-expo -f

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🎯 Варіант 4: Використання Docker (Рекомендовано)

### Створіть docker-compose.yml:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    container_name: handyhub-mongo
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=handyhub

  backend:
    build: ./backend
    container_name: handyhub-backend
    restart: always
    ports:
      - "8001:8001"
    depends_on:
      - mongodb
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=handyhub
      - CORS_ORIGINS=*
    volumes:
      - ./backend:/app

  nginx:
    image: nginx:alpine
    container_name: handyhub-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### Запуск:
```bash
docker-compose up -d
```

---

## 🔧 Налаштування API ключів (В додатку)

Після запуску, увійдіть як адмін і налаштуйте:

1. **Stripe API Key** (для платежів):
   - Отримайте на https://dashboard.stripe.com/apikeys
   - Налаштуйте в Settings → Stripe Integration

2. **Telegram Bot Token** (для нотифікацій):
   - Створіть бота через @BotFather в Telegram
   - Налаштуйте в Settings → Telegram Integration

---

## 📱 Завантаження APK на Android (без Google Play)

### Після збірки APK:

1. **Завантажте APK** з посилання EAS Build
2. **Перенесіть на телефон** через USB або хмару
3. **Увімкніть "Unknown Sources"**:
   - Settings → Security → Unknown Sources (вимкніть)
4. **Встановіть APK**:
   - Відкрийте файл через File Manager
   - Натисніть "Install"

---

## 🆘 Troubleshooting

### Проблема: Expo не підключається

**Рішення:**
```bash
# Перезапустіть Expo з тунелем
cd /app/frontend
npx expo start --tunnel --clear
```

### Проблема: Backend помилки

**Рішення:**
```bash
# Перевірте логи
sudo journalctl -u handyhub-backend -n 100

# Перезапустіть
sudo systemctl restart handyhub-backend
```

### Проблема: MongoDB не працює

**Рішення:**
```bash
# Перевірте статус
sudo systemctl status mongod

# Перезапустіть
sudo systemctl restart mongod

# Перевірте з'єднання
mongo --eval "db.adminCommand('ping')"
```

---

## 📞 Корисні команди

```bash
# Перезапуск всіх сервісів
sudo systemctl restart handyhub-backend mongod nginx

# Очистка MongoDB (ОБЕРЕЖНО!)
mongo handyhub --eval "db.dropDatabase()"

# Оновлення коду
cd /home/HandyHub
git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && yarn install
sudo systemctl restart handyhub-backend handyhub-expo
```

---

## ✅ Чек-лист перед запуском

- [ ] MongoDB встановлено і працює
- [ ] Python 3.11+ встановлено
- [ ] Node.js 18+ встановлено
- [ ] Backend залежності встановлені
- [ ] Frontend залежності встановлені
- [ ] .env файли налаштовані
- [ ] Nginx налаштовано (якщо використовуєте)
- [ ] Stripe API key налаштовано
- [ ] Telegram bot token налаштовано (опціонально)
- [ ] Тестові акаунти створені

---

## 🎉 Готово!

Тепер ваш HandyHub додаток запущений і готовий до використання!

**Наступні кроки:**
1. Створіть нових користувачів (клієнтів та виконавців)
2. Додайте сервіси через адмін панель
3. Виконавці заповнюють свої портфоліо
4. Клієнти можуть бронювати послуги

**Підтримка:**
- Перевірте логи при виникненні проблем
- Оновлюйте код регулярно: `git pull`
- Робіть бекапи MongoDB регулярно

---

**Створено для HandyHub - Your hub for handyman and cleaning services! 🛠️🧹**
