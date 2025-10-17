// backend/scripts/import-sql.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Ruta del dump (ya lo subiste como backend/sql/qrmanager.sql)
const SQL_FILE = process.env.SQL_FILE || path.join(__dirname, "..", "sql", "qrmanager.sql");

(async () => {
  try {
    const host = process.env.DB_HOST || process.env.MYSQLHOST;
    const port = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);
    const user = process.env.DB_USER || process.env.MYSQLUSER;
    const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
    const database = process.env.DB_NAME || process.env.MYSQLDATABASE;

    console.log("[IMPORT] Conectando a:", host, port, database, "como", user);
    const conn = await mysql.createConnection({
      host, port, user, password, database,
      charset: "utf8mb4_unicode_ci",
      multipleStatements: true, // necesario para dumps
      timezone: "Z",
    });

    const sqlPath = path.resolve(SQL_FILE);
    console.log("[IMPORT] Leyendo:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf8");

    await conn.query(sql);
    console.log("[IMPORT] ÉXITO: dump ejecutado completo.");
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error("[IMPORT] ERROR:", e.message);
    process.exit(1);
  }
})();
