// backend/routes/posts.js

const express       = require("express");
const multer        = require("multer");
const router        = express.Router();
const auth          = require("../middleware/authMiddleware");
const { uploadToR2 } = require("../controllers/uploadToS3");

const postController = require("../controllers/postController");

const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/posts
 * Upload media → S3 → attach mediaUrl/mediaType → create post
 */
router.post(
  "/",
  auth,
  upload.single("media"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }
      const ext      = req.file.mimetype.split("/")[1];
      const filename = `${Date.now()}.${ext}`;
      const key      = `posts/${req.user.id}/${filename}`;
      const mediaUrl = await uploadToR2(req.file.buffer, key, req.file.mimetype);


      // attach to body for controller
      req.body.mediaUrl  = mediaUrl;
      req.body.mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";

      return postController.createPost(req, res);
    } catch (e) {
      console.error("POST /api/posts error:", e);
      return res.status(500).json({ success: false, error: "Upload failed" });
    }
  }
);

/** GET /api/posts?groupId=xxx */
router.get("/", auth, postController.getPosts);

/** Toggle like/unlike on a post */
router.post("/:postId/like", auth, postController.toggleLike);

/** Add a comment to a post */
router.post("/:postId/comments", auth, postController.addComment);

module.exports = router;
