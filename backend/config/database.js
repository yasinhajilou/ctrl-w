/**
 * MongoDB Database Configuration
 *
 * PURPOSE:
 * - Establishes connection to MongoDB Atlas
 * - Implements connection pooling for performance
 * - Handles connection errors and retries
 * - Provides graceful shutdown on app termination
 *
 *
 * KEY CONCEPTS:
 * - Connection Pooling: Reuse database connections
 * - Retry Logic: Handle temporary network failures
 * - Event Listeners: Monitor connection state
 * - Graceful Shutdown: Close connections cleanly
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Database Connection Options
 *
 * EXPLANATION:
 * These options configure Mongoose's behavior when connecting to MongoDB
 */

const options = {
  // Maximum number of connections in the pool
  // Higher = more concurrent operations, but more memory
  maxPoolSize: 10,
  // Minimum number of connections to maintain
  // Keeps connections "warm" for faster requests
  minPoolSize: 5,
  // How long to wait for a connection before timing out (ms)
  // 10 seconds is reasonable for cloud databases
  serverSelectionTimeoutMS: 10000,
  // How long a socket stays open before timing out (ms)
  // 45 seconds allows for long-running queries
  socketTimeoutMs: 45000,
  // Automatically create indexes defined in schemas
  // Set to false in production (create indexes manually)
  autoIndex: process.env.NODE_ENV === 'development',
};

/**
 * Connect to MongoDB
 *
 * FLOW:
 * 1. Validate MONGO_URI exists
 * 2. Attempt connection with retry logic
 * 3. Set up event listeners for monitoring
 * 4. Return connection status
 *
 * @returns {Promise<void>}
 */

const connectDB = async () => {
  try {
    if ((!process.env.MONGO_URI)) {
      throw new Error(
        'MONGO_URI is not defined in environment variables. Check your .env file.'
      );
    }

    console.log('Connecting to MongoDB...');

    // Attempt connection
    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);

    // Set up connection event listeners
    setupConnectionListeners();
  } catch (error) {
    // In production, you might want to retry
    // For development, exit to force developer to fix config
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    } else {
      console.error('💡Tip: Check your MONGO_URI in .env file' , error.message);
      process.exit(1);
    }
  }
};

/**
 * Set Up Connection Event Listeners
 *
 * PURPOSE:
 * Monitor connection state(health) changes for debugging and alerting
 *
 * EVENTS:
 * - connected: Initial connection established
 * - disconnected: Connection lost (network issues, server restart)
 * - error: Connection error occurred
 * - reconnected: Successfully reconnected after disconnection
 *
 * these would integrate with monitoring tools like Datadog or New Relic.
 */

const setupConnectionListeners = () => {
  const db = mongoose.connection;

  // Connection established
  db.on('connected', () => {
    console.log(' Mongoose connected to MongoDB');
  });

  // Connection lost
  db.on('disconnected', () => {
    console.warn('  Mongoose disconnected from MongoDB');
  });

  // Connection error
  db.on('error', (error) => {
    console.error(' Mongoose connection error:', error.message);
  });

  // Successfully reconnected
  db.on('reconnected', () => {
    console.log(' Mongoose reconnected to MongoDB');
  });
};

/**
 * Gracefully Close Database Connection
 *
 * PURPOSE:
 * Ensures all pending operations complete before shutdown
 * Prevents data corruption and connection leaks
 *
 * WHEN CALLED:
 * - Process termination (Ctrl+C)
 * - Server shutdown
 * - During tests (cleanup)
 *
 */

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log(' MongoDB connection closed gracefully');
  } catch (error) {
    console.error(' Error closing MongoDB connection:', error.message);
    process.exit(1);
  }
};

/**
 * Handle Process Termination Signals
 *
 * SIGNALS:
 * - SIGINT: Ctrl+C in terminal
 * - SIGTERM: Kill command or container orchestrator (Docker, K8s)
 *
 * FLOW:
 * 1. Receive termination signal
 * 2. Close database connection
 * 3. Exit process cleanly
 */

process.on('SIGINT', async () => {
  console.log('SIGINT received: Closing MongoDB connection...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received: Closing MongoDB connection...');
  await disconnectDB();
  process.exit(0);
});


export {connectDB , disconnectDB}