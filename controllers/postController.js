// backend/controllers/postController.js

const Post = require('../models/Post');
const User = require('../models/User');
const Group = require('../models/Group');
const NotificationService = require('../services/notificationService');

/**
 * GET /api/posts
 * Optional ?groupId=xxx to filter by group.
 */
exports.getPosts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.groupId) filter.group = req.query.groupId;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate('user', '_id username profilePicture')
      .populate('comments.user', 'username')
      .lean();
      
    if (posts.length === 0) {
      console.log('[getPosts] No posts found');
    } else {
      console.log('[getPosts] First post:', posts[0]);
    }
    
    return res.json({ success: true, data: posts });
  } catch (err) {
    console.error('getPosts error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * POST /api/posts
 * Body must already contain mediaUrl, mediaType, caption, groupId.
 * File upload is handled inline in the route.
 */
exports.createPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { caption = '', groupId, mediaUrl, mediaType } = req.body;
    
    if (!mediaUrl || !groupId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing mediaUrl or groupId' 
      });
    }

    // Create the post
    const post = await Post.create({
      user: userId,
      group: groupId,
      caption,
      mediaUrl,
      mediaType,
    });

    // Populate both the post's author and nested comment authors in one call:
    const populated = await post.populate([
      { path: 'user', select: '_id username profilePicture' },
      { path: 'comments.user', select: 'username' }
    ]);

    // 🔥 SEND NOTIFICATION: Group post notification
    try {
      // Get group details for notification
      const group = await Group.findById(groupId);
      
      if (group) {
        // Fire and forget - don't wait for notification
        NotificationService.sendGroupPostNotification(
          groupId,
          userId,
          caption || 'New post shared',
          group.name || 'Your group'
        );
        
        console.log('✅ Group post notification triggered');
      }
    } catch (notifError) {
      // Don't fail the post creation if notification fails
      console.error('❌ Notification failed:', notifError);
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error during post creation' 
    });
  }
};

/**
 * POST /api/posts/:postId/like
 * Body: { like: true|false }
 */
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }

    const idx = post.likes.findIndex(id => id.equals(userId));
    if (idx >= 0) {
      post.likes.splice(idx, 1);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    return res.json({ success: true, data: { likes: post.likes } });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * POST /api/posts/:postId/comments
 * Body: { text: "..." }
 */
exports.addComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment text missing' 
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }

    // Add comment and save
    post.comments.push({ user: userId, text });
    await post.save();

    // Grab the new comment and populate its user
    const newComment = post.comments[post.comments.length - 1].toObject();
    const user = await User.findById(userId).select('username');
    newComment.user = { username: user.username };

    // 🔥 SEND NOTIFICATION: Comment notification
    try {
      // Only send notification if commenting on someone else's post
      if (post.user.toString() !== userId.toString()) {
        const commenter = await User.findById(userId).select('username');
        
        // Fire and forget - don't wait for notification
        NotificationService.sendCommentNotification(
          postId,
          post.user,
          commenter?.username || 'Someone',
          text
        );
        
        console.log('✅ Comment notification triggered');
      }
    } catch (notifError) {
      // Don't fail the comment creation if notification fails
      console.error('❌ Comment notification failed:', notifError);
    }

    return res.status(201).json({ success: true, data: newComment });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};
