/** @format */

const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");
const morgan = require("morgan");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Data file path
const DATA_FILE = path.join(__dirname, "logs.json");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, "..")));

// Utility function to read logs from file
async function readLogs() {
	try {
		const data = await fs.readFile(DATA_FILE, "utf8");
		return JSON.parse(data);
	} catch (error) {
		// If file doesn't exist, return empty array
		if (error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

// Utility function to write logs to file
async function writeLogs(logs) {
	await fs.writeFile(DATA_FILE, JSON.stringify(logs, null, 2), "utf8");
}

// API Routes

// Get all logs
app.get("/api/logs", async (req, res) => {
	try {
		const logs = await readLogs();
		res.json(logs);
	} catch (error) {
		console.error("Error reading logs:", error);
		res.status(500).json({ error: "Failed to read logs" });
	}
});

// Create a new log
app.post("/api/logs", async (req, res) => {
	try {
		const logs = await readLogs();
		const newLog = req.body;

		// Validate required fields
		if (!newLog.title || !newLog.content) {
			return res.status(400).json({ error: "Title and content are required" });
		}

		// Ensure the log has an id
		if (!newLog.id) {
			newLog.id =
				Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
		}

		// Add timestamp if not provided
		if (!newLog.timestamp) {
			newLog.timestamp = new Date().toISOString();
		}

		logs.push(newLog);
		await writeLogs(logs);

		res.status(201).json(newLog);
	} catch (error) {
		console.error("Error creating log:", error);
		res.status(500).json({ error: "Failed to create log" });
	}
});

// Update a log
app.put("/api/logs/:id", async (req, res) => {
	try {
		const logs = await readLogs();
		const id = req.params.id;
		const updatedLog = req.body;

		const index = logs.findIndex((log) => log.id === id);

		if (index === -1) {
			return res.status(404).json({ error: "Log not found" });
		}

		// Ensure we don't change the id
		updatedLog.id = id;

		logs[index] = updatedLog;
		await writeLogs(logs);

		res.json(updatedLog);
	} catch (error) {
		console.error("Error updating log:", error);
		res.status(500).json({ error: "Failed to update log" });
	}
});

// Delete a log
app.delete("/api/logs/:id", async (req, res) => {
	try {
		const logs = await readLogs();
		const id = req.params.id;

		const filteredLogs = logs.filter((log) => log.id !== id);

		if (filteredLogs.length === logs.length) {
			return res.status(404).json({ error: "Log not found" });
		}

		await writeLogs(filteredLogs);

		res.json({ message: "Log deleted successfully" });
	} catch (error) {
		console.error("Error deleting log:", error);
		res.status(500).json({ error: "Failed to delete log" });
	}
});

// Sync logs from client
app.post("/api/logs/sync", async (req, res) => {
	try {
		const serverLogs = await readLogs();
		const clientLogs = req.body.logs || [];

		if (!Array.isArray(clientLogs)) {
			return res.status(400).json({ error: "Logs must be an array" });
		}

		// Map of existing logs by ID for quick lookup
		const existingLogsMap = new Map(serverLogs.map((log) => [log.id, log]));

		// Process client logs
		for (const clientLog of clientLogs) {
			// Skip if no id
			if (!clientLog.id) continue;

			// If log exists on server, keep the newer version
			if (existingLogsMap.has(clientLog.id)) {
				const serverLog = existingLogsMap.get(clientLog.id);
				const serverDate = new Date(serverLog.timestamp);
				const clientDate = new Date(clientLog.timestamp);

				// If client log is newer, replace server log
				if (clientDate > serverDate) {
					existingLogsMap.set(clientLog.id, clientLog);
				}
			} else {
				// If log doesn't exist on server, add it
				existingLogsMap.set(clientLog.id, clientLog);
			}
		}

		// Convert map back to array
		const mergedLogs = Array.from(existingLogsMap.values());

		// Save merged logs
		await writeLogs(mergedLogs);

		res.json({
			message: "Logs synchronized successfully",
			count: mergedLogs.length,
		});
	} catch (error) {
		console.error("Error syncing logs:", error);
		res.status(500).json({ error: "Failed to sync logs" });
	}
});

// Catch-all route to serve the main HTML file
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Start the server
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Visit http://localhost:${PORT} to access your Daily Logger`);
});

// Create logs.json file if it doesn't exist
async function ensureDataFileExists() {
	try {
		await fs.access(DATA_FILE);
	} catch (error) {
		if (error.code === "ENOENT") {
			console.log("Creating logs.json file...");
			await writeLogs([]);
			console.log("logs.json file created successfully");
		}
	}
}

// Initialize the app
(async () => {
	try {
		await ensureDataFileExists();
	} catch (error) {
		console.error("Error initializing app:", error);
	}
})();
