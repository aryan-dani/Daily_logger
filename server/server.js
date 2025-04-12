/** @format */

const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session); // Import session-file-store
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const nodemailer = require("nodemailer");

// Define the data directory path
const dataDir = process.env.DATA_DIR || __dirname;
console.log(`Using data directory: ${dataDir}`);
const sessionDir = path.join(dataDir, "sessions"); // Define session storage path

// Ensure data directory and session directory exist
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  } catch (err) {
    console.error(`Error creating data directory ${dataDir}:`, err);
    // Exit or handle error appropriately if data directory is critical
    process.exit(1);
  }
}
if (!fs.existsSync(sessionDir)) {
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log(`Created session directory: ${sessionDir}`);
  } catch (err) {
    console.error(`Error creating session directory ${sessionDir}:`, err);
    process.exit(1);
  }
}

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

// Session configuration - Use FileStore
app.use(
  session({
    store: new FileStore({
      path: sessionDir, // Path to store session files
      ttl: 86400, // Session TTL in seconds (e.g., 24 hours)
      logFn: function (msg) {
        console.log("[SessionFileStore]", msg);
      }, // Optional logging
    }),
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      // Use 'none' for cross-site requests (e.g., GitHub Pages -> Render),
      // requires secure: true. Use 'lax' locally.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true, // Prevent client-side JS access
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Helper function for logging
function logToFile(message, data = {}) {
  const logEntry = {
    timestamp: new Date(),
    message,
    ...data,
  };

  const logsPath = path.join(dataDir, "logs.json"); // Use dataDir

  // Read existing logs
  let logs = [];
  try {
    if (fs.existsSync(logsPath)) {
      const logsData = fs.readFileSync(logsPath, "utf8");
      logs = JSON.parse(logsData);
    }
  } catch (err) {
    console.error("Error reading logs file:", err);
  }

  // Add new log entry
  logs.push(logEntry);

  // Keep only the last 1000 entries to avoid file growing too large
  if (logs.length > 1000) {
    logs = logs.slice(logs.length - 1000);
  }

  // Write back to file
  try {
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to logs file:", err);
  }

  // Also log to console
  console.log(`[${logEntry.timestamp}] ${message}`, data);
}

// Load user database
const usersDbPath = path.join(dataDir, "users.json"); // Use dataDir
let users = [];

try {
  // Check if users.json exists
  if (fs.existsSync(usersDbPath)) {
    // Load existing users
    users = JSON.parse(fs.readFileSync(usersDbPath, "utf8"));
    logToFile("Loaded existing users database", { count: users.length });
  } else {
    // Create default users only if the file doesn't exist
    const defaultUsers = [
      {
        id: 1,
        username: "admin",
        password: bcrypt.hashSync("admin", 10), // Consider stronger default password or prompt
        email: "admin@example.com",
        role: "admin",
      },
      {
        id: 2,
        username: "srushti",
        password: bcrypt.hashSync("paneer", 10), // Consider stronger default password or prompt
        email: "srushti@example.com",
        role: "user",
      },
    ];

    // Save to file
    fs.writeFileSync(
      usersDbPath,
      JSON.stringify(defaultUsers, null, 2),
      "utf8"
    );
    users = defaultUsers;

    logToFile("Created users database with default users", {
      users: defaultUsers.map((u) => u.username),
    });
    console.log("Users created: admin, srushti");
  }
} catch (err) {
  logToFile("Error initializing users database", { error: err.message });
  console.error("Error initializing users database:", err);
  // Decide if the app can run without users db
  process.exit(1);
}

// Load logs database
const logsDbPath = path.join(dataDir, "logs_db.json"); // Use dataDir
let logs = [];

try {
  if (fs.existsSync(logsDbPath)) {
    logs = JSON.parse(fs.readFileSync(logsDbPath, "utf8"));
    logToFile("Loaded existing logs database", { count: logs.length });
  } else {
    // Create empty logs database if it doesn't exist
    fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");
    logToFile("Created empty logs database");
  }
} catch (err) {
  logToFile("Error loading logs database", { error: err.message });
  console.error("Error loading logs database:", err);
  // Decide if the app can run without logs db
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  logToFile("Unauthorized access attempt", {
    path: req.path,
    ip: req.ip,
    headers: req.headers,
  });
  return res.status(401).json({ error: "Unauthorized" });
}

// Token authentication middleware
function verifyToken(req, res, next) {
  // Check for session first (local usage)
  if (req.session && req.session.userId) {
    return next();
  }

  // Check for token in headers
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      // Decode token (simple implementation)
      const decoded = Buffer.from(token, "base64").toString();
      const [userId, timestamp] = decoded.split(":");

      // Verify token is not too old (24 hours)
      if (Date.now() - Number(timestamp) > 24 * 60 * 60 * 1000) {
        return res.status(401).json({ error: "Token expired" });
      }

      // Find the user
      const user = users.find((user) => user.id === Number(userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Set userId in request for later use
      req.userId = Number(userId);
      return next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token format" });
    }
  }

  // No authentication found
  logToFile("Unauthorized access attempt", {
    path: req.path,
    ip: req.ip,
    headers: req.headers,
  });
  return res.status(401).json({ error: "Unauthorized" });
}

// === ROUTES ===

// Authentication status route
app.get("/api/user", (req, res) => {
  if (req.session && req.session.userId) {
    const user = users.find((user) => user.id === req.session.userId);
    if (user) {
      return res.json({
        authenticated: true,
        username: user.username,
        email: user.email,
      });
    }
  }
  return res.status(401).json({ authenticated: false });
});

// Login route
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    logToFile("Failed login attempt", { username });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Set user session
  req.session.userId = user.id;

  // Generate a token for cross-origin authentication
  const token = Buffer.from(`${user.id}:${Date.now()}:auth`).toString("base64");

  logToFile("User logged in", { username, userId: user.id });

  return res.json({
    success: true,
    username: user.username,
    email: user.email,
    token: token, // Send the token to the client
  });
});

// Logout route
app.get("/api/logout", (req, res) => {
  logToFile("User logged out", { userId: req.session.userId });
  req.session.destroy();
  res.json({ success: true });
});

// Get all logs
app.get("/api/logs", verifyToken, (req, res) => {
  res.json(logs);
});

// Create a new log
app.post("/api/logs", verifyToken, (req, res) => {
  const log = req.body;

  // Validate log
  if (!log.title || !log.content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  // Add to logs
  logs.push(log);

  // Save to file
  try {
    // Add error handling for file write
    fs.writeFileSync(logsDbPath, JSON.stringify(logs, null, 2), "utf8"); // Use logsDbPath defined earlier
  } catch (err) {
    logToFile("Error saving logs database after create", {
      error: err.message,
    });
    console.error("Error saving logs database after create:", err);
    // Decide if you should return an error to the client
    return res.status(500).json({ error: "Failed to save log data." });
  }

  // Check if email notification is enabled and send email
  if (emailConfig.enabled && emailConfig.transport && emailConfig.options) {
    sendEmailNotification(log);
  }

  logToFile("Log created", { logId: log.id, title: log.title });

  res.json({ success: true, log });
});

// Update a log
app.put("/api/logs/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const updatedLog = req.body;

  // Find log index
  const index = logs.findIndex((log) => log.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Log not found" });
  }

  // Update log
  logs[index] = updatedLog;

  // Save to file
  try {
    // Add error handling
    fs.writeFileSync(logsDbPath, JSON.stringify(logs, null, 2), "utf8"); // Use logsDbPath
  } catch (err) {
    logToFile("Error saving logs database after update", {
      error: err.message,
    });
    console.error("Error saving logs database after update:", err);
    // Optionally revert the change in memory or return error
    return res.status(500).json({ error: "Failed to save log data." });
  }

  logToFile("Log updated", { logId: id, title: updatedLog.title });

  res.json({ success: true, log: updatedLog });
});

// Delete a log
app.delete("/api/logs/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  // Filter out the log to delete
  const initialCount = logs.length;
  logs = logs.filter((log) => log.id !== id);

  if (logs.length === initialCount) {
    return res.status(404).json({ error: "Log not found" });
  }

  // Save to file
  try {
    // Add error handling
    fs.writeFileSync(logsDbPath, JSON.stringify(logs, null, 2), "utf8"); // Use logsDbPath
  } catch (err) {
    logToFile("Error saving logs database after delete", {
      error: err.message,
    });
    console.error("Error saving logs database after delete:", err);
    // Optionally revert the change in memory or return error
    return res.status(500).json({ error: "Failed to save log data." });
  }

  logToFile("Log deleted", { logId: id });

  res.json({ success: true });
});

