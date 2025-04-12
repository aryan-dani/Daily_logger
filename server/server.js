/** @format */
require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session); // Keep for sessions for now
const path = require("path");
const bcrypt = require("bcryptjs"); // Keep for password comparison during login
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose"); // Import Mongoose

// Import Mongoose Models
const User = require("./models/User");
const Log = require("./models/Log");

// Define the data directory path (still needed for sessions if using FileStore)
const dataDir = process.env.DATA_DIR || __dirname;
console.log(`Using data directory: ${dataDir}`);
const sessionDir = path.join(dataDir, "sessions"); // Define session storage path

// Ensure session directory exists (if using FileStore)
// const fs = require('fs'); // Re-require if needed only for directory check
// if (!fs.existsSync(sessionDir)) {
//   try {
//     fs.mkdirSync(sessionDir, { recursive: true });
//     console.log(`Created session directory: ${sessionDir}`);
//   } catch (err) {
//     console.error(`Error creating session directory ${sessionDir}:`, err);
//     process.exit(1);
//   }
// }

// --- Connect to MongoDB ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("FATAL ERROR: MONGODB_URI environment variable is not set.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true, // No longer needed in Mongoose 6+
    // useFindAndModify: false // No longer needed in Mongoose 6+
  })
  .then(() => console.log("MongoDB Connected successfully."))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
// --- End MongoDB Connection ---

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust the Render proxy
app.set("trust proxy", 1);

// Load email config from environment variables
let emailConfig = {
  enabled: process.env.EMAIL_ENABLED === "true",
  transport: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  },
  options: {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
  },
};

// Basic validation for email config
if (emailConfig.enabled) {
  if (
    !emailConfig.transport.host ||
    !emailConfig.transport.auth.user ||
    !emailConfig.transport.auth.pass ||
    !emailConfig.options.from ||
    !emailConfig.options.to
  ) {
    console.warn(
      "Email is enabled, but some environment variables (EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM, EMAIL_TO) are missing."
    );
    // Optionally disable email if config is incomplete
    // emailConfig.enabled = false;
  } else {
    console.log(
      "Email configuration loaded successfully from environment variables."
    );
  }
} else {
  console.log(
    "Email notifications are disabled (EMAIL_ENABLED is not 'true')."
  );
}

// Middleware
app.use(express.static(path.join(__dirname, "..")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS for development
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://aryan-dani.github.io",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // Allow cookies to be sent with requests
  })
);

