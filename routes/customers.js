/**
 * Sky High International - Customer Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.*,
        ct.customer_type_description as customer_type,
        co.country_name
      FROM customers c
      LEFT JOIN customer_types ct ON c.customer_type_id = ct.customer_type_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      ORDER BY c.customer_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        c.*,
        ct.customer_type_description as customer_type,
        co.country_name
      FROM customers c
      LEFT JOIN customer_types ct ON c.customer_type_id = ct.customer_type_id
      LEFT JOIN countries co ON c.country_id = co.country_id
      WHERE c.customer_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customerName,
      customerTypeId,
      contactPerson,
      contactEmail,
      contactPhone,
      countryId,
      address,
    } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Use queryWithUser - triggers will auto-set created_by, created_at, modified_by, modified_at
    const result = await queryWithUser(`
      INSERT INTO customers (
        customer_name, customer_type_id, contact_person, contact_email,
        contact_phone, country_id, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING customer_id
    `, [
      customerName, customerTypeId, contactPerson, contactEmail,
      contactPhone, countryId, address
    ], req.user.username);

    res.status(201).json({
      message: 'Customer created successfully',
      customerId: result.rows[0].customer_id,
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerTypeId,
      contactPerson,
      contactEmail,
      contactPhone,
      countryId,
      address,
    } = req.body;

    // Use queryWithUser - trigger will auto-set modified_by and modified_at
    const result = await queryWithUser(`
      UPDATE customers SET
        customer_name = COALESCE($1, customer_name),
        customer_type_id = $2,
        contact_person = $3,
        contact_email = $4,
        contact_phone = $5,
        country_id = $6,
        address = $7
      WHERE customer_id = $8
      RETURNING customer_id
    `, [
      customerName, customerTypeId, contactPerson, contactEmail,
      contactPhone, countryId, address, id
    ], req.user.username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM customers
      WHERE customer_id = $1
      RETURNING customer_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
