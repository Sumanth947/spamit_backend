const path           = require('path');
const uploadMemory   = require('../middleware/uploadV3');
const { uploadToR2 } = require('../utils/uploadToR2'); // Make sure your util exports this

module.exports = [
  uploadMemory.single('image'),

  async (req, res, next) => {
    if (!req.file) return next();

    try {
      const userId    = req.params.userId;
      const timestamp = Date.now();
      const ext       = path.extname(req.file.originalname);
      const key       = `posts/${userId}/profile/${timestamp}${ext}`;

      // FIX: use the correct function name
      const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
      req.profileImageUrl = url;
    } catch (err) {
      return next(err);
    }
    next();
  }
];
