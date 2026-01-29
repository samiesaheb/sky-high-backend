/**
 * Notifications Routes
 * Provides real-time notifications for:
 * - Overdue tasks
 * - Recently assigned tasks
 * - Inquiries needing attention
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/notifications - Get all notifications
router.get('/', async (req, res) => {
  try {
    const notifications = [];

    // 1. Overdue Tasks (due_date < today and not completed)
    const overdueResult = await pool.query(`
      SELECT
        id.detail_id,
        id.inquiry_id,
        ih.inquiry_number,
        ih.inquiry_description,
        t.task_name,
        a.assignee_name,
        m.material_name,
        id.due_date,
        id.status,
        id.progress,
        c.customer_name,
        CURRENT_DATE - id.due_date as days_overdue
      FROM inquiry_details id
      JOIN inquiry_headers ih ON id.inquiry_id = ih.inquiry_id
      JOIN customers c ON ih.customer_id = c.customer_id
      LEFT JOIN tasks t ON id.task_id = t.task_id
      LEFT JOIN assignees a ON id.assignee_id = a.assignee_id
      LEFT JOIN materials m ON id.material_id = m.material_id
      WHERE id.due_date < CURRENT_DATE
        AND id.status NOT IN ('Completed', 'Cancelled', 'Abandoned')
      ORDER BY id.due_date ASC
      LIMIT 20
    `);

    overdueResult.rows.forEach(row => {
      notifications.push({
        id: `overdue-${row.detail_id}`,
        type: 'overdue',
        title: 'Overdue Task',
        message: `${row.task_name || row.material_name || 'Task'} is ${row.days_overdue} day(s) overdue`,
        inquiry_id: row.inquiry_id,
        inquiry_number: row.inquiry_number,
        detail_id: row.detail_id,
        customer_name: row.customer_name,
        assignee_name: row.assignee_name,
        due_date: row.due_date,
        days_overdue: row.days_overdue,
        priority: 'high',
        created_at: row.due_date
      });
    });

    // 2. Tasks Due Today
    const dueTodayResult = await pool.query(`
      SELECT
        id.detail_id,
        id.inquiry_id,
        ih.inquiry_number,
        t.task_name,
        a.assignee_name,
        m.material_name,
        id.due_date,
        id.status,
        c.customer_name
      FROM inquiry_details id
      JOIN inquiry_headers ih ON id.inquiry_id = ih.inquiry_id
      JOIN customers c ON ih.customer_id = c.customer_id
      LEFT JOIN tasks t ON id.task_id = t.task_id
      LEFT JOIN assignees a ON id.assignee_id = a.assignee_id
      LEFT JOIN materials m ON id.material_id = m.material_id
      WHERE id.due_date = CURRENT_DATE
        AND id.status NOT IN ('Completed', 'Cancelled', 'Abandoned')
      ORDER BY ih.inquiry_number
      LIMIT 10
    `);

    dueTodayResult.rows.forEach(row => {
      notifications.push({
        id: `due-today-${row.detail_id}`,
        type: 'due_today',
        title: 'Due Today',
        message: `${row.task_name || row.material_name || 'Task'} is due today`,
        inquiry_id: row.inquiry_id,
        inquiry_number: row.inquiry_number,
        detail_id: row.detail_id,
        customer_name: row.customer_name,
        assignee_name: row.assignee_name,
        due_date: row.due_date,
        priority: 'medium',
        created_at: row.due_date
      });
    });

    // 3. Inquiries with No Progress (status = 'Not Started' for more than 7 days)
    const staleResult = await pool.query(`
      SELECT
        ih.inquiry_id,
        ih.inquiry_number,
        ih.inquiry_description,
        ih.inquiry_date,
        ih.status,
        c.customer_name,
        CURRENT_DATE - ih.inquiry_date as days_since_created
      FROM inquiry_headers ih
      JOIN customers c ON ih.customer_id = c.customer_id
      WHERE ih.status = 'Not Started'
        AND ih.inquiry_date < CURRENT_DATE - INTERVAL '7 days'
      ORDER BY ih.inquiry_date ASC
      LIMIT 10
    `);

    staleResult.rows.forEach(row => {
      notifications.push({
        id: `stale-${row.inquiry_id}`,
        type: 'stale',
        title: 'Inquiry Needs Attention',
        message: `${row.inquiry_number} has not started for ${row.days_since_created} days`,
        inquiry_id: row.inquiry_id,
        inquiry_number: row.inquiry_number,
        customer_name: row.customer_name,
        days_since_created: row.days_since_created,
        priority: 'low',
        created_at: row.inquiry_date
      });
    });

    // 4. Recently Modified Inquiries (last 24 hours) - for awareness
    const recentResult = await pool.query(`
      SELECT
        ih.inquiry_id,
        ih.inquiry_number,
        ih.inquiry_description,
        ih.status,
        ih.modified_at,
        ih.modified_by,
        c.customer_name
      FROM inquiry_headers ih
      JOIN customers c ON ih.customer_id = c.customer_id
      WHERE ih.modified_at > NOW() - INTERVAL '24 hours'
        AND ih.modified_at != ih.created_at
      ORDER BY ih.modified_at DESC
      LIMIT 5
    `);

    recentResult.rows.forEach(row => {
      notifications.push({
        id: `recent-${row.inquiry_id}-${row.modified_at}`,
        type: 'recent_update',
        title: 'Recently Updated',
        message: `${row.inquiry_number} was updated by ${row.modified_by || 'someone'}`,
        inquiry_id: row.inquiry_id,
        inquiry_number: row.inquiry_number,
        customer_name: row.customer_name,
        modified_by: row.modified_by,
        priority: 'info',
        created_at: row.modified_at
      });
    });

    // Sort all notifications: high priority first, then by date
    const priorityOrder = { high: 0, medium: 1, low: 2, info: 3 };
    notifications.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({
      notifications,
      summary: {
        total: notifications.length,
        overdue: notifications.filter(n => n.type === 'overdue').length,
        due_today: notifications.filter(n => n.type === 'due_today').length,
        stale: notifications.filter(n => n.type === 'stale').length,
        recent_updates: notifications.filter(n => n.type === 'recent_update').length
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/count - Get notification count only (for badge)
router.get('/count', async (req, res) => {
  try {
    // Count overdue tasks
    const overdueCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM inquiry_details
      WHERE due_date < CURRENT_DATE
        AND status NOT IN ('Completed', 'Cancelled', 'Abandoned')
    `);

    // Count tasks due today
    const dueTodayCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM inquiry_details
      WHERE due_date = CURRENT_DATE
        AND status NOT IN ('Completed', 'Cancelled', 'Abandoned')
    `);

    // Count stale inquiries (Not Started for more than 7 days)
    const staleCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM inquiry_headers
      WHERE status = 'Not Started'
        AND inquiry_date < CURRENT_DATE - INTERVAL '7 days'
    `);

    // Count recently modified inquiries (last 24 hours)
    const recentCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM inquiry_headers
      WHERE modified_at > NOW() - INTERVAL '24 hours'
        AND modified_at != created_at
    `);

    const overdue = parseInt(overdueCount.rows[0].count) || 0;
    const dueToday = parseInt(dueTodayCount.rows[0].count) || 0;
    const stale = parseInt(staleCount.rows[0].count) || 0;
    const recent_updates = parseInt(recentCount.rows[0].count) || 0;

    res.json({
      total: overdue + dueToday + stale + recent_updates,
      overdue,
      due_today: dueToday,
      stale,
      recent_updates
    });

  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({ error: 'Failed to fetch notification count' });
  }
});

module.exports = router;
