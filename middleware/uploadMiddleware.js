// backend/uploadMiddleware.js
const AWS       = require("aws-sdk");
const multer    = require("multer");
const multerS3  = require("multer-s3");

// v2 client (has .upload(), used by multer-s3)
const s3v2 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const upload = multer({
  storage: multerS3({
    s3:        s3v2,
    bucket:    process.env.AWS_S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext      = file.mimetype.split("/")[1];
      const filename = `${Date.now()}.${ext}`;
      const folder   = `posts/${req.user.id}`; 
      cb(null, `${folder}/${filename}`);
    },
  }),
});

module.exports = upload;
