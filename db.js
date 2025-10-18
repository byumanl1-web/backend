// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

/* ---------------------------------------------
   Utilidades
----------------------------------------------*/
const norm = (v) => (typeof v === "string" ? v.trim() : v);
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function parseMysqlUrl(raw) {
  try {
    const u = new URL(raw); // mysql://user:pass@host:port/dbname
    return {
      host: norm(u.hostname),
      port: toInt(u.port || 3306),
      user: norm(decodeURIComponent(u.username || "")),
      password: norm(decodeURIComponent(u.password || "")),
      database: norm(u.pathname ? u.pathname.replace(/^\//, "") : ""),
    };
  } catch {
    return null;
  }
}

function required(label, value) {
  if (value === 0) return value; // permitir 0 (puerto)
  if (value === null || value === undefined || value === "") {
    throw new Error(`[DB] Falta variable de entorno: ${label}`);
  }
  return value;
}

function take(a, b) {
  return process.env[a] ?? process.env[b] ?? null;
}

/* ---------------------------------------------
   Lectura de variables de entorno
   - Soporta DB_* propios
   - Soporta MYSQL* de Railway
   - Soporta MYSQL_URL / MYSQL_PUBLIC_URL
----------------------------------------------*/
let DB_HOST = norm(take("DB_HOST", "MYSQLHOST"));
let DB_PORT = toInt(take("DB_PORT", "MYSQLPORT"));
let DB_USER = norm(take("DB_USER", "MYSQLUSER"));
let DB_PASSWORD =
  norm(process.env.DB_PASSWORD ?? process.env.DB_PASS ?? process.env.MYSQLPASSWORD) || null;
let DB_NAME = norm(take("DB_NAME", "MYSQLDATABASE"));

if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  const urlCandidate = norm(process.env.MYSQL_URL) || norm(process.env.MYSQL_PUBLIC_URL);
  const parsed = urlCandidate ? parseMysqlUrl(urlCandidate) : null;
  if (parsed) {
    DB_HOST = DB_HOST || parsed.host;
    DB_PORT = Number.isFinite(DB_PORT) ? DB_PORT : parsed.port;
    DB_USER = DB_USER || parsed.user;
    DB_PASSWORD = DB_PASSWORD || parsed.password;
    DB_NAME = DB_NAME || parsed.database;
  }
}

/* ---------------------------------------------
   Validación estricta (evita defaults inseguros)
----------------------------------------------*/
DB_HOST = required("DB_HOST/MYSQLHOST", DB_HOST);
DB_PORT = Number(required("DB_PORT/MYSQLPORT", DB_PORT));
DB_USER = required("DB_USER/MYSQLUSER", DB_USER);
DB_PASSWORD = required("DB_PASSWORD/MYSQLPASSWORD/DB_PASS", DB_PASSWORD);
DB_NAME = required("DB_NAME/MYSQLDATABASE", DB_NAME);

// SSL opcional (si tu proveedor exige SSL, pon DB_SSL=true)
const USE_SSL = /^(1|true|yes)$/i.test(process.env.DB_SSL || "");
const ssl = USE_SSL ? { rejectUnauthorized: false } : undefined;

/* ---------------------------------------------
   Pool de conexiones
----------------------------------------------*/
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
  timezone: "Z",            // UTC
  multipleStatements: false, // Seguridad
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl,
});

/* ---------------------------------------------
   Ping de verificación al arrancar (no tumba el proceso)
----------------------------------------------*/
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log(
      `[DB] Conectado -> ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} OK=${rows?.[0]?.ok}`
    );
  } catch (err) {
    console.error("[DB] Error conectando a MySQL:", err?.sqlMessage || err?.message || err);
  }
})();

module.exports = pool;
