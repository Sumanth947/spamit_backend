const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');   // Import your auth
const Group = require('../models/Group');
const Message = require('../models/Message'); // You'll need a Message model

// Middleware to check if user is a member of group
async function requireGroupMember(req, res, next) {
  const { groupId } = req.params;
  const group = await Group.findById(groupId).select('members admin');
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const uid = req.userId;
  const isMember = group.members.map(id => id.toString()).includes(uid) || group.admin.toString() === uid;
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });
  next();
}

// GET /api/groups/:groupId/messages (protected, members only)
router.get('/:groupId/messages', auth, requireGroupMember, async (req, res) => {
  const { groupId } = req.params;
  // Fetch from MongoDB
  const messages = await Message.find({ groupId }).sort({ createdAt: 1 });
  res.json({ messages });
});

// POST /api/groups/:groupId/messages (protected, members only)
router.post('/:groupId/messages', auth, requireGroupMember, async (req, res) => {
  const { groupId } = req.params;
  const { text } = req.body;
  const senderId = req.userId;
  const senderName = req.user.username;
  const senderAvatarUrl = req.user.profilePicture || '';

  // Save to DB
  const msg = new Message({
    groupId,
    senderId,
    senderName,
    senderAvatarUrl,
    text,
    createdAt: new Date()
  });
  await msg.save();
  res.status(201).json({ message: msg });
});

module.exports = router;
