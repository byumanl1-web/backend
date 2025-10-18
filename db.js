// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

<<<<<<< HEAD
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
    const u = new URL(raw);
    // mysql://user:pass@host:port/dbname
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

function required(name, value) {
  // Permitimos 0 solo para puertos
  if (value === 0) return;
  if (!value) {
    throw new Error(`[DB] Falta variable de entorno: ${name}`);
  }
}
=======
/**
 * Toma primero las variables DB_* (las que tú pones en el servicio backend)
 * y, si no están, usa las que expone Railway en el servicio MySQL (MYSQL*).
 * Si aún así falta alguna, lanza error explícito.
 */
function take(nameA, nameB) {
  return process.env[nameA] ?? process.env[nameB] ?? null;
}
function required(nameLabel, value) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`[DB] Falta variable de entorno: ${nameLabel}`);
  }
  return value;
}

const DB_HOST = required("DB_HOST/MYSQLHOST", take("DB_HOST", "MYSQLHOST"));
const DB_PORT = Number(required("DB_PORT/MYSQLPORT", take("DB_PORT", "MYSQLPORT")));
const DB_USER = required("DB_USER/MYSQLUSER", take("DB_USER", "MYSQLUSER"));
const DB_PASSWORD = required(
  "DB_PASSWORD/MYSQLPASSWORD",
  take("DB_PASSWORD", "MYSQLPASSWORD")
);
const DB_NAME = required("DB_NAME/MYSQLDATABASE", take("DB_NAME", "MYSQLDATABASE"));
>>>>>>> c7df2cf (cambio de apis)

/* ---------------------------------------------
   Lectura de variables de entorno
   - Soporta DB_* propios
   - Soporta MYSQL* de Railway
   - Soporta MYSQL_URL / MYSQL_PUBLIC_URL
----------------------------------------------*/
let DB_HOST =
  norm(process.env.DB_HOST) ||
  norm(process.env.MYSQLHOST) ||
  null;

let DB_PORT =
  toInt(process.env.DB_PORT) ||
  toInt(process.env.MYSQLPORT) ||
  NaN;

let DB_USER =
  norm(process.env.DB_USER) ||
  norm(process.env.MYSQLUSER) ||
  null;

let DB_PASSWORD =
  norm(
    process.env.DB_PASSWORD ??
      process.env.DB_PASS ??
      process.env.MYSQLPASSWORD
  ) || null;

let DB_NAME =
  norm(process.env.DB_NAME) ||
  norm(process.env.MYSQLDATABASE) ||
  null;

// Si faltan valores y tenemos una URL, la usamos para completar
if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  const urlCandidate =
    norm(process.env.MYSQL_URL) || norm(process.env.MYSQL_PUBLIC_URL);
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
required("DB_HOST/MYSQLHOST", DB_HOST);
required("DB_PORT/MYSQLPORT", DB_PORT);
required("DB_USER/MYSQLUSER", DB_USER);
required("DB_PASSWORD/MYSQLPASSWORD/DB_PASS", DB_PASSWORD);
required("DB_NAME/MYSQLDATABASE", DB_NAME);

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
<<<<<<< HEAD
  timezone: "Z", // UTC
  multipleStatements: false, // seguridad
=======
  timezone: "Z",           // Fechas en UTC
  multipleStatements: false, // Seguridad
>>>>>>> c7df2cf (cambio de apis)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

<<<<<<< HEAD
/* ---------------------------------------------
   Probar conexión al arrancar (sin tumbar proceso)
----------------------------------------------*/
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    const ok = rows && rows[0] && rows[0].ok;
    // No mostramos credenciales; solo datos no sensibles
    console.log(
      `[DB] Conectado -> host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} OK=${ok}`
    );
  } catch (err) {
    console.error(
      "[DB] Error conectando a MySQL:",
      err && (err.sqlMessage || err.message || err)
    );
=======
// Ping de verificación al arrancar (no tumba el proceso si falla)
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log(
      `[DB] Conectado OK: user=@host:port/db => ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} OK=${rows?.[0]?.ok}`
    );
  } catch (err) {
    console.error("[DB] Error conectando a MySQL:", err?.message || err);
>>>>>>> c7df2cf (cambio de apis)
  }
})();

module.exports = pool;
