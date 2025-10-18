// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

/* ---------------------------------------------
   Solo usamos MYSQL_URL (formato):
   mysql://USER:PASS@HOST:PORT/DBNAME
   + DB_SSL=true/false (recomendado: true en cloud)
----------------------------------------------*/
const norm = (v) => (typeof v === "string" ? v.trim() : v);

function parseMysqlUrl(raw) {
  const url = norm(raw || "");
  if (!url) throw new Error("[DB] Falta MYSQL_URL");
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("[DB] MYSQL_URL inválida. Ej: mysql://user:pass@host:3306/db");
  }
  if (u.protocol !== "mysql:") {
    throw new Error('[DB] MYSQL_URL debe iniciar con "mysql://"...');
  }
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database: (u.pathname || "").replace(/^\//, ""),
  };
}

// Lee config únicamente desde MYSQL_URL
const cfg = parseMysqlUrl(process.env.MYSQL_URL);

// SSL opcional (recomendado en cloud)
const USE_SSL = /^(1|true|yes)$/i.test(process.env.DB_SSL || "true");
const ssl = USE_SSL ? { rejectUnauthorized: false } : undefined;

// Validaciones mínimas
if (!cfg.host || !cfg.user || !cfg.database || !cfg.port || Number.isNaN(cfg.port)) {
  throw new Error("[DB] MYSQL_URL incompleta (host/user/pass/port/db)");
}

/* ---------------------------------------------
   Pool de conexiones
----------------------------------------------*/
const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  timezone: "Z",
  multipleStatements: false,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl,
});

/* ---------------------------------------------
   Ping de verificación al arrancar (no tumba)
----------------------------------------------*/
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log("[DB] Config usada:", {
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      database: cfg.database,
      ssl: !!ssl,
    });
    console.log(`[DB] Conectado OK=${rows?.[0]?.ok}`);
  } catch (err) {
    console.error("[DB] Error conectando a MySQL:", err?.sqlMessage || err?.message || err);
  }
})();

module.exports = pool;
