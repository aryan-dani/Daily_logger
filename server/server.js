/** @format */

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Determine if we're in production environment
const isProduction = process.env.NODE_ENV === "production";

// Set up CORS for cross-domain requests (GitHub Pages to Render)
// This allows GitHub Pages to connect to your Render backend
app.use(
	cors({
		origin: isProduction
			? [
					"https://aryan-dani.github.io",
					"https://your-custom-domain.com",
			  ] // Replace with your actual domains
			: "http://localhost:3000",
		credentials: true, // Allow cookies for authentication
		methods: ["GET", "POST", "PUT", "DELETE"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);

// Configure email - first try environment variables, then fall back to local config
let emailConfig;
try {
	// First check for environment variables (with support for Heroku Deploy HD_ prefixed vars)
	if (process.env.EMAIL_HOST || process.env.HD_EMAIL_HOST) {
		emailConfig = {
			enabled:
				process.env.EMAIL_ENABLED === "true" ||
				process.env.HD_EMAIL_ENABLED === "true",
			host: process.env.EMAIL_HOST || process.env.HD_EMAIL_HOST,
			port: process.env.EMAIL_PORT || process.env.HD_EMAIL_PORT || 587,
			secure:
				process.env.EMAIL_SECURE === "true" ||
				process.env.HD_EMAIL_SECURE === "true",
			user: process.env.EMAIL_USER || process.env.HD_EMAIL_USER,
			password: process.env.EMAIL_PASSWORD || process.env.HD_EMAIL_PASSWORD,
			from: process.env.EMAIL_FROM || process.env.HD_EMAIL_FROM,
			to: process.env.EMAIL_TO || process.env.HD_EMAIL_TO,
		};
		console.log("Email configuration loaded from environment variables");
	} else {
		// Fall back to local config file
		emailConfig = require("./email-config");
		console.log("Email configuration loaded from local file");
	}
} catch (error) {
	console.log(
		"Email configuration not found or invalid. Email notifications will not be sent."
	);
	emailConfig = { enabled: false };
}

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Session configuration - deliberately simplified
app.use(
	session({
		secret: "daily-logger-secret-key",
		resave: false,
		saveUninitialized: true,
		cookie: {
			secure: false, // Turn off secure cookies for local testing
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
		},
	})
);

// Serve static files
app.use(express.static(path.join(__dirname, "..")));

// Login endpoint - placed BEFORE the auth middleware
app.post("/api/login", (req, res) => {
	const { username, password } = req.body;

	console.log(
		`Login attempt - Username: "${username}", Password: "${password}"`
	);

	// Hardcoded check specifically for srushti/paneer
	if (username === "srushti" && password === "paneer") {
		req.session.authenticated = true;
		req.session.username = username;
		console.log("Login successful!");
		return res.json({ success: true });
	} else {
		console.log(`Login failed - Username: ${username}`);
		return res
			.status(401)
			.json({ success: false, message: "Invalid username or password" });
	}
});

// Public routes that don't require authentication
app.get("/api/status", (req, res) => {
	res.json({
		status: "online",
		environment: isProduction ? "production" : "development",
		emailEnabled: emailConfig && emailConfig.enabled,
	});
});

// Authentication check middleware - only applied AFTER login endpoints
const checkAuth = (req, res, next) => {
	console.log(
		`Auth check for path: ${req.path}, Auth status: ${
			req.session.authenticated ? "Authenticated" : "Not authenticated"
		}`
	);

	// Skip auth for login route and static files
	if (
		req.path === "/login.html" ||
		req.path === "/api/login" ||
		req.path === "/api/status"
	) {
		return next();
	}

	// Check if user is logged in
	if (req.session.authenticated) {
		return next();
	}

	// If this is an API request, send 401 response
	if (req.path.startsWith("/api/")) {
		return res.status(401).json({ error: "Authentication required" });
	}

	// Otherwise redirect to login page
	res.redirect("/login.html");
};

// Get current user info
app.get("/api/user", (req, res) => {
	console.log(
		`User info request - Auth status: ${
			req.session.authenticated ? "Authenticated" : "Not authenticated"
		}`
	);

	if (req.session.authenticated) {
		res.json({
			authenticated: true,
			username: req.session.username,
		});
	} else {
		res.status(401).json({ authenticated: false });
	}
});

// Logout endpoint
app.get("/api/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			return res
				.status(500)
				.json({ success: false, message: "Could not log out" });
		}
		res.json({ success: true });
	});
});

// Apply authentication middleware for protected routes
app.use(checkAuth);

// Data file path - use a writable location in production
const dataFile = isProduction
	? path.join(process.env.DATA_DIR || __dirname, "logs.json")
	: path.join(__dirname, "logs.json");

