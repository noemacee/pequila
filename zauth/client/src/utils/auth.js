import { jwtDecode } from 'jwt-decode';

// Google OAuth configuration
export const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const VITE_GOOGLE_REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;  

// ID Token verification
export const verifyIdToken = (idToken) => {
  if (!idToken) return null;
  try {
    const decoded = jwtDecode(idToken);
    // Check if token is expired
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return decoded;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    return null;
  }
};

// Generate Google OAuth URL
export const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: VITE_GOOGLE_CLIENT_ID,
    redirect_uri: VITE_GOOGLE_REDIRECT_URI,
    response_type: 'token',
    scope: 'email profile',
    include_granted_scopes: 'true',
    prompt: 'select_account'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Handle Google OAuth callback
export const handleGoogleCallback = async (idToken) => {
  try {
    const decoded = jwtDecode(idToken);
    
    if (!decoded || !decoded.email) {
      throw new Error('Invalid ID token data');
    }

    // Store the ID token and user email
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('userEmail', decoded.email);

    return decoded;
  } catch (error) {
    console.error('Error handling Google callback:', error);
    // Clear any partial data
    localStorage.removeItem('idToken');
    localStorage.removeItem('userEmail');
    throw error;
  }
}; 