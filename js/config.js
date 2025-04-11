/**
 * Configuration for Daily Logger
 * @format
 */

// API URL - Using your actual Render app URL when deployed
const API_BASE_URL =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1"
		? "" // Empty for localhost (relative URLs)
		: "https://daily-logger-7ial.onrender.com"; // This should be your actual deployed Render URL

// Export for use in other scripts
window.API_BASE_URL = API_BASE_URL;
