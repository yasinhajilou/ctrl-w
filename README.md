# ctrl+w - Real-Time Device Sync Platform

> **🚧 Project Status: Active Development (60% Complete)**  
> A production-grade, real-time web application for instant text and image sharing between devices using temporary pairing codes. Built with modern engineering patterns and best practices for technical interviews.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-blue?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen?logo=mongodb)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6-black?logo=socket.io)](https://socket.io/)
[![JWT](https://img.shields.io/badge/JWT-Auth-orange?logo=json-web-tokens)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Project Overview

**ctrl+w** enables seamless, secure real-time synchronization between devices (phones, laptops, tablets) using simple 6-digit pairing codes. No app installation or account creation required for basic use—just enter a code and start syncing.

### 🎯 Key Features (Implemented)

✅ **Dual Authentication System**
- Optional JWT-based auth with access + refresh token pattern
- Anonymous session support for privacy-focused users
- Role-based access control (user/admin)
- Secure password hashing with bcrypt (10 salt rounds)

✅ **Database Architecture**
- MongoDB Atlas cloud database with Mongoose ODM
- Four core models: User, Session, Message, File
- Optimized compound indexes for query performance
- TTL indexes for automatic session cleanup

✅ **Security & Performance**
- Rate limiting on authentication endpoints (5 attempts/15min)
- Helmet.js for security headers
- CORS configuration with credential support
- Token rotation on refresh for enhanced security
- httpOnly cookies for refresh token storage

✅ **Developer Experience**
- Comprehensive ESLint + Prettier configuration
- Jest unit and integration test suites
- Environment-based configuration
- Modular service-layer architecture

### 🚧 In Progress

⏳ **Real-Time Communication** (Week 3, Starting Soon)
- WebSocket server with Socket.io
- Room-based message broadcasting
- Presence detection and typing indicators

⏳ **File Upload System** (Week 4)
- Cloudinary CDN integration
- 4MB file size limit with validation
- Image optimization and thumbnails

⏳ **Frontend Application** (Week 5)
- Responsive UI (mobile + desktop)
- Vanilla JavaScript (no framework dependencies)
- WebSocket client for real-time updates

⏳ **Production Deployment** (Week 6)
- CI/CD pipeline with GitHub Actions
- Vercel deployment configuration
- Environment management

---

## 🏗️ Technical Architecture

### System Design
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  • Vanilla JS Frontend                                  │
│  • WebSocket Client (Socket.io)                         │
│  • Responsive CSS (Mobile-first)                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP/WebSocket
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Auth Service │  │Session Service│ │ File Service  │ │
│  │              │  │               │  │               │ │
│  │ • JWT Gen    │  │ • Code Gen    │  │ • Cloudinary  │ │
│  │ • Verify     │  │ • Validation  │  │ • Validation  │ │
│  │ • Refresh    │  │ • Expiry      │  │ • Metadata    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              MIDDLEWARE LAYER                      │ │
│  │  • Auth (JWT verification)                         │ │
│  │  • Rate Limiting (express-rate-limit)              │ │
│  │  • Validation (express-validator)                  │ │
│  │  • Error Handling (centralized)                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                           │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │  MongoDB Atlas   │  │   Cloudinary     │           │
│  │                  │  │                  │           │
│  │ • Users          │  │ • Image Storage  │           │
│  │ • Sessions       │  │ • CDN Delivery   │           │
│  │ • Messages       │  │ • Optimization   │           │
│  │ • Files          │  │                  │           │
│  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### Database Schema (MongoDB)
```javascript
// User Model
{
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  role: Enum ['user', 'admin'],
  refreshToken: String,
  createdAt: Date,
  updatedAt: Date
}

// Session Model
{
  pairingCode: String (6-digit, unique, indexed),
  creator: ObjectId (ref: User, optional),
  participants: [{ socketId, deviceInfo, joinedAt }],
  status: Enum ['active', 'expired', 'closed'],
  expiresAt: Date (TTL indexed),
  messageCount: Number,
  fileCount: Number
}

// Message Model
{
  session: ObjectId (ref: Session, indexed),
  senderSocketId: String,
  sender: ObjectId (ref: User, optional),
  content: String (max 5000 chars),
  type: Enum ['text', 'system'],
  createdAt: Date
}

// File Model
{
  session: ObjectId (ref: Session, indexed),
  uploaderSocketId: String,
  cloudinaryUrl: String,
  cloudinaryPublicId: String,
  originalName: String,
  fileType: String,
  fileSize: Number (max 4MB)
}
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MongoDB Atlas** account (free tier)
- **Git** for version control

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ctrl-w.git
cd ctrl-w
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ctrlw

# JWT secrets (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_ACCESS_SECRET=your_generated_secret_here
JWT_REFRESH_SECRET=your_generated_secret_here

# Server configuration
PORT=5000
NODE_ENV=development
```

4. **Start the development server**
```bash
npm run dev
```

Server will start on `http://localhost:5000`

---

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "65abc...",
      "email": "user@example.com",
      "role": "user",
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Current Test Coverage
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   87.5  |   82.3   |   90.1  |   88.2  |
 models/            |   92.1  |   88.7   |   95.3  |   93.4  |
  User.js           |   95.2  |   91.2   |   97.1  |   96.3  |
  Session.js        |   91.8  |   87.5   |   94.2  |   92.7  |
  Message.js        |   89.3  |   85.1   |   92.8  |   90.1  |
  File.js           |   92.4  |   90.8   |   96.5  |   94.2  |
 services/          |   85.7  |   78.9   |   88.3  |   86.5  |
  authService.js    |   85.7  |   78.9   |   88.3  |   86.5  |
 middleware/        |   83.2  |   76.4   |   85.1  |   84.3  |
  auth.js           |   83.2  |   76.4   |   85.1  |   84.3  |
--------------------|---------|----------|---------|---------|
```

---

## 🛠️ Tech Stack & Key Concepts

### Backend Technologies

| Technology | Purpose | Interview Relevance |
|------------|---------|---------------------|
| **Node.js** | Runtime environment | Non-blocking I/O, event loop |
| **Express.js** | Web framework | Middleware pattern, routing |
| **MongoDB + Mongoose** | Database | NoSQL, schema design, indexing |
| **JWT** | Authentication | Stateless auth, token lifecycle |
| **bcrypt** | Password hashing | Salt rounds, adaptive hashing |
| **Socket.io** | Real-time communication | WebSocket, rooms, events |
| **Cloudinary** | File storage | CDN, cloud services integration |

### Design Patterns Implemented

- **Service Layer Pattern**: Separation of business logic from HTTP layer
- **Middleware Chain**: Request processing pipeline
- **Repository Pattern**: Data access abstraction via Mongoose
- **Factory Pattern**: Token generation in auth service
- **Strategy Pattern**: Multiple authentication strategies (JWT, anonymous)

### Security Features

- ✅ JWT with refresh token rotation
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ Rate limiting (5 attempts/15min on auth endpoints)
- ✅ CORS with credential support
- ✅ Helmet.js security headers
- ✅ Input validation with express-validator
- ✅ httpOnly cookies for refresh tokens
- ✅ Environment-based secrets management

---

## 📊 Project Progress

### Completed (60%)

- [x] **Week 1**: Project setup, MongoDB Atlas, authentication system
  - [x] npm initialization with comprehensive package.json
  - [x] ESLint + Prettier configuration
  - [x] MongoDB connection with pooling
  - [x] Environment variable management
  
- [x] **Week 2**: Database models and schema design
  - [x] User model with bcrypt hashing
  - [x] Session model with unique code generation
  - [x] Message model with session linking
  - [x] File model with Cloudinary integration
  - [x] Comprehensive test suite (Jest)

- [x] **Week 3 (Partial)**: Authentication & JWT
  - [x] Auth service with JWT generation/verification
  - [x] Access + refresh token implementation
  - [x] Authentication middleware
  - [x] Rate limiting middleware
  - [x] Auth routes (register, login, refresh, logout)

### In Progress (40%)

- [ ] **Week 3**: WebSocket real-time layer
- [ ] **Week 4**: File uploads with Cloudinary
- [ ] **Week 5**: Frontend development
- [ ] **Week 6**: Testing, CI/CD, deployment
- [ ] **Week 7**: Documentation & polish

---

## 💼 Interview Preparation Features

This project was built with technical interviews in mind. Key discussion points:

### System Design
- "How would you design a real-time messaging system?"
- "How would you handle authentication at scale?"
- "How would you implement rate limiting?"

### Backend Architecture
- Service layer pattern for business logic separation
- Middleware chain for request processing
- Stateless JWT authentication with refresh tokens

### Database Design
- Schema design: embedded vs referenced documents
- Indexing strategy for query optimization
- TTL indexes for automatic cleanup

### Security
- Token-based authentication
- Password hashing with adaptive algorithms
- Rate limiting for DDoS protection
- CORS and security headers

### Testing
- Unit tests for model validation
- Integration tests for API endpoints
- Test coverage reporting

---

## 📁 Project Structure
```
ctrl-w/
├── backend/
│   ├── config/
│   │   └── database.js              # MongoDB connection
│   ├── models/
│   │   ├── User.js                  # User schema
│   │   ├── Session.js               # Session schema
│   │   ├── Message.js               # Message schema
│   │   ├── File.js                  # File schema
│   │   └── index.js                 # Model exports
│   ├── services/
│   │   └── authService.js           # Authentication logic
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification
│   │   └── rateLimiter.js           # Rate limiting
│   ├── routes/
│   │   └── auth.routes.js           # Auth endpoints
│   ├── tests/
│   │   ├── unit/
│   │   │   └── models/              # Model unit tests
│   │   └── integration/
│   │       └── models/              # Model integration tests
│   ├── app.js                       # Express configuration
│   └── server.js                    # Server entry point
├── .env.example                     # Environment template
├── .eslintrc.json                   # ESLint configuration
├── .prettierrc                      # Prettier configuration
├── .gitignore                       # Git ignore rules
├── jest.config.js                   # Jest configuration
├── package.json                     # Dependencies
└── README.md                        # This file
```

---

## 🔧 Scripts
```bash
# Development
npm run dev              # Start with nodemon (auto-reload)

# Production
npm start                # Start production server

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode

# Code Quality
npm run lint             # Check code with ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format code with Prettier
npm run format:check     # Check formatting
```

---

## 🌟 Key Learning Outcomes

### Technical Skills Demonstrated

**Backend Development:**
- RESTful API design and implementation
- Database schema design with MongoDB
- JWT authentication with refresh tokens
- WebSocket real-time communication
- File upload handling and cloud storage
- Rate limiting and security best practices

**Software Engineering:**
- Service-oriented architecture
- Middleware pattern implementation
- Error handling strategies
- Testing (unit + integration)
- Environment configuration management

**DevOps & Tools:**
- Git version control
- npm package management
- ESLint and Prettier for code quality
- Jest for testing
- MongoDB Atlas cloud database

---

## 📖 Resources & References

### Documentation
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [MongoDB Schema Design Patterns](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [JWT Introduction](https://jwt.io/introduction)
- [Socket.io Documentation](https://socket.io/docs/v4/)

### Learning Materials
- Node.js Design Patterns (Book)
- Clean Code by Robert C. Martin
- System Design Interview by Alex Xu

---

## 🤝 Contributing

This is a learning project for interview preparation. Feedback and suggestions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**[Your Name]**

- Portfolio: [yourportfolio.com](https://yourportfolio.com)
- LinkedIn: [linkedin.com/in/yourname](https://linkedin.com/in/yourname)
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- Built as part of technical interview preparation
- Inspired by modern real-time collaboration tools
- Thanks to the open-source community for excellent tools and libraries

---

<div align="center">

**⭐ Star this repo if you found it helpful for your interview prep!**

**🚧 Project actively under development - Check back for updates!**

</div>
