/**
 * User Model
 *
 * PURPOSE:
 * - Define user schema with validation
 * - Hash passwords before saving (security)
 * - Provide method to compare passwords (login)
 * - Support optional authentication (users can use app without accounts)
 *
 *
 * SECURITY:
 * - Passwords hashed with bcrypt (adaptive hashing)
 * - Salt rounds: 10 (good balance of security vs performance)
 * - Password field has select: false (excluded from queries by default)
 * - Email is unique and validated
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    // Email Field
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // Creates unique index in MongoDB
      lowercase: true, // Converts to lowercase before saving
      trim: true, // Removes whitespace
      validate: {
        validator: function (email) {
          // Simple email regex validation
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address',
      },
      index: true, // Creates index for fast lookups
    },

    // Password Field
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Excluded from queries by default (security)
    },

    // Role Field (for future admin features)
    role: {
      type: String,
      enum: ['user', 'admin'], // Only these values allowed
      default: 'user',
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Last Login Tracking (useful for analytics)
    lastLogin: {
      type: Date,
      default: null,
    },

    // Refresh Token Storage (for JWT refresh strategy)
    // Will implement in auth section
    refreshToken: {
      type: String,
      select: false, // Sensitive data, exclude by default
    },
  },
  {
    // Timestamps option adds createdAt and updatedAt automatically
    timestamps: true,

    // JSON transformation (what gets sent to client)
    toJSON: {
      transform: function (doc, ret) {
        // Remove sensitive fields when converting to JSON
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v; // Remove MongoDB version key
        return ret;
      },
    },
  }
);

/**
 * Pre-Save Middleware (Hook)
 *
 * PURPOSE:
 * Automatically hash password before saving to database
 *
 * WHEN IT RUNS:
 * - On user.save()
 * - On User.create()
 * - NOT on User.findByIdAndUpdate() (use save() instead)
 *
 *
 * FLOW:
 * 1. Check if password was modified (don't re-hash already hashed passwords)
 * 2. Generate salt (random data added to password)
 * 3. Hash password with salt
 * 4. Replace plain password with hash
 * 5. Continue to save operation
 */

userSchema.pre('save', async function (next) {
  // 'this' refers to the document being saved

  // Only hash if password is new or modified
  if (!this.isModified('password')) {
    return next(); // Skip hashing, move to next middleware
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance Method: Compare Password
 *
 * PURPOSE:
 * Check if provided password matches hashed password (for login)
 *
 * USAGE:
 * const user = await User.findOne({ email });
 * const isMatch = await user.comparePassword('userEnteredPassword');
 *
 *
 * @param {string} candidatePassword - Password to check
 * @returns {Promise<boolean>} - True if password matches
 */

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

/**
 * Static Method: Find By Credentials
 *
 * PURPOSE:
 * Helper method to find user and validate password in one call
 * Makes login logic cleaner
 *
 * STATIC vs INSTANCE:
 * - Static: Called on Model (User.findByCredentials)
 * - Instance: Called on document (user.comparePassword)
 *
 * USAGE:
 * const user = await User.findByCredentials('email@example.com', 'password123');
 */

userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
