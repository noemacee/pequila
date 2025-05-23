const crypto = require('crypto');

class SessionManager {
  constructor() {
    // In-memory store for sessions (in production, use Redis or a database)
    this.sessions = new Map();
    this.SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    this.startCleanupInterval();
  }

  // Create a new session after successful proof verification
  createSession(userId) {
    // Generate a random session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.SESSION_DURATION;

    // Store session data
    this.sessions.set(token, {
      userId,
      expiresAt,
      createdAt: Date.now()
    });

    return {
      token,
      expiresAt
    };
  }

  // Validate a session token
  validateSession(token) {
    const session = this.sessions.get(token);
    
    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  // Remove a session (logout)
  removeSession(token) {
    this.sessions.delete(token);
  }

  startCleanupInterval() {
    // Clean up expired sessions every hour
    setInterval(() => {
      const now = Date.now();
      for (const [token, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          this.sessions.delete(token);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Create a singleton instance
const sessionManager = new SessionManager();

// Store for pending SSO requests
const pendingSSORequests = new Map();

module.exports = {
    sessionManager,
    pendingSSORequests
}; 