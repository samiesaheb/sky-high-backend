/**
 * Sky High International - File Upload Middleware
 * Configures multer for handling file uploads
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed file types
const ALLOWED_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with UUID
    const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: JPG, PNG, GIF, WebP, PDF, DOC, DOCX, XLS, XLSX`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Helper to check if file is an image
const isImage = (mimetype) => {
  return mimetype.startsWith('image/');
};

// Helper to get file extension from mimetype
const getExtension = (mimetype) => {
  return ALLOWED_TYPES[mimetype] || '';
};

module.exports = {
  upload,
  uploadsDir,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  isImage,
  getExtension,
};
