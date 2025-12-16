/**
 * Message Model
 * 
 * PURPOSE:
 * - Store chat messages for session history
 * - Link messages to sessions
 * - Track sender information
 * - Support optional persistence for logged-in users
 * 
 * - "Messages are linked to sessions via foreign key (sessionId)"
 * - "For anonymous sessions, messages are deleted with the session"
 * - "For logged-in users, messages could persist (optional feature)"
 * 
 * DESIGN DECISIONS:
 * - Why store messages? Optional history feature, debugging, analytics
 * - Why not just WebSocket? WebSocket is ephemeral, DB is persistent
 * - Could be optional (env var) to reduce database storage
 */

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    // Link to Session
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true, // Fast lookups by session
    },

    // Sender Information
    // We store socket ID since users might be anonymous
    senderSocketId: {
      type: String,
      required: true,
    },

    // Optional: Link to User (if sender is logged in)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Message Content
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [10000, 'Message cannot exceed 10000 characters'],
    },

    // Message Type (for future extensions)
    type: {
      type: String,
      enum: ['text', 'system'], // 'system' for "User joined", etc.
      default: 'text',
    },

    // Read Status (for future read receipts feature)
    readBy: [
      {
        socketId: String,
        readAt: Date,
      },
    ],

    // Delivery Status
    delivered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/**
 * Compound Index
 * 
 * PURPOSE:
 * Optimize query: "Get all messages for a session, sorted by time"
 * 
 * QUERY:
 * Message.find({ session: sessionId }).sort({ createdAt: 1 })
 * 
 * Without index: O(n) - Scans all messages
 * With index: O(log n) - Uses B-tree lookup
 * 
 */
messageSchema.index({ session: 1, createdAt: 1 });

/**
 * Static Method: Get Session History
 * 
 * PURPOSE:
 * Retrieve all messages for a session, sorted chronologically
 * 
 * USAGE:
 * const history = await Message.getSessionHistory(sessionId, limit);
 * 
 * @param {ObjectId} sessionId - Session ID
 * @param {number} limit - Maximum messages to return
 * @returns {Promise<Array>} - Array of messages
 */
messageSchema.statics.getSessionHistory = async function (sessionId, limit = 50) {
  return this.find({ session: sessionId })
    .sort({ createdAt: 1 }) // Oldest first
    .limit(limit)
    .select('content senderSocketId type createdAt') // Only needed fields
    .lean(); // Return plain JS objects (faster, no Mongoose overhead)
};

/**
 * Pre-Save Hook: Update Session Message Count
 * 
 * PURPOSE:
 * Automatically increment messageCount in parent session
 * 
 * "This maintains a denormalized counter for performance. Instead of
 * COUNT(*) queries (slow on large collections), we track the count.
 * Trade-off: Slight write overhead for much faster reads."
 */
messageSchema.post('save', async function () {
  try {
    // Import Session model (avoid circular dependency)
    const Session = mongoose.model('Session');
    
    // Increment messageCount and update lastActivity
    await Session.findByIdAndUpdate(this.session, {
      $inc: { messageCount: 1 },
      $set: { lastActivity: new Date() },
    });
  } catch (error) {
    console.error('Error updating session message count:', error);
  }
});

/**
 * Cascade Delete
 * 
 * PURPOSE:
 * When a session is deleted, delete all its messages
 * 
 * IMPLEMENTATION:
 * Done in Session model's pre-remove hook (Step 3.2)
 * Or use MongoDB's cascade delete (but we'll do it in code for control)
 */

const Message = mongoose.model('Message', messageSchema);

export default Message;