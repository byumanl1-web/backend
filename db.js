// backend/db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "qrmanager",   // <-- fallback alineado
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  // Opcionales:
  // dateStrings: true,     // devuelve DATETIME como string
  // timezone: 'Z',         // guarda/lee en UTC
});

// Pequeña verificación al arrancar:
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log(
      `MySQL OK -> ${process.env.DB_NAME || "qrmanager"}@${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 3306}`
    );
  } catch (err) {
    console.error("Error conectando a MySQL:", err.message);
    process.exit(1);
  }
})();

module.exports = pool;