// Ensure data file exists
try {
	if (!fs.existsSync(dataFile)) {
		fs.writeFileSync(dataFile, JSON.stringify([]));
		console.log(`Created logs data file at: ${dataFile}`);
	} else {
		console.log(`Using existing logs data file at: ${dataFile}`);
	}
} catch (error) {
	console.error(`Error accessing data file: ${error.message}`);
	console.log("Will attempt to use in-memory storage as fallback");
}

// In-memory fallback storage for environments where file writing is restricted
let inMemoryLogs = [];
let useMemoryStorage = false;

// Helper function to read logs
function getLogs() {
	if (useMemoryStorage) {
		return inMemoryLogs;
	}

	try {
		const data = fs.readFileSync(dataFile, "utf8");
		return JSON.parse(data);
	} catch (error) {
		console.error("Error reading logs data:", error);
		useMemoryStorage = true;
		console.log("Switched to in-memory storage due to file access errors");
		return inMemoryLogs;
	}
}

// Helper function to save logs
function saveLogs(logs) {
	if (useMemoryStorage) {
		inMemoryLogs = logs;
		return;
	}

	try {
		fs.writeFileSync(dataFile, JSON.stringify(logs, null, 2));
	} catch (error) {
		console.error("Error saving logs data:", error);
		useMemoryStorage = true;
		inMemoryLogs = logs;
		console.log("Switched to in-memory storage due to file access errors");
	}
}

// Helper function to send email notification
async function sendEmailNotification(log) {
	// Add extensive logging for troubleshooting
	console.log("Attempting to send email notification for log:", log.title);

	if (!emailConfig || !emailConfig.enabled) {
		console.log(
			"Email notifications are disabled - email config:",
			emailConfig ? "exists" : "missing",
			"enabled:",
			emailConfig ? emailConfig.enabled : "N/A"
		);
		return false;
	}

	console.log(`Email will be sent to: ${emailConfig.to}`);

	try {
		// Create a transporter with debug logging
		console.log("Creating email transporter with host:", emailConfig.host);
		const transporter = nodemailer.createTransport({
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: {
				user: emailConfig.user,
				pass: emailConfig.password,
			},
			debug: true, // Enable debug logs
			logger: true, // Log to console
		});

		// Verify connection configuration
		await transporter.verify();
		console.log("Email transporter verification successful");

		// Format date
		const date = new Date(log.timestamp).toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
		});

		// Determine category display name
		const categoryDisplayNames = {
			"html-css": "HTML & CSS",
			javascript: "JavaScript",
			node: "Node.js",
			express: "Express",
			mongodb: "MongoDB",
			project: "Projects",
		};

		const categoryName = categoryDisplayNames[log.category] || log.category;

		// Prepare email content with a back-to-site link
		const siteUrl = isProduction
			? "https://aryan-dani.github.io/Daily_logger" // Replace with your actual GitHub Pages URL
			: `http://localhost:${PORT}`;

		const emailSubject = `New Daily Logger Entry: ${log.title}`;
		const emailContent = `
        <h2>New Entry in Daily Logger</h2>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Title:</strong> ${log.title}</p>
        <p><strong>Category:</strong> ${categoryName}</p>
        <p><strong>Understanding Level:</strong> ${log.importance}/5</p>
        <p><strong>Content:</strong></p>
        <div style="padding: 10px; background-color: #f5f5f5; border-left: 4px solid #007bff; margin: 10px 0;">
            ${log.content.replace(/\n/g, "<br>")}
        </div>
        <hr>
        <p>
            <a href="${siteUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">
                View All Entries
            </a>
        </p>
        <p><small>This is an automated notification from your Daily Logger app.</small></p>
        `;

		// Send mail with defined transport object
		console.log("Sending email now...");
		const info = await transporter.sendMail({
			from: emailConfig.from || emailConfig.user,
			to: emailConfig.to,
			subject: emailSubject,
			html: emailContent,
			priority: "high",
		});

		console.log("Email notification sent successfully:", info.messageId);
		console.log("Email preview URL:", nodemailer.getTestMessageUrl(info));
		return true;
	} catch (error) {
		console.error("Error sending email notification:", error);
		return false;
	}
}

// API Routes
// Get all logs
app.get("/api/logs", (req, res) => {
	const logs = getLogs();
	res.json(logs);
});

// Create a new log
app.post("/api/logs", (req, res) => {
	const logs = getLogs();
	const newLog = {
		...req.body,
		id: uuidv4(),
	};

	logs.push(newLog);
	saveLogs(logs);

	// Send email notification
	sendEmailNotification(newLog)
		.then((success) => {
			if (success) {
				console.log("Email notification sent successfully");
			} else {
				console.log(
					"Failed to send email notification or notifications are disabled"
				);
			}
		})
		.catch((err) => {
			console.error("Error in email notification:", err);
		});

	res.status(201).json(newLog);
});

