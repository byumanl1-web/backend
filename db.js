// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

// Toma primero tus variables (DB_*) y, si no existen,
// usa las que suele dar Railway (MYSQL*).
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || "root";
const DB_PASSWORD =
  process.env.DB_PASSWORD ?? process.env.DB_PASS ?? process.env.MYSQLPASSWORD ?? "";
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || "qrmanager";

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
