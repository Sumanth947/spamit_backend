const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");

const search = async (req, res) => {
  const query = req.query.q;
  try {
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
};

const getUserProfile = async (req, res) => {
  const userId = req.params.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ user: userId }).sort({ createdAt: -1 });

    res.json({
      user,
      posts,
      groupCount: user.groups.length,
      postCount: posts.length,
    });
  } catch (err) {
    console.error("Get profile error:", err.message);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

const createPost = async (req, res) => {
  try {
    const { caption, mediaUrl, mediaType, group } = req.body;
    const userId = req.body.userId; // For testing, use userId from body; replace with auth middleware later

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const post = new Post({
      user: userId,
      caption: caption || 'Default caption', // Handle optional caption
      mediaUrl,
      mediaType: mediaType || 'image',
      group: group || null,
      likes: [],
      comments: [],
    });

    await post.save();

    // Populate user details for response
    const populatedPost = await Post.findById(post._id).populate('user', 'username profilePicture');

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Error creating post:', error.message);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

// controllers/userController.js
const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    console.log('Querying posts with page:', page, 'limit:', limit, 'skip:', skip); // Debug
    const posts = await Post.find()
      .populate('user', 'username profilePicture')
      .populate('comments.user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Fetched posts:', posts); // Debug
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error.message);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

module.exports = { getUserProfile, search, createPost, getPosts };