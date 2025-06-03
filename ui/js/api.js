// API utility functions for making authenticated requests

const apiBaseUrl = '/api';

/**
 * Get the current authentication token from localStorage
 * @returns {string|null} The ID token or null if not authenticated
 */
function getAuthToken() {
  return localStorage.getItem('idToken');
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - The API endpoint to call
 * @param {string} method - The HTTP method (GET, POST, PUT, DELETE)
 * @param {object} [body] - The request body (for POST/PUT)
 * @returns {Promise<any>} The response data
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  const options = {
    method,
    headers
  };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${apiBaseUrl}${endpoint}`, options);
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Token might be expired, redirect to login
      window.location.href = 'custom-login.html';
      throw new Error('Authentication failed');
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  // For DELETE requests that return 204 No Content
  if (response.status === 204) {
    return null;
  }
  
  return await response.json();
}

// API functions for care facilities
const facilityApi = {
  getAll: () => apiRequest('/care-facility'),
  getById: (id) => apiRequest(`/care-facility/${id}`),
  create: (facility) => apiRequest('/care-facility', 'POST', facility),
  update: (id, facility) => apiRequest(`/care-facility/${id}`, 'PUT', facility),
  delete: (id) => apiRequest(`/care-facility/${id}`, 'DELETE')
};

// API functions for visit requests
const visitRequestApi = {
  getAll: () => apiRequest('/visit-request'),
  getById: (id) => apiRequest(`/visit-request/${id}`),
  getByAssignedUser: (userId) => apiRequest(`/visit-request?assignedUserId=${userId}`),
  getUnassigned: () => apiRequest('/visit-request?assignedUserId=unassigned'),
  create: (request) => apiRequest('/visit-request', 'POST', request),
  update: (id, request) => apiRequest(`/visit-request/${id}`, 'PUT', request),
  delete: (id) => apiRequest(`/visit-request/${id}`, 'DELETE')
};

// API functions for users
const userApi = {
  getAll: () => apiRequest('/user'),
  getById: (id) => apiRequest(`/user/${id}`),
  create: (user) => apiRequest('/user', 'POST', user),
  update: (id, user) => apiRequest(`/user/${id}`, 'PUT', user),
  delete: (id) => apiRequest(`/user/${id}`, 'DELETE')
};