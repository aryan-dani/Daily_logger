/** @format */

// DEBUG - verify script loading
console.log("DEBUG: app.js is loading at", new Date().toTimeString());

// Colt Steele's Web Developer Bootcamp Learning Journal

// Use the API_BASE_URL and BASE_PATH from config.js
console.log("App initialization with API_BASE_URL:", window.API_BASE_URL);
console.log("App initialization with BASE_PATH:", window.BASE_PATH);

// Debug function to help diagnose issues
function debugApp() {
  console.log("---------- DEBUG INFO ----------");
  console.log("API_BASE_URL:", window.API_BASE_URL);
  console.log("BASE_PATH:", window.BASE_PATH);
  console.log("isAuthenticated:", window.isAuthenticated);
  console.log("appInitialized:", window.appInitialized);
  console.log("User session data:", document.cookie);

  // Check if settings toggle exists
  const settingsToggle = document.getElementById("settings-toggle");
  console.log("Settings toggle exists:", !!settingsToggle);

  // Check if settings panel exists
  const settingsPanel = document.getElementById("settings-panel");
  console.log("Settings panel exists:", !!settingsPanel);

  // Check email configuration
  fetch(`${window.API_BASE_URL}/api/email-status`, {
    credentials: "include",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Email configuration status:", data);
      alert("Debug info logged to console. Check browser developer tools.");
    })
    .catch((error) => {
      console.error("Failed to check email status:", error);
      alert("Debug info logged to console. Email status check failed.");
    });
}

// DOM Elements - only create references, actual elements are found in initializeApp
let currentDateEl,
  logTitleEl,
  logCategoryEl,
  logContentEl,
  logImportanceEl,
  saveLogBtn,
  logsListEl,
  filterCategoryEl,
  searchLogsEl,
  statsCountEl,
  logModal,
  modalContent,
  closeModal,
  progressBarEl,
  daysLoggedEl,
  progressPercentageEl,
  notificationEl,
  notificationTextEl,
  settingsToggle,
  settingsPanel,
  closeSettings,
  testEmailBtn,
  emailStatus,
  logoutBtn; // Add logoutBtn

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
  if (currentDateEl) {
    currentDateEl.textContent = now.toLocaleDateString("en-US", options);
    console.log("Date updated successfully:", currentDateEl.textContent);
  } else {
    console.error("Current date element not found");
  }
}

// Show notification
function showNotification(message, type = "success") {
  if (!notificationEl || !notificationTextEl) {
    console.error("Notification elements not found");
    return;
  }

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
  if (Notification && Notification.permission === "granted") {
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
  if (!daysLoggedEl || !progressPercentageEl || !progressBarEl) {
    console.error("Progress elements not found");
    return { daysLogged: 0, progressPercentage: 0 };
  }

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
  console.log("Save log function called");

  // Verify DOM elements before proceeding
  if (!logTitleEl || !logCategoryEl || !logContentEl || !logImportanceEl) {
    console.error("Missing form elements:", {
      title: !!logTitleEl,
      category: !!logCategoryEl,
      content: !!logContentEl,
      importance: !!logImportanceEl,
    });
    showToast("Error: Form elements not found", "error");
    return;
  }

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
    console.log("API_BASE_URL:", window.API_BASE_URL);

    // Send log to backend with dynamic URL
    const url = isEditing
      ? `${window.API_BASE_URL}/api/logs/${log.id}`
      : `${window.API_BASE_URL}/api/logs`;

    console.log("Sending log to URL:", url);
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(log),
      credentials: "include", // For authentication cookies
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      throw new Error(
        `Failed to ${isEditing ? "update" : "save"} entry: ${response.status}`
      );
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

    // Clear form - do this first before any dialogs
    if (!isEditing) {
      logTitleEl.value = "";
      logCategoryEl.value = "html-css";
      logContentEl.value = "";
      logImportanceEl.value = 3;
    }

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
  } catch (error) {
    console.error("Error saving entry:", error);

    // Show error notification
    showToast("Error saving entry: " + error.message, "error");

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

    // Update UI with local data
    displayLogs();
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
    console.log("Fetching logs from:", `${window.API_BASE_URL}/api/logs`);
    const response = await fetch(`${window.API_BASE_URL}/api/logs`, {
      credentials: "include", // This is critical for authenticated requests
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch logs:",
        response.status,
        response.statusText
      );
      throw new Error(`Failed to fetch logs: ${response.status}`);
    }

    const logs = await response.json();
    console.log("Fetched logs:", logs);
    return logs;
  } catch (error) {
    console.error("Error fetching logs:", error);
    // Fall back to localStorage if backend fetch fails
    const localLogs = JSON.parse(localStorage.getItem("logs") || "[]");
    console.log("Using local logs instead:", localLogs);
    return localLogs;
  }
}

