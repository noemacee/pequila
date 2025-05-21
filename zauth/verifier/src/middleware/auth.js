const sessionManager = require('../session');

function requireAuth(req, res, next) {
  // Get session token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No session token provided'
    });
  }

  const sessionToken = authHeader.split(' ')[1];
  const session = sessionManager.validateSession(sessionToken);

  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token'
    });
  }

  // Attach session data to request object
  req.session = session;
  next();
}

module.exports = {
  requireAuth
}; 