/**
 * Sky High International - Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, queryWithUser } = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    // Get current user
    const result = await query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password - trigger will auto-set modified_by and modified_at
    await queryWithUser(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [newPasswordHash, userId],
      req.user.username
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Temporary: Seed missing users (admin-only)
router.post('/seed-users', authenticateToken, async (req, res) => {
  try {
    const perms = typeof req.user.permissions === 'string'
      ? JSON.parse(req.user.permissions)
      : req.user.permissions;
    if (!perms || !perms.includes('all')) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash('password123', saltRounds);

    const users = [
      ['habib', hash, 'Mr. Habib', 'habib@skyhigh.co.th', 'Managing Director', 'Management', '["all"]'],
      ['kg', hash, 'Kraisar Gilitwala', 'kraisar@gmail.com', 'Admin', 'Administration', '["all"]'],
      ['shalini', hash, 'Shalini', 'shalini@skyhigh.co.th', 'Operations Manager', 'Operations', '["view_all", "edit_own", "reports"]'],
      ['lek', hash, 'Lek', 'lek@skyhigh.co.th', 'Procurement Specialist', 'Procurement', '["view_all", "edit_assigned"]'],
      ['oh', hash, 'Oh+', 'oh@skyhigh.co.th', 'Pricing Specialist', 'R&D', '["view_all", "edit_assigned"]'],
      ['sharik', hash, 'Sharik', 'sharik@skyhigh.co.th', 'Procurement Specialist', 'Procurement', '["view_all", "edit_assigned"]'],
      ['donald', hash, 'Donald', 'donald@skyhigh.co.th', 'Design Specialist', 'Design', '["view_all", "edit_assigned"]'],
      ['tua', hash, 'Tua', 'tua@skyhigh.co.th', 'Logistics Specialist', 'Logistics', '["view_all", "edit_assigned"]'],
    ];

    const results = [];
    for (const u of users) {
      const exists = await query('SELECT user_id FROM users WHERE username = $1', [u[0]]);
      if (exists.rows.length > 0) {
        results.push({ username: u[0], status: 'already exists' });
      } else {
        await query(
          'INSERT INTO users (username, password_hash, full_name, email, role, department, permissions, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [...u, 'system']
        );
        results.push({ username: u[0], status: 'created' });
      }
    }

    res.json({ message: 'Seed complete', results });
  } catch (error) {
    console.error('Seed users error:', error);
    res.status(500).json({ error: 'Failed to seed users' });
  }
});

module.exports = router;
