/**
 * Sky High International - Master Data Routes
 * Tasks, Categories, Countries, Customer Types, Material Types
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// TASKS - Full CRUD
// ============================================

router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM tasks ORDER BY task_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM tasks WHERE task_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { taskName, taskDescription, defaultDurationDays } = req.body;
    const result = await queryWithUser(
      `INSERT INTO tasks (task_name, task_description, default_duration_days)
       VALUES ($1, $2, $3) RETURNING *`,
      [taskName, taskDescription || null, defaultDurationDays || 7],
      req.user.username
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { taskName, taskDescription, defaultDurationDays } = req.body;
    const result = await queryWithUser(
      `UPDATE tasks SET task_name = $1, task_description = $2, default_duration_days = $3
       WHERE task_id = $4 RETURNING *`,
      [taskName, taskDescription || null, defaultDurationDays || 7, req.params.id],
      req.user.username
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM tasks WHERE task_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============================================
// PRODUCT CATEGORIES - Full CRUD
// ============================================

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM product_categories ORDER BY category_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM product_categories WHERE product_category_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { categoryName, categoryDescription } = req.body;
    const result = await queryWithUser(
      `INSERT INTO product_categories (category_name, category_description)
       VALUES ($1, $2) RETURNING *`,
      [categoryName, categoryDescription || null],
      req.user.username
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { categoryName, categoryDescription } = req.body;
    const result = await queryWithUser(
      `UPDATE product_categories SET category_name = $1, category_description = $2
       WHERE product_category_id = $3 RETURNING *`,
      [categoryName, categoryDescription || null, req.params.id],
      req.user.username
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM product_categories WHERE product_category_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============================================
// CUSTOMER TYPES - Full CRUD
// ============================================

router.get('/customer-types', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM customer_types ORDER BY customer_type_description');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customer types:', error);
    res.status(500).json({ error: 'Failed to fetch customer types' });
  }
});

router.get('/customer-types/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM customer_types WHERE customer_type_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching customer type:', error);
    res.status(500).json({ error: 'Failed to fetch customer type' });
  }
});

router.post('/customer-types', authenticateToken, async (req, res) => {
  try {
    const { customerTypeDescription } = req.body;
    const result = await queryWithUser(
      `INSERT INTO customer_types (customer_type_description)
       VALUES ($1) RETURNING *`,
      [customerTypeDescription],
      req.user.username
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating customer type:', error);
    res.status(500).json({ error: 'Failed to create customer type' });
  }
});

router.put('/customer-types/:id', authenticateToken, async (req, res) => {
  try {
    const { customerTypeDescription } = req.body;
    const result = await queryWithUser(
      `UPDATE customer_types SET customer_type_description = $1
       WHERE customer_type_id = $2 RETURNING *`,
      [customerTypeDescription, req.params.id],
      req.user.username
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating customer type:', error);
    res.status(500).json({ error: 'Failed to update customer type' });
  }
});

router.delete('/customer-types/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM customer_types WHERE customer_type_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer type not found' });
    }
    res.json({ message: 'Customer type deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer type:', error);
    res.status(500).json({ error: 'Failed to delete customer type' });
  }
});

// ============================================
// MATERIAL TYPES - Full CRUD
// ============================================

router.get('/material-types', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM material_types ORDER BY material_type_description');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching material types:', error);
    res.status(500).json({ error: 'Failed to fetch material types' });
  }
});

router.get('/material-types/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM material_types WHERE material_type_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching material type:', error);
    res.status(500).json({ error: 'Failed to fetch material type' });
  }
});

router.post('/material-types', authenticateToken, async (req, res) => {
  try {
    const { materialTypeDescription } = req.body;
    const result = await queryWithUser(
      `INSERT INTO material_types (material_type_description)
       VALUES ($1) RETURNING *`,
      [materialTypeDescription],
      req.user.username
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating material type:', error);
    res.status(500).json({ error: 'Failed to create material type' });
  }
});

router.put('/material-types/:id', authenticateToken, async (req, res) => {
  try {
    const { materialTypeDescription } = req.body;
    const result = await queryWithUser(
      `UPDATE material_types SET material_type_description = $1
       WHERE material_type_id = $2 RETURNING *`,
      [materialTypeDescription, req.params.id],
      req.user.username
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating material type:', error);
    res.status(500).json({ error: 'Failed to update material type' });
  }
});

router.delete('/material-types/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM material_types WHERE material_type_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material type not found' });
    }
    res.json({ message: 'Material type deleted successfully' });
  } catch (error) {
    console.error('Error deleting material type:', error);
    res.status(500).json({ error: 'Failed to delete material type' });
  }
});

module.exports = router;
