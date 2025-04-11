/** @format */

// Colt Steele's Web Developer Bootcamp Learning Journal

// API base URL - get from config.js or use dynamic detection
const API_BASE_URL =
	window.API_BASE_URL !== undefined
		? window.API_BASE_URL
		: window.location.hostname === "localhost" ||
		  window.location.hostname === "127.0.0.1"
		? "" // Empty for localhost (relative URLs)
		: window.location.origin; // Full origin for deployed site

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
const progressBarEl = document.getElementById("course-progress-bar");
const daysLoggedEl = document.getElementById("days-logged");
const progressPercentageEl = document.getElementById("progress-percentage");
const notificationEl = document.getElementById("notification");
const notificationTextEl = document.getElementById("notification-text");

// Settings panel elements
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const closeSettings = document.querySelector(".close-settings");
const testEmailBtn = document.getElementById("test-email-btn");
const emailStatus = document.getElementById("email-status");

// DOM Elements for authentication
const userInfoEl = document.createElement("div");
userInfoEl.className = "user-info";
document.querySelector("header").appendChild(userInfoEl);

// Course config - approximately how many days the Web Developer Bootcamp takes
const COURSE_DURATION = 65; // Based on Colt's course sections

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

// Show notification
function showNotification(message, type = "success") {
	notificationTextEl.textContent = message;
	notificationEl.className = "notification"; // Reset classes
	notificationEl.classList.add(type);
	notificationEl.classList.add("show");

	// Hide notification after 5 seconds
	setTimeout(() => {
		notificationEl.classList.remove("show");
	}, 5000);

	// Add click event to dismiss notification
	notificationEl.addEventListener(
		"click",
		() => {
			notificationEl.classList.remove("show");
		},
		{ once: true }
	);

	// Also trigger browser notification if permission granted
	if (Notification.permission === "granted") {
		const notification = new Notification("Web Dev Bootcamp Journal", {
			body: message,
			icon: "https://img.icons8.com/color/96/000000/code.png",
		});

		// Close browser notification after 5 seconds
		setTimeout(() => {
			notification.close();
		}, 5000);
	}
}

