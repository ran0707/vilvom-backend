# Vilvom Backend - NestJS Microservices

A comprehensive backend system for the Vilvom Tea Plantation Management Application built with NestJS microservices architecture.

## 🏗️ Architecture Overview

This backend consists of several microservices:

- **API Gateway** (Port: 5000) - Main entry point, handles routing and authentication
- **Auth Service** (Port: 3001) - User authentication, OTP verification, JWT management
- **User Service** (Port: 3002) - User profile management, location services
- **Pest Service** (Port: 3003) - AI-powered pest detection, recommendations
- **Drone Service** (Port: 3004) - Drone service requests, operator management
- **Weather Service** (Port: 3005) - Weather data integration, forecasting
- **Order Service** (Port: 3006) - Order management, tracking, payments
- **Notification Service** (Port: 3007) - Push notifications, SMS, email alerts

## 🚀 Quick Start

### Prerequisites

- Node.js v20+ 
- MongoDB Atlas account
- Redis (optional, for caching)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your MongoDB connection string and other configurations.

4. **Start the development server:**
   ```bash
   npm run start:dev
   ```

   The API Gateway will be running on http://localhost:5000

## 📊 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/api/health

## 🔧 Available Scripts

```bash
# Development
npm run start:dev          # Start API Gateway in watch mode
npm run start:auth         # Start Auth Service in watch mode
npm run start:user         # Start User Service in watch mode
npm run start:pest         # Start Pest Service in watch mode
npm run start:drone        # Start Drone Service in watch mode

# Production
npm run build              # Build all services
npm run start:prod         # Start in production mode

# Testing
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage

# Linting
npm run lint               # Lint and fix code
```

## 🔐 Security Features

- **JWT Authentication** with configurable expiration
- **Rate Limiting** (100 requests per minute, 5 auth attempts per minute)
- **Input Validation** with class-validator
- **Helmet** for security headers
- **CORS** configuration
- **Password Hashing** with bcrypt (12 rounds)
- **Device Binding** for enhanced security
- **OTP-based Authentication** with expiration and attempt limits

## 📱 Mobile App Integration

The backend is specifically designed for your React Native Vilvom application with endpoints that match your frontend requirements:

### Authentication Flow
- `/api/auth/request-otp` - Send OTP to phone number
- `/api/auth/verify-otp` - Verify OTP and login/register
- `/api/auth/login-otp` - Request OTP for existing users
- `/api/auth/password-status` - Check password policy compliance

### Pest Detection
- `/api/pest/detect` - Upload image for AI pest detection
- `/api/pest/detections` - Get user's detection history
- `/api/pest/recommendations` - Get pest management advice
- `/api/pest/nearby` - Find pest patterns in the area

### Drone Services
- `/api/drone/services` - Get available drone services
- `/api/drone/request` - Book drone service
- `/api/drone/time-slots` - Get available booking slots

### Weather Integration
- `/api/weather/current` - Current weather data
- `/api/weather/forecast` - 7-day weather forecast
- `/api/weather/alerts` - Weather-based farming alerts

## 🗄️ Database Schema

### MongoDB Collections:

**Users Collection:**
- Authentication data (phone, password, device info)
- Profile information (name, email, location, bio)
- Security settings (device binding, password policy)

**PestDetections Collection:**
- AI detection results (pest name, confidence, bounding box)
- User-provided data (symptoms, location, images)
- Treatment recommendations (biological, chemical, mechanical)
- Chat history for expert consultation

**DroneRequests Collection:**
- Service bookings (type, date, time, location)
- Farm details (area, crop type, requirements)
- Communication logs and status updates
- Service ratings and feedback

**Orders Collection:**
- Product orders and tracking
- Payment information
- Delivery status and history

**Notifications Collection:**
- Push notification history
- Delivery status and analytics

## 🌐 External API Integrations

- **Weather API** - Real-time weather data and forecasts
- **SMS Service** - OTP delivery and notifications
- **Firebase FCM** - Push notifications
- **Payment Gateway** - Order payment processing (ready for integration)
- **Email Service** - SMTP-based notifications

## 📊 Monitoring & Analytics

- **Health Checks** - Service availability monitoring
- **Request Logging** - Comprehensive API request logging
- **Error Tracking** - Structured error handling and reporting
- **Performance Metrics** - Response time and throughput tracking

## 🔄 Development Workflow

1. **Local Development:**
   ```bash
   npm run start:dev
   ```

2. **Testing Changes:**
   ```bash
   npm run test
   npm run lint
   ```

3. **Building for Production:**
   ```bash
   npm run build
   npm run start:prod
   ```

## 📈 Scaling Considerations

The microservices architecture allows for:
- **Individual Service Scaling** - Scale services based on demand
- **Load Balancing** - Distribute requests across service instances
- **Database Sharding** - Distribute data across multiple databases
- **Caching Strategy** - Redis integration for improved performance

## 🔍 Troubleshooting

### Common Issues:

1. **MongoDB Connection Error:**
   - Verify your DATABASE_URL in .env
   - Check MongoDB Atlas network access settings
   - Ensure IP whitelist includes your server IP

2. **JWT Token Issues:**
   - Verify JWT_SECRET is set in .env
   - Check token expiration settings
   - Ensure proper Bearer token format in requests

3. **OTP Not Received:**
   - Check SMS service configuration
   - Verify phone number format
   - Check rate limiting settings

## 📞 Support

For questions or issues:
- Check the API documentation at `/api/docs`
- Review the health check endpoint at `/api/health`
- Enable debug logging by setting `LOG_LEVEL=debug` in .env

## 🚦 API Status Codes

- `200` - Success
- `201` - Created successfully
- `400` - Bad request (validation errors)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `429` - Too many requests (rate limited)
- `500` - Internal server error

Your React Native app can handle these responses appropriately for the best user experience.

---

**Built for Vilvom Tea Plantation Management System** 🍃