/** @format */

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Determine if we're in production environment
const isProduction = process.env.NODE_ENV === "production";

// Configure email - first try environment variables, then fall back to local config
let emailConfig;
try {
	// First check for environment variables
	if (process.env.EMAIL_HOST) {
		emailConfig = {
			enabled: true,
			host: process.env.EMAIL_HOST,
			port: process.env.EMAIL_PORT || 587,
			secure: process.env.EMAIL_SECURE === "true",
			user: process.env.EMAIL_USER,
			password: process.env.EMAIL_PASSWORD,
			from: process.env.EMAIL_FROM,
			to: process.env.EMAIL_TO,
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

// Serve static files
app.use(express.static(path.join(__dirname, "..")));

// Ensure all API routes are handled before the catch-all
app.use((req, res, next) => {
	if (req.path.startsWith("/api/")) {
		next();
	} else {
		// For all non-API routes, serve the main index.html
		if (req.path !== "/" && !req.path.includes(".")) {
			res.sendFile(path.join(__dirname, "..", "index.html"));
		} else {
			next();
		}
	}
});

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
	if (!emailConfig || !emailConfig.enabled) {
		console.log("Email notifications are disabled");
		return false;
	}

	try {
		// Create a transporter
		const transporter = nodemailer.createTransport({
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: {
				user: emailConfig.user,
				pass: emailConfig.password,
			},
		});

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

		// Prepare email content
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
      <p><small>This is an automated notification from your Daily Logger app.</small></p>
    `;

		// Send mail
		const info = await transporter.sendMail({
			from: emailConfig.from || emailConfig.user,
			to: emailConfig.to,
			subject: emailSubject,
			html: emailContent,
		});

		console.log("Email notification sent:", info.messageId);
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
		return res.status(400).json({
			success: false,
			message: "Email notifications are not configured or disabled",
		});
	}

	try {
		// Create a transporter
		const transporter = nodemailer.createTransport({
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: {
				user: emailConfig.user,
				pass: emailConfig.password,
			},
		});

		// Send test email
		const info = await transporter.sendMail({
			from: emailConfig.from || emailConfig.user,
			to: emailConfig.to,
			subject: "Daily Logger - Test Email",
			html: `
        <h2>Daily Logger - Email Test</h2>
        <p>This is a test email from your Daily Logger application.</p>
        <p>If you're receiving this email, your email notifications are configured correctly!</p>
        <hr>
        <p><small>This is an automated test from your Daily Logger app.</small></p>
      `,
		});

		console.log("Test email sent:", info.messageId);
		res.json({ success: true, message: "Test email sent successfully!" });
	} catch (error) {
		console.error("Error sending test email:", error);
		res.status(500).json({
			success: false,
			message: "Failed to send test email: " + error.message,
		});
	}
});

// API status endpoint
app.get("/api/status", (req, res) => {
	res.json({
		status: "online",
		environment: isProduction ? "production" : "development",
		storageType: useMemoryStorage ? "in-memory" : "file-based",
		emailEnabled: emailConfig && emailConfig.enabled,
	});
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
});
