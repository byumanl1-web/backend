// backend/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

/* ---------------------------------------------
   LOG AUX
----------------------------------------------*/
function mask(str = "") {
  if (!str) return str;
  if (str.length <= 6) return "***";
  return str.slice(0, 2) + "***" + str.slice(-2);
}
function logCfg(cfg, useSSL) {
  const safe = {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: mask(cfg.password),
    database: cfg.database,
    ssl: !!useSSL,
  };
  console.log("[DB] Config usada:", safe);
}

/* ---------------------------------------------
   Parseo de MYSQL_URL
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

const cfg = parseMysqlUrl(process.env.MYSQL_URL);

// Railway suele requerir SSL en el proxy
const USE_SSL = /^(1|true|yes)$/i.test(process.env.DB_SSL || "true");
const ssl = USE_SSL ? { rejectUnauthorized: false } : undefined;

// Validaciones mínimas
if (!cfg.host || !cfg.user || !cfg.database || !cfg.port || Number.isNaN(cfg.port)) {
  throw new Error("[DB] MYSQL_URL incompleta (host/user/pass/port/db)");
}

/* ---------------------------------------------
   Pool + Monkey-patch para LOG de tiempos/errores
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
  connectTimeout: 15000,   // 15s
  ssl,
});

logCfg(cfg, ssl);

// parche ligero para loguear querys lentas/errores
const _query = pool.query.bind(pool);
pool.query = async function patchedQuery(sql, params) {
  const started = Date.now();
  try {
    const res = await _query(sql, params);
    const ms = Date.now() - started;
    if (ms > 300) {
      console.warn("[DB][SLOW]", ms + "ms", String(sql).slice(0, 120));
    }
    return res;
  } catch (e) {
    const ms = Date.now() - started;
    console.error("[DB][ERROR]", ms + "ms", e.code || e.name, e.message, "SQL:", String(sql).slice(0, 120));
    throw e;
  }
};

const _exec = pool.execute.bind(pool);
pool.execute = async function patchedExecute(sql, params) {
  const started = Date.now();
  try {
    const res = await _exec(sql, params);
    const ms = Date.now() - started;
    if (ms > 300) {
      console.warn("[DB][SLOW EXEC]", ms + "ms", String(sql).slice(0, 120));
    }
    return res;
  } catch (e) {
    const ms = Date.now() - started;
    console.error("[DB][ERROR EXEC]", ms + "ms", e.code || e.name, e.message, "SQL:", String(sql).slice(0, 120));
    throw e;
  }
};

/* ---------------------------------------------
   Ping de verificación al arrancar (no tumba)
----------------------------------------------*/
(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log(`[DB] Conexión inicial OK=${rows?.[0]?.ok}`);
  } catch (err) {
    // Clasificación de errores típica
    const code = err?.code || err?.name;
    console.error("[DB] Error conectando a MySQL:", code, err?.sqlMessage || err?.message || err);
    switch (code) {
      case "ER_ACCESS_DENIED_ERROR":
        console.error("↳ Credenciales inválidas (user/pass/db). Revisa MYSQL_URL.");
        break;
      case "ENOTFOUND":
      case "EAI_AGAIN":
        console.error("↳ No se resuelve el host. Revisa host/Red/Firewall.");
        break;
      case "ETIMEDOUT":
        console.error("↳ Timeout conectando. Revisa puerto/SSL/red; intenta DB_SSL=true.");
        break;
      case "HANDSHAKE_SSL_ERROR":
        console.error("↳ Problema SSL. Prueba con DB_SSL=true y rejectUnauthorized:false.");
        break;
      case "ECONNREFUSED":
        console.error("↳ Conexión rechazada. Revisa host/puerto y si el servicio está UP.");
        break;
      default:
        console.error("↳ Revisa logs anteriores y variables de entorno.");
    }
  }
})();

module.exports = { pool, cfg, sslEnabled: !!ssl };