// Sync logs from client (bulk add/update)
app.post("/api/logs/sync", verifyToken, (req, res) => {
  const clientLogs = req.body.logs;

  if (!Array.isArray(clientLogs)) {
    return res.status(400).json({ error: "Logs must be an array" });
  }

  let added = 0;
  let updated = 0;

  // Process each client log
  clientLogs.forEach((clientLog) => {
    const index = logs.findIndex((log) => log.id === clientLog.id);

    if (index === -1) {
      // Add new log
      logs.push(clientLog);
      added++;
    } else {
      // Update existing log, but only if the client version is newer
      const clientDate = new Date(clientLog.timestamp);
      const serverDate = new Date(logs[index].timestamp);

      if (clientDate > serverDate) {
        logs[index] = clientLog;
        updated++;
      }
    }
  });

  // Save to file
  try {
    // Add error handling
    fs.writeFileSync(logsDbPath, JSON.stringify(logs, null, 2), "utf8"); // Use logsDbPath
  } catch (err) {
    logToFile("Error saving logs database after sync", { error: err.message });
    console.error("Error saving logs database after sync:", err);
    // Return error
    return res.status(500).json({ error: "Failed to save synced log data." });
  }

  logToFile("Logs synced from client", { added, updated });

  res.json({ success: true, added, updated });
});

