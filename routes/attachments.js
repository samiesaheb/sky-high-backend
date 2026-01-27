/**
 * Sky High International - Attachments Routes
 * Handles file upload, download, and deletion for inquiry attachments
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { upload, uploadsDir, isImage } = require('../middleware/upload');

// Upload files to inquiry header
router.post('/header/:inquiryId', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify inquiry exists
    const inquiryCheck = await query(
      'SELECT inquiry_id FROM inquiry_headers WHERE inquiry_id = $1',
      [inquiryId]
    );

    if (inquiryCheck.rows.length === 0) {
      // Delete uploaded files if inquiry doesn't exist
      files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Insert attachment records
    const attachments = [];
    for (const file of files) {
      const result = await queryWithUser(
        `INSERT INTO attachments (
          inquiry_id, original_filename, stored_filename, file_path, file_size, mime_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING attachment_id, original_filename, stored_filename, file_size, mime_type, created_at`,
        [
          inquiryId,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          file.mimetype,
        ],
        req.user.username
      );
      attachments.push({
        ...result.rows[0],
        isImage: isImage(file.mimetype),
      });
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      attachments,
    });
  } catch (error) {
    console.error('Error uploading files to header:', error);
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Upload files to inquiry detail row
router.post('/detail/:detailId', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { detailId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify detail exists
    const detailCheck = await query(
      'SELECT detail_id FROM inquiry_details WHERE detail_id = $1',
      [detailId]
    );

    if (detailCheck.rows.length === 0) {
      // Delete uploaded files if detail doesn't exist
      files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
      return res.status(404).json({ error: 'Inquiry detail not found' });
    }

    // Insert attachment records
    const attachments = [];
    for (const file of files) {
      const result = await queryWithUser(
        `INSERT INTO attachments (
          detail_id, original_filename, stored_filename, file_path, file_size, mime_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING attachment_id, original_filename, stored_filename, file_size, mime_type, created_at`,
        [
          detailId,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          file.mimetype,
        ],
        req.user.username
      );
      attachments.push({
        ...result.rows[0],
        isImage: isImage(file.mimetype),
      });
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      attachments,
    });
  } catch (error) {
    console.error('Error uploading files to detail:', error);
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get attachments for inquiry header
router.get('/header/:inquiryId', authenticateToken, async (req, res) => {
  try {
    const { inquiryId } = req.params;

    const result = await query(
      `SELECT attachment_id, original_filename, stored_filename, file_size, mime_type, created_at, created_by
       FROM attachments
       WHERE inquiry_id = $1
       ORDER BY created_at DESC`,
      [inquiryId]
    );

    const attachments = result.rows.map(row => ({
      ...row,
      isImage: isImage(row.mime_type),
    }));

    res.json(attachments);
  } catch (error) {
    console.error('Error fetching header attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Get attachments for inquiry detail
router.get('/detail/:detailId', authenticateToken, async (req, res) => {
  try {
    const { detailId } = req.params;

    const result = await query(
      `SELECT attachment_id, original_filename, stored_filename, file_size, mime_type, created_at, created_by
       FROM attachments
       WHERE detail_id = $1
       ORDER BY created_at DESC`,
      [detailId]
    );

    const attachments = result.rows.map(row => ({
      ...row,
      isImage: isImage(row.mime_type),
    }));

    res.json(attachments);
  } catch (error) {
    console.error('Error fetching detail attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Download attachment
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT original_filename, stored_filename, file_path, mime_type FROM attachments WHERE attachment_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(uploadsDir, attachment.stored_filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// View/Preview attachment (for images and PDFs)
// Supports token via query parameter for img src usage
router.get('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token || req.headers['authorization']?.split(' ')[1];

    // Verify token
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const result = await query(
      'SELECT original_filename, stored_filename, file_path, mime_type FROM attachments WHERE attachment_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(uploadsDir, attachment.stored_filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.original_filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error viewing attachment:', error);
    res.status(500).json({ error: 'Failed to view attachment' });
  }
});

// Delete attachment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get attachment info before deleting
    const result = await query(
      'SELECT stored_filename, file_path FROM attachments WHERE attachment_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(uploadsDir, attachment.stored_filename);

    // Delete from database
    await query('DELETE FROM attachments WHERE attachment_id = $1', [id]);

    // Delete file from filesystem
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting file from filesystem:', err);
        }
      });
    }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Error handler for multer
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size exceeds 10MB limit' });
  }
  if (error.message) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
