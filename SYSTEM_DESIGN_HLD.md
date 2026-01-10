# RideSphere - High Level Design (HLD)

## Executive Summary

RideSphere is a distributed ride-sharing platform built on a **microservices architecture** that separates concerns into distinct, independently scalable services. The system uses **API Gateway pattern** for routing, **message queues** for asynchronous communication, and **MongoDB** for data persistence.

---

## 1. System Overview

### Vision

Create a scalable, resilient ride-sharing platform where users can request rides and captains can accept them in real-time using a modern distributed architecture.

### Key Design Principles

- **Separation of Concerns**: Each microservice has a single responsibility
- **Scalability**: Services can scale independently based on demand
- **Resilience**: Failure isolation prevents cascading failures
- **Loose Coupling**: Asynchronous communication via message queues
- **Maintainability**: Clear service boundaries and communication contracts

---

## 2. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     Client Layer                               │
│  (Mobile Apps, Web Browsers, Third-party Integrations)         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼ HTTP(S)
        ┌────────────────────────────┐
        │     API Gateway            │
        │  - Request Routing         │
        │  - Load Balancing          │
        │  - Request/Response Logging│
        │  - Rate Limiting (future)  │
        └────┬─────────┬─────────┬───┘
             │         │         │
        ┌────▼──┐  ┌───▼───┐  ┌─▼─────┐
        │  User │  │Captain│  │ Ride  │
        │Service│  │Service│  │Service│
        └───┬───┘  └───┬───┘  └───┬───┘
            │          │          │
            └──────────┼──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Message Queue      │
            │   (RabbitMQ)        │
            │  Topics/Queues:     │
            │  - new-ride         │
            │  - ride-accepted    │
            │  - ride-completed   │
            └────────────┬────────┘
                         │
            ┌────────────▼─────────────┐
            │  Data Persistence Layer  │
            │       (MongoDB)          │
            │  Collections:            │
            │  - users                 │
            │  - captains              │
            │  - rides                 │
            │  - blacklist_tokens      │
            └──────────────────────────┘
