// backend/middleware/authMiddleware.js

const admin = require('firebase-admin');
const User  = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    // 1) Extract the raw Firebase ID token
    const idToken = authHeader.split('Bearer ')[1].trim();
    console.log('🔍 Extracted idToken:', idToken);

    // 2) Verify it with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('🔐 decodedToken.uid:', decodedToken.uid);

    // 3) Lookup your Mongo user
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    console.log('👤 Found Mongo user:', user);

    if (!user) {
      return res.status(401).json({ error: 'User not found in database' });
    }

    // 4) Attach the IDs for your controllers
    req.userId = user._id.toString();
    req.user   = {
      id:          user._id.toString(),
      firebaseUid: user.firebaseUid,
      phoneNumber: user.phoneNumber,
      username:    user.username,
      profilePicture: user.profilePicture, 
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
