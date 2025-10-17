// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

// ==== Requerir variables (no usar defaults peligrosos en prod) ====
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST;
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT);
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER;
const DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.DB_PASS ?? process.env.MYSQLPASSWORD;
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE;

function assertEnv(name, value) {
  if (!value && value !== 0) {
    throw new Error(`[DB] Falta variable de entorno: ${name}`);
  }
}
assertEnv("DB_HOST/MYSQLHOST", DB_HOST);
assertEnv("DB_PORT/MYSQLPORT", DB_PORT);
assertEnv("DB_USER/MYSQLUSER", DB_USER);
assertEnv("DB_PASSWORD", DB_PASSWORD);
assertEnv("DB_NAME/MYSQLDATABASE", DB_NAME);

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  timezone: "Z",                 // UTC
  multipleStatements: false,     // seguridad
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Verificación simple al arrancar (no tumba el proceso si falla)
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log(`[DB] Conectado: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} OK=${rows[0]?.ok}`);
  } catch (err) {
    console.error("[DB] Error conectando a MySQL:", err.message);
  }
})();

module.exports = pool;
