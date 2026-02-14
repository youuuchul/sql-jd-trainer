import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf-8');
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnvFile();

const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'sql_jd_trainer',
  sqlMode: process.env.MYSQL_SQL_MODE || 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION',
  serverPort: Number(process.env.PORT || 8787),
};

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
    if (
      col.includes('amount') ||
      col.includes('price') ||
      col.includes('total') ||
      col.includes('rate') ||
      col.includes('score') ||
      col.includes('ratio')
    ) {
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

const escapeValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const str = String(value);
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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

const runMysql = (sql) =>
  new Promise((resolve, reject) => {
    const args = [
      '--protocol=TCP',
      '--default-character-set=utf8mb4',
      '-h',
      config.host,
      '-P',
      String(config.port),
      '-u',
      config.user,
      '-D',
      config.database,
      '--batch',
      '--raw',
      '-e',
      sql,
    ];

    execFile(
      'mysql',
      args,
      { env: { ...process.env, MYSQL_PWD: config.password } },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout);
      }
    );
  });

const parseMysqlTsv = (output) => {
  const trimmed = output.trim();
  if (!trimmed) return [];
  const lines = trimmed.split('\n');
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).map((line) => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? null;
    });
    return row;
  });
  return rows;
};

const json = (res, code, payload) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const initSchemaSql = (schema) => {
  const statements = [];
  statements.push(`CREATE DATABASE IF NOT EXISTS ${escapeId(config.database)}`);
  statements.push(`USE ${escapeId(config.database)}`);
  statements.push(`SET SESSION sql_mode='${config.sqlMode}'`);
  statements.push('SET FOREIGN_KEY_CHECKS=0');

  for (const table of schema) {
    statements.push(`DROP TABLE IF EXISTS ${escapeId(table.tableName)}`);
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
    statements.push(`CREATE TABLE ${escapeId(table.tableName)} (${columnDefs.join(', ')})`);

    if (data.length > 0) {
      const rows = data.map((row) =>
        `(${columns.map((col) => escapeValue(row?.[col])).join(', ')})`
      );
      statements.push(
        `INSERT INTO ${escapeId(table.tableName)} (${columns
          .map(escapeId)
          .join(', ')}) VALUES ${rows.join(', ')}`
      );
    }
  }

  return statements.join(';\n') + ';';
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end();
    return;
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    try {
      const output = await runMysql('SELECT 1');
      if (output.includes('1')) {
        json(res, 200, { ok: true, database: config.database });
      } else {
        json(res, 500, { ok: false, error: 'MySQL 응답이 없습니다.' });
      }
    } catch (err) {
      json(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  if (req.url === '/api/init' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { schema } = body;
      if (!Array.isArray(schema)) {
        json(res, 400, { error: 'schema가 필요합니다.' });
        return;
      }
      const sql = initSchemaSql(schema);
      await runMysql(sql);
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  if (req.url === '/api/query' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { sql } = body;
      if (!sql || typeof sql !== 'string') {
        json(res, 400, { error: 'sql이 필요합니다.' });
        return;
      }
      const firstToken = stripLeadingComments(sql).toLowerCase();
      if (!firstToken.startsWith('select') && !firstToken.startsWith('with')) {
        json(res, 400, { error: 'SELECT/CTE 쿼리만 허용됩니다.' });
        return;
      }
      const querySql = `SET SESSION sql_mode='${config.sqlMode}';\n${sql}`;
      const output = await runMysql(querySql);
      const rows = parseMysqlTsv(output);
      json(res, 200, { rows });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(config.serverPort, () => {
  console.log(`SQL JD Trainer API listening on port ${config.serverPort}`);
});
