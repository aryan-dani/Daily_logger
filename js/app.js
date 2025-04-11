/** @format */

// Daily Logger Application

// DOM Elements
const currentDateEl = document.getElementById("current-date");
const logTitleEl = document.getElementById("log-title");
const logCategoryEl = document.getElementById("log-category");
const logContentEl = document.getElementById("log-content");
const logImportanceEl = document.getElementById("log-importance");
const saveLogBtn = document.getElementById("save-log");
const logsListEl = document.getElementById("logs-list");
const filterCategoryEl = document.getElementById("filter-category");
const searchLogsEl = document.getElementById("search-logs");
const statsCountEl = document.getElementById("stats-count");
const logModal = document.getElementById("log-modal");
const modalContent = document.getElementById("modal-content");
const closeModal = document.querySelector(".close-modal");

// Display current date
function displayCurrentDate() {
	const now = new Date();
	const options = {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	};
	currentDateEl.textContent = now.toLocaleDateString("en-US", options);
}

// Toast notification function
function showToast(message, type = "") {
	// Check if a toast already exists, if so, remove it
	const existingToast = document.querySelector(".toast");
	if (existingToast) {
		document.body.removeChild(existingToast);
	}

	// Create new toast
	const toast = document.createElement("div");
	toast.className = `toast ${type}`;
	toast.textContent = message;

	document.body.appendChild(toast);

	// Show the toast
	setTimeout(() => {
		toast.classList.add("show");
	}, 10);

	// Hide toast after 3 seconds
	setTimeout(() => {
		toast.classList.remove("show");
		setTimeout(() => {
			document.body.removeChild(toast);
		}, 300);
	}, 3000);
}

// Generate a unique ID for logs
function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Save log to localStorage
async function saveLog() {
	const title = logTitleEl.value.trim();
	const category = logCategoryEl.value;
	const content = logContentEl.value.trim();
	const importance = parseInt(logImportanceEl.value);

	if (!title || !content) {
		showToast("Please fill in all fields", "error");
		return;
	}

	const log = {
		id: generateId(),
		title,
		category,
		content,
		importance,
		timestamp: new Date().toISOString(),
	};

	try {
		// Send log to backend
		const response = await fetch("/api/logs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(log),
		});

		if (!response.ok) {
			throw new Error("Failed to save log");
		}

		// Save to localStorage as backup
		const logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs.push(log);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Clear form
		logTitleEl.value = "";
		logCategoryEl.value = "work";
		logContentEl.value = "";
		logImportanceEl.value = 3;

		// Update UI
		displayLogs();
		showToast("Log saved successfully!", "success");
	} catch (error) {
		console.error("Error saving log:", error);

		// Fallback to localStorage if backend fails
		const logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs.push(log);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Clear form
		logTitleEl.value = "";
		logCategoryEl.value = "work";
		logContentEl.value = "";
		logImportanceEl.value = 3;

		// Update UI
		displayLogs();
		showToast("Log saved locally (offline mode)", "success");
	}
}

