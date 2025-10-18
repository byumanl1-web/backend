// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

/* ---------------------------------------------
   Utilidades
----------------------------------------------*/
const norm = (v) => (typeof v === "string" ? v.trim() : v);
const toInt = (v, dft = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
};

function parseMysqlUrl(raw) {
  try {
    const u = new URL(raw); // mysql://user:pass@host:port/dbname
    return {
      host: norm(u.hostname),
      port: toInt(u.port || 3306, 3306),
      user: norm(decodeURIComponent(u.username || "")),
      password: norm(decodeURIComponent(u.password || "")),
      database: norm(u.pathname ? u.pathname.replace(/^\//, "") : ""),
    };
  } catch {
    return null;
  }
}

function required(label, value) {
  if (value === 0) return value;
  if (value === null || value === undefined || value === "") {
    throw new Error(`[DB] Falta variable de entorno: ${label}`);
  }
  return value;
}

/* ---------------------------------------------
   Lectura de variables (prioridades)
   1) MYSQL_URL
   2) DB_* (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME)
   3) MYSQL* (MYSQLHOST/MYSQLPORT/...)
----------------------------------------------*/
let cfg = { host: null, port: null, user: null, password: null, database: null };

// 1) MYSQL_URL
const url = norm(process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL);
const parsedFromUrl = url ? parseMysqlUrl(url) : null;
if (parsedFromUrl) cfg = { ...cfg, ...parsedFromUrl };

// 2) DB_* (si algo falta, toma de aquí)
cfg.host     = cfg.host     || norm(process.env.DB_HOST);
cfg.port     = cfg.port     || toInt(process.env.DB_PORT);
cfg.user     = cfg.user     || norm(process.env.DB_USER);
cfg.password = cfg.password || norm(process.env.DB_PASSWORD ?? process.env.DB_PASS);
cfg.database = cfg.database || norm(process.env.DB_NAME);

// 3) MYSQL* (Railway referencias)
cfg.host     = cfg.host     || norm(process.env.MYSQLHOST);
cfg.port     = cfg.port     || toInt(process.env.MYSQLPORT);
cfg.user     = cfg.user     || norm(process.env.MYSQLUSER);
cfg.password = cfg.password || norm(process.env.MYSQLPASSWORD);
cfg.database = cfg.database || norm(process.env.MYSQLDATABASE);

// Validación explícita
cfg.host     = required("DB_HOST/MYSQLHOST", cfg.host);
cfg.port     = Number(required("DB_PORT/MYSQLPORT", cfg.port));
cfg.user     = required("DB_USER/MYSQLUSER", cfg.user);
cfg.password = required("DB_PASSWORD/MYSQLPASSWORD/DB_PASS", cfg.password);
cfg.database = required("DB_NAME/MYSQLDATABASE", cfg.database);

// SSL opcional (recomendado en cloud). Puedes usar DB_SSL=true
const USE_SSL = /^(1|true|yes)$/i.test(process.env.DB_SSL || "");
const ssl = USE_SSL ? { rejectUnauthorized: false } : undefined;

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
    console.log(
      `[DB] Conectado -> ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} OK=${rows?.[0]?.ok}`
    );
  } catch (err) {
    console.error("[DB] Error conectando a MySQL:", err?.sqlMessage || err?.message || err);
  }
})();

module.exports = pool;
