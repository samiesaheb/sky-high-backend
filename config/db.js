/**
 * Sky High International - Database Configuration
 * PostgreSQL connection pool setup with audit user context support
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'skyhigh_inquiry_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function for basic queries (without user context)
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  }
  return res;
};

/**
 * Execute a query with user context for audit triggers
 * Sets the app.current_user session variable before executing the query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @param {string} username - Username for audit tracking
 * @returns {Promise} Query result
 */
const queryWithUser = async (text, params, username) => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    // Set the current user for this transaction using set_config (parameterized)
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user', username || 'system']);
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query with user', {
        text: text.substring(0, 50),
        duration,
        rows: res.rowCount,
        user: username
      });
    }
    return res;
  } finally {
    client.release();
  }
};

/**
 * Get a client with user context set for transactions
 * Use this for multi-statement transactions that need audit tracking
 * @param {string} username - Username for audit tracking
 * @returns {Promise<{client: PoolClient, setUser: Function}>} Client with setUser helper
 */
const getClientWithUser = async (username) => {
  const client = await pool.connect();

  // Helper to set user context within the transaction using set_config (parameterized)
  const setUser = async (user) => {
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user', user || username || 'system']);
  };

  return { client, setUser };
};

// Helper function for transactions (backward compatible)
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  queryWithUser,
  getClient,
  getClientWithUser,
};
