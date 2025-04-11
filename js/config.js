/**
 * Configuration for Daily Logger
 * @format
 */

// API URL - Using your actual Render app URL when deployed
const API_BASE_URL =
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1"
		? "" // Empty for localhost (relative URLs)
		: window.location.hostname === "aryan-dani.github.io"
		? "https://daily-logger-7ial.onrender.com" // GitHub Pages to Render
		: "https://daily-logger-7ial.onrender.com"; // Default to Render URL

// Fix for GitHub Pages base path
const BASE_PATH =
	window.location.hostname === "aryan-dani.github.io"
		? "/Daily_logger" // Add repository name for GitHub Pages
		: "";

// Export for use in other scripts
window.API_BASE_URL = API_BASE_URL;
window.BASE_PATH = BASE_PATH;

console.log("Environment configuration loaded:");
console.log("API URL:", API_BASE_URL);
console.log("Base path:", BASE_PATH);
