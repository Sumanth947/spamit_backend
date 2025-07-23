// backend/routes/groups.js

const express      = require('express');
const auth         = require('../middleware/authMiddleware');      
const groupCtrl    = require('../controllers/groupController');   
const Group        = require('../models/Group');    // Add this import
const Message      = require('../models/Message');  // Add this import

// Quick sanity check: these should all log as "function"
console.log('auth is', typeof auth);
console.log('createGroup is',    typeof groupCtrl.createGroup);
console.log('getUserGroups is',  typeof groupCtrl.getUserGroups);
console.log('joinViaToken is',   typeof groupCtrl.joinViaToken);
console.log('getGroupDetail is', typeof groupCtrl.getGroupDetail);
console.log('inviteToGroup is',  typeof groupCtrl.inviteToGroup);
console.log('updateGroup is',    typeof groupCtrl.updateGroup);
console.log('addGroupMembers is',typeof groupCtrl.addGroupMembers);
console.log('deleteGroup is',    typeof groupCtrl.deleteGroup);

const router = express.Router();

// Middleware to check if user is a member of group
async function requireGroupMember(req, res, next) {
  try {
    const { id: groupId } = req.params; // Using :id instead of :groupId to match your routes
    const group = await Group.findById(groupId).select('members admin');
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const uid = req.userId;
    const isMember = group.members.map(id => id.toString()).includes(uid) || 
                     group.admin.toString() === uid;
    
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    
    req.group = group; // Pass group to next middleware if needed
    next();
  } catch (error) {
    console.error('Error checking group membership:', error);
    res.status(500).json({ error: 'Server error checking group membership' });
  }
}

// === EXISTING GROUP ROUTES ===

// 1) Create a new group         POST /api/groups
router.post(   '/',               auth, groupCtrl.createGroup);

// 2) List groups you belong to   GET  /api/groups
router.get(    '/',               auth, groupCtrl.getUserGroups);

// 3) Join via invite-token       POST /api/groups/join
router.post(   '/join',           auth, groupCtrl.joinViaToken);

// 4) Get one group's detail      GET  /api/groups/:id
router.get(    '/:id',            auth, groupCtrl.getGroupDetail);

// 5) Send SMS invites            POST /api/groups/:id/invite
router.post(   '/:id/invite',     auth, groupCtrl.inviteToGroup);

// 6) Rename / re-member group     PUT  /api/groups/:id
router.put(    '/:id',            auth, groupCtrl.updateGroup);

// 7) Add more members (admin)    POST /api/groups/:id/members
router.post(   '/:id/members',    auth, groupCtrl.addGroupMembers);

// 8) Delete a group              DELETE /api/groups/:id
router.delete( '/:id',            auth, groupCtrl.deleteGroup);

// === MESSAGING ROUTES ===

// 9) Get group messages          GET /api/groups/:id/messages
router.get('/:id/messages', auth, requireGroupMember, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    
    // Fetch messages from MongoDB, sorted by creation time (oldest first)
    const messages = await Message.find({ groupId }).sort({ createdAt: 1 });
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 10) Send group message         POST /api/groups/:id/messages
router.post('/:id/messages', auth, requireGroupMember, async (req, res) => {
    console.log('POST /messages route called!'); // Add this first line
  try {
    const { id: groupId } = req.params;
    const { text } = req.body;
    console.log('User data:', req.user);
    console.log('Profile picture:', req.user?.profilePicture);
    // Validate message text
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }
    
    if (text.trim().length > 1000) { // Optional: limit message length
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    const senderId = req.userId;
    const senderName = req.user.username || 'Unknown User';
    const senderAvatarUrl = req.user.profilePicture || '';

    // Create and save message to database
    const message = new Message({
      groupId,
      senderId,
      senderName,
      senderAvatarUrl,
      text: text.trim(),
      createdAt: new Date()
    });
    
    await message.save();
    
    res.status(201).json({ message });
  } catch (error) {
    console.error('Error sending group message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 11) Delete a specific message  DELETE /api/groups/:id/messages/:messageId (optional)
router.delete('/:id/messages/:messageId', auth, requireGroupMember, async (req, res) => {
  try {
    const { id: groupId, messageId } = req.params;
    const userId = req.userId;
    
    // Find the message
    const message = await Message.findOne({ _id: messageId, groupId });
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user can delete this message (only sender or group admin)
    const group = await Group.findById(groupId).select('admin');
    const canDelete = message.senderId.toString() === userId || 
                     group.admin.toString() === userId;
    
    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    await Message.findByIdAndDelete(messageId);
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
