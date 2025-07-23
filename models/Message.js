const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  groupId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderAvatarUrl: { type: String, default: '' },
  text:       { type: String, required: true },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
