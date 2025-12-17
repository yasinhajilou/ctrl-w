/**
 * Models Index
 * 
 * PURPOSE:
 * - Central export point for all models
 * - Cleaner imports in other files
 * - Easy to add new models
 * 
 * USAGE:
 * import { User, Session, Message, File } from './models/index.js';
 * 
 * Instead of:
 * import User from './models/User.js';
 * import Session from './models/Session.js';
 * import Message from './models/Message.js';
 * import File from './models/File.js';
 */


/*
*
 Import only what you need:
 import { User, Message } from './models';
*/
import User from './User.js';
import Session from './Session.js';
import Message from './Message.js';
import File from './File.js';

export { User, Session, Message, File };

/*
*
Import all models as a single object:
import models from './models';
*/
export default {
  User,
  Session,
  Message,
  File,
};