// backend/middleware/uploadV3.js
const multer = require('multer');

// store in memory so we can re-stream via Upload
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
