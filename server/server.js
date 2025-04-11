/** @format */

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const nodemailer = require("nodemailer");

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Load email config if available
let emailConfig = {};
try {
	const emailConfigPath = path.join(__dirname, "email-config.js");
	if (fs.existsSync(emailConfigPath)) {
		emailConfig = require("./email-config.js");
		// Set up the transport object in the expected format
		emailConfig.transport = {
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: {
				user: emailConfig.user,
				pass: emailConfig.password,
			},
		};

		// Set up the options object in the expected format
		emailConfig.options = {
			from: emailConfig.from,
			to: emailConfig.to,
		};

		console.log("Email configuration loaded successfully");
	} else {
		console.log("No email configuration found");
	}
} catch (err) {
	console.log("Error loading email config:", err);
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

// Session configuration - critical for authentication
app.use(
	session({
		secret:
			process.env.SESSION_SECRET || "your-secret-key-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: process.env.NODE_ENV === "production", // Use secure cookies in production
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

	const logsPath = path.join(__dirname, "logs.json");

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
const usersDbPath = path.join(__dirname, "users.json");
let users = [];

try {
	// Always recreate users with correct hashing
	const defaultUsers = [
		{
			id: 1,
			username: "admin",
			password: bcrypt.hashSync("admin", 10),
			email: "admin@example.com",
			role: "admin",
		},
		{
			id: 2,
			username: "srushti",
			password: bcrypt.hashSync("paneer", 10),
			email: "srushti@example.com",
			role: "user",
		},
	];

	// Save to file
	fs.writeFileSync(usersDbPath, JSON.stringify(defaultUsers, null, 2), "utf8");
	users = defaultUsers;

	logToFile("Users database recreated with default users", {
		users: defaultUsers.map((u) => u.username),
	});
	console.log("Users created: admin, srushti");
} catch (err) {
	logToFile("Error creating users database", { error: err.message });
	console.error("Error creating users database:", err);
}

// Load logs database
const logsDbPath = path.join(__dirname, "logs_db.json");
let logs = [];

try {
	if (fs.existsSync(logsDbPath)) {
		logs = JSON.parse(fs.readFileSync(logsDbPath, "utf8"));
	} else {
		// Create empty logs database
		fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");
		logToFile("Created empty logs database");
	}
} catch (err) {
	logToFile("Error loading logs database", { error: err.message });
	console.error("Error loading logs database:", err);
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

	logToFile("User logged in", { username, userId: user.id });

	return res.json({
		success: true,
		username: user.username,
		email: user.email,
	});
});

// Logout route
app.get("/api/logout", (req, res) => {
	logToFile("User logged out", { userId: req.session.userId });
	req.session.destroy();
	res.json({ success: true });
});

// Get all logs
app.get("/api/logs", isAuthenticated, (req, res) => {
	res.json(logs);
});

// Create a new log
app.post("/api/logs", isAuthenticated, (req, res) => {
	const log = req.body;

	// Validate log
	if (!log.title || !log.content) {
		return res.status(400).json({ error: "Title and content are required" });
	}

	// Add to logs
	logs.push(log);

	// Save to file
	fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");

	// Check if email notification is enabled and send email
	if (emailConfig.enabled && emailConfig.transport && emailConfig.options) {
		sendEmailNotification(log);
	}

	logToFile("Log created", { logId: log.id, title: log.title });

	res.json({ success: true, log });
});

// Update a log
app.put("/api/logs/:id", isAuthenticated, (req, res) => {
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
	fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");

	logToFile("Log updated", { logId: id, title: updatedLog.title });

	res.json({ success: true, log: updatedLog });
});

// Delete a log
app.delete("/api/logs/:id", isAuthenticated, (req, res) => {
	const { id } = req.params;

	// Filter out the log to delete
	const initialCount = logs.length;
	logs = logs.filter((log) => log.id !== id);

	if (logs.length === initialCount) {
		return res.status(404).json({ error: "Log not found" });
	}

	// Save to file
	fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");

	logToFile("Log deleted", { logId: id });

	res.json({ success: true });
});

// Sync logs from client (bulk add/update)
app.post("/api/logs/sync", isAuthenticated, (req, res) => {
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
	fs.writeFileSync(logsDbPath, JSON.stringify(logs), "utf8");

	logToFile("Logs synced from client", { added, updated });

	res.json({ success: true, added, updated });
});

// Get server status (including email configuration)
app.get("/api/status", isAuthenticated, (req, res) => {
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

// Send test email
app.get("/api/test-email", isAuthenticated, (req, res) => {
	// Check if email is configured
	if (!emailConfig.enabled || !emailConfig.transport || !emailConfig.options) {
		return res.status(400).json({
			success: false,
			message: "Email is not configured. Check server/email-config.js",
		});
	}

	// Get current user
	const user = users.find((user) => user.id === req.session.userId);

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
