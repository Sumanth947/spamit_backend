// backend/controllers/groupController.js

const jwt    = require('jsonwebtoken');
const twilio = require('twilio');
const Group  = require('../models/Group');
const User   = require('../models/User');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

//
// 1) CREATE: POST /api/groups
//
exports.createGroup = async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    const adminId = req.userId;
    const allMembers = [ adminId, ...memberIds ];

    const group = await Group.create({ name, admin: adminId, members: allMembers });

    // add group ref to each user
    await User.updateMany(
      { _id: { $in: allMembers } },
      { $addToSet: { groups: group._id } }
    );

    res.status(201).json({ success: true, data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 2) LIST: GET /api/groups
//
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.userId;
    const groups = await Group
    .find({ members: userId })
    .populate('admin',   'username')
    .populate('members', 'username');
    res.json({ success: true, data: groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 3) JOIN VIA INVITE: POST /api/groups/join
//
exports.joinViaToken = async (req, res) => {
  try {
    const { token } = req.body;
    // validate invite token
    const { groupId, inviter } = jwt.verify(token, process.env.JWT_SECRET);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const userId = req.userId;
    if (group.members.includes(userId)) {
      return res.status(400).json({ success: false, error: 'Already a member' });
    }

    group.members.push(userId);
    await group.save();

    // add group to user's list
    await User.findByIdAndUpdate(userId, { $addToSet: { groups: groupId } });

    res.json({
      success: true,
      data: { groupId: group._id.toString(), name: group.name }
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, error: 'Invite link expired' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 4) DETAIL: GET /api/groups/:id
//
exports.getGroupDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group
  .findById(groupId)
  .populate('admin',   'username')
  .populate('members', 'username');;

    if (!group) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    if (!group.members.some(m => m._id.equals(req.userId))) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 5) INVITE: POST /api/groups/:id/invite
//
exports.inviteToGroup = async (req, res) => {
  try {
    const adminId       = req.userId;
    const { id: groupId } = req.params;
    const { phoneNumbers = [] } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    if (!group.admin.equals(adminId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const token = jwt.sign(
      { groupId, inviter: adminId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const inviteLink = `${process.env.APP_URL}/invite/${token}`;

    for (let to of phoneNumbers) {
      await client.messages.create({
        from: process.env.TWILIO_PHONE,
        to,
        body: `Join "${group.name}": ${inviteLink}`
      });
    }

    res.json({ success: true, inviteLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 6) UPDATE: PUT /api/groups/:id
//
exports.updateGroup = async (req, res) => {
  try {
    const adminId = req.userId;
    const { id: groupId } = req.params;
    const { name, memberIds } = req.body;

    const group = await Group.findById(groupId);
    if (!group || !group.admin.equals(adminId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (name) group.name = name;
    if (Array.isArray(memberIds)) {
      group.members = [adminId, ...memberIds];
      await User.updateMany({ groups: groupId }, { $pull: { groups: groupId } });
      await User.updateMany({ _id: { $in: group.members } }, { $addToSet: { groups: groupId } });
    }
    await group.save();
    res.json({ success: true, data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 7) ADD MEMBERS: POST /api/groups/:id/members
//
exports.addGroupMembers = async (req, res) => {
  try {
    const adminId    = req.userId;
    const { id: groupId } = req.params;
    const { memberIds = [] } = req.body;

    const group = await Group.findById(groupId);
    if (!group || !group.admin.equals(adminId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await Group.findByIdAndUpdate(groupId, {
      $addToSet: { members: { $each: memberIds } }
    });
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $addToSet: { groups: groupId } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//
// 8) DELETE: DELETE /api/groups/:id
//
exports.deleteGroup = async (req, res) => {
  try {
    const adminId = req.userId;
    const { id: groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group || !group.admin.equals(adminId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    await group.remove();
    await User.updateMany({ groups: groupId }, { $pull: { groups: groupId } });
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
