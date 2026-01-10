# RideSphere - Ride Sharing Microservices Platform

<p align="center">
  <strong>A scalable, distributed ride-sharing application built with microservices architecture, real-time communication, and asynchronous message queuing.</strong>
</p>

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Running the Application](#running-the-application)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [Communication Patterns](#communication-patterns)
11. [Deployment](#deployment)
12. [Contributing](#contributing)

---

## 🎯 Overview

**RideSphere** is a modern ride-sharing platform that implements a **microservices architecture** with independent services for user management, captain (driver) management, and ride coordination. The system uses an **API Gateway** pattern for request routing, **RabbitMQ** for asynchronous communication, **MongoDB** for data persistence, and **JWT** for authentication.

The architecture enables:

- **Scalability**: Each microservice can be scaled independently
- **Resilience**: Failure of one service doesn't cascade to others
- **Decoupling**: Services communicate through message queues
- **Real-time Updates**: Long polling for ride notifications
- **Security**: JWT-based authentication and password hashing with bcrypt

---

## ✨ Features

### User Features

- User registration and authentication
- Secure password storage with bcrypt hashing
- JWT-based session management
- Profile management
- Ride request creation

### Captain (Driver) Features

- Captain registration and authentication
- Availability toggle (online/offline status)
- Real-time ride notifications via long polling
- Accept/reject ride requests
- JWT-based session management

### Ride Management

- Ride request creation by users
- Ride acceptance by available captains
- Real-time notification system via RabbitMQ
- Ride status tracking (requested → accepted → started → completed)
- Persistent ride history

### System Features

- **API Gateway** for unified routing
- **Asynchronous Communication** via RabbitMQ
- **Token Blacklisting** for secure logout
- **Request Logging** with Morgan
- **Error Handling** across all services
- **Database Connection Pooling**

---

## 🏗️ Architecture

### High-Level Architecture (HLD)

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│             API Gateway (Port 3000)                          │
│  - Request Routing & Forwarding                             │
│  - Request/Response Logging                                 │
│  - Header Management                                        │
└──┬─────────────┬─────────────┬──────────────────────────────┘
   │             │             │
   ▼             ▼             ▼
┌────────┐  ┌────────┐   ┌────────┐
│ User   │  │Captain │   │  Ride  │
│Service │  │Service │   │Service │
│(3001)  │  │(3002)  │   │ (3003) │
└───┬────┘  └───┬────┘   └───┬────┘
    │          │            │
    └──────────┼────────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Message Queue      │
    │   (RabbitMQ)        │
    │  - new-ride queue   │
    │  - event publishing │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Database           │
    │  (MongoDB)          │
    │  - users            │
    │  - captains         │
    │  - rides            │
    │  - blacklist_tokens │
    └─────────────────────┘
```

### Service Responsibilities

| Service             | Port | Responsibility                                           |
| ------------------- | ---- | -------------------------------------------------------- |
| **User Service**    | 3001 | User authentication, registration, profile management    |
| **Captain Service** | 3002 | Captain authentication, availability, ride notifications |
| **Ride Service**    | 3003 | Ride creation, acceptance, status management             |
| **API Gateway**     | 3000 | Request routing, logging, unified entry point            |

---

## 🛠️ Tech Stack

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - REST API framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **RabbitMQ** - Message broker (asynchronous communication)
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **amqplib** - RabbitMQ client library
- **express-http-proxy** - API Gateway routing
- **Morgan** - HTTP request logger
- **dotenv** - Environment variable management

### Infrastructure

- **Docker** (optional for containerization)
- **MongoDB Atlas** or local MongoDB instance

---

## 📁 Project Structure

```
RideSphere/
├── gateway/                      # API Gateway Service
│   ├── app.js                   # Express app setup
│   ├── package.json
│   └── server.js
│
├── user/                        # User Microservice
│   ├── app.js
│   ├── server.js
│   ├── db/
│   │   └── db.js               # MongoDB connection
│   ├── models/
│   │   └── user.model.js        # User schema
│   ├── controllers/
│   │   └── user.controller.js   # User logic
│   ├── routes/
│   │   └── user.routes.js       # User endpoints
│   ├── middleware/
│   │   └── auth.middleware.js   # Authentication
│   ├── service/
│   │   └── rabbit.js            # RabbitMQ client
│   └── package.json
│
├── captain/                     # Captain Microservice
│   ├── app.js
│   ├── server.js
│   ├── db/
│   │   └── db.js
│   ├── models/
│   │   ├── captain.model.js     # Captain schema
│   │   └── blacklisttoken.model.js
│   ├── controllers/
│   │   └── captain.controller.js
│   ├── routes/
│   │   └── captain.routes.js
│   ├── middleware/
│   │   └── authMiddleWare.js
│   ├── service/
│   │   └── rabbit.js
│   └── package.json
│
├── ride/                        # Ride Microservice
│   ├── app.js
│   ├── server.js
│   ├── db/
│   │   └── db.js
│   ├── models/
│   │   └── ride.model.js        # Ride schema
│   ├── controllers/
│   │   └── ride.controller.js
│   ├── routes/
│   │   └── ride.routes.js
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── service/
│   │   └── rabbit.js
│   └── package.json
│
├── backend-check/              # Load testing & health checks
│   ├── app.js
│   ├── gateway.service.js
│   ├── stress.service.js
│   └── test/
│       ├── package.json
│       └── test.js
│
├── .env.example               # Environment variables template
└── README.md                  # This file
```

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v14+)
- **npm** or **yarn**
- **MongoDB** (local or Atlas)
- **RabbitMQ** server running

### 1. Clone the Repository

```bash
git clone https://github.com/Pranjal360Agarwal/RideSphere.git
cd RideSphere
```

### 2. Environment Configuration

Create a `.env` file in each service directory with the following variables:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ridesphere?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# RabbitMQ Configuration
RABBIT_URL=amqp://guest:guest@localhost:5672

# Service Ports (optional, if overriding defaults)
PORT=3001  # for user service
PORT=3002  # for captain service
PORT=3003  # for ride service
```

### 3. Install Dependencies

```bash
# Install gateway dependencies
cd gateway && npm install && cd ..

# Install user service dependencies
cd user && npm install && cd ..

# Install captain service dependencies
cd captain && npm install && cd ..

# Install ride service dependencies
cd ride && npm install && cd ..
```

### 4. MongoDB Setup

If using MongoDB Atlas:

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user and whitelist your IP
3. Update `MONGO_URI` in `.env` files

If using local MongoDB:

```bash
# Start MongoDB service
mongod
```

### 5. RabbitMQ Setup

```bash
# Using Docker (recommended)
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Or install locally: https://www.rabbitmq.com/download.html
```

---

## 📱 Running the Application

### Option 1: Manual Startup (Development)

Terminal 1 - Start User Service:

```bash
cd user && npm start
```

Terminal 2 - Start Captain Service:

```bash
cd captain && npm start
```

Terminal 3 - Start Ride Service:

```bash
cd ride && npm start
```

Terminal 4 - Start API Gateway:

```bash
cd gateway && npm start
```

### Option 2: Using PM2 (Production-like)

```bash
npm install -g pm2

# Start all services
pm2 start gateway/server.js --name "gateway" --env production
pm2 start user/server.js --name "user-service" --env production
pm2 start captain/server.js --name "captain-service" --env production
pm2 start ride/server.js --name "ride-service" --env production

# Monitor
pm2 monit

# View logs
pm2 logs
```

### Option 3: Using Docker Compose (Recommended for Production)

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: ridesphere

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"

  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production

  user-service:
    build: ./user
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - mongodb
      - rabbitmq

  captain-service:
    build: ./captain
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    depends_on:
      - mongodb
      - rabbitmq

  ride-service:
    build: ./ride
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
    depends_on:
      - mongodb
      - rabbitmq
```

Run with:

```bash
docker-compose up -d
```

---

## 🔗 API Endpoints

### User Service (via Gateway: `/user`)

| Method | Endpoint    | Description       | Auth |
| ------ | ----------- | ----------------- | ---- |
| POST   | `/register` | User registration | ❌   |
| POST   | `/login`    | User login        | ❌   |
| GET    | `/profile`  | Get user profile  | ✅   |
| POST   | `/logout`   | User logout       | ✅   |

### Captain Service (via Gateway: `/captain`)

| Method | Endpoint               | Description                  | Auth |
| ------ | ---------------------- | ---------------------------- | ---- |
| POST   | `/register`            | Captain registration         | ❌   |
| POST   | `/login`               | Captain login                | ❌   |
| GET    | `/profile`             | Get captain profile          | ✅   |
| POST   | `/logout`              | Captain logout               | ✅   |
| PUT    | `/toggle-availability` | Toggle online/offline status | ✅   |
| GET    | `/wait-for-ride`       | Long polling for new rides   | ✅   |

### Ride Service (via Gateway: `/ride`)

| Method | Endpoint       | Description               | Auth         |
| ------ | -------------- | ------------------------- | ------------ |
| POST   | `/create-ride` | Create a new ride request | ✅ (User)    |
| PUT    | `/accept-ride` | Accept a ride request     | ✅ (Captain) |

---

## 💾 Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Captains Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  isAvailable: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### Rides Collection

```javascript
{
  _id: ObjectId,
  user: ObjectId (reference to User),
  captain: ObjectId (reference to Captain),
  pickup: String,
  destination: String,
  status: String (enum: ["requested", "accepted", "started", "completed"]),
  createdAt: Date,
  updatedAt: Date
}
```

### Blacklisted Tokens Collection

```javascript
{
  _id: ObjectId,
  token: String,
  createdAt: Date
}
```

---

## 📨 Communication Patterns

### 1. Synchronous Communication

- **REST APIs** between gateway and services
- Request-response pattern for immediate operations

### 2. Asynchronous Communication (RabbitMQ)

#### New Ride Queue (`new-ride`)

- **Publisher**: Ride Service (when ride is created)
- **Subscribers**: Captain Service (all connected captains receive notifications)
- **Purpose**: Real-time notifications for available captains

**Flow**:

```
User creates ride → Ride Service → Publish to "new-ride" queue
                                 → All captains receive notification
```

#### Captain Availability

- Captains subscribe to ride notifications only when `isAvailable = true`
- Long polling mechanism with 30-second timeout

---

## 🔐 Security Features

### Authentication & Authorization

- **JWT Tokens**: 1-hour expiration for secure sessions
- **Token Blacklisting**: Logout invalidates tokens in database
- **Password Hashing**: bcrypt with 10 salt rounds
- **Middleware Protection**: `authMiddleware` validates JWT on protected routes

### Data Protection

- **Environment Variables**: Sensitive data in `.env` files
- **Cookie-based Storage**: Tokens stored as HTTP-only cookies
- **MongoDB Connection**: SSL/TLS with MongoDB Atlas

### API Security

- **CORS**: Cross-origin handling via express
- **Input Validation**: Express middleware for JSON/URL-encoded data
- **Error Handling**: Generic error messages to prevent information disclosure

---

## 📊 Performance Optimization

### Scalability Strategies

1. **Horizontal Scaling**: Deploy multiple instances of each service
2. **Load Balancing**: Use Nginx or cloud load balancers
3. **Database Indexing**: Ensure indexes on `email`, `user`, `captain` fields
4. **Connection Pooling**: MongoDB connection pooling via Mongoose
5. **Caching**: Implement Redis for frequently accessed data (future enhancement)

### Monitoring & Logging

- **Morgan**: HTTP request logging
- **PM2**: Process monitoring and auto-restart
- **RabbitMQ Management UI**: Queue monitoring (http://localhost:15672)

---

## 🐛 Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB is running
mongod --version

# For Atlas, verify connection string and IP whitelist
```

### RabbitMQ Connection Failures

```bash
# Check RabbitMQ service
sudo systemctl status rabbitmq-server

# Or with Docker
docker logs rabbitmq
```

### JWT Token Errors

- Ensure `JWT_SECRET` is set consistently across all services
- Check token expiration (1 hour default)
- Verify token is being sent in Authorization header

### Service Not Starting

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Check for port conflicts
lsof -i :3000  # Check if port 3000 is in use
```

---

## 📝 Example Workflows

### Workflow 1: User Registration & Login

```
1. User POST /user/register with email & password
2. Password hashed with bcrypt
3. User document created in MongoDB
4. JWT token generated & stored in cookie
5. User can now create rides
```

### Workflow 2: Captain Availability & Ride Notifications

```
1. Captain logs in (POST /captain/login)
2. Captain toggles availability (PUT /captain/toggle-availability)
3. Captain calls GET /captain/wait-for-ride (long polling)
4. Request held for 30 seconds waiting for ride notifications
5. When user creates ride:
   - Ride Service publishes to "new-ride" queue
   - Captain Service receives message
   - All waiting captains get notified with ride data
```

### Workflow 3: Create & Accept Ride

```
1. User creates ride (POST /ride/create-ride)
   - Ride stored in MongoDB with status "requested"
   - Message published to "new-ride" queue
2. Available captains receive notification
3. Captain accepts ride (PUT /ride/accept-ride)
   - Ride status updated to "accepted"
   - Captain ID assigned to ride
4. Ride in progress
```

---

## 🚀 Deployment

### AWS Deployment

1. **EC2 Instances**: One per service + Gateway
2. **RDS**: MongoDB Atlas alternative
3. **SQS/SNS**: Alternative to RabbitMQ
4. **Load Balancer**: ALB for API Gateway
5. **CloudWatch**: Monitoring and logging

### Heroku Deployment

```bash
# Create Heroku apps
heroku create ridesphere-gateway
heroku create ridesphere-user
heroku create ridesphere-captain
heroku create ridesphere-ride

# Add MongoDB Atlas add-on
heroku addons:create mongolab:sandbox --app ridesphere-user

# Deploy
git push heroku main
```

### GCP/Google Cloud

1. **Cloud Run**: Serverless deployment
2. **Cloud SQL**: Managed MongoDB alternative
3. **Pub/Sub**: Alternative to RabbitMQ
4. **Cloud Load Balancing**: Request routing

---

## 📚 API Usage Examples

### cURL Examples

**User Registration**:

```bash
curl -X POST http://localhost:3000/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**User Login**:

```bash
curl -X POST http://localhost:3000/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Create Ride**:

```bash
curl -X POST http://localhost:3000/ride/create-ride \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "pickup": "123 Main St",
    "destination": "456 Oak Ave"
  }'
```

**Accept Ride**:

```bash
curl -X PUT http://localhost:3000/ride/accept-ride \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "rideId": "ride_object_id"
  }'
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Use consistent indentation (2 spaces)
- Follow Node.js naming conventions
- Add comments for complex logic
- Test all endpoints before submitting PR

---

## 👨‍💻 Author

**Pranjal Agarwal**

- GitHub: [@Pranjal360Agarwal](https://github.com/Pranjal360Agarwal)
- Project: [RideSphere](https://github.com/Pranjal360Agarwal/RideSphere)

---

## 📞 Support

For issues, questions, or suggestions, please:

1. Check existing [GitHub Issues](https://github.com/Pranjal360Agarwal/RideSphere/issues)
2. Create a new issue with detailed information
3. Include error messages, environment details, and steps to reproduce

---

## 🎯 Future Enhancements

- [ ] Real-time location tracking with WebSockets
- [ ] Payment integration (Stripe/Razorpay)
- [ ] Rating and review system
- [ ] Ride sharing/pooling
- [ ] Admin dashboard
- [ ] Mobile app (React Native)
- [ ] AI-based driver matching
- [ ] Real-time notifications (Push notifications)
- [ ] Analytics dashboard
- [ ] Caching layer (Redis)

---

## Contact

If you have any questions or feedback, please feel free to contact me at [pranjal360agarwal@gmail.com](mailto:pranjal360agarwal@gmail.com). You can also connect with me on [LinkedIn](https://www.linkedin.com/in/pranjalagarwal99/) or [Twitter](https://twitter.com/Pranjal12393385). Thank you for visiting my project!

# Made with ❤ by [Pranjal Agarwal](https://github.com/Pranjal360Agarwal).
