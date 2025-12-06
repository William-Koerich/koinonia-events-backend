const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Erro no pool do Postgres:', err);
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    console.log('[DB] Conectado com sucesso:', result.rows[0].now);
  } catch (err) {
    console.error('[DB] Erro ao conectar:', err.message);
  }
}

module.exports = {
  pool,
  testConnection,
};
