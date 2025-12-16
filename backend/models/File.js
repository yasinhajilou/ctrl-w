/**
 * File Model
 * 
 * PURPOSE:
 * - Store metadata for uploaded files
 * - Track Cloudinary URLs and public IDs
 * - Link files to sessions
 * - Enable file deletion from Cloudinary
 * 
 * - "I store file metadata in MongoDB, actual files in Cloudinary CDN"
 * - "Storing public_id allows programmatic deletion from Cloudinary"
 * - "File validation happens before upload (size, type)"
 * - "CDN URLs are permanent even after session expires (optional cleanup)"
 * 
 * DESIGN DECISIONS:
 * - Why Cloudinary? Free CDN, automatic optimization, no server storage
 * - Why store metadata? Track uploads, enable deletion, analytics
 * - Why 4MB limit? Balance of UX vs infrastructure cost
 */

import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    // Link to Session
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },

    // Uploader Information
    uploaderSocketId: {
      type: String,
      required: true,
    },

    // Optional: Link to User (if uploader is logged in)
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Cloudinary Information
    cloudinaryUrl: {
      type: String,
      required: true,
    },

    cloudinaryPublicId: {
      type: String,
      required: true,
      // Public ID format: "ctrl-w/abc123xyz"
      // Used for deletion: cloudinary.uploader.destroy(publicId)
    },

    // File Metadata
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    fileType: {
      type: String,
      required: true,
      // MIME type: image/jpeg, image/png, image/gif
    },

    fileSize: {
      type: Number,
      required: true,
      // Size in bytes
      validate: {
        validator: function (size) {
          // Validate against MAX_FILE_SIZE from env
          const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB) || 4;
          const maxSizeBytes = maxSizeMB * 1024 * 1024;
          return size <= maxSizeBytes;
        },
        message: 'File size exceeds maximum allowed size',
      },
    },

    // Thumbnail URL (Cloudinary auto-generates)
    thumbnailUrl: {
      type: String,
    },

    // Download count (optional analytics)
    downloadCount: {
      type: Number,
      default: 0,
    },

    // Deletion Status
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/**
 * Indexes
 */
fileSchema.index({ session: 1, createdAt: -1 });
fileSchema.index({ cloudinaryPublicId: 1 }); // For deletion lookups

/**
 * Virtual: File Size in MB
 * 
 * PURPOSE:
 * Display-friendly file size (converts bytes to MB)
 * 
 * VIRTUALS:
 * - Not stored in database
 * - Calculated on-the-fly when accessed
 * - Useful for derived data
 * 
 * USAGE:
 * const file = await File.findById(id);
 * console.log(file.fileSizeMB); // "2.45 MB"
 */
fileSchema.virtual('fileSizeMB').get(function () {
  return (this.fileSize / (1024 * 1024)).toFixed(2);
});

/**
 * Static Method: Get Session Files
 * 
 * PURPOSE:
 * Retrieve all files for a session
 * 
 * @param {ObjectId} sessionId - Session ID
 * @returns {Promise<Array>} - Array of files
 */
fileSchema.statics.getSessionFiles = async function (sessionId) {
  return this.find({ session: sessionId, isDeleted: false })
    .sort({ createdAt: -1 }) // Newest first
    .select('originalName fileType fileSize cloudinaryUrl thumbnailUrl createdAt')
    .lean();
};

/**
 * Instance Method: Soft Delete
 * 
 * PURPOSE:
 * Mark file as deleted without removing from database
 * Allows for potential "undo" or audit trails
 * 
 * @returns {Promise<void>}
 */
fileSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

/**
 * Instance Method: Delete from Cloudinary
 * 
 * PURPOSE:
 * Remove file from Cloudinary CDN and mark as deleted in DB
 * 
 * INTERVIEW NOTE:
 * "I implement soft delete first, then hard delete from CDN.
 * This allows for audit trails and potential recovery windows."
 * 
 * @returns {Promise<void>}
 */
fileSchema.methods.deleteFromCloudinary = async function () {
  try {
    // Import cloudinary config (will create in file upload section)
    const cloudinary = (await import('../config/cloudinary.js')).default;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(this.cloudinaryPublicId);

    // Mark as deleted in database
    await this.softDelete();

    console.log(`✅ Deleted file ${this.cloudinaryPublicId} from Cloudinary`);
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

/**
 * Pre-Save Hook: Update Session File Count
 */
fileSchema.post('save', async function () {
  if (this.isNew) {
    // Only increment on new files
    try {
      const Session = mongoose.model('Session');
      await Session.findByIdAndUpdate(this.session, {
        $inc: { fileCount: 1 },
        $set: { lastActivity: new Date() },
      });
    } catch (error) {
      console.error('Error updating session file count:', error);
    }
  }
});

/**
 * Enable virtuals in JSON
 */
fileSchema.set('toJSON', { virtuals: true });
fileSchema.set('toObject', { virtuals: true });

const File = mongoose.model('File', fileSchema);

export default File;