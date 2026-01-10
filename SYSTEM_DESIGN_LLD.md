# RideSphere - Low Level Design (LLD)

## Table of Contents

1. [User Service LLD](#user-service-lld)
2. [Captain Service LLD](#captain-service-lld)
3. [Ride Service LLD](#ride-service-lld)
4. [API Gateway LLD](#api-gateway-lld)
5. [Database Design](#database-design)
6. [Message Queue Design](#message-queue-design)
7. [Code Patterns & Best Practices](#code-patterns--best-practices)

---

## User Service LLD

### 1. File Structure

```
user/
├── app.js                          # Express app configuration
├── server.js                       # Server entry point
├── db/
│   └── db.js                       # MongoDB connection
├── models/
│   └── user.model.js               # Mongoose User schema
├── controllers/
│   └── user.controller.js          # Business logic
├── routes/
│   └── user.routes.js              # Route definitions
├── middleware/
│   └── auth.middleware.js          # JWT validation
├── service/
│   └── rabbit.js                   # RabbitMQ client
├── .env                            # Environment variables
└── package.json                    # Dependencies
```

### 2. User Model Schema

```javascript
// user/models/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email",
    ],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false, // Don't return password by default
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
userSchema.index({ email: 1 });

module.exports = mongoose.model("user", userSchema);
```

### 3. Controller Implementation

```javascript
// user/controllers/user.controller.js
const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Registration Handler
module.exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000, // 1 hour
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Login Handler
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user with password field
    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000,
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Profile Handler
module.exports.profile = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile retrieved",
      user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Logout Handler
module.exports.logout = async (req, res) => {
  try {
    const token = req.cookies.token;

    // Add token to blacklist (handled by captain service)
    res.clearCookie("token");

    res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
```

### 4. Authentication Middleware

```javascript
// user/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

module.exports.authUser = (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token has expired",
      });
    }
    return res.status(401).json({
      message: "Invalid token",
    });
  }
};
```

### 5. Routes Definition

```javascript
// user/routes/user.routes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.get("/profile", authMiddleware.authUser, userController.profile);
router.post("/logout", authMiddleware.authUser, userController.logout);

module.exports = router;
```

### 6. Server Setup

```javascript
// user/server.js
const app = require("./app");
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
```

---

## Captain Service LLD

### 1. File Structure

```
captain/
├── app.js
├── server.js
├── db/
│   └── db.js
├── models/
│   ├── captain.model.js
│   └── blacklisttoken.model.js
├── controllers/
│   └── captain.controller.js
├── routes/
│   └── captain.routes.js
├── middleware/
│   └── authMiddleWare.js
├── service/
│   └── rabbit.js
├── .env
└── package.json
```

### 2. Captain Model & Blacklist Token Model

```javascript
// captain/models/captain.model.js
const mongoose = require("mongoose");

const captainSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    select: false,
  },
  isAvailable: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

captainSchema.index({ email: 1 });
captainSchema.index({ isAvailable: 1 });

module.exports = mongoose.model("captain", captainSchema);
```

```javascript
// captain/models/blacklisttoken.model.js
const mongoose = require("mongoose");

const blacklistTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // Auto-delete document after 1 hour (3600 seconds)
    index: { expireAfterSeconds: 3600 },
  },
});

module.exports = mongoose.model("blacklisttoken", blacklistTokenSchema);
```

### 3. Captain Controller with Real-time Notifications

```javascript
// captain/controllers/captain.controller.js
const captainModel = require("../models/captain.model");
const blacklistTokenModel = require("../models/blacklisttoken.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { subscribeToQueue } = require("../service/rabbit");

// In-memory storage for pending requests (long polling)
const pendingRequests = [];

module.exports.register = async (req, res) => {
  // Similar to user registration
  try {
    const { name, email, password } = req.body;
    const captain = await captainModel.findOne({ email });

    if (captain) {
      return res.status(400).json({ message: "Captain already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const newCaptain = new captainModel({ name, email, password: hash });

    await newCaptain.save();

    const token = jwt.sign({ id: newCaptain._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token);
    const captainResponse = newCaptain.toObject();
    delete captainResponse.password;

    res.status(201).json({ token, captain: captainResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.login = async (req, res) => {
  // Similar to user login
  try {
    const { email, password } = req.body;
    const captain = await captainModel.findOne({ email }).select("+password");

    if (!captain || !(await bcrypt.compare(password, captain.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: captain._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token);
    const captainResponse = captain.toObject();
    delete captainResponse.password;

    res.status(200).json({ token, captain: captainResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.logout = async (req, res) => {
  try {
    const token = req.cookies.token;

    // Add token to blacklist
    await blacklistTokenModel.create({ token });
    res.clearCookie("token");

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.profile = async (req, res) => {
  try {
    res.status(200).json({ captain: req.captain });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.toggleAvailability = async (req, res) => {
  try {
    const captain = await captainModel.findById(req.captain._id);
    captain.isAvailable = !captain.isAvailable;
    await captain.save();

    res.status(200).json({
      message: `Captain is now ${captain.isAvailable ? "online" : "offline"}`,
      captain,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Long Polling for New Rides
module.exports.waitForNewRide = async (req, res) => {
  try {
    // Set timeout for long polling (30 seconds)
    const timeoutId = req.setTimeout(30000, () => {
      // Remove from pending when timeout occurs
      const index = pendingRequests.indexOf(res);
      if (index > -1) {
        pendingRequests.splice(index, 1);
      }
      res.status(204).end(); // No Content
    });

    // Add response object to pending requests
    pendingRequests.push({ res, timeoutId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Subscribe to new rides from RabbitMQ
subscribeToQueue("new-ride", (data) => {
  try {
    const rideData = JSON.parse(data);

    // Send to all waiting captains
    pendingRequests.forEach((req) => {
      req.res.json({
        message: "New ride available",
        ride: rideData,
      });
      clearTimeout(req.timeoutId);
    });

    // Clear pending requests
    pendingRequests.length = 0;
  } catch (error) {
    console.error("Error processing ride notification:", error);
  }
});
```

### 4. Routes

```javascript
// captain/routes/captain.routes.js
const express = require("express");
const router = express.Router();
const captainController = require("../controllers/captain.controller");
const authMiddleware = require("../middleware/authMiddleWare");

router.post("/register", captainController.register);
router.post("/login", captainController.login);
router.get("/profile", authMiddleware.captainAuth, captainController.profile);
router.put(
  "/toggle-availability",
  authMiddleware.captainAuth,
  captainController.toggleAvailability
);
router.get(
  "/wait-for-ride",
  authMiddleware.captainAuth,
  captainController.waitForNewRide
);
router.post("/logout", authMiddleware.captainAuth, captainController.logout);

module.exports = router;
```

---

## Ride Service LLD

### 1. Ride Model

```javascript
// ride/models/ride.model.js
const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "User is required"],
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "captain",
      default: null,
    },
    pickup: {
      type: String,
      required: [true, "Pickup location is required"],
    },
    destination: {
      type: String,
      required: [true, "Destination is required"],
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "started", "completed", "cancelled"],
      default: "requested",
    },
    fare: {
      type: Number,
      default: null,
    },
    distance: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
rideSchema.index({ user: 1, createdAt: -1 });
rideSchema.index({ captain: 1, createdAt: -1 });
rideSchema.index({ status: 1 });
rideSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ride", rideSchema);
```

### 2. Ride Controller

```javascript
// ride/controllers/ride.controller.js
const rideModel = require("../models/ride.model");
const { publishToQueue } = require("../service/rabbit");

module.exports.createRide = async (req, res) => {
  try {
    const { pickup, destination } = req.body;

    // Validate input
    if (!pickup || !destination) {
      return res.status(400).json({
        message: "Pickup and destination are required",
      });
    }

    // Create ride
    const ride = new rideModel({
      user: req.user.id,
      pickup,
      destination,
      status: "requested",
    });

    await ride.save();

    // Publish to RabbitMQ for captains to receive notification
    const rideData = {
      rideId: ride._id,
      userId: ride.user,
      pickup: ride.pickup,
      destination: ride.destination,
      status: ride.status,
      createdAt: ride.createdAt,
    };

    await publishToQueue("new-ride", JSON.stringify(rideData));

    res.status(201).json({
      message: "Ride created and published",
      ride,
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.body;

    // Validate input
    if (!rideId) {
      return res.status(400).json({
        message: "Ride ID is required",
      });
    }

    // Find ride
    const ride = await rideModel.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    // Check if ride is still available
    if (ride.status !== "requested") {
      return res.status(400).json({
        message: `Ride is already ${ride.status}`,
      });
    }

    // Update ride
    ride.captain = req.captain.id;
    ride.status = "accepted";
    await ride.save();

    // Publish ride accepted event
    await publishToQueue(
      "ride-accepted",
      JSON.stringify({
        rideId: ride._id,
        captainId: ride.captain,
        status: "accepted",
      })
    );

    res.status(200).json({
      message: "Ride accepted successfully",
      ride,
    });
  } catch (error) {
    console.error("Accept ride error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports.getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's ride history
    const rides = await rideModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      message: "Ride history retrieved",
      rides,
      count: rides.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

### 3. Routes

```javascript
// ride/routes/ride.routes.js
const express = require("express");
const router = express.Router();
const rideController = require("../controllers/ride.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/create-ride", authMiddleware.userAuth, rideController.createRide);

router.put(
  "/accept-ride",
  authMiddleware.captainAuth,
  rideController.acceptRide
);

router.get("/history", authMiddleware.userAuth, rideController.getRideHistory);

module.exports = router;
```

---

## API Gateway LLD

### 1. Gateway Implementation

```javascript
// gateway/app.js
const express = require("express");
const expressProxy = require("express-http-proxy");
const morgan = require("morgan");
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Proxy configuration
const createProxyOptions = () => ({
  proxyReqPathResolver: (req) => {
    return req.url || "/";
  },
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    let bodyString;

    if (bodyContent && Buffer.isBuffer(bodyContent)) {
      bodyString = bodyContent.toString();
    } else if (
      bodyContent &&
      bodyContent.type === "Buffer" &&
      Array.isArray(bodyContent.data)
    ) {
      bodyString = Buffer.from(bodyContent.data).toString();
    } else {
      bodyString = JSON.stringify(bodyContent || srcReq.body || {});
    }

    return bodyString;
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    let bodyString;
    try {
      if (srcReq.body && Buffer.isBuffer(srcReq.body)) {
        bodyString = srcReq.body.toString();
      } else {
        bodyString = JSON.stringify(srcReq.body || {});
      }
    } catch (e) {
      bodyString = "";
    }

    proxyReqOpts.headers["Content-Type"] = "application/json";
    proxyReqOpts.headers["Content-Length"] = Buffer.byteLength(bodyString);
    return proxyReqOpts;
  },
});

// Route traffic to services
app.use("/user", expressProxy("http://localhost:3001", createProxyOptions()));
app.use(
  "/captain",
  expressProxy("http://localhost:3002", createProxyOptions())
);
app.use("/ride", expressProxy("http://localhost:3003", createProxyOptions()));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Gateway is healthy" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Gateway error:", error);
  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
  });
});

module.exports = app;
```

---

## Database Design

### 1. MongoDB Connection & Pooling

```javascript
// db/db.js (applicable to all services)
const mongoose = require("mongoose");

const connect = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      retryWrites: true,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connect;
```

### 2. Index Strategy

```javascript
// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.captains.createIndex({ email: 1 }, { unique: true });
db.captains.createIndex({ isAvailable: 1 });
db.rides.createIndex({ user: 1, createdAt: -1 });
db.rides.createIndex({ captain: 1, createdAt: -1 });
db.rides.createIndex({ status: 1 });
db.rides.createIndex({ createdAt: -1 });
db.blacklist_tokens.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 } // TTL index
);
```

---

## Message Queue Design

### 1. RabbitMQ Service Wrapper

```javascript
// service/rabbit.js (same across services)
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBIT_URL || "amqp://localhost";
let connection, channel;