// Format date for display
function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Create log item HTML
function createLogItemHTML(log) {
	// Create importance dots
	let importanceDots = "";
	for (let i = 1; i <= 5; i++) {
		const activeClass = i <= log.importance ? "" : "inactive";
		importanceDots += `<span class="importance-dot ${activeClass}"></span>`;
	}

	return `
        <div class="log-item" data-id="${log.id}">
            <div class="log-header">
                <h3 class="log-title">${log.title}</h3>
                <span class="log-date">${formatDate(log.timestamp)}</span>
            </div>
            <p class="log-preview">${log.content}</p>
            <div class="log-meta">
                <span class="log-category category-${log.category}">${
		log.category
	}</span>
                <div class="log-importance">
                    <span>Importance:</span>
                    <div class="importance-dots">
                        ${importanceDots}
                    </div>
                </div>
            </div>
            <div class="log-actions">
                <button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

// Display logs in the UI
async function displayLogs() {
	try {
		let logs = [];

		// Try to fetch logs from backend
		try {
			const response = await fetch("/api/logs");
			if (response.ok) {
				logs = await response.json();
			} else {
				throw new Error("Failed to fetch logs from server");
			}
		} catch (error) {
			console.warn("Using localStorage fallback:", error);
			// Fallback to localStorage if backend request fails
			logs = JSON.parse(localStorage.getItem("logs") || "[]");
		}

		// Update stats count
		statsCountEl.textContent = logs.length;

		// Apply filters
		const filterCategory = filterCategoryEl.value;
		const searchTerm = searchLogsEl.value.toLowerCase();

		const filteredLogs = logs.filter((log) => {
			// Filter by category
			if (filterCategory !== "all" && log.category !== filterCategory) {
				return false;
			}

			// Filter by search term
			if (
				searchTerm &&
				!log.title.toLowerCase().includes(searchTerm) &&
				!log.content.toLowerCase().includes(searchTerm)
			) {
				return false;
			}

			return true;
		});

		// Sort logs by timestamp (newest first)
		filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		// Display logs
		if (filteredLogs.length === 0) {
			logsListEl.innerHTML = `
                <div class="empty-logs">
                    <i class="fas fa-book-open"></i>
                    <p>No logs found. Create your first log!</p>
                </div>
            `;
		} else {
			logsListEl.innerHTML = filteredLogs
				.map((log) => createLogItemHTML(log))
				.join("");
		}

		// Add event listeners to log items
		document.querySelectorAll(".log-item").forEach((item) => {
			// View log details
			item.addEventListener("click", (e) => {
				if (!e.target.closest(".log-actions")) {
					const logId = item.dataset.id;
					openLogDetails(logs.find((log) => log.id === logId));
				}
			});

			// Delete log
			const deleteBtn = item.querySelector(".delete-btn");
			if (deleteBtn) {
				deleteBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					const logId = item.dataset.id;
					deleteLog(logId);
				});
			}

			// Edit log
			const editBtn = item.querySelector(".edit-btn");
			if (editBtn) {
				editBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					const logId = item.dataset.id;
					editLog(logs.find((log) => log.id === logId));
				});
			}
		});
	} catch (error) {
		console.error("Error displaying logs:", error);
		showToast("Failed to load logs", "error");
	}
}

// Delete log
async function deleteLog(id) {
	if (!confirm("Are you sure you want to delete this log?")) {
		return;
	}

	try {
		// Try to delete from backend
		const response = await fetch(`/api/logs/${id}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error("Failed to delete log from server");
		}

		// Also delete from localStorage
		let logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs = logs.filter((log) => log.id !== id);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Update UI
		displayLogs();
		showToast("Log deleted successfully", "success");
	} catch (error) {
		console.error("Error deleting log:", error);

		// Fallback to localStorage if backend fails
		let logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs = logs.filter((log) => log.id !== id);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Update UI
		displayLogs();
		showToast("Log deleted locally", "success");
	}
}