// Session configuration - Use FileStore (or switch to connect-mongo later if preferred)
app.use(
  session({
    store: new FileStore({
      // Keep FileStore for now
      path: sessionDir,
      ttl: 86400,
      retries: 0,
      logFn: function (msg) {
        /* Optional logging */
      },
    }),
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      // Use 'none' for cross-site requests (e.g., GitHub Pages -> Render),
      // requires secure: true. Use 'lax' locally.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true, // Prevent client-side JS access
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Helper function for logging (can keep or remove if not needed)
function logToFile(message, data = {}) {
  // This function wrote to logs.json, which is ignored.
  // You might want to replace this with a more robust logging library (like Winston)
  // or remove it if console logging is sufficient.
  console.log(`[${new Date().toISOString()}] ${message}`, data);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    // Optional: You could fetch the user from DB here to ensure they still exist
    // const user = await User.findById(req.session.userId);
    // if (!user) { /* Handle error */ }
    // req.user = user; // Attach user to request
    return next();
  }
  logToFile("Unauthorized access attempt", { path: req.path, ip: req.ip });
  // Redirect to login for browser requests, return JSON for API requests
  if (req.accepts("html")) {
    // Assuming you have a login page route or static file
    // return res.redirect('/login.html'); // Or your login route
    // For now, just send 401 for simplicity as frontend handles redirect
    return res.status(401).send("Unauthorized. Please log in.");
  } else {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// --- API Routes ---

// Login Route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  logToFile("Login attempt", { username });

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    // Find user by username (case-insensitive)
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      logToFile("Login failed: User not found", { username });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logToFile("Login failed: Incorrect password", { username });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Regenerate session to prevent fixation
    req.session.regenerate((err) => {
      if (err) {
        logToFile("Session regeneration error", {
          username,
          error: err.message,
        });
        return res
          .status(500)
          .json({ error: "Login failed. Please try again." });
      }

      // Store user ID in session
      req.session.userId = user._id;
      req.session.username = user.username; // Store username for convenience

      logToFile("Login successful", {
        username: user.username,
        userId: user._id,
      });
      res.json({ success: true, username: user.username });
    });
  } catch (err) {
    logToFile("Login error", { username, error: err.message });
    res.status(500).json({ error: "Server error during login" });
  }
});

// Logout Route
app.get("/api/logout", (req, res) => {
  if (req.session) {
    const username = req.session.username;
    req.session.destroy((err) => {
      if (err) {
        logToFile("Logout error", { username, error: err.message });
        return res
          .status(500)
          .json({ error: "Could not log out, please try again." });
      } else {
        logToFile("Logout successful", { username });
        // Clear the cookie on the client side
        res.clearCookie("connect.sid"); // Use the name of your session cookie if different
        return res.json({ success: true });
      }
    });
  } else {
    // If no session exists, logout is effectively successful
    return res.json({ success: true });
  }
});

// Get current user status
app.get("/api/user", (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// --- Log Routes (Protected) ---

// GET all logs for the logged-in user
app.get("/api/logs", isAuthenticated, async (req, res) => {
  try {
    const userLogs = await Log.find({ userId: req.session.userId }).sort({
      timestamp: -1,
    }); // Sort newest first
    res.json(userLogs);
  } catch (err) {
    logToFile("Error fetching logs", {
      userId: req.session.userId,
      error: err.message,
    });
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// POST a new log for the logged-in user
app.post("/api/logs", isAuthenticated, async (req, res) => {
  const { title, category, content, importance } = req.body;

  if (!title || !category || !content || importance === undefined) {
    return res.status(400).json({ error: "Missing required log fields" });
  }

  try {
    const newLog = new Log({
      userId: req.session.userId,
      title,
      category,
      content,
      importance: parseInt(importance, 10),
      // timestamp is defaulted by schema
    });

    const savedLog = await newLog.save();
    logToFile("Log entry created", {
      userId: req.session.userId,
      logId: savedLog._id,
    });
    res.status(201).json(savedLog); // Return the saved log with its ID and timestamp
  } catch (err) {
    logToFile("Error creating log", {
      userId: req.session.userId,
      error: err.message,
      body: req.body,
    });
    res.status(500).json({ error: "Failed to save log entry" });
  }
});

// PUT (update) an existing log
app.put("/api/logs/:id", isAuthenticated, async (req, res) => {
  const { title, category, content, importance } = req.body;
  const logId = req.params.id;

  if (!title || !category || !content || importance === undefined) {
    return res
      .status(400)
      .json({ error: "Missing required log fields for update" });
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: "Invalid log ID format" });
  }

  try {
    const updatedLogData = {
      title,
      category,
      content,
      importance: parseInt(importance, 10),
      // Do NOT update userId or timestamp here generally
    };

    // Find the log by ID and ensure it belongs to the current user
    const updatedLog = await Log.findOneAndUpdate(
      { _id: logId, userId: req.session.userId }, // Condition: Match ID and User ID
      updatedLogData,
      { new: true } // Return the updated document
    );

    if (!updatedLog) {
      // If null, either log doesn't exist or doesn't belong to the user
      logToFile("Log update failed: Not found or unauthorized", {
        userId: req.session.userId,
        logId,
      });
      return res
        .status(404)
        .json({
          error: "Log entry not found or you don't have permission to edit it.",
        });
    }

    logToFile("Log entry updated", { userId: req.session.userId, logId });
    res.json(updatedLog);
  } catch (err) {
    logToFile("Error updating log", {
      userId: req.session.userId,
      logId,
      error: err.message,
    });
    res.status(500).json({ error: "Failed to update log entry" });
  }
});

// DELETE a log entry
app.delete("/api/logs/:id", isAuthenticated, async (req, res) => {
  const logId = req.params.id;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    return res.status(400).json({ error: "Invalid log ID format" });
  }

  try {
    // Find the log by ID and ensure it belongs to the current user before deleting
    const result = await Log.findOneAndDelete({
      _id: logId,
      userId: req.session.userId,
    });

    if (!result) {
      // If null, either log doesn't exist or doesn't belong to the user
      logToFile("Log deletion failed: Not found or unauthorized", {
        userId: req.session.userId,
        logId,
      });
      return res
        .status(404)
        .json({
          error:
            "Log entry not found or you don't have permission to delete it.",
        });
    }

    logToFile("Log entry deleted", { userId: req.session.userId, logId });
    res.status(200).json({ success: true, message: "Log entry deleted" }); // Send 200 OK or 204 No Content
  } catch (err) {
    logToFile("Error deleting log", {
      userId: req.session.userId,
      logId,
      error: err.message,
    });
    res.status(500).json({ error: "Failed to delete log entry" });
  }
});

// --- Email Routes (Keep as is for now) ---
// GET email status
app.get("/api/status", (req, res) => {
  // ... (keep existing email status logic) ...
});

// POST test email
app.post("/api/test-email", isAuthenticated, async (req, res) => {
  // ... (keep existing test email logic) ...
});

// --- Serve Frontend Routes ---
// Serve login page explicitly
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "login.html"));
});

// Serve main app page (index.html) only if authenticated
app.get("/", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});
// Fallback for root if not authenticated (redirect to login)
app.get("/", (req, res) => {
  if (!req.session || !req.session.userId) {
    res.redirect("/login.html");
  } else {
    // Should have been caught by isAuthenticated, but as a safeguard
    res.sendFile(path.join(__dirname, "..", "index.html"));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logToFile("Server started", { port: PORT });
});

// Optional: Add default user creation logic if DB is empty (run once)
async function createDefaultUserIfNone() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("No users found. Creating default admin user...");
      const defaultAdmin = new User({
        username: "admin",
        password: "admin", // Password will be hashed by pre-save hook
        email: "admin@example.com",
        role: "admin",
      });
      await defaultAdmin.save();
      console.log(
        "Default admin user created (username: admin, password: admin)"
      );
    }
  } catch (error) {
    console.error("Error creating default user:", error);
  }
}

// Call this after MongoDB connection is established
mongoose.connection.once("open", () => {
  createDefaultUserIfNone();
});
