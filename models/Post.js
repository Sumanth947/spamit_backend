// backend/models/Post.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text:      { type: String, required: true },
  createdAt: { type: Date,   default: Date.now },
});

const PostSchema = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  group:     { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  caption:   { type: String, default: '' },
  mediaUrl:  { type: String, required: true },
  mediaType: { type: String, enum: ['image','video'], required: true },
  likes:     [{ type: Schema.Types.ObjectId, ref: 'User' }],   // ← array of user IDs
  comments:  [CommentSchema],                                 // ← subdocuments
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Post', PostSchema);