// Edit log
function editLog(log) {
	if (!log) return;

	// Fill form with log data
	logTitleEl.value = log.title;
	logCategoryEl.value = log.category;
	logContentEl.value = log.content;
	logImportanceEl.value = log.importance;

	// Change button text
	saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Update Log';

	// Scroll to form
	document
		.querySelector(".input-section")
		.scrollIntoView({ behavior: "smooth" });

	// Update button click handler
	const originalClickHandler = saveLogBtn.onclick;
	saveLogBtn.onclick = async () => {
		try {
			const updatedLog = {
				...log,
				title: logTitleEl.value.trim(),
				category: logCategoryEl.value,
				content: logContentEl.value.trim(),
				importance: parseInt(logImportanceEl.value),
			};

			// Update on backend
			const response = await fetch(`/api/logs/${log.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updatedLog),
			});

			if (!response.ok) {
				throw new Error("Failed to update log on server");
			}

			// Update in localStorage
			let logs = JSON.parse(localStorage.getItem("logs") || "[]");
			logs = logs.map((l) => (l.id === log.id ? updatedLog : l));
			localStorage.setItem("logs", JSON.stringify(logs));

			// Reset form
			logTitleEl.value = "";
			logCategoryEl.value = "work";
			logContentEl.value = "";
			logImportanceEl.value = 3;

			// Reset button text and handler
			saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Save Log';
			saveLogBtn.onclick = originalClickHandler;

			// Update UI
			displayLogs();
			showToast("Log updated successfully", "success");
		} catch (error) {
			console.error("Error updating log:", error);

			// Fallback to localStorage
			const updatedLog = {
				...log,
				title: logTitleEl.value.trim(),
				category: logCategoryEl.value,
				content: logContentEl.value.trim(),
				importance: parseInt(logImportanceEl.value),
			};

			let logs = JSON.parse(localStorage.getItem("logs") || "[]");
			logs = logs.map((l) => (l.id === log.id ? updatedLog : l));
			localStorage.setItem("logs", JSON.stringify(logs));

			// Reset form
			logTitleEl.value = "";
			logCategoryEl.value = "work";
			logContentEl.value = "";
			logImportanceEl.value = 3;

			// Reset button text and handler
			saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Save Log';
			saveLogBtn.onclick = originalClickHandler;

			// Update UI
			displayLogs();
			showToast("Log updated locally (offline mode)", "success");
		}
	};
}

// Open log details modal
function openLogDetails(log) {
	if (!log) return;

	// Create importance dots
	let importanceDots = "";
	for (let i = 1; i <= 5; i++) {
		const activeClass = i <= log.importance ? "" : "inactive";
		importanceDots += `<span class="importance-dot ${activeClass}"></span>`;
	}

	// Fill modal content
	modalContent.innerHTML = `
        <h2 class="log-detail-title">${log.title}</h2>
        <div class="log-detail-meta">
            <span>Category: <span class="log-category category-${
							log.category
						}">${log.category}</span></span>
            <span>Created: ${formatDate(log.timestamp)}</span>
            <div class="log-importance">
                Importance: 
                <div class="importance-dots">
                    ${importanceDots}
                </div>
            </div>
        </div>
        <div class="log-detail-content">
            ${log.content.replace(/\n/g, "<br>")}
        </div>
        <button class="btn primary" id="edit-from-modal">
            <i class="fas fa-edit"></i> Edit
        </button>
    `;

	// Show modal
	logModal.style.display = "block";

	// Add edit button functionality
	document.getElementById("edit-from-modal").addEventListener("click", () => {
		closeLogModal();
		editLog(log);
	});
}

// Close log details modal
function closeLogModal() {
	logModal.style.display = "none";
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
	// Display current date
	displayCurrentDate();

	// Display logs
	displayLogs();

	// Save log button
	saveLogBtn.addEventListener("click", saveLog);

	// Filter logs by category
	filterCategoryEl.addEventListener("change", displayLogs);

	// Search logs
	searchLogsEl.addEventListener("input", displayLogs);

	// Close modal when clicking on X
	closeModal.addEventListener("click", closeLogModal);

	// Close modal when clicking outside
	window.addEventListener("click", (e) => {
		if (e.target === logModal) {
			closeLogModal();
		}
	});

	// Sync logs with backend on page load
	syncLogsWithBackend();
});

// Sync logs between localStorage and backend
async function syncLogsWithBackend() {
	try {
		const localLogs = JSON.parse(localStorage.getItem("logs") || "[]");

		if (localLogs.length === 0) {
			return;
		}

		// Try to push local logs to server
		const response = await fetch("/api/logs/sync", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ logs: localLogs }),
		});

		if (!response.ok) {
			throw new Error("Failed to sync logs with server");
		}

		console.log("Logs synced with backend successfully");

		// Refresh logs display after sync
		displayLogs();
	} catch (error) {
		console.error("Error syncing logs:", error);
	}
}
