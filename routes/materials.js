/**
 * Sky High International - Materials Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryWithUser } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all materials
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*, mt.material_type_description
      FROM materials m
      LEFT JOIN material_types mt ON m.material_type_id = mt.material_type_id
      ORDER BY m.material_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Get material by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT m.*, mt.material_type_description
      FROM materials m
      LEFT JOIN material_types mt ON m.material_type_id = mt.material_type_id
      WHERE m.material_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// Create material
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      materialName,
      materialDescription,
      materialTypeId,
      materialCategory,
      unitOfMeasure,
      standardCost,
    } = req.body;

    if (!materialName) {
      return res.status(400).json({ error: 'Material name is required' });
    }

    // Use queryWithUser - triggers will auto-set audit fields
    const result = await queryWithUser(`
      INSERT INTO materials (
        material_name, material_description, material_type_id,
        material_category, unit_of_measure, standard_cost
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING material_id
    `, [
      materialName, materialDescription, materialTypeId,
      materialCategory, unitOfMeasure, standardCost
    ], req.user.username);

    res.status(201).json({
      message: 'Material created successfully',
      materialId: result.rows[0].material_id,
    });
  } catch (error) {
    console.error('Error creating material:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      materialName,
      materialDescription,
      materialTypeId,
      materialCategory,
      unitOfMeasure,
      standardCost,
    } = req.body;

    // Use queryWithUser - trigger will auto-set modified_by and modified_at
    const result = await queryWithUser(`
      UPDATE materials SET
        material_name = COALESCE($1, material_name),
        material_description = $2,
        material_type_id = $3,
        material_category = $4,
        unit_of_measure = $5,
        standard_cost = $6
      WHERE material_id = $7
      RETURNING material_id
    `, [
      materialName, materialDescription, materialTypeId,
      materialCategory, unitOfMeasure, standardCost, id
    ], req.user.username);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({ message: 'Material updated successfully' });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

module.exports = router;