// Sync logs from client
app.post("/api/logs/sync", async (req, res) => {
	try {
		const clientLogs = req.body.logs || [];
		if (clientLogs.length === 0) {
			return res.status(400).json({ error: "No logs to sync" });
		}

		const serverLogs = getLogs();
		let newLogsCount = 0;
		let updatedLogsCount = 0;

		// Process each client log
		for (const clientLog of clientLogs) {
			const existingLogIndex = serverLogs.findIndex(
				(log) => log.id === clientLog.id
			);

			if (existingLogIndex === -1) {
				// This is a new log, add it to the server
				serverLogs.push(clientLog);
				newLogsCount++;

				// Send email notification for new logs
				await sendEmailNotification(clientLog);
			} else {
				// Log exists, check if it needs updating
				const existingLog = serverLogs[existingLogIndex];
				const clientTimestamp = new Date(clientLog.timestamp);
				const serverTimestamp = new Date(existingLog.timestamp);

				// Update if client version is newer
				if (clientTimestamp > serverTimestamp) {
					serverLogs[existingLogIndex] = clientLog;
					updatedLogsCount++;
				}
			}
		}

		// Save updated logs
		saveLogs(serverLogs);

		res.json({
			success: true,
			message: `Synced ${newLogsCount} new and ${updatedLogsCount} updated logs`,
		});
	} catch (error) {
		console.error("Error syncing logs:", error);
		res.status(500).json({ error: "Failed to sync logs: " + error.message });
	}
});

// Update a log
app.put("/api/logs/:id", (req, res) => {
	const logs = getLogs();
	const id = req.params.id;
	const updatedLog = req.body;

	const index = logs.findIndex((log) => log.id === id);

	if (index === -1) {
		return res.status(404).json({ error: "Log not found" });
	}

	logs[index] = updatedLog;
	saveLogs(logs);

	res.json(updatedLog);
});

// Delete a log
app.delete("/api/logs/:id", (req, res) => {
	const logs = getLogs();
	const id = req.params.id;

	const filteredLogs = logs.filter((log) => log.id !== id);

	if (filteredLogs.length === logs.length) {
		return res.status(404).json({ error: "Log not found" });
	}

	saveLogs(filteredLogs);

	res.status(204).end();
});

// Test email configuration
app.get("/api/test-email", async (req, res) => {
	if (!emailConfig || !emailConfig.enabled) {
		console.log("Test email failed - Email notifications are disabled");
		return res.status(400).json({
			success: false,
			message: "Email notifications are not configured or disabled",
		});
	}

	try {
		// Create a transporter with debugging enabled
		console.log(
			"Test email - Creating transporter with host:",
			emailConfig.host
		);
		const transporter = nodemailer.createTransport({
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: {
				user: emailConfig.user,
				pass: emailConfig.password,
			},
			debug: true,
			logger: true,
		});

		// Verify connection configuration
		await transporter.verify();
		console.log("Test email - Transporter verification successful");

		// Prepare site URL for the link in the email
		const siteUrl = isProduction
			? "https://your-github-username.github.io/Daily_logger" // Replace with your actual GitHub Pages URL
			: `http://localhost:${PORT}`;

		// Send test email
		console.log("Test email - Sending email now...");
		const info = await transporter.sendMail({
			from: emailConfig.from || emailConfig.user,
			to: emailConfig.to,
			subject: "Daily Logger - Test Email",
			priority: "high",
			html: `
        <h2>Daily Logger - Email Test</h2>
        <p>This is a test email from your Daily Logger application.</p>
        <p>If you're receiving this email, your email notifications are configured correctly!</p>
        <p>New log entries will now trigger email notifications with their content.</p>
        <hr>
        <p>
            <a href="${siteUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">
                Open Daily Logger
            </a>
        </p>
        <p><small>This is an automated test from your Daily Logger app.</small></p>
      `,
		});

		console.log("Test email sent successfully:", info.messageId);
		console.log("Test email preview URL:", nodemailer.getTestMessageUrl(info));

		res.json({ success: true, message: "Test email sent successfully!" });
	} catch (error) {
		console.error("Error sending test email:", error);
		res.status(500).json({
			success: false,
			message: "Failed to send test email: " + error.message,
		});
	}
});

// Catch-all route to handle SPA routing
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Start the server
app.listen(PORT, () => {
	console.log(
		`Server running on ${
			isProduction ? "production" : "development"
		} mode at http://localhost:${PORT}`
	);
	console.log(`Using ${useMemoryStorage ? "in-memory" : "file-based"} storage`);
	console.log(
		`Email notifications are ${
			emailConfig && emailConfig.enabled ? "enabled" : "disabled"
		}`
	);

	// Display login instructions for easier testing
	console.log("\n----- AUTHENTICATION INSTRUCTIONS -----");
	console.log("Username: srushti");
	console.log("Password: paneer");
	console.log("---------------------------------------\n");
});
