import axios from 'axios';

export const sessionManager = {
  // Get the current session token
  getToken() {
    return localStorage.getItem('sessionToken');
  },

  // Check if session is valid
  isSessionValid() {
    const token = this.getToken();
    const expiresAt = localStorage.getItem('sessionExpiresAt');
    
    if (!token || !expiresAt) return false;
    
    // Check if token is expired
    return Date.now() < parseInt(expiresAt);
  },

  // Set up session
  setupSession(token, expiresAt) {
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('sessionExpiresAt', expiresAt);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  

  // Clear session (logout)
  clearSession() {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sessionExpiresAt');
    delete axios.defaults.headers.common['Authorization'];
  },

  // Initialize session from storage
  initializeSession() {
    const token = this.getToken();
    if (token && this.isSessionValid()) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    }
    return false;
  }
}; 