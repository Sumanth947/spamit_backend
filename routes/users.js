// backend/routes/users.js

const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const auth          = require('../middleware/authMiddleware');
const uploadProfile = require('../middleware/uploadProfile');
const User          = require('../models/User');
const {
  search,
  createPost,
  getPosts
} = require('../controllers/userController');

// --- Debug logger for every request in this router ---
router.use((req, res, next) => {
  console.log(`[UsersRoute] ${req.method} ${req.originalUrl}`);
  next();
});

// 1) Search users
router.get('/search', (req, res, next) => {
  console.log('[UsersRoute] → search');
  return search(req, res, next);
});

// 2) Lookup by phoneNumber
router.get('/mobile/:phone', async (req, res) => {
  const phone = req.params.phone;
  console.log('[UsersRoute] → phone lookup:', phone);
  try {
    const user = await User.findOne(
      { phoneNumber: phone },
      '_id'
    ).lean();
    if (!user) {
      console.log('[UsersRoute] phone lookup: not found');
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ id: user._id });
  } catch (err) {
    console.error('[UsersRoute] phone lookup error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3) “/me” returns the JWT‐decoded user (requires Authorization header)
router.get('/me', auth, (req, res) => {
  console.log('[UsersRoute] → /me, authenticated userId:', req.userId);
  return res.json({ user: req.user });
});

// 4) Create and list posts for a user
router.post('/posts', (req, res, next) => {
  console.log('[UsersRoute] → createPost');
  return createPost(req, res, next);
});
router.get('/posts', (req, res, next) => {
  console.log('[UsersRoute] → getPosts');
  return getPosts(req, res, next);
});

// 5) Get user by Mongo _id OR by firebaseUid
router.get('/:userId', async (req, res) => {
  const raw = req.params.userId;
  console.log('[UsersRoute] → getUserProfile raw param:', raw);

  // Build filter: if valid ObjectId, search by _id; otherwise by firebaseUid
  const filter = mongoose.Types.ObjectId.isValid(raw)
    ? { _id: raw }
    : { firebaseUid: raw };

  try {
    const user = await User.findOne(filter).lean();
    if (!user) {
      console.log('[UsersRoute] getUserProfile: user not found for', filter);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('[UsersRoute] getUserProfile: success →', user._id);
    return res.json({ user });
  } catch (err) {
    console.error('[UsersRoute] getUserProfile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6) Update profile (protected + optional image upload)
router.put(
  '/:userId',
  auth,
  uploadProfile,
  async (req, res) => {
    const raw = req.params.userId;
    console.log('[UsersRoute] → updateUser raw param:', raw);

    // Same filter logic as GET
    const filter = mongoose.Types.ObjectId.isValid(raw)
      ? { _id: raw }
      : { firebaseUid: raw };

    try {
      const updates = {
        username:    req.body.username,
        phoneNumber: req.body.phoneNumber,
        bio:         req.body.bio
      };
      if (req.profileImageUrl) {
        updates.profilePicture = req.profileImageUrl;
      }
      console.log('[UpdateUser] req.body:', req.body);
      console.log('[UpdateUser] updates object:', updates);
      console.log('[UpdateUser] req.profileImageUrl:', req.profileImageUrl);
      console.log('[UpdateUser] filter:', filter);
      
      const user = await User.findOneAndUpdate(
        filter,
        { $set: updates },
        { new: true }
      ).lean();

      if (!user) {
        console.log('[UsersRoute] updateUser: user not found for', filter);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('[UsersRoute] updateUser: success →', user._id);
      return res.json({ user });
    } catch (err) {
      console.error('[UsersRoute] updateUser error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);
router.post('/fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }
    
    await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken: fcmToken },
      { new: true }
    );
    
    console.log('✅ FCM token saved for user:', req.user.id);
    res.json({ success: true, message: 'FCM token saved successfully' });
    
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

// PUT /api/users/fcm-token - Update FCM token
router.put('/fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken: fcmToken }
    );
    
    res.json({ success: true, message: 'FCM token updated successfully' });
    
  } catch (error) {
    console.error('❌ Error updating FCM token:', error);
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
});

// DELETE /api/users/fcm-token - Remove FCM token (for logout)
router.delete('/fcm-token', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { fcmToken: 1 } }
    );
    
    res.json({ success: true, message: 'FCM token removed successfully' });
    
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    res.status(500).json({ error: 'Failed to remove FCM token' });
  }
});


module.exports = router;