// Display logs in the UI
async function displayLogs() {
  if (!logsListEl || !statsCountEl) {
    console.error("Logs list or stats count element not found");
    return;
  }

  try {
    let logs = await fetchLogs();

    // Update stats count
    statsCountEl.textContent = logs.length;

    // Update course progress
    updateCourseProgress(logs);

    // Apply filters
    const filterCategory = filterCategoryEl ? filterCategoryEl.value : "all";
    const searchTerm = searchLogsEl ? searchLogsEl.value.toLowerCase() : "";

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

// Initialize app
function initializeApp() {
  console.log("Initializing app...");
  window.appInitialized = true;

  // Find DOM elements
  currentDateEl = document.getElementById("current-date");
  logTitleEl = document.getElementById("log-title");
  logCategoryEl = document.getElementById("log-category");
  logContentEl = document.getElementById("log-content");
  logImportanceEl = document.getElementById("log-importance");
  saveLogBtn = document.getElementById("save-log");
  logsListEl = document.getElementById("logs-list");
  filterCategoryEl = document.getElementById("filter-category");
  searchLogsEl = document.getElementById("search-logs");
  statsCountEl = document.getElementById("stats-count");
  logModal = document.getElementById("log-modal");
  modalContent = document.getElementById("modal-content");
  closeModal = document.querySelector(".close-modal");
  progressBarEl = document.getElementById("course-progress-bar");
  daysLoggedEl = document.getElementById("days-logged");
  progressPercentageEl = document.getElementById("progress-percentage");
  notificationEl = document.getElementById("notification");
  notificationTextEl = document.getElementById("notification-text");
  settingsToggle = document.getElementById("settings-toggle");
  settingsPanel = document.getElementById("settings-panel");
  closeSettings = document.querySelector(".close-settings");
  testEmailBtn = document.getElementById("test-email-btn");
  emailStatus = document.getElementById("email-status");
  logoutBtn = document.getElementById("logout-btn"); // Find logout button

  // Display current date
  displayCurrentDate();

  // Load and display logs
  displayLogs();

  // Add event listeners
  if (saveLogBtn) {
    saveLogBtn.addEventListener("click", saveLog);
  }

  // Add event listeners for settings panel
  if (settingsToggle && settingsPanel && closeSettings) {
    settingsToggle.addEventListener("click", function () {
      console.log("Settings toggle clicked!"); // DEBUG
      settingsPanel.classList.toggle("show");
    });

    closeSettings.addEventListener("click", function () {
      console.log("Close settings clicked!"); // DEBUG
      settingsPanel.classList.remove("show");
    });

    // Close settings panel if clicking outside of it
    document.addEventListener("click", function (event) {
      if (
        !settingsPanel.contains(event.target) &&
        !settingsToggle.contains(event.target) &&
        settingsPanel.classList.contains("show")
      ) {
        console.log("Clicked outside settings panel, closing."); // DEBUG
        settingsPanel.classList.remove("show");
      }
    });
  } else {
    console.error("Settings panel elements not found!"); // DEBUG
  }

  // Set up test email functionality
  if (testEmailBtn && emailStatus) {
    // Check email status on load
    checkEmailStatus();

    // Add event listener for test email button
    testEmailBtn.addEventListener("click", sendTestEmail);
  }

  // Add event listener for logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  // Request notification permission
  requestNotificationPermission();

  console.log("App initialization complete!");
}

// Make sure debugApp is available globally
window.debugApp = debugApp;

// Check email configuration status
async function checkEmailStatus() {
  if (!emailStatus) {
    console.error("Email status element not found");
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/status`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to check email status: ${response.status}`);
    }

    const data = await response.json();

    if (data.emailEnabled) {
      emailStatus.textContent = "Email notifications are enabled";
      emailStatus.className = "status enabled";
      testEmailBtn.disabled = false;
    } else {
      emailStatus.textContent = "Email notifications are disabled";
      emailStatus.className = "status disabled";
      testEmailBtn.disabled = true;
    }
  } catch (error) {
    console.error("Error checking email status:", error);
    emailStatus.textContent = "Unable to check email status";
    emailStatus.className = "status error";
    testEmailBtn.disabled = true;
  }
}