// Request notification permission on page load
function requestNotificationPermission() {
	if (
		Notification &&
		Notification.permission !== "granted" &&
		Notification.permission !== "denied"
	) {
		Notification.requestPermission();
	}
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

	// Add icon based on type
	let iconClass = "info-circle";
	if (type === "success") iconClass = "check-circle";
	if (type === "error") iconClass = "exclamation-circle";

	toast.innerHTML = `<i class="fas fa-${iconClass}"></i>${message}`;

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

// Calculate and update course progress
function updateCourseProgress(logs) {
	// Get unique days with entries
	const uniqueDays = new Set();
	logs.forEach((log) => {
		const date = new Date(log.timestamp).toLocaleDateString();
		uniqueDays.add(date);
	});

	const daysLogged = uniqueDays.size;
	const progressPercentage = Math.min(
		Math.round((daysLogged / COURSE_DURATION) * 100),
		100
	);

	// Update DOM elements
	daysLoggedEl.textContent = `${daysLogged} ${
		daysLogged === 1 ? "day" : "days"
	}`;
	progressPercentageEl.textContent = `${progressPercentage}%`;
	progressBarEl.style.width = `${progressPercentage}%`;

	return { daysLogged, progressPercentage };
}

// Save log to backend and localStorage
async function saveLog() {
	const title = logTitleEl.value.trim();
	const category = logCategoryEl.value;
	const content = logContentEl.value.trim();
	const importance = parseInt(logImportanceEl.value);

	if (!title || !content) {
		showToast("Please fill in all fields", "error");
		return;
	}

	// Check if we're editing or creating
	const isEditing = saveLogBtn.textContent.includes("Update");

	let log = {
		id: isEditing ? saveLogBtn.dataset.editId : generateId(),
		title,
		category,
		content,
		importance,
		timestamp: isEditing
			? saveLogBtn.dataset.editTimestamp
			: new Date().toISOString(),
	};

	try {
		// Send log to backend with dynamic URL
		const url = isEditing
			? `${API_BASE_URL}/api/logs/${log.id}`
			: `${API_BASE_URL}/api/logs`;
		const method = isEditing ? "PUT" : "POST";

		const response = await fetch(url, {
			method: method,
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(log),
		});

		if (!response.ok) {
			throw new Error(`Failed to ${isEditing ? "update" : "save"} entry`);
		}

		// Handle localStorage
		const logs = JSON.parse(localStorage.getItem("logs") || "[]");

		if (isEditing) {
			// Update existing log
			const index = logs.findIndex((l) => l.id === log.id);
			if (index !== -1) {
				logs[index] = log;
			}
		} else {
			// Add new log
			logs.push(log);
		}

		localStorage.setItem("logs", JSON.stringify(logs));

		// Reset button if we were editing
		if (isEditing) {
			saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Save Entry';
			saveLogBtn.removeAttribute("data-edit-id");
			saveLogBtn.removeAttribute("data-edit-timestamp");
		}

		// Update UI
		await displayLogs();

		// Generate appropriate message based on section
		const sectionMessage = getSectionMotivationalMessage(category);

		// Show notification for new entry
		if (!isEditing) {
			showNotification(sectionMessage);
		}

		showToast(
			isEditing
				? "Entry updated successfully!"
				: "Learning entry saved successfully!",
			"success"
		);

		// Ask if the user wants to continue adding entries
		if (!isEditing) {
			setTimeout(() => {
				const continueIterate = confirm(
					"Continue to iterate? Add another entry?"
				);
				if (continueIterate) {
					// Focus on the title field to start a new entry
					logTitleEl.focus();
				} else {
					// If user doesn't want to continue, maybe scroll to the logs section
					document
						.querySelector(".logs-section")
						.scrollIntoView({ behavior: "smooth" });
				}
			}, 500);
		}

		// Clear form - move this after the confirm dialog
		if (!isEditing) {
			logTitleEl.value = "";
			logCategoryEl.value = "html-css";
			logContentEl.value = "";
			logImportanceEl.value = 3;
		}
	} catch (error) {
		console.error("Error saving entry:", error);

		// Fallback to localStorage if backend fails
		const logs = JSON.parse(localStorage.getItem("logs") || "[]");

		if (isEditing) {
			// Update existing log
			const index = logs.findIndex((l) => l.id === log.id);
			if (index !== -1) {
				logs[index] = log;
			}
		} else {
			// Add new log
			logs.push(log);
		}

		localStorage.setItem("logs", JSON.stringify(logs));

		// Reset button if we were editing
		if (isEditing) {
			saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Save Entry';
			saveLogBtn.removeAttribute("data-edit-id");
			saveLogBtn.removeAttribute("data-edit-timestamp");
		}

		// Update UI
		displayLogs();

		// Generate appropriate message based on section
		const sectionMessage = getSectionMotivationalMessage(category);

		// Show notification for new entry
		if (!isEditing) {
			showNotification(sectionMessage);
		}

		showToast(
			isEditing
				? "Entry updated locally (offline mode)"
				: "Learning entry saved locally (offline mode)",
			"success"
		);

		// Ask if the user wants to continue adding entries
		if (!isEditing) {
			setTimeout(() => {
				const continueIterate = confirm(
					"Continue to iterate? Add another entry?"
				);
				if (continueIterate) {
					// Focus on the title field to start a new entry
					logTitleEl.focus();
				} else {
					// If user doesn't want to continue, maybe scroll to the logs section
					document
						.querySelector(".logs-section")
						.scrollIntoView({ behavior: "smooth" });
				}
			}, 500);
		}

		// Clear form - move this after the confirm dialog
		if (!isEditing) {
			logTitleEl.value = "";
			logCategoryEl.value = "html-css";
			logContentEl.value = "";
			logImportanceEl.value = 3;
		}
	}
}

// Get motivational message based on course section
function getSectionMotivationalMessage(category) {
	switch (category) {
		case "html-css":
			return "Great job learning HTML & CSS! You're building the foundation of the web!";
		case "javascript":
			return "JavaScript entry added! Keep mastering the language of the web!";
		case "node":
			return "Node.js progress logged! You're becoming a full-stack developer!";
		case "express":
			return "Express.js concepts recorded! Your backend skills are growing!";
		case "mongodb":
			return "MongoDB knowledge tracked! Database skills are crucial - great work!";
		case "project":
			return "Project work recorded! Building real applications is the best way to learn!";
		default:
			return "New bootcamp entry added! Keep up the great work!";
	}
}

// Format date for display
function formatDate(dateString) {
	const date = new Date(dateString);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	// If it's today or yesterday, show that instead of the date
	if (date.toDateString() === today.toDateString()) {
		return `Today at ${date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
	} else if (date.toDateString() === yesterday.toDateString()) {
		return `Yesterday at ${date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
	} else {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
}

// Create log item HTML
function createLogItemHTML(log) {
	// Create importance dots (now representing understanding level)
	let importanceDots = "";
	for (let i = 1; i <= 5; i++) {
		const activeClass = i <= log.importance ? "" : "inactive";
		importanceDots += `<span class="importance-dot ${activeClass}"></span>`;
	}

	// Get preview text - limit to 150 characters
	let preview = log.content;
	if (preview.length > 150) {
		preview = preview.substring(0, 147) + "...";
	}

	return `
        <div class="log-item ${log.category}" data-id="${log.id}">
            <div class="log-header">
                <h3 class="log-title">${log.title}</h3>
                <span class="log-date">${formatDate(log.timestamp)}</span>
            </div>
            <p class="log-preview">${preview}</p>
            <div class="log-meta">
                <span class="log-category category-${
									log.category
								}">${getCategoryDisplayName(log.category)}</span>
                <div class="log-importance">
                    <span>Understanding:</span>
                    <div class="importance-dots">
                        ${importanceDots}
                    </div>
                </div>
            </div>
            <div class="log-actions">
                <button class="action-btn edit-btn" title="Edit Entry"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" title="Delete Entry"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

// Get display name for category
function getCategoryDisplayName(category) {
	switch (category) {
		case "html-css":
			return "HTML & CSS";
		case "javascript":
			return "JavaScript";
		case "node":
			return "Node.js";
		case "express":
			return "Express";
		case "mongodb":
			return "MongoDB";
		case "project":
			return "Project";
		default:
			return category;
	}
}

// Fetch logs from the backend
async function fetchLogs() {
	try {
		const response = await fetch(`${API_BASE_URL}/api/logs`);

		if (!response.ok) {
			throw new Error(`Failed to fetch logs: ${response.status}`);
		}

		const logs = await response.json();
		return logs;
	} catch (error) {
		console.error("Error fetching logs:", error);
		// Fall back to localStorage if backend fetch fails
		return JSON.parse(localStorage.getItem("logs") || "[]");
	}
}

// Display logs in the UI
async function displayLogs() {
	try {
		let logs = await fetchLogs();

		// Update stats count
		statsCountEl.textContent = logs.length;

		// Update course progress
		updateCourseProgress(logs);

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
                    <i class="fas fa-code"></i>
                    <p>No entries found. Ready to add your first bootcamp learning entry?</p>
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
		showToast("Failed to load entries", "error");
	}
}

// Delete log
async function deleteLog(id) {
	if (!confirm("Are you sure you want to delete this learning entry?")) {
		return;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/logs/${id}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error(`Failed to delete entry: ${response.status}`);
		}

		// Also delete from localStorage
		let logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs = logs.filter((log) => log.id !== id);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Update UI
		displayLogs();
		showToast("Entry deleted successfully", "success");
	} catch (error) {
		console.error("Error deleting entry:", error);

		// Fallback to localStorage if backend fails
		let logs = JSON.parse(localStorage.getItem("logs") || "[]");
		logs = logs.filter((log) => log.id !== id);
		localStorage.setItem("logs", JSON.stringify(logs));

		// Update UI
		displayLogs();
		showToast("Entry deleted locally", "success");
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
	saveLogBtn.innerHTML = '<i class="fas fa-save"></i> Update Entry';
	saveLogBtn.dataset.editId = log.id;
	saveLogBtn.dataset.editTimestamp = log.timestamp;

	// Scroll to form and focus the title field
	document
		.querySelector(".input-section")
		.scrollIntoView({ behavior: "smooth" });
	setTimeout(() => logTitleEl.focus(), 500);
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

	// Get understanding level text
	let understandingText;
	if (log.importance <= 1) understandingText = "Need more review";
	else if (log.importance === 2) understandingText = "Basic understanding";
	else if (log.importance === 3) understandingText = "Good grasp";
	else if (log.importance === 4) understandingText = "Strong understanding";
	else understandingText = "Fully understood";

	// Fill modal content
	modalContent.innerHTML = `
        <h2 class="log-detail-title">${log.title}</h2>
        <div class="log-detail-meta">
            <span>Section: <span class="log-category category-${
							log.category
						}">${getCategoryDisplayName(log.category)}</span></span>
            <span>Date: ${formatDate(log.timestamp)}</span>
            <div class="log-importance">
                Understanding: 
                <div class="importance-dots" title="${understandingText}">
                    ${importanceDots}
                </div>
                <span class="comprehension-text">(${understandingText})</span>
            </div>
        </div>
        <div class="log-detail-content">
            ${log.content.replace(/\n/g, "<br>")}
        </div>
        <button class="btn primary" id="edit-from-modal">
            <i class="fas fa-edit"></i> Edit Entry
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

// Check email configuration
async function checkEmailConfiguration() {
	try {
		const statusDot = emailStatus.querySelector(".status-dot");
		const statusText = emailStatus.querySelector(".status-text");

		// Get email status from API endpoint rather than checking file directly
		const response = await fetch(`${API_BASE_URL}/api/status`);

		if (response.ok) {
			const statusData = await response.json();

			if (statusData.emailEnabled) {
				// Email is configured correctly
				statusDot.classList.add("active");
				statusText.textContent = "Email notifications are enabled";
			} else {
				// Email configuration exists but might be incomplete
				statusDot.classList.add("warning");
				statusText.textContent = "Email notifications are disabled";
			}
		} else {
			// Can't access API status
			statusDot.classList.add("error");
			statusText.textContent = "Can't check email configuration";
		}
	} catch (error) {
		console.error("Error checking email configuration:", error);
		const statusDot = emailStatus.querySelector(".status-dot");
		const statusText = emailStatus.querySelector(".status-text");
		statusDot.classList.add("error");
		statusText.textContent = "Error checking email configuration";
	}
}

// Test email function
async function testEmailNotification() {
	try {
		emailStatus.innerHTML =
			'<i class="fas fa-spinner fa-spin"></i> Testing email...';

		const response = await fetch(`${API_BASE_URL}/api/test-email`);
		const result = await response.json();

		if (result.success) {
			emailStatus.innerHTML =
				'<i class="fas fa-check-circle text-success"></i> Test email sent successfully!';
		} else {
			emailStatus.innerHTML = `<i class="fas fa-exclamation-circle text-danger"></i> ${result.message}`;
		}
	} catch (error) {
		emailStatus.innerHTML =
			'<i class="fas fa-exclamation-circle text-danger"></i> Failed to send test email. Check server logs.';
		console.error("Error testing email:", error);
	}
}

// Check authentication status
async function checkAuthStatus() {
	try {
		const response = await fetch(`${API_BASE_URL}/api/user`);

		if (!response.ok) {
			// If not authenticated, redirect to login page
			window.location.href = "/login.html";
			return;
		}

		const data = await response.json();
		if (data.authenticated) {
			// Update UI with username
			userInfoEl.innerHTML = `
        <span>Welcome, ${data.username}</span>
        <button id="logoutBtn" class="logout-btn">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      `;

			// Add logout functionality
			document.getElementById("logoutBtn").addEventListener("click", logout);
		} else {
			window.location.href = "/login.html";
		}
	} catch (error) {
		console.error("Error checking authentication:", error);
		window.location.href = "/login.html";
	}
}

// Logout function
async function logout() {
	try {
		const response = await fetch(`${API_BASE_URL}/api/logout`);
		const data = await response.json();

		if (data.success) {
			window.location.href = "/login.html";
		} else {
			showToast("Logout failed. Please try again.", "error");
		}
	} catch (error) {
		console.error("Logout error:", error);
		showToast("Logout failed. Please try again.", "error");
	}
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
	// Check authentication first
	checkAuthStatus();

	// Request notification permissions
	requestNotificationPermission();

	// Display current date
	displayCurrentDate();

	// Display logs
	displayLogs();

	// Save log button
	saveLogBtn.addEventListener("click", saveLog);

	// Filter logs by category
	filterCategoryEl.addEventListener("change", displayLogs);

	// Search logs
	searchLogsEl.addEventListener("input", () => {
		// Debounce search to avoid too many updates
		clearTimeout(searchLogsEl.searchTimeout);
		searchLogsEl.searchTimeout = setTimeout(() => {
			displayLogs();
		}, 300);
	});

	// Close modal when clicking on X
	closeModal.addEventListener("click", closeLogModal);

	// Close modal when clicking outside
	window.addEventListener("click", (e) => {
		if (e.target === logModal) {
			closeLogModal();
		}
	});

	// Keyboard shortcuts
	window.addEventListener("keydown", (e) => {
		// Escape key to close modal
		if (e.key === "Escape" && logModal.style.display === "block") {
			closeLogModal();
		}

		// Ctrl+Enter to save entry when in textarea
		if (
			e.key === "Enter" &&
			e.ctrlKey &&
			document.activeElement === logContentEl
		) {
			saveLog();
		}
	});

	// Sync logs with backend on page load
	syncLogsWithBackend();

	// Settings panel event listeners
	settingsToggle.addEventListener("click", function () {
		console.log("Settings toggle clicked");
		settingsPanel.classList.toggle("active");
	});

	closeSettings.addEventListener("click", function () {
		console.log("Close settings clicked");
		settingsPanel.classList.remove("active");
	});

	// Click outside to close settings panel
	document.addEventListener("click", function (event) {
		if (
			settingsPanel.classList.contains("active") &&
			!settingsPanel.contains(event.target) &&
			event.target !== settingsToggle
		) {
			console.log("Clicked outside settings panel, closing");
			settingsPanel.classList.remove("active");
		}
	});

	// Test email functionality
	testEmailBtn.addEventListener("click", async function () {
		testEmailBtn.disabled = true;
		testEmailBtn.innerHTML =
			'<i class="fas fa-spinner fa-spin"></i> Sending...';

		try {
			const response = await fetch(`${API_BASE_URL}/api/test-email`);
			const data = await response.json();

			if (data.success) {
				showNotification("Test email sent successfully!");
			} else {
				showNotification(
					"Failed to send test email. Check server logs.",
					"error"
				);
			}
		} catch (error) {
			showNotification("Error: " + error.message, "error");
		} finally {
			testEmailBtn.disabled = false;
			testEmailBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Test Email';
		}
	});

	// Check email configuration status
	checkEmailConfiguration();
});

// Sync logs between localStorage and backend
async function syncLogsWithBackend() {
	try {
		const localLogs = JSON.parse(localStorage.getItem("logs") || "[]");

		if (localLogs.length === 0) {
			return;
		}

		// Try to push local logs to server
		const response = await fetch(`${API_BASE_URL}/api/logs/sync`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ logs: localLogs }),
		});

		if (!response.ok) {
			throw new Error("Failed to sync entries with server");
		}

		console.log("Learning entries synced with backend successfully");

		// Refresh logs display after sync
		displayLogs();
	} catch (error) {
		console.error("Error syncing entries:", error);
	}
}
