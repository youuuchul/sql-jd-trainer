import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const dbName = process.env.MYSQL_DATABASE || 'sql_jd_trainer';
const sqlMode = process.env.MYSQL_SQL_MODE || 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
const baseConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  multipleStatements: false,
};

let dbPool = null;
const adminPool = mysql.createPool(baseConfig);

const escapeId = (name) => `\`${String(name).replace(/`/g, '``')}\``;

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isDateTime = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(value);
const isInt = (value) =>
  typeof value === 'number'
    ? Number.isInteger(value)
    : typeof value === 'string' && /^-?\d+$/.test(value);
const isFloat = (value) =>
  typeof value === 'number'
    ? !Number.isNaN(value) && !Number.isInteger(value)
    : typeof value === 'string' && /^-?\d+\.\d+$/.test(value);
const isBool = (value) =>
  typeof value === 'boolean' || value === 'true' || value === 'false';

const inferColumnType = (name, values) => {
  const col = String(name || '').toLowerCase();
  if (!values.length) {
    if (col.endsWith('_id') || col === 'id') return 'INT';
    if (col.includes('date')) return 'DATE';
    if (col.includes('time') || col.includes('timestamp') || col.endsWith('_at')) return 'DATETIME';
    if (col.startsWith('is_') || col.startsWith('has_') || col.endsWith('_flag')) return 'TINYINT(1)';
    if (col.includes('amount') || col.includes('price') || col.includes('total') || col.includes('rate') || col.includes('score') || col.includes('ratio')) {
      return 'DECIMAL(18,4)';
    }
    return 'TEXT';
  }
  if (values.every(isBool)) return 'TINYINT(1)';
  if (values.every(isInt)) return 'INT';
  if (values.every((v) => isInt(v) || isFloat(v))) return 'DECIMAL(18,4)';
  if (values.every(isDateTime)) return 'DATETIME';
  if (values.every(isDate)) return 'DATE';
  return 'TEXT';
};

const ensureDatabase = async () => {
  await adminPool.query(`CREATE DATABASE IF NOT EXISTS ${escapeId(dbName)}`);
};

const getDbPool = async () => {
  if (!dbPool) {
    await ensureDatabase();
    dbPool = mysql.createPool({ ...baseConfig, database: dbName });
  }
  return dbPool;
};

const applySqlMode = async (connection) => {
  if (!sqlMode) return;
  await connection.query('SET SESSION sql_mode = ?', [sqlMode]);
};

const stripLeadingComments = (sql) => {
  const lines = sql.split('\n');
  const filtered = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) continue;
    filtered.push(trimmed);
  }
  return filtered.join(' ').trim();
};

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getDbPool();
    await pool.query('SELECT 1');
    res.json({ ok: true, database: dbName });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/init', async (req, res) => {
  const { schema } = req.body || {};
  if (!Array.isArray(schema)) {
    return res.status(400).json({ error: 'schema가 필요합니다.' });
  }

  try {
    const pool = await getDbPool();
    const connection = await pool.getConnection();
    try {
      await applySqlMode(connection);
      await connection.query('SET FOREIGN_KEY_CHECKS=0');

      for (const table of schema) {
        const tableName = escapeId(table.tableName);
        await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
      }

      for (const table of schema) {
        const columns = Array.isArray(table.columns) ? table.columns : [];
        const data = Array.isArray(table.data) ? table.data : [];
        const columnDefs = columns.map((col) => {
          const values = data
            .map((row) => row?.[col])
            .filter((v) => v !== null && v !== undefined);
          return `${escapeId(col)} ${inferColumnType(col, values)}`;
        });
        await connection.query(`CREATE TABLE ${escapeId(table.tableName)} (${columnDefs.join(', ')})`);

        if (data.length > 0) {
          const rows = data.map((row) => columns.map((col) => (row[col] ?? null)));
          await connection.query(
            `INSERT INTO ${escapeId(table.tableName)} (${columns
              .map(escapeId)
              .join(', ')}) VALUES ?`,
            [rows]
          );
        }
      }
    } finally {
      connection.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'sql이 필요합니다.' });
  }

  const firstToken = stripLeadingComments(sql).toLowerCase();
  if (!firstToken.startsWith('select') && !firstToken.startsWith('with')) {
    return res.status(400).json({ error: 'SELECT/CTE 쿼리만 허용됩니다.' });
  }

  try {
    const pool = await getDbPool();
    const connection = await pool.getConnection();
    try {
      await applySqlMode(connection);
      const [rows] = await connection.query(sql);
      return res.json({ rows });
    } finally {
      connection.release();
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`SQL JD Trainer API listening on port ${port}`);
});