// Send test email
async function sendTestEmail() {
  if (!testEmailBtn || !emailStatus) {
    console.error("Test email button or email status element not found");
    return;
  }

  // Disable button and show loading state
  testEmailBtn.disabled = true;
  testEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/test-email`, {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      showToast("Test email sent successfully!", "success");
    } else {
      showToast("Failed to send test email: " + data.message, "error");
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    showToast("Error sending test email: " + error.message, "error");
  } finally {
    // Reset button state
    testEmailBtn.disabled = false;
    testEmailBtn.innerHTML =
      '<i class="fas fa-paper-plane"></i> Send Test Email';
  }
}

// Logout user
async function logoutUser() {
  console.log("Logging out user...");
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/logout`, {
      method: "GET", // Or POST depending on your server implementation
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Clear any client-side authentication tokens/flags
      if (window.auth && typeof window.auth.clearAuthToken === "function") {
        window.auth.clearAuthToken(); // Use auth utility if available
      } else {
        localStorage.removeItem("authToken"); // Fallback
      }
      window.isAuthenticated = false; // Update flag
      console.log("Logout successful, redirecting to login.");
      // Redirect to login page
      window.location.href = `${window.BASE_PATH || ""}/login.html`;
    } else {
      throw new Error(data.error || "Logout failed on server.");
    }
  } catch (error) {
    console.error("Error logging out:", error);
    showToast(`Logout failed: ${error.message}`, "error");
  }
}

// Delete log entry
async function deleteLog(logId) {
  if (!confirm("Are you sure you want to delete this entry?")) {
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/logs/${logId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete entry: ${response.status}`);
    }

    // Remove from localStorage
    let logs = JSON.parse(localStorage.getItem("logs") || "[]");
    logs = logs.filter((log) => log.id !== logId);
    localStorage.setItem("logs", JSON.stringify(logs));

    showToast("Entry deleted successfully!", "success");
    await displayLogs(); // Refresh the list
  } catch (error) {
    console.error("Error deleting entry:", error);
    showToast(`Error deleting entry: ${error.message}`, "error");
    // Optionally, refresh logs even on error to ensure consistency with server state if possible
    await displayLogs();
  }
}

// Prepare log entry for editing
function editLog(log) {
  if (!log) return;

  logTitleEl.value = log.title;
  logCategoryEl.value = log.category;
  logContentEl.value = log.content;
  logImportanceEl.value = log.importance;

  // Change button text and add data attributes
  saveLogBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Entry';
  saveLogBtn.dataset.editId = log.id;
  // Store original timestamp to preserve it on update
  saveLogBtn.dataset.editTimestamp = log.timestamp;

  // Scroll to the input form for easy editing
  document
    .querySelector(".input-section")
    .scrollIntoView({ behavior: "smooth" });
  logTitleEl.focus(); // Focus the title field
}

// Open log details in modal
function openLogDetails(log) {
  if (!log || !logModal || !modalContent) return;

  // Create importance dots for the modal
  let importanceDots = "";
  for (let i = 1; i <= 5; i++) {
    const activeClass = i <= log.importance ? "" : "inactive";
    importanceDots += `<span class="importance-dot ${activeClass}"></span>`;
  }

  modalContent.innerHTML = `
        <h2 class="log-detail-title">${log.title}</h2>
        <div class="log-detail-meta">
            <span><strong>Category:</strong> ${getCategoryDisplayName(
              log.category
            )}</span>
            <span><strong>Date:</strong> ${formatDate(log.timestamp)}</span>
            <div class="log-importance">
                <span><strong>Understanding:</strong></span>
                <div class="importance-dots">
                    ${importanceDots}
                </div>
            </div>
        </div>
        <div class="log-detail-content">
            ${log.content.replace(/\n/g, "<br>")}
        </div>
    `;
  logModal.style.display = "block";
}

// Call initializeApp only if the user is authenticated
if (window.isAuthenticated) {
  console.log("User is authenticated, initializing app");
  initializeApp();
} else {
  console.log("Waiting for authentication before initializing app");
  // The init function will be called after authentication in index.html
}
