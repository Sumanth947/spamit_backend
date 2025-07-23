const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment', 'group_invite', 'new_post'], required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema);