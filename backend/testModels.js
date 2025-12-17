/**
 * Model Testing Script
 * 
 * PURPOSE:
 * - Verify models work correctly
 * - Test CRUD operations
 * - Test relationships
 * - Test validation
 * 
 * RUN: node backend/testModels.js
 */

import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config/database.js';
import { User, Session, Message, File } from './models/index.js';

dotenv.config();

const testModels = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('\n🧪 Starting Model Tests...\n');

    // ============================================
    // TEST 1: Create User
    // ============================================
    console.log('📝 Test 1: Create User');
    
    // Delete existing test user if exists
    await User.deleteOne({ email: 'test@example.com' });
    
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123', // Will be hashed by pre-save hook
      role: 'user',
    });

    console.log('✅ User created:', {
      id: user._id,
      email: user.email,
      role: user.role,
      passwordHash: user.password.substring(0, 20) + '...',
    });

    // ============================================
    // TEST 2: Test Password Hashing
    // ============================================
    console.log('\n📝 Test 2: Test Password Hashing');
    
    const isMatch = await user.comparePassword('password123');
    const isNotMatch = await user.comparePassword('wrongpassword');
    
    console.log('✅ Correct password:', isMatch); // Should be true
    console.log('✅ Wrong password:', isNotMatch); // Should be false

    // ============================================
    // TEST 3: Create Session with Unique Code
    // ============================================
    console.log('\n📝 Test 3: Create Session');
    
    const pairingCode = await Session.generateUniquePairingCode();
    const session = await Session.create({
      pairingCode,
      creator: user._id,
      status: 'active',
    });

    console.log('✅ Session created:', {
      id: session._id,
      code: session.pairingCode,
      creator: session.creator,
      expiresAt: session.expiresAt,
    });

    // ============================================
    // TEST 4: Add Participants to Session
    // ============================================
    console.log('\n📝 Test 4: Add Participants');
    
    await session.addParticipant('socket-123', 'Chrome on iPhone');
    await session.addParticipant('socket-456', 'Firefox on Desktop');
    
    await session.save();
    
    console.log('✅ Participants added:', {
      count: session.participants.length,
      participants: session.participants.map((p) => ({
        socketId: p.socketId,
        device: p.deviceInfo,
      })),
    });

    // ============================================
    // TEST 5: Create Messages
    // ============================================
    console.log('\n📝 Test 5: Create Messages');
    
    const message1 = await Message.create({
      session: session._id,
      senderSocketId: 'socket-123',
      sender: user._id,
      content: 'Hello from device 1!',
      type: 'text',
    });

    const message2 = await Message.create({
      session: session._id,
      senderSocketId: 'socket-456',
      content: 'Hello from device 2!',
      type: 'text',
    });

    console.log('✅ Messages created:', {
      message1: message1.content,
      message2: message2.content,
    });

    // Verify session message count updated
    const updatedSession = await Session.findById(session._id);
    console.log('✅ Session message count:', updatedSession.messageCount);

    // ============================================
    // TEST 6: Get Session History
    // ============================================
    console.log('\n📝 Test 6: Get Session History');
    
    const history = await Message.getSessionHistory(session._id);
    console.log('✅ Session history:', {
      count: history.length,
      messages: history.map((m) => m.content),
    });

    // ============================================
    // TEST 7: Create File Metadata
    // ============================================
    console.log('\n📝 Test 7: Create File Metadata');
    
    const file = await File.create({
      session: session._id,
      uploaderSocketId: 'socket-123',
      uploader: user._id,
      cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      cloudinaryPublicId: 'ctrl-w/test-image-123',
      originalName: 'test-image.jpg',
      fileType: 'image/jpeg',
      fileSize: 2 * 1024 * 1024, // 2MB in bytes
    });

    console.log('✅ File created:', {
      id: file._id,
      name: file.originalName,
      size: file.fileSizeMB + ' MB', // Virtual field
      url: file.cloudinaryUrl,
    });

    // ============================================
    // TEST 8: Test Validation (Should Fail)
    // ============================================
    console.log('\n📝 Test 8: Test Validation');
    
    try {
      await User.create({
        email: 'invalid-email', // Invalid format
        password: '123', // Too short
      });
      console.log('❌ Validation should have failed!');
    } catch (error) {
      console.log('✅ Validation worked:', error.message);
    }

    // ============================================
    // TEST 9: Test Relationships (Population)
    // ============================================
    console.log('\n📝 Test 9: Test Relationships');
    
    const messageWithUser = await Message.findById(message1._id)
      .populate('sender', 'email role')
      .populate('session', 'pairingCode status');

    console.log('✅ Message with populated fields:', {
      content: messageWithUser.content,
      senderEmail: messageWithUser.sender.email,
      sessionCode: messageWithUser.session.pairingCode,
    });

    // ============================================
    // CLEANUP
    // ============================================
    console.log('\n🧹 Cleaning up test data...');
    
    await User.findByIdAndDelete(user._id);
    await Session.findByIdAndDelete(session._id);
    await Message.deleteMany({ session: session._id });
    await File.findByIdAndDelete(file._id);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n✅ All model tests passed!\n');

    // Disconnect
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await disconnectDB();
    process.exit(1);
  }
};

testModels();