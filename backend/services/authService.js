/**
 * Authentication Service
 *
 * PURPOSE:
 * - Handle JWT generation and verification
 * - Implement access + refresh token pattern
 * - Provide token rotation for security
 * - Abstract authentication logic from routes
 *
 * - "I use a service layer to separate business logic from HTTP layer"
 * - "Access tokens are short-lived (15 min), refresh tokens are long-lived (7 days)"
 * - "I store refresh tokens in database for revocation capability"
 * - "JWT payload is base64-encoded, not encrypted - never store secrets there"
 *
 * SECURITY PRINCIPLES:
 * - Principle of Least Privilege: Access tokens have minimal lifespan
 * - Defense in Depth: Multiple layers (token expiry, refresh rotation, database revocation)
 * - Secure by Default: httpOnly cookies for refresh tokens
 */

import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

/**
 * Generate Access Token
 *
 * PURPOSE:
 * Create short-lived token for API authorization
 *
 * PAYLOAD CONTENTS:
 * - userId: User identifier (for database lookups)
 * - email: User email (for convenience)
 * - role: User role (for authorization checks)
 * - iat: Issued at timestamp (automatic)
 * - exp: Expiration timestamp (automatic)
 *
 * "I keep the payload minimal to reduce token size. The signature
 * ensures integrity - nobody can modify the payload without detection."
 *
 * @param {Object} user - User document from database
 * @returns {string} - Signed JWT access token
 */

const generateAccessToken = (user) => {
  //payload(claims)
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '7m',
    issuer: 'ctrl-w-api', // Who issued the token
    audience: 'ctrl-w-client', // Who can use the token
  });
};
/**
 * Generate Refresh Token
 *
 * PURPOSE:
 * Create long-lived token for getting new access tokens
 *
 * DESIGN DECISION:
 * Refresh tokens have minimal payload (just userId) to reduce size
 * We look up user in database when refreshing anyway
 *
 * @param {Object} user - User document from database
 * @returns {string} - Signed JWT refresh token
 */
const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    type: 'refresh', // Distinguish from access tokens
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: 'ctrl-w-api',
    audience: 'ctrl-w-client',
  });
};

/**
 * Verify Access Token
 *
 * PURPOSE:
 * Validate token signature and expiration
 *
 * VERIFICATION CHECKS:
 * 1. Signature valid (token not tampered with)
 * 2. Not expired
 * 3. Issued by us (issuer check)
 * 4. Intended for us (audience check)
 *
 * THROWS:
 * - JsonWebTokenError: Invalid signature
 * - TokenExpiredError: Token expired
 * - NotBeforeError: Token used before valid
 *
 * @param {string} token - JWT access token
 * @returns {Object} - Decoded payload
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: 'ctrl-w-api',
      audience: 'ctrl-w-client',
    });
    return decoded;
  } catch (error) {
    if (error === 'TokenExpiredError') {
      const err = new Error('Access token has expired');
      err.name = 'TokenExpiredError';
      throw err;
    }

    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid access token');
      err.name = 'JsonWebTokenError';
      throw err;
    }

    throw error;
  }
};

/**
 * Verify Refresh Token
 *
 * PURPOSE:
 * Validate refresh token and check database revocation
 *
 * SECURITY NOTE:
 * Unlike access tokens (stateless), we verify refresh tokens against
 * the database to enable revocation (logout, security breach)
 *
 * @param {string} token - JWT refresh token
 * @returns {Object} - Decoded payload
 */
const verifyRefreshToken = async (token) => {
  try {
    // 1. Verify JWT signature and expiration
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'ctrl-w-api',
      audience: 'ctrl-w-client',
    });

    // 2. Check token type
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // 3. Verify token exists in database (not revoked)
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user) {
      throw new Error('User not found');
    }

    if (user.refreshToken !== token) {
      throw new Error('Refresh token has been revoked');
    }

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Refresh token has expired');
      err.name = 'TokenExpiredError';
      throw err;
    }

    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid refresh token');
      err.name = 'JsonWebTokenError';
      throw err;
    }

    throw error;
  }
};

