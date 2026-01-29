/**
 * Sky High International - Inquiry Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser, getClient, getClientWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all inquiries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT
        h.inquiry_id,
        h.inquiry_number,
        h.inquiry_date,
        h.inquiry_description,
        h.customer_id,
        c.customer_name,
        c.contact_person,
        c.contact_email,
        c.contact_phone,
        co.country_name,
        h.product_category_id,
        pc.category_name as product_category_description,
        h.status,
        h.inquiry_group,
        h.remarks,
        h.conclusion,
        h.created_at,
        h.created_by
      FROM inquiry_headers h
      LEFT JOIN customers c ON h.customer_id = c.customer_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      LEFT JOIN product_categories pc ON h.product_category_id = pc.product_category_id
      ORDER BY h.inquiry_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// Get inquiry by ID with details and attachments
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get header
    const headerResult = await query(`
      SELECT
        h.inquiry_id,
        h.inquiry_number,
        h.inquiry_date,
        h.inquiry_description,
        h.customer_id,
        c.customer_name,
        co.country_name,
        h.product_category_id,
        pc.category_name as product_category_description,
        h.status,
        h.inquiry_group,
        h.remarks,
        h.conclusion,
        h.created_at,
        h.created_by
      FROM inquiry_headers h
      LEFT JOIN customers c ON h.customer_id = c.customer_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      LEFT JOIN product_categories pc ON h.product_category_id = pc.product_category_id
      WHERE h.inquiry_id = $1
    `, [id]);

    if (headerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Get details
    const detailsResult = await query(`
      SELECT
        d.detail_id,
        d.inquiry_id,
        d.material_id,
        m.material_name,
        m.material_description,
        mt.material_type_description,
        d.task_id,
        t.task_name,
        t.task_description,
        d.assignee_id,
        a.assignee_name,
        d.status AS detail_status,
        d.progress,
        d.start_date,
        d.due_date,
        d.estimated_cost,
        d.actual_cost,
        d.customer_approved,
        d.remarks AS detail_remarks,
        d.created_at,
        d.created_by
      FROM inquiry_details d
      LEFT JOIN materials m ON d.material_id = m.material_id
      LEFT JOIN material_types mt ON m.material_type_id = mt.material_type_id
      LEFT JOIN tasks t ON d.task_id = t.task_id
      LEFT JOIN assignees a ON d.assignee_id = a.assignee_id
      WHERE d.inquiry_id = $1
      ORDER BY d.detail_id
    `, [id]);

    // Get header attachments (gracefully handle if table doesn't exist)
    let headerAttachments = [];
    let detailAttachments = {};

    try {
      const headerAttachmentsResult = await query(`
        SELECT attachment_id, original_filename, stored_filename, file_size, mime_type, created_at, created_by
        FROM attachments
        WHERE inquiry_id = $1
        ORDER BY created_at DESC
      `, [id]);
      headerAttachments = headerAttachmentsResult.rows;

      // Get detail attachments (grouped by detail_id)
      const detailIds = detailsResult.rows.map(d => d.detail_id);

      if (detailIds.length > 0) {
        const detailAttachmentsResult = await query(`
          SELECT attachment_id, detail_id, original_filename, stored_filename, file_size, mime_type, created_at, created_by
          FROM attachments
          WHERE detail_id = ANY($1)
          ORDER BY created_at DESC
        `, [detailIds]);

        // Group attachments by detail_id
        detailAttachmentsResult.rows.forEach(att => {
          if (!detailAttachments[att.detail_id]) {
            detailAttachments[att.detail_id] = [];
          }
          detailAttachments[att.detail_id].push({
            ...att,
            isImage: att.mime_type.startsWith('image/'),
          });
        });
      }
    } catch (attachmentError) {
      // Attachments table might not exist yet - continue without attachments
      console.log('Note: Attachments not available:', attachmentError.message);
    }

    // Add attachments to each detail
    const detailsWithAttachments = detailsResult.rows.map(detail => ({
      ...detail,
      attachments: detailAttachments[detail.detail_id] || [],
    }));

    res.json({
      header: headerResult.rows[0],
      details: detailsWithAttachments,
      headerAttachments: headerAttachments.map(att => ({
        ...att,
        isImage: att.mime_type.startsWith('image/'),
      })),
    });
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    res.status(500).json({ error: 'Failed to fetch inquiry' });
  }
});

// Generate inquiry number (accepts optional client for transaction support)
const generateInquiryNumber = async (client = null) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `INQ-${year}${month}-`;

  // Use transaction client if provided, otherwise use pool
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(`
    SELECT inquiry_number FROM inquiry_headers
    WHERE inquiry_number LIKE $1
    ORDER BY inquiry_number DESC LIMIT 1
  `, [`${prefix}%`]);

  let nextNum = 1;
  if (result.rows.length > 0) {
    const lastNum = parseInt(result.rows[0].inquiry_number.split('-')[2]);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, '0')}`;
};

// Create new inquiry
router.post('/', authenticateToken, async (req, res) => {
  const { client, setUser } = await getClientWithUser(req.user.username);

  try {
    const {
      inquiryDate,
      inquiryDescription,
      customerId,
      productCategoryId,
      status,
      inquiryGroup,
      remarks,
      conclusion,
      details,
    } = req.body;

    // Validate required fields before starting transaction
    if (!customerId || !inquiryDescription) {
      client.release();
      return res.status(400).json({ error: 'Customer and description are required' });
    }

    await client.query('BEGIN');
    // Set user context for audit triggers
    await setUser();

    const inquiryNumber = await generateInquiryNumber(client);

    // Insert header - triggers will auto-set created_by, created_at, modified_by, modified_at
    const headerResult = await client.query(`
      INSERT INTO inquiry_headers (
        inquiry_number, inquiry_date, inquiry_description, customer_id,
        product_category_id, status, inquiry_group, remarks, conclusion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING inquiry_id
    `, [
      inquiryNumber,
      inquiryDate || new Date(),
      inquiryDescription,
      customerId,
      productCategoryId || null,
      status || 'Not Started',
      inquiryGroup || null,
      remarks || null,
      conclusion || null
    ]);

    const inquiryId = headerResult.rows[0].inquiry_id;

    // Insert details if provided - triggers will auto-set audit fields
    if (details && Array.isArray(details)) {
      for (const detail of details) {
        await client.query(`
          INSERT INTO inquiry_details (
            inquiry_id, material_id, task_id, assignee_id, status,
            progress, start_date, due_date, estimated_cost,
            customer_approved, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          inquiryId,
          detail.materialId || null,
          detail.taskId || null,
          detail.assigneeId || null,
          detail.status || 'Not Started',
          detail.progress || 0,
          detail.startDate || null,
          detail.dueDate || null,
          detail.estimatedCost || 0,
          detail.customerApproved || 'NA',
          detail.remarks || null
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Inquiry created successfully',
      inquiryId,
      inquiryNumber,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating inquiry:', error);
    res.status(500).json({
      error: 'Failed to create inquiry',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Helper to convert empty strings to null (for integer fields)
const toIntOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

// Update inquiry
router.put('/:id', authenticateToken, async (req, res) => {
  const { client, setUser } = await getClientWithUser(req.user.username);

  try {
    await client.query('BEGIN');
    // Set user context for audit triggers
    await setUser();

    const { id } = req.params;
    const {
      inquiryDate,
      inquiryDescription,
      customerId,
      productCategoryId,
      status,
      inquiryGroup,
      remarks,
      conclusion,
      details,
    } = req.body;

    // Update header - trigger will auto-set modified_by and modified_at
    const headerResult = await client.query(`
      UPDATE inquiry_headers SET
        inquiry_date = COALESCE($1, inquiry_date),
        inquiry_description = COALESCE($2, inquiry_description),
        customer_id = COALESCE($3, customer_id),
        product_category_id = $4,
        status = COALESCE($5, status),
        inquiry_group = $6,
        remarks = $7,
        conclusion = $8
      WHERE inquiry_id = $9
      RETURNING inquiry_id
    `, [
      inquiryDate || null,
      inquiryDescription || null,
      toIntOrNull(customerId),
      toIntOrNull(productCategoryId),
      status || null,
      inquiryGroup || null,
      remarks || null,
      conclusion || null,
      id
    ]);

    if (headerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Update details if provided
    if (details && Array.isArray(details)) {
      // Delete existing details
      await client.query('DELETE FROM inquiry_details WHERE inquiry_id = $1', [id]);

      // Insert new details - triggers will auto-set audit fields
      for (const detail of details) {
        await client.query(`
          INSERT INTO inquiry_details (
            inquiry_id, material_id, task_id, assignee_id, status,
            progress, start_date, due_date, estimated_cost, actual_cost,
            customer_approved, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          id,
          detail.materialId || null,
          detail.taskId || null,
          detail.assigneeId || null,
          detail.status || 'Not Started',
          detail.progress || 0,
          detail.startDate || null,
          detail.dueDate || null,
          detail.estimatedCost || 0,
          detail.actualCost || 0,
          detail.customerApproved || 'NA',
          detail.remarks || null
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Inquiry updated successfully',
      inquiryId: id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating inquiry:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  } finally {
    client.release();
  }
});

// Delete inquiry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM inquiry_headers WHERE inquiry_id = $1 RETURNING inquiry_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({ message: 'Inquiry deleted successfully' });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

// Update inquiry detail
router.put('/:inquiryId/details/:detailId', authenticateToken, async (req, res) => {
  try {
    const { inquiryId, detailId } = req.params;
    const {
      materialId,
      taskId,
      assigneeId,
      status,
      progress,
      startDate,
      dueDate,
      estimatedCost,
      actualCost,
      customerApproved,
      remarks,
    } = req.body;

    // Use queryWithUser - trigger will auto-set modified_by and modified_at
    const result = await queryWithUser(`
      UPDATE inquiry_details SET
        material_id = $1,
        task_id = $2,
        assignee_id = $3,
        status = COALESCE($4, status),
        progress = COALESCE($5, progress),
        start_date = $6,
        due_date = $7,
        estimated_cost = COALESCE($8, estimated_cost),
        actual_cost = COALESCE($9, actual_cost),
        customer_approved = COALESCE($10, customer_approved),
        remarks = $11
      WHERE detail_id = $12 AND inquiry_id = $13
      RETURNING detail_id
    `, [
      materialId, taskId, assigneeId, status, progress,
      startDate, dueDate, estimatedCost, actualCost,
      customerApproved, remarks, detailId, inquiryId
    ], req.user.username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Detail not found' });
    }

    res.json({ message: 'Detail updated successfully' });
  } catch (error) {
    console.error('Error updating detail:', error);
    res.status(500).json({ error: 'Failed to update detail' });
  }
});

module.exports = router;
