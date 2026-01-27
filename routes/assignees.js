/**
 * Sky High International - Assignees Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all assignees
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM assignees
      WHERE is_active = true
      ORDER BY assignee_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assignees:', error);
    res.status(500).json({ error: 'Failed to fetch assignees' });
  }
});

// Get assignee workload
router.get('/workload', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        a.assignee_id,
        a.assignee_name,
        a.department,
        COUNT(d.detail_id) as total_tasks,
        COUNT(CASE WHEN d.status = 'In Progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN d.status = 'Completed' THEN 1 END) as completed
      FROM assignees a
      LEFT JOIN inquiry_details d ON a.assignee_id = d.assignee_id
      WHERE a.is_active = true
      GROUP BY a.assignee_id, a.assignee_name, a.department
      ORDER BY total_tasks DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching workload:', error);
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
});

// Get assignee by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM assignees WHERE assignee_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching assignee:', error);
    res.status(500).json({ error: 'Failed to fetch assignee' });
  }
});

// Create assignee
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      assigneeName,
      title,
      department,
      email,
      phone,
      specialty,
    } = req.body;

    if (!assigneeName) {
      return res.status(400).json({ error: 'Assignee name is required' });
    }

    // Use queryWithUser - triggers will auto-set audit fields
    const result = await queryWithUser(`
      INSERT INTO assignees (
        assignee_name, title, department, email, phone, specialty
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING assignee_id
    `, [
      assigneeName, title, department, email, phone, specialty
    ], req.user.username);

    res.status(201).json({
      message: 'Assignee created successfully',
      assigneeId: result.rows[0].assignee_id,
    });
  } catch (error) {
    console.error('Error creating assignee:', error);
    res.status(500).json({ error: 'Failed to create assignee' });
  }
});

// Update assignee
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      assigneeName,
      title,
      department,
      email,
      phone,
      specialty,
    } = req.body;

    // Use queryWithUser - trigger will auto-set modified_by and modified_at
    const result = await queryWithUser(`
      UPDATE assignees SET
        assignee_name = COALESCE($1, assignee_name),
        title = $2,
        department = $3,
        email = $4,
        phone = $5,
        specialty = $6
      WHERE assignee_id = $7
      RETURNING assignee_id
    `, [
      assigneeName, title, department, email, phone, specialty, id
    ], req.user.username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    res.json({ message: 'Assignee updated successfully' });
  } catch (error) {
    console.error('Error updating assignee:', error);
    res.status(500).json({ error: 'Failed to update assignee' });
  }
});

module.exports = router;
