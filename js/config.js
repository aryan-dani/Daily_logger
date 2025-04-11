/**
 * Configuration for Daily Logger
 * @format
 */

// API URL - Change this to your Render app URL when deploying
const API_BASE_URL =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1"
		? "" // Empty for localhost (relative URLs)
		: "https://daily-logger-7ial.onrender.com"; // Replace with your actual Render service URL

// Export for use in other scripts
window.API_BASE_URL = API_BASE_URL;