```

---

## 3. Service Architecture

### 3.1 API Gateway

**Purpose**: Single entry point for all client requests

**Responsibilities**:

- Route requests to appropriate microservices
- Request/response logging
- Header management and transformation
- Rate limiting (future)
- API versioning (future)

**Routing Rules**:

```
/user/*      → User Service (port 3001)
/captain/*   → Captain Service (port 3002)
/ride/*      → Ride Service (port 3003)
```

**Technology**: Express.js with `express-http-proxy`

**Scalability**: Stateless - can run multiple instances behind load balancer

---

### 3.2 User Service

**Purpose**: Manage user accounts and authentication

**Key Responsibilities**:

- User registration and validation
- User login/logout
- Password hashing and verification
- User profile management
- JWT token generation

**Core Entities**:

- `User` - User account information

**API Endpoints**:

```
POST   /register      - Create new user account
POST   /login         - Authenticate and get JWT token
GET    /profile       - Retrieve user profile (authenticated)
POST   /logout        - Invalidate user session
```

**Technology Stack**:

- Node.js + Express
- MongoDB + Mongoose
- JWT for authentication
- bcrypt for password hashing

**Database Design**:

```javascript
User {
  _id: ObjectId (Primary Key)
  name: String
  email: String (Unique Index)
  password: String (Hashed)
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### 3.3 Captain Service

**Purpose**: Manage driver (captain) accounts and ride availability

**Key Responsibilities**:

- Captain registration and validation
- Captain login/logout
- Availability management (online/offline toggle)
- Long polling for ride notifications
- Authentication of captain actions

**Core Entities**:

- `Captain` - Captain profile and status
- `BlacklistedToken` - Logged out tokens for security

**API Endpoints**:

```
POST   /register              - Captain registration
POST   /login                 - Captain login
GET    /profile               - Get captain profile (authenticated)
PUT    /toggle-availability   - Toggle online/offline status
GET    /wait-for-ride         - Long polling for new rides
POST   /logout                - Captain logout
```

**Technology Stack**:

- Node.js + Express
- MongoDB + Mongoose
- RabbitMQ for ride notifications
- JWT + Token Blacklisting

**Database Design**:

```javascript
Captain {
  _id: ObjectId (Primary Key)
  name: String
  email: String (Unique Index)
  password: String (Hashed)
  isAvailable: Boolean (default: false)
  createdAt: Timestamp
  updatedAt: Timestamp
}

BlacklistedToken {
  _id: ObjectId (Primary Key)
  token: String
  createdAt: Timestamp (TTL Index for auto-deletion)
}
```

**Real-time Communication**:

- Long polling mechanism with 30-second timeout
- Captain calls `/wait-for-ride` and receives new ride notifications
- Subscribed to `new-ride` queue in RabbitMQ

---

### 3.4 Ride Service

**Purpose**: Manage ride requests and lifecycle

**Key Responsibilities**:

- Create new ride requests
- Accept/reject rides
- Update ride status
- Publish ride events to message queue
- Maintain ride history

**Core Entities**:

- `Ride` - Ride request and status information

**API Endpoints**:

```
POST   /create-ride   - Create new ride request (User)
PUT    /accept-ride   - Accept ride request (Captain)
```

**Technology Stack**:

- Node.js + Express
- MongoDB + Mongoose
- RabbitMQ for event publishing
- JWT for authentication

**Database Design**:

```javascript
Ride {
  _id: ObjectId (Primary Key)
  user: ObjectId (Reference to User)
  captain: ObjectId (Reference to Captain, initially null)
  pickup: String
  destination: String
  status: String (enum: ["requested", "accepted", "started", "completed"])
  createdAt: Timestamp (Index for sorting)
  updatedAt: Timestamp
}
```

**Ride Lifecycle**:

```
requested → accepted → started → completed
```

---

## 4. Communication Patterns

### 4.1 Synchronous Communication (REST)

**When Used**:

- Direct request-response needed
- Real-time data required
- Client interaction initiated

**Examples**:

- User registration
- Ride creation
- Profile retrieval

**Advantages**:

- Simple and familiar
- Immediate feedback
- Easier debugging

**Disadvantages**:

- Tight coupling
- Cascading failures possible
- May block operations

---

### 4.2 Asynchronous Communication (Message Queue)

**When Used**:

- Deferred processing acceptable
- Event notification needed
- Decoupled service interaction

**RabbitMQ Queues**:

#### `new-ride` Queue

- **Publisher**: Ride Service (when user creates ride)
- **Subscribers**: Captain Service (all connected captains)
- **Message Format**:
  ```json
  {
    "rideId": "640abc123",
    "userId": "640xyz789",
    "pickup": "123 Main St",
    "destination": "456 Oak Ave",
    "createdAt": "2024-01-15T10:30:00Z"
  }
  ```
- **Processing**: Captain receives notification via long polling

**Advantages**:

- Decoupled services
- Resilient to failures
- Scalable event propagation
- Load balancing through queue

**Disadvantages**:

- Eventual consistency
- Harder to debug
- Additional infrastructure needed

---

## 5. Data Flow Diagrams

### 5.1 User Registration Flow

```
┌──────┐
│Client│
└───┬──┘
    │ POST /user/register
    │ {name, email, password}
    ▼
┌─────────────┐
│ API Gateway │
    └───┬─────┘
        │ Forward to User Service
        ▼
┌───────────────────┐
│  User Service     │
│ 1. Validate input │
│ 2. Hash password  │
│ 3. Create user    │
│ 4. Generate JWT   │
└───┬───────────────┘
    │
    ▼
┌──────────────┐
│   MongoDB    │
│ Save User    │
└──────────────┘
    │
    ▼
┌─────────────────┐
│ Response to API │
│ {token, user}   │
└────────┬────────┘
         │
         ▼
    ┌──────┐
    │Client│
    └──────┘
```

### 5.2 Ride Creation & Captain Notification Flow

```
┌──────┐
│User  │
└───┬──┘
    │ POST /ride/create-ride
    │ {pickup, destination}
    ▼
┌─────────────┐
│ API Gateway │
    └───┬─────┘
        │
        ▼
┌──────────────────┐
│  Ride Service    │
│ 1. Create ride   │
│ 2. Save to DB    │
│ 3. Publish event │
└──┬───────────────┘
   │
   ├──────────────────────┐
   │                      │
   ▼                      ▼
┌─────────┐    ┌────────────────┐
│MongoDB  │    │  RabbitMQ      │
│Save Ride│    │ Publish to     │
│         │    │ new-ride queue │
└─────────┘    └────────┬───────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Captain Service  │
              │ Received Message │
              │ (each captain)   │
              └────┬─────────────┘
                   │
                   ▼ (Long polling)
              ┌──────────┐
              │Captain   │
              │Notified  │
              └──────────┘
```

### 5.3 Ride Acceptance Flow

```
┌────────┐
│Captain │
└───┬────┘
    │ PUT /ride/accept-ride
    │ {rideId}
    ▼
┌─────────────┐
│ API Gateway │
    └───┬─────┘
        │
        ▼
┌────────────────────────┐
│  Ride Service          │
│ 1. Verify ride exists  │
│ 2. Check captain auth  │
│ 3. Update ride status  │
│ 4. Assign captain      │
│ 5. Save to DB          │
└─────┬──────────────────┘
      │
      ▼
┌──────────────┐
│   MongoDB    │
│ Update Ride  │
│ Status       │
└──────────────┘
      │
      ▼
┌──────────────────┐
│  Response OK     │
│ {status, ride}   │
└────────┬─────────┘
         │
         ▼
    ┌────────┐
    │Captain │
    │Confirmed│
    └────────┘
```

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
┌──────────────────────────────────────────────────┐
│         Authentication & Authorization            │
├──────────────────────────────────────────────────┤
│                                                   │
│  1. User/Captain Login                           │
│     ↓                                            │
│  2. Verify credentials (email + password)        │
│     ↓                                            │
│  3. JWT Token Generation                         │
│     ├─ Header: {typ: "JWT", alg: "HS256"}       │
│     ├─ Payload: {id, email, iat, exp}            │
│     └─ Secret: Signed with JWT_SECRET            │
│     ↓                                            │
│  4. Token sent to client (cookie)                │
│     ↓                                            │
│  5. Client includes token in headers             │
│     ↓                                            │
│  6. Middleware validates token                   │
│     ├─ Verify signature                          │
│     ├─ Check expiration                          │
│     └─ Check token blacklist                     │
│     ↓                                            │
│  7. Request proceeds or denied                   │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 6.2 Password Security

- **Hashing Algorithm**: bcrypt with salt rounds = 10
- **Salt Generation**: Automatic per password
- **Comparison**: Timing-safe bcrypt.compare()
- **Never Stored**: Plain passwords never stored in database

### 6.3 Token Management

**JWT Token Structure**:

```
Header.Payload.Signature

Header: {
  "typ": "JWT",
  "alg": "HS256"
}

Payload: {
  "id": "user_id",
  "iat": 1705308600,    // issued at
  "exp": 1705312200     // expires in 1 hour
}
```

**Token Blacklisting**:

- On logout, token added to `BlacklistedToken` collection
- Middleware checks token against blacklist
- Auto-deletion via MongoDB TTL index (matches token expiration)

---

## 7. Scalability Considerations

### 7.1 Horizontal Scaling

**API Gateway**:

- Stateless service, easily scalable
- Deploy multiple instances
- Use load balancer (Nginx, AWS ALB, GCP LB)

**Microservices**:

- Each service independently scalable
- Auto-scale based on CPU/memory metrics
- Use container orchestration (Kubernetes)

**Example Scaling Strategy**:

```
High Load Scenario:
├── User Service: 1 instance → 3 instances
├── Captain Service: 1 instance → 2 instances
├── Ride Service: 1 instance → 4 instances
└── API Gateway: 1 instance → 2 instances
```

### 7.2 Database Optimization

**Indexing Strategy**:

```javascript
// Indexes to create
db.users.createIndex({ email: 1 }); // Login lookups
db.captains.createIndex({ email: 1 }); // Login lookups
db.captains.createIndex({ isAvailable: 1 }); // Find available captains
db.rides.createIndex({ user: 1 }); // User ride history
db.rides.createIndex({ captain: 1 }); // Captain ride history
db.rides.createIndex({ createdAt: -1 }); // Recent rides
db.blacklist_tokens.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 } // Auto-delete after 1 hour
);
```

**Connection Pooling**:

- Mongoose default: 5 connections in pool
- Configurable based on load
- Prevents connection exhaustion

### 7.3 Message Queue Optimization

**RabbitMQ Configuration**:

- Message acknowledgment to prevent loss
- Queue durable for persistence
- Consumer prefetch limit (fair dispatch)
- Dead letter queues for failed messages (future)

---

## 8. Failure Handling & Resilience

### 8.1 Service Failures

**Scenario: Ride Service Down**

- Impact: Users cannot create rides, but other services function
- Recovery:
  - Automated restart (PM2/Kubernetes)
  - Load balancer removes unhealthy instance
  - Queue messages retain ride requests

**Scenario: RabbitMQ Down**

- Impact: Captains don't receive notifications, but sync operations work
- Recovery:
  - RabbitMQ cluster setup (redundancy)
  - Message persistence on disk
  - Automatic connection retry

### 8.2 Database Failures

**MongoDB Replication**:

- Primary-Secondary-Arbiter setup
- Automatic failover
- Eventual consistency guaranteed
- Backup strategy (daily snapshots)

### 8.3 Circuit Breaker Pattern (Future)

```javascript
// Pseudo-code
if (service_failures > threshold) {
  circuit_breaker.open(); // Stop forwarding requests
  // After timeout period
  circuit_breaker.half_open(); // Try one request
  if (success) circuit_breaker.close(); // Resume
}
```

---

## 9. Monitoring & Observability

### 9.1 Logging Strategy

**Request Logging** (Morgan):

```
GET /user/profile 200 45.123 ms - 1234
POST /ride/create-ride 201 156.789 ms - 5678
```

**Application Logging**:

```javascript
console.log("User registered:", userId);
console.error("Database connection failed:", error);
console.warn("Queue message processing delayed");
```

### 9.2 Metrics to Track

**Per Service**:

- Request count and latency
- Error rate and types
- Database query performance
- RabbitMQ queue depth

**System Level**:

- CPU and memory usage
- Network I/O
- Disk space
- Connection counts

### 9.3 Monitoring Tools

- **PM2 Monitoring**: Real-time process metrics
- **Morgan**: HTTP request logging
- **RabbitMQ Management UI**: Queue statistics
- **MongoDB Atlas**: Database metrics
- **Grafana/Prometheus**: (Future) Comprehensive monitoring

---

## 10. Deployment Architecture

### 10.1 Development Environment

```
Developer Machine
├── MongoDB (local or Atlas)
├── RabbitMQ (Docker container)
├── User Service (npm start)
├── Captain Service (npm start)
├── Ride Service (npm start)
└── API Gateway (npm start)
```

### 10.2 Production Environment

```
AWS/GCP/Azure
├── Load Balancer (Nginx/ALB)
│   └── API Gateway (2+ instances)
├── User Service (Auto-scaling group, 2-4 instances)
├── Captain Service (Auto-scaling group, 2-3 instances)
├── Ride Service (Auto-scaling group, 2-6 instances)
├── MongoDB Atlas (Managed, 3-node replica set)
├── RabbitMQ Cluster (3-5 nodes)
├── CloudWatch/Stackdriver (Monitoring)
└── S3/Cloud Storage (Backups)
```

### 10.3 Containerization (Docker)

**Dockerfile Pattern**:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

---

## 11. Performance Benchmarks (Target)

| Metric                    | Target       | Notes                 |
| ------------------------- | ------------ | --------------------- |
| API Response Time         | < 200ms      | 95th percentile       |
| Ride Notification Latency | < 500ms      | From queue to captain |
| Peak Throughput           | 1000 req/sec | Per service           |
| Database Query Latency    | < 50ms       | 99th percentile       |
| System Availability       | 99.9%        | Monthly uptime        |

---

## 12. Future Enhancements

### Phase 2

- WebSocket for real-time updates
- Payment processing integration
- Rating and review system
- Admin dashboard

### Phase 3

- AI-based captain matching
- Ride pooling/sharing
- Multi-language support
- Mobile app (React Native)

### Phase 4

- Advanced analytics
- Machine learning for pricing
- Blockchain for payment settlement
- IoT integration for vehicles

---

## Conclusion

RideSphere's architecture provides a solid foundation for a scalable, resilient ride-sharing platform. The microservices approach with API Gateway pattern ensures services can evolve independently while maintaining system coherence. Asynchronous communication via RabbitMQ decouples critical operations, and MongoDB provides flexible data persistence. This design supports growth from startup MVP to enterprise-scale system.