async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    console.log("Connected to RabbitMQ");

    // Handle connection errors
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
      setTimeout(connect, 5000); // Reconnect after 5 seconds
    });
  } catch (error) {
    console.error("RabbitMQ connection failed:", error);
    setTimeout(connect, 5000);
  }
}

async function subscribeToQueue(queueName, callback) {
  if (!channel) await connect();

  try {
    await channel.assertQueue(queueName, { durable: true });
    channel.prefetch(1); // Fair dispatch

    channel.consume(queueName, (message) => {
      if (message) {
        callback(message.content.toString());
        channel.ack(message); // Acknowledge after processing
      }
    });

    console.log(`Subscribed to queue: ${queueName}`);
  } catch (error) {
    console.error("Subscribe error:", error);
  }
}

async function publishToQueue(queueName, data) {
  if (!channel) await connect();

  try {
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(
      queueName,
      Buffer.from(data),
      { persistent: true } // Persist message on disk
    );

    console.log(`Published to queue: ${queueName}`);
  } catch (error) {
    console.error("Publish error:", error);
  }
}

module.exports = {
  subscribeToQueue,
  publishToQueue,
  connect,
};
```

---

## Code Patterns & Best Practices

### 1. Error Handling Pattern

```javascript
// Standard error response pattern
try {
  // operation
} catch (error) {
  console.error("Operation error:", error);

  // Determine error type
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  } else if (error.name === "MongoError" && error.code === 11000) {
    return res.status(409).json({ message: "Duplicate entry" });
  } else if (error.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  return res.status(500).json({ message: "Internal server error" });
}
```

### 2. Request Validation Pattern

```javascript
// Input validation helper
const validateRequest = (data, required = []) => {
  const errors = [];

  required.forEach((field) => {
    if (!data[field] || data[field].trim() === "") {
      errors.push(`${field} is required`);
    }
  });

  return errors;
};