// Get server status (including email configuration)
app.get("/api/status", verifyToken, (req, res) => {
  res.json({
    status: "running",
    version: "1.0.0",
    emailEnabled: !!(
      emailConfig.enabled &&
      emailConfig.transport &&
      emailConfig.options
    ),
    logs: logs.length,
  });
});

// Get email status - simplified endpoint for checking email configuration
app.get("/api/email-status", (req, res) => {
  res.json({
    emailEnabled: !!(
      emailConfig.enabled &&
      emailConfig.transport &&
      emailConfig.options
    ),
  });
});

// Send test email
app.get("/api/test-email", verifyToken, (req, res) => {
  // Check if email is configured
  if (!emailConfig.enabled || !emailConfig.transport || !emailConfig.options) {
    return res.status(400).json({
      success: false,
      message: "Email is not configured. Check server/email-config.js",
    });
  }

  // Get current user - need to handle both session and token auth
  let user;
  if (req.session && req.session.userId) {
    user = users.find((user) => user.id === req.session.userId);
  } else if (req.userId) {
    // This comes from verifyToken middleware
    user = users.find((user) => user.id === req.userId);
  }

  if (!user || !user.email) {
    return res.status(400).json({
      success: false,
      message: "User email not found",
    });
  }

  // Create test email options
  const mailOptions = {
    from: emailConfig.options.from,
    to: user.email,
    subject: "Test Email from Web Developer Bootcamp Journal",
    html: `
      <h1>Test Email</h1>
      <p>This is a test email from your Web Developer Bootcamp Journal application.</p>
      <p>If you're receiving this email, your email notifications are working correctly!</p>
      <p>Time sent: ${new Date().toLocaleString()}</p>
    `,
  };

  // Send test email
  try {
    const transporter = nodemailer.createTransport(emailConfig.transport);

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logToFile("Test email failed", {
          error: error.message,
          user: user.email,
        });
        return res.json({
          success: false,
          message: "Failed to send test email: " + error.message,
        });
      }

      logToFile("Test email sent", { user: user.email, info });
      res.json({
        success: true,
        message: "Test email sent to " + user.email,
      });
    });
  } catch (err) {
    logToFile("Error creating email transporter", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Error setting up email: " + err.message,
    });
  }
});

// Send email notification for new log
function sendEmailNotification(log) {
  if (!emailConfig.enabled || !emailConfig.transport || !emailConfig.options) {
    return;
  }

  try {
    const transporter = nodemailer.createTransport(emailConfig.transport);

    // Format the date
    const logDate = new Date(log.timestamp);
    const formattedDate = logDate.toLocaleString();

    // Get category display name
    let categoryName = log.category;
    switch (log.category) {
      case "html-css":
        categoryName = "HTML & CSS";
        break;
      case "javascript":
        categoryName = "JavaScript";
        break;
      case "node":
        categoryName = "Node.js";
        break;
      case "express":
        categoryName = "Express";
        break;
      case "mongodb":
        categoryName = "MongoDB";
        break;
      case "project":
        categoryName = "Project";
        break;
    }

    // Create mail options
    const mailOptions = {
      from: emailConfig.options.from,
      to: emailConfig.options.to,
      subject: `New Learning Entry: ${log.title}`,
      html: `
        <h1>New Web Developer Bootcamp Journal Entry</h1>
        <h2>${log.title}</h2>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Category:</strong> ${categoryName}</p>
        <p><strong>Understanding Level:</strong> ${log.importance}/5</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50;">
          <p>${log.content.replace(/\n/g, "<br>")}</p>
        </div>
        <p style="margin-top: 30px;">Keep up the great work with your web development journey!</p>
      `,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logToFile("Email notification failed", {
          error: error.message,
          logId: log.id,
        });
        console.error("Failed to send email notification:", error);
      } else {
        logToFile("Email notification sent", { logId: log.id, info });
        console.log("Email notification sent:", info.response);
      }
    });
  } catch (err) {
    logToFile("Error creating email transporter", { error: err.message });
    console.error("Error setting up email notification:", err);
  }
}

// Catch-all route to serve the main app
app.get("*", (req, res) => {
  // Check if it's an API request
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Determine which file to serve
  let filePath;

  // If the path is the root or index, serve index.html
  if (req.path === "/" || req.path === "/index.html") {
    filePath = path.join(__dirname, "..", "index.html");
  }
  // If the path is login, serve login.html
  else if (req.path === "/login" || req.path === "/login.html") {
    filePath = path.join(__dirname, "..", "login.html");
  }
  // For all other paths, try to find the file
  else {
    filePath = path.join(__dirname, "..", req.path);
  }

  // Check if the file exists and serve it
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // If file doesn't exist, serve index.html as a fallback (for SPA behavior)
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`View the app at http://localhost:${PORT}`);
});
