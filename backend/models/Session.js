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
        const minutes = parsInt(process.env.SESSION_EXPIRY_MINUTES) || 30;
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

