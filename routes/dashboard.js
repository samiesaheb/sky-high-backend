/**
 * Sky High International - Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*) as total_inquiries,
        COUNT(CASE WHEN status = 'Not Started' THEN 1 END) as not_started,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
      FROM inquiry_headers
    `);

    // Count overdue details (past due_date and not completed)
    const overdue = await query(`
      SELECT COUNT(*) as overdue_count
      FROM inquiry_details
      WHERE due_date < CURRENT_DATE
      AND status NOT IN ('Completed', 'Cancelled')
    `);

    res.json({
      ...stats.rows[0],
      overdue: overdue.rows[0].overdue_count,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get recent inquiries
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await query(`
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
        h.created_at
      FROM inquiry_headers h
      LEFT JOIN customers c ON h.customer_id = c.customer_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      LEFT JOIN product_categories pc ON h.product_category_id = pc.product_category_id
      ORDER BY h.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent inquiries:', error);
    res.status(500).json({ error: 'Failed to fetch recent inquiries' });
  }
});

// Get inquiries by status
router.get('/by-status', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT status, COUNT(*) as count
      FROM inquiry_headers
      GROUP BY status
      ORDER BY count DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching status summary:', error);
    res.status(500).json({ error: 'Failed to fetch status summary' });
  }
});

// Get inquiries by customer country
router.get('/by-country', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT co.country_name, COUNT(*) as count
      FROM inquiry_headers h
      JOIN customers c ON h.customer_id = c.customer_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      GROUP BY co.country_name
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching country summary:', error);
    res.status(500).json({ error: 'Failed to fetch country summary' });
  }
});

// Get monthly inquiry trend
router.get('/monthly-trend', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        TO_CHAR(inquiry_date, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM inquiry_headers
      WHERE inquiry_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(inquiry_date, 'YYYY-MM')
      ORDER BY month
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly trend:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

module.exports = router;
