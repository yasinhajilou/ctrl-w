/**
 * Session Model
 *
 * PURPOSE:
 * - Store temporary pairing sessions
 * - Generate unique 6-digit codes
 * - Track active participants (socket IDs)
 * - Auto-expire after configurable time
 * - Handle collision detection for codes
 *
 * - "6-digit codes give 1 million combinations (000000-999999)"
 * - "Indexing pairingCode ensures O(1) lookups instead of O(n) scans"
 *
 */

import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    // Pairing Code (6-digit string)
    pairingCode: {
      type: String,
      required: true,
      unique: true, // No two sessions can have the same code
      length: 6,
      match: /^[0-9]{6}$/, // Only digits 0-9,
      index: true, // Fast lookups by code
    },
    // Optional: Creator (if user is logged in)
    // Reference to User model
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Active Participants (array of socket IDs)
    // Socket IDs are temporary identifiers for WebSocket connections
    participants: [
      {
        socketId: {
          type: String,
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        //Optional
        deviceInfo: {
          type: String,
          default: 'Unknown',
        },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'expired', 'closed'],
      default: 'active',
      index: true, // fast filtering
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      //Different date for each session, based on creation time(Dynamic value)
      default: () => {
        const minutes = parseInt(process.env.SESSION_EXPIRY_MINUTES) || 30;
        return new Date(Date.now() + minutes * 60 * 1000);
      },
    },
    // Message Count (for analytics)
    messageCount: {
      type: Number,
      default: 0,
    },

    // File Count (for analytics)
    fileCount: {
      type: Number,
      default: 0,
    },

    // Last Activity (updated on each message/file)
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);


/**
 * Indexes
 * 
 * COMPOUND INDEX:
 * Optimize queries that filter by multiple fields
 * 
 * Example: Find active sessions by creator
 * db.sessions.find({ creator: userId, status: 'active' })
 */
sessionSchema.index({ creator: 1, status: 1 });
sessionSchema.index({ status: 1, expiresAt: 1 });

/**
 * TTL Index (Time-To-Live)
 * 
 * PURPOSE:
 * Automatically delete documents after they expire
 * 
 * HOW IT WORKS:
 * MongoDB checks every 60 seconds for documents where:
 * - expiresAt < current time
 * - Deletes matching documents automatically
 * 
 * INTERVIEW NOTE:
 * "TTL indexes are perfect for temporary data like sessions, OTPs, or cache.
 * MongoDB handles cleanup automatically, so we don't need cron jobs for
 * simple cases. For complex cleanup (cascading deletes), I'd use cron."
 * 
 * LIMITATION:
 * - Runs every 60 seconds (not instant deletion)
 * - Single field only (can't do compound TTL)
 */
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


/**
 * Static Method: Generate Unique Pairing Code
 * 
 * PURPOSE:
 * Create a random 6-digit code that doesn't already exist
 * 
 * ALGORITHM:
 * 1. Generate random 6-digit number
 * 2. Check if it exists in database
 * 3. If exists, retry (collision handling)
 * 4. If unique, return code
 * 
 * COLLISION PROBABILITY:
 * - Total codes: 1,000,000 (000000-999999)
 * - With 10,000 active sessions: ~1% collision rate
 * - With 100,000 active sessions: ~10% collision rate
 * 
 * 
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<string>} - Unique 6-digit code
 */
sessionSchema.statics.generateUniquePairingCode = async function (
  maxRetries = 10
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Generate random 6-digit number
    // Math.random() → 0.0 to 1.0
    // * 1000000 → 0 to 1000000
    // Math.floor() → Remove decimals
    // .toString().padStart(6, '0') → Ensure 6 digits (e.g., 000042)
    const code = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');

    // Check if code already exists
    const existing = await this.findOne({ pairingCode: code });

    if (!existing) {
      return code; // Unique code found!
    }

    // Code exists, retry
    console.log(`⚠️  Collision detected for code ${code}, retrying...`);
  }

  // Failed after max retries (very rare)
  throw new Error(
    'Failed to generate unique pairing code after maximum retries'
  );
};

/**
 * Instance Method: Add Participant
 * 
 * PURPOSE:
 * Add a socket ID to the session's participant list
 * 
 * USAGE:
 * const session = await Session.findOne({ pairingCode: '123456' });
 * await session.addParticipant('socket-id-abc', 'Chrome on iPhone');
 * 
 * @param {string} socketId - Socket.io connection ID
 * @param {string} deviceInfo - Optional device information
 */
sessionSchema.methods.addParticipant = async function (socketId, deviceInfo) {
  // Check if socket ID already exists (prevent duplicates)
  const exists = this.participants.some((p) => p.socketId === socketId);

  if (!exists) {
    this.participants.push({
      socketId,
      deviceInfo: deviceInfo || 'Unknown',
      joinedAt: new Date(),
    });

    this.lastActivity = new Date();
    await this.save();
  }
};

/**
 * Instance Method: Remove Participant
 * 
 * PURPOSE:
 * Remove a socket ID when user disconnects
 * 
 * @param {string} socketId - Socket.io connection ID
 */
sessionSchema.methods.removeParticipant = async function (socketId) {
  this.participants = this.participants.filter((p) => p.socketId !== socketId);
  this.lastActivity = new Date();

  // If no participants left, mark as closed
  if (this.participants.length === 0) {
    this.status = 'closed';
  }

  await this.save();
};

/**
 * Instance Method: Check if Expired
 * 
 * PURPOSE:
 * Manually check if session has expired (before TTL cleanup)
 * 
 * @returns {boolean} - True if session is expired
 */
sessionSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

/**
 * Instance Method: Extend Expiration
 * 
 * PURPOSE:
 * Reset expiration time (useful for active sessions)
 * 
 * USAGE:
 * On each message, extend the session to keep it alive
 * 
 * @param {number} minutes - Minutes to extend
 */
sessionSchema.methods.extendExpiration = async function (minutes) {
  const additionalMs = minutes * 60 * 1000;
  this.expiresAt = new Date(Date.now() + additionalMs);
  this.lastActivity = new Date();
  await this.save();
};

// Create the model
const Session = mongoose.model('Session', sessionSchema);

export default Session;
