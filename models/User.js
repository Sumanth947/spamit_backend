// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // display name
  username: {
    type: String,
    required: true,
    unique: true,
  },

  // for Firebase‐OTP users
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  // phone number
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },

  // date of birth (new)
  dob: {
    type: Date,
  },

  // optional fallback if you ever want passwords
  password: {
    type: String,
  },
fcmToken: {
    type: String,
    default: null
  },
  // profile
  profilePicture: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },

  // group memberships
  groups: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }
  ],

  // keeps track of when the doc was created
  createdAt: {
    type: Date,
    default: Date.now,
  }
  
},
{
  timestamps: true  // adds createdAt & updatedAt automatically
});

module.exports = mongoose.model('User', UserSchema);
