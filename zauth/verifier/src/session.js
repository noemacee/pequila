const crypto = require('crypto');

class SessionManager {
  constructor() {
    // In-memory store for sessions (in production, use Redis or a database)
    this.sessions = new Map();
    this.SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Create a new session after successful proof verification
  createSession(userData) {
    // Generate a random session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.SESSION_DURATION;

    // Store session data
    this.sessions.set(sessionToken, {
      userData,
      expiresAt,
      createdAt: Date.now()
    });

    return {
      sessionToken,
      expiresAt
    };
  }

  // Validate a session token
  validateSession(sessionToken) {
    const session = this.sessions.get(sessionToken);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    // Refresh session expiration
    session.expiresAt = Date.now() + this.SESSION_DURATION;
    return session;
  }

  // Remove a session (logout)
  removeSession(sessionToken) {
    this.sessions.delete(sessionToken);
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionToken, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionToken);
      }
    }
  }
}

// Create a singleton instance
const sessionManager = new SessionManager();

// Clean up expired sessions every hour
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = sessionManager; 