// Usage in controller
module.exports.someAction = async (req, res) => {
  const errors = validateRequest(req.body, ["name", "email"]);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  // continue...
};
```

### 3. Response Standardization

```javascript
// Standard response format
const sendResponse = (res, statusCode, message, data = null) => {
  const response = { message };
  if (data) response.data = data;
  res.status(statusCode).json(response);
};

// Usage
sendResponse(res, 200, "Success", { user });
sendResponse(res, 400, "Validation error");
```

### 4. Async/Await Pattern

```javascript
// Proper async error handling
app.post("/endpoint", async (req, res) => {
  try {
    const result = await asyncOperation();
    res.json(result);
  } catch (error) {
    // Handle error
    res.status(500).json({ error: error.message });
  }
});
```

### 5. Environment Configuration

```javascript
// environment/config.js
module.exports = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  rabbitUrl: process.env.RABBIT_URL,
  nodeEnv: process.env.NODE_ENV || "development",
};

// Validation
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
```

---

## Query Optimization Examples

### Efficient Query Patterns

```javascript
// ❌ Inefficient: No indexing, full collection scan
const user = await userModel.find({ email: "test@example.com" });

// ✅ Efficient: Uses email index
const user = await userModel.findOne({ email: "test@example.com" });

// ❌ Inefficient: Returns all fields
const rides = await rideModel.find({ user: userId });

// ✅ Efficient: Select only needed fields
const rides = await rideModel
  .find({ user: userId })
  .select("pickup destination status createdAt")
  .sort({ createdAt: -1 })
  .limit(10);

// ❌ Inefficient: No pagination
const allRides = await rideModel.find({ user: userId });

// ✅ Efficient: With pagination
const page = req.query.page || 1;
const limit = 10;
const rides = await rideModel
  .find({ user: userId })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip((page - 1) * limit);
```

---

## Conclusion

This LLD provides detailed implementation guidelines for each service, including:

- **Schema design** with appropriate indexing
- **Controller logic** with error handling
- **Route definitions** with middleware
- **Message queue patterns** for inter-service communication
- **Best practices** for Node.js/Express development

Each service follows consistent patterns ensuring maintainability, scalability, and reliability.
