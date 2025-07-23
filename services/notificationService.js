// services/notificationService.js
const admin = require('firebase-admin');
const Notification = require('../models/Notification');

class NotificationService {
  /**
   * Send notification to group members when someone posts
   */
  static async sendGroupPostNotification(groupId, postAuthorId, postTitle, groupName) {
    try {
      console.log('🔥 Sending group post notification...');
      
      const Group = require('../models/Group');
      const User = require('../models/User');
      
      const group = await Group.findById(groupId).populate('members');
      if (!group) {
        console.log('❌ Group not found');
        return;
      }
      
      // Get all member IDs except the post author
      const memberIds = group.members
        .filter(member => member._id.toString() !== postAuthorId.toString())
        .map(member => member._id);
      
      if (memberIds.length === 0) {
        console.log('❌ No group members to notify');
        return;
      }
      
      // Get FCM tokens for these members
      const users = await User.find({ 
        _id: { $in: memberIds },
        fcmToken: { $exists: true, $ne: null }
      });
      
      const tokens = users.map(user => user.fcmToken).filter(Boolean);
      
      // 🔥 CREATE DATABASE NOTIFICATIONS for all group members
      const notificationPromises = memberIds.map(memberId => 
        new Notification({
          user: memberId,
          type: 'new_post',
          group: groupId,
          fromUser: postAuthorId,
          message: `New post in ${groupName}: ${postTitle || 'Check it out!'}`
        }).save()
      );
      
      await Promise.all(notificationPromises);
      console.log(`✅ Created ${memberIds.length} database notifications`);
      
      // Send FCM notifications
      if (tokens.length > 0) {
        const message = {
          notification: {
            title: `New post in ${groupName}`,
            body: postTitle || 'Someone shared a new post'
          },
          data: {
            type: 'group_post',
            groupId: groupId.toString(),
            groupName: groupName
          },
          tokens: tokens
        };
        
        const response = await admin.messaging().sendMulticast(message);
        console.log(`✅ FCM notifications sent: ${response.successCount}/${tokens.length}`);
      } else {
        console.log('❌ No valid FCM tokens found');
      }
      
    } catch (error) {
      console.error('❌ Error sending group notification:', error);
    }
  }
  
  /**
   * Send notification to post author when someone comments
   */
  static async sendCommentNotification(postId, postAuthorId, commenterName, commentText) {
    try {
      console.log('💬 Sending comment notification...');
      
      const User = require('../models/User');
      const Post = require('../models/Post');
      
      // Get post author's FCM token
      const postAuthor = await User.findById(postAuthorId);
      const post = await Post.findById(postId);
      
      if (!postAuthor) {
        console.log('❌ Post author not found');
        return;
      }
      
      // Get commenter info
      const commenter = await User.findOne({ username: commenterName });
      
      // 🔥 CREATE DATABASE NOTIFICATION
      await new Notification({
        user: postAuthorId,
        type: 'comment',
        post: postId,
        fromUser: commenter?._id,
        message: `${commenterName} commented: ${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}`
      }).save();
      
      console.log('✅ Created database notification for comment');
      
      // Send FCM notification
      if (postAuthor.fcmToken) {
        const message = {
          notification: {
            title: 'New comment on your post',
            body: `${commenterName}: ${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}`
          },
          data: {
            type: 'post_comment',
            postId: postId.toString()
          },
          token: postAuthor.fcmToken
        };
        
        const response = await admin.messaging().send(message);
        console.log('✅ FCM comment notification sent:', response);
      } else {
        console.log('❌ Post author has no FCM token');
      }
      
    } catch (error) {
      console.error('❌ Error sending comment notification:', error);
    }
  }
}

module.exports = NotificationService;
