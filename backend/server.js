/**
 * Server Entry Point
 *
 * PURPOSE:
 * - Initialize Express application
 * - Connect to database
 * - Start HTTP server
 * - Handle startup errors
 *
 * FLOW:
 * 1. Load environment variables
 * 2. Connect to MongoDB
 * 3. Start Express server
 * 4. Listen for requests
 */

import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

// Load environment variables FIRST (before anything else)
dotenv.config();

/**
 * Start Server
 *
 * ASYNC/AWAIT PATTERN:
 * We use async/await to ensure database connects before accepting requests
 * This prevents "database not connected" errors on first requests
 */
const startServer = async () => {
  try {
    // Step 1: Connect to database
    await connectDB();

    // Step 2: Get port from environment (default: 5000)
    const PORT = process.env.PORT || 5000;

    // Step 3: Create a simple test server (will replace with Express later)
    console.log(`🚀 Server would start on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log('✅ Database connected successfully!');
  } catch (error) {
    console.log(
      'an error happened while trying to start the server:',
      error.message
    );
    process.exit(1);
  }
};

startServer();
