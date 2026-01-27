/**
 * Sky High International - Countries Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all countries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM countries
      ORDER BY country_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get country by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM countries WHERE country_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching country:', error);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

// Create country
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { countryName, countryCode } = req.body;

    if (!countryName) {
      return res.status(400).json({ error: 'Country name is required' });
    }

    // Use queryWithUser - triggers will auto-set audit fields
    const result = await queryWithUser(`
      INSERT INTO countries (country_name, country_code)
      VALUES ($1, $2)
      RETURNING country_id
    `, [countryName, countryCode], req.user.username);

    res.status(201).json({
      message: 'Country created successfully',
      countryId: result.rows[0].country_id,
    });
  } catch (error) {
    console.error('Error creating country:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Country name already exists' });
    }
    res.status(500).json({ error: 'Failed to create country' });
  }
});

// Update country
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { countryName, countryCode } = req.body;

    // Use queryWithUser - trigger will auto-set modified_by and modified_at
    const result = await queryWithUser(`
      UPDATE countries SET
        country_name = COALESCE($1, country_name),
        country_code = COALESCE($2, country_code)
      WHERE country_id = $3
      RETURNING country_id
    `, [countryName, countryCode, id], req.user.username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json({ message: 'Country updated successfully' });
  } catch (error) {
    console.error('Error updating country:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Country name already exists' });
    }
    res.status(500).json({ error: 'Failed to update country' });
  }
});

// Delete country
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if country is used by any customers
    const checkResult = await query(
      'SELECT COUNT(*) FROM customers WHERE country_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete country. It is being used by customers.'
      });
    }

    const result = await query(
      'DELETE FROM countries WHERE country_id = $1 RETURNING country_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json({ message: 'Country deleted successfully' });
  } catch (error) {
    console.error('Error deleting country:', error);
    res.status(500).json({ error: 'Failed to delete country' });
  }
});

module.exports = router;
