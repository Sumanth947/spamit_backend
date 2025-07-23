const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

// POST /api/auth/register-or-login
router.post('/register-or-login', async (req, res) => {
  const { idToken, username: clientName, dob: dobIso } = req.body;

  console.log('📥 Incoming /register-or-login payload:', { idToken, clientName, dobIso });

  if (!idToken) {
    console.log('❌ Missing idToken');
    return res.status(400).json({ error: 'Missing idToken' });
  }

  try {
    // 1️⃣ Verify token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, phone_number, name: firebaseName } = decoded;

    console.log('🔐 Firebase UID:', uid);
    console.log('📞 Firebase phone:', phone_number);
    console.log('🧾 Firebase name:', firebaseName);

    // 2️⃣ Find existing user
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      console.log('👤 No existing user found. Creating new user...');

      const displayName = clientName || firebaseName || 'Anonymous';
      const dob = dobIso ? new Date(dobIso) : undefined;

      user = new User({
        firebaseUid: uid,
        username: displayName,
        phoneNumber: phone_number,
        dob: dob,
      });

      await user.save();

      console.log('✅ New user saved to MongoDB:', user);
    } else {
      console.log('👤 Existing user found:', user);

      // 3️⃣ Update name/dob if provided
      let updated = false;

      if (clientName && clientName !== user.username) {
        console.log(`✏️ Updating username: "${user.username}" → "${clientName}"`);
        user.username = clientName;
        updated = true;
      }

      if (dobIso) {
        const dob = new Date(dobIso);
        if (!user.dob || user.dob.toISOString() !== dob.toISOString()) {
          console.log(`📆 Updating DOB: "${user.dob}" → "${dob}"`);
          user.dob = dob;
          updated = true;
        }
      }

      if (updated) {
        await user.save();
        console.log('✅ Existing user updated in MongoDB:', user);
      } else {
        console.log('ℹ️ No updates needed for existing user.');
      }
    }

    // 4️⃣ Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    console.log('🔑 JWT token generated');

    // 5️⃣ Send response
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        dob: user.dob,
      },
    });

  } catch (err) {
    console.error('❌ register-or-login error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});


// GET /api/auth/exists?phone=+91xxxx
router.get('/exists', async (req, res) => {
  const phone = req.query.phone;

  if (!phone) {
    return res.status(400).json({ error: 'Missing phone number' });
  }

  try {
    const user = await User.findOne({ phoneNumber: phone });
    res.json({ exists: !!user });
  } catch (err) {
    console.error('check-number error:', err);
    res.status(500).json({ error: 'Server error checking user existence' });
  }
});

module.exports = router;
