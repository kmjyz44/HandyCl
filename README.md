# HandyHub - Handyman & Cleaning Services App

## 📱 Overview
A comprehensive mobile application for booking handyman and cleaning services, built with React Native (Expo), FastAPI, and MongoDB.

**App Name:** HandyHub - Your hub for all handyman and cleaning needs!

## ✨ Features

### For Clients:
- Browse and search services by category
- Book services with date/time selection
- Track booking status in real-time
- Secure Stripe payments
- In-app messaging with providers
- Rate and review service providers

### For Service Providers:
- View and manage assigned tasks
- Accept/decline task assignments
- Update task status in real-time
- Receive Telegram notifications for new tasks
- Access booking details and client information

### For Administrators:
- Complete dashboard with business metrics
- Manage services (CRUD operations)
- Assign tasks to providers
- Configure API keys (Stripe, Telegram)
- Manage user roles
- View all bookings and transactions

## 🛠️ Tech Stack

### Frontend:
- **React Native** with Expo Router
- **TypeScript** for type safety
- **Zustand** for state management
- **Expo Vector Icons** for icons
- **React Native Gesture Handler** for smooth interactions
- **Expo Secure Store** for secure token storage

### Backend:
- **FastAPI** (Python)
- **MongoDB** with Motor (async driver)
- **bcrypt** for password hashing
- **emergentintegrations** for Stripe & Telegram

### Integrations:
- **Stripe** - Payment processing
- **Telegram Bot API** - Notifications
- **Emergent OAuth** - Google authentication
- **Emergent LLM Key** - AI features (optional)

## 📁 Project Structure

```
/app
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── .env              # Environment variables
│   └── requirements.txt  # Python dependencies
│
├── frontend/
│   ├── app/              # Expo Router screens
│   │   ├── (tabs)/      # Tab navigation screens
│   │   ├── index.tsx    # Root screen
│   │   ├── login.tsx    # Login screen
│   │   └── register.tsx # Registration screen
│   ├── store/           # Zustand stores
│   ├── utils/           # API client & helpers
│   └── package.json     # Node dependencies
```

## 🚀 Getting Started

### Test Accounts:

#### Admin:
- Email: `admin@handyhub.com`
- Password: `admin123`

#### Client:
- Email: `client@example.com`  
- Password: `client123`

#### Provider:
- Email: `provider@example.com`
- Password: `provider123`

### API Endpoints:

**Authentication:**
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user
- POST `/api/auth/logout` - Logout

**Services:**
- GET `/api/services` - List all services
- POST `/api/services` - Create service (Admin only)
- PUT `/api/services/{id}` - Update service (Admin only)
- DELETE `/api/services/{id}` - Delete service (Admin only)

**Bookings:**
- GET `/api/bookings` - Get user's bookings
- POST `/api/bookings` - Create booking
- PUT `/api/bookings/{id}` - Update booking status

**Tasks:**
- GET `/api/tasks` - Get provider's tasks
- POST `/api/tasks` - Create task (Admin only)
- PUT `/api/tasks/{id}` - Update task status

**Payments:**
- POST `/api/payments/checkout` - Create Stripe checkout
- GET `/api/payments/status/{session_id}` - Check payment status

**Admin:**
- GET `/api/admin/dashboard` - Dashboard statistics
- GET `/api/admin/users` - List users
- GET `/api/settings` - Get settings
- PUT `/api/settings` - Update API keys

## 🔑 Configuration

### Admin Panel Settings:

1. **Stripe Integration:**
   - Navigate to Settings tab (Admin only)
   - Enter your Stripe API key (get from https://dashboard.stripe.com/apikeys)
   - Save settings

2. **Telegram Notifications:**
   - Create a bot via @BotFather on Telegram
   - Copy the bot token
   - Enter token in Settings tab
   - Users can add their chat ID in Profile

## 🎨 Service Categories

### Handyman Services:
- **Plumbing** - Leak repairs, pipe installation
- **Electrical** - Wiring, outlets, lighting
- **Carpentry** - Furniture assembly, woodwork
- **Painting** - Interior & exterior painting

### Cleaning Services:
- **Regular Cleaning** - Standard house cleaning
- **Deep Cleaning** - Comprehensive deep clean
- **Move-Out Cleaning** - Complete property cleaning

## 🔐 Authentication Options

1. **Email/Password** - Traditional authentication
2. **Google OAuth** - Via Emergent authentication (coming soon for mobile)

## 📊 Database Schema

**Collections:**
- `users` - User accounts with roles
- `services` - Available services
- `bookings` - Service bookings
- `tasks` - Tasks assigned to providers
- `messages` - In-app messages
- `reviews` - Service ratings
- `settings` - App configuration
- `user_sessions` - Authentication sessions
- `payment_transactions` - Payment records

## 🌍 Deployment

The app is deployed on Emergent platform:
- **Web Preview:** https://handyhub-preview-1.preview.emergentagent.com
- **Backend API:** https://handyhub-preview-1.preview.emergentagent.com/api
- **Mobile:** Scan QR code in Expo Go app

## 📝 Future Enhancements

- [ ] Real-time in-app chat (Socket.io)
- [ ] Push notifications (Expo Notifications)
- [ ] Provider availability calendar
- [ ] Service area/location filtering
- [ ] Multi-language support (Spanish, Ukrainian)
- [ ] AI-powered service recommendations
- [ ] Provider earnings dashboard
- [ ] Advanced search & filters
- [ ] Photo upload for bookings
- [ ] Recurring bookings
- [ ] Promo codes & discounts

## 📞 Support

For issues or questions:
- Check API documentation at `/api/docs`
- Review backend logs: `sudo supervisorctl tail backend stderr`
- Review frontend logs: `sudo supervisorctl tail expo stdout`

## 🔒 Security Notes

- All passwords are hashed with bcrypt
- API keys stored securely in database
- Session tokens expire after 7 days
- CORS enabled for all origins (configure for production)
- HTTPS recommended for production deployment

---

**Built with ❤️ using Emergent AI Development Platform**