/**
 * Register New User
 * 
 * PURPOSE:
 * Create user account and return tokens
 * 
 * FLOW:
 * 1. Validate email doesn't exist
 * 2. Create user (password auto-hashed by pre-save hook)
 * 3. Generate tokens
 * 4. Store refresh token in database
 * 5. Return tokens and user info
 * 
 * @param {string} email - User email
 * @param {string} password - User password (will be hashed)
 * @param {string} role - User role (default: 'user')
 * @returns {Object} - { user, accessToken, refreshToken }
 */
const register = async (email, password, role = 'user') => {
  try {
    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 409; // Conflict
      throw error;
    }

    // 2. Create user (password hashed by pre-save hook)
    const user = await User.create({
      email,
      password,
      role,
    });

    // 3. Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 4. Store refresh token in database
    user.refreshToken = refreshToken;
    await user.save();

    // 5. Return user and tokens (exclude password)
    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Login Existing User
 * 
 * PURPOSE:
 * Authenticate user and return tokens
 * 
 * FLOW:
 * 1. Find user by email
 * 2. Verify password
 * 3. Generate new tokens
 * 4. Store refresh token (invalidates old token)
 * 5. Update last login timestamp
 * 6. Return tokens and user info
 * 
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} - { user, accessToken, refreshToken }
 */
const login = async (email, password) => {
  try {
    // 1. Find user and verify credentials (using static method)
    const user = await User.findByCredentials(email, password);

    // 2. Generate new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 3. Store refresh token (replaces old token)
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // 4. Return user and tokens
    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    // Enhance error for authentication failures
    if (error.message === 'Invalid credentials') {
      error.statusCode = 401; // Unauthorized
    }
    throw error;
  }
};

/**
 * Refresh Access Token
 * 
 * PURPOSE:
 * Generate new access token using valid refresh token
 * 
 * SECURITY: Token Rotation
 * We generate a NEW refresh token each time to prevent replay attacks
 * If an attacker steals a refresh token, it becomes invalid on next use
 * 
 * "I implement token rotation: each refresh generates a new refresh token.
 * This limits the window of vulnerability if a token is compromised."
 * 
 * @param {string} refreshToken - Current refresh token
 * @returns {Object} - { accessToken, refreshToken }
 */
const refresh = async (refreshToken) => {
  try {
    // 1. Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken);

    // 2. Get user from database
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // 3. Generate NEW access token
    const newAccessToken = generateAccessToken(user);

    // 4. Generate NEW refresh token (token rotation)
    const newRefreshToken = generateRefreshToken(user);

    // 5. Store new refresh token (invalidates old one)
    user.refreshToken = newRefreshToken;
    await user.save();

    // 6. Return both tokens
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    error.statusCode = 401; // Unauthorized
    throw error;
  }
};

/**
 * Logout User
 * 
 * PURPOSE:
 * Invalidate refresh token (access token expires naturally)
 * 
 * STATELESS CHALLENGE:
 * Access tokens can't be revoked (stateless), so they remain valid
 * until expiration. This is why we use short expiry times (15 min).
 * 
 * Refresh token CAN be revoked (stored in database).
 * 
 "How would you immediately revoke access tokens?"
 * "Implement a token blacklist in Redis with TTL matching token
 * expiry. Check blacklist on each request. Trade-off: Adds latency and
 * loses pure statelessness. For most apps, 15-min expiry is acceptable."
 * 
 * @param {string} userId - User ID
 * @returns {void}
 */
const logout = async (userId) => {
  try {
    // Remove refresh token from database
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 }, // Remove field
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Verify User Token (for WebSocket auth)
 * 
 * PURPOSE:
 * Verify token and return user ID for socket authentication
 * 
 * @param {string} token - JWT access token
 * @returns {string} - User ID
 */
const verifyUserToken = async (token) => {
  try {
    const decoded = verifyAccessToken(token);
    
    // Optionally verify user still exists and is active
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    return decoded.userId;
  } catch (error) {
    throw error;
  }
};

// Export all functions
export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  register,
  login,
  refresh,
  logout,
  verifyUserToken,
};