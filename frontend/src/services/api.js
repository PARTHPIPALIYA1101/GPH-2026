const API_BASE = '/api';

export async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  const token = localStorage.getItem('gov_auth_token');
  const customHeaders = {
    'Accept': 'application/json',
    ...headers
  };

  if (token) {
    customHeaders['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers: customHeaders
  };

  if (body) {
    if (body instanceof FormData) {
      delete customHeaders['Content-Type'];
      options.body = body;
    } else {
      customHeaders['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    localStorage.removeItem('gov_auth_token');
    localStorage.removeItem('gov_auth_user');
    window.location.reload();
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || `Request failed with status ${response.status}`);
    }
    return data;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.text();
}
