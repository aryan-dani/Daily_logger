/** @format */

// Authentication utilities for the Daily Logger app

// Store the auth token after login
function storeAuthToken(token) {
	localStorage.setItem("authToken", token);
	console.log("Auth token stored");
}

// Clear the auth token on logout
function clearAuthToken() {
	localStorage.removeItem("authToken");
	console.log("Auth token cleared");
}

// Get the stored auth token (if any)
function getAuthToken() {
	return localStorage.getItem("authToken");
}

// Check if the user has an auth token
function hasAuthToken() {
	return !!getAuthToken();
}

// Create fetch headers with auth token if available
function getAuthHeaders() {
	const headers = {
		"Content-Type": "application/json",
	};

	const token = getAuthToken();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	return headers;
}

// Fetch with authentication
async function fetchWithAuth(url, options = {}) {
	// Merge provided headers with auth headers
	const headers = {
		...getAuthHeaders(),
		...options.headers,
	};

	return fetch(url, {
		...options,
		headers,
		credentials: "include", // Keep this for session cookies as fallback
	});
}

// Export for use in other modules
window.auth = {
	storeAuthToken,
	clearAuthToken,
	getAuthToken,
	hasAuthToken,
	getAuthHeaders,
	fetchWithAuth,
};
