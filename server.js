// backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const crypto = require("crypto");

const adminRouter = require("./routes/admin");
const motoristasRouter = require("./routes/motoristas");

// 🔧 Import único y correcto de la DB
const { pool, cfg, sslEnabled } = require("./db");

/* -------------------- APP -------------------- */
const app = express();
app.set("trust proxy", true);

/* -------------------- CONFIG -------------------- */
const SECRET = (process.env.JWT_SECRET || "supersecreto").trim();

// Prefijo de API configurable: "", "/" o "/api"
const API_PREFIX_RAW = process.env.API_PREFIX ?? "/api";
const API = (API_PREFIX_RAW === "/" ? "" : API_PREFIX_RAW).replace(/\/+$/, "");

// Tablas
const TABLE_MOTORISTAS = process.env.MOTORISTAS_TABLE || "motoristas";
const TABLE_EMERGENCIA = process.env.EMERGENCIA_CONTACTOS_TABLE || "emergencia_contactos";
const TABLE_VEHICULOS   = process.env.VEHICULOS_TABLE || "vehiculos";
const TABLE_INCIDENTES  = process.env.INCIDENTES_TABLE || "incidentes";
const TABLE_QR_SCANS    = process.env.QR_SCANS_TABLE || "qr_scans";

// URL pública del front para generar el QR
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000"
).trim();

/* -------------------- MIDDLEWARES GLOBALES -------------------- */
app.use(cors({
  origin(origin, cb) {
    // permite cualquier origen; se loguea una vez
    if (origin) {
      if (!global.__seenOrigins) global.__seenOrigins = new Set();
      if (!global.__seenOrigins.has(origin)) {
        console.log("[CORS] Permitido origin:", origin);
        global.__seenOrigins.add(origin);
      }
    }
    cb(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

/* -------------------- LOGS HTTP DETALLADOS -------------------- */
const lastRequests = [];
const MAX_LAST = 200;
function genId() { return crypto.randomBytes(8).toString("hex"); }

app.use((req, res, next) => {
  const reqId = req.get("x-request-id") || genId();
  req.reqId = reqId;

  const t0 = Date.now();
  const { method } = req;
  const url = req.originalUrl || req.url;

  const baseInfo = {
    ts: new Date().toISOString(),
    id: reqId,
    method,
    url,
    ip: req.ip,
    origin: req.get("origin") || null,
    referer: req.get("referer") || null,
    userAgent: req.get("user-agent") || null,
  };

  res.setHeader("x-request-id", reqId);
  res.setHeader("x-backend", "qrmanager-api");
  res.setHeader("x-api-prefix", API);

  res.on("finish", () => {
    const ms = Date.now() - t0;
    const status = res.statusCode;
    const length = res.getHeader("content-length") || "-";
    const msg = [
      `[HTTP] #${reqId}`, method, url, "->", status,
      `(${ms}ms, ${length}B)`,
      `ip=${baseInfo.ip}`,
      baseInfo.origin ? `origin=${baseInfo.origin}` : "",
      baseInfo.referer ? `referer=${baseInfo.referer}` : "",
    ].filter(Boolean).join(" ");
    console.log(msg);

    lastRequests.push({ ...baseInfo, status, ms, length: String(length) });
    while (lastRequests.length > MAX_LAST) lastRequests.shift();
  });

  next();
});

app.use((req, _res, next) => {
  if (req.method === "OPTIONS") {
    console.log(`[CORS][PRE-FLIGHT] #${req.reqId} ${req.headers.origin || "-"} ${req.headers["access-control-request-method"] || "-"} ${req.originalUrl}`);
  }
  next();
});

/* -------------------- ENDPOINTS DE DEBUG -------------------- */
app.get("/__debug/last-requests", (_req, res) => {
  res.json({
    count: lastRequests.length,
    items: lastRequests.slice().reverse().slice(0, 50),
  });
});

app.get("/__debug/env", (_req, res) => {
  const mask = (s = "") => (s.length <= 6 ? "***" : s.slice(0,2) + "***" + s.slice(-2));
  let parsedUrl = "INVALID_URL";
  try {
    const u = new URL(process.env.MYSQL_URL || "");
    parsedUrl = {
      protocol: u.protocol, host: u.hostname, port: u.port, user: u.username,
      pass: mask(decodeURIComponent(u.password || "")),
      db: (u.pathname || "").replace(/^\//,""),
    };
  } catch {}
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    API_PREFIX: process.env.API_PREFIX,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    MYSQL_URL: parsedUrl,
    DB_SSL: process.env.DB_SSL,
    sslEnabled,
  });
});

app.get("/__debug/db/ping", async (_req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, result: r[0] });
  } catch (e) {
    res.status(500).json({ ok: false, code: e.code || e.name, message: e.message });
  }
});

app.get("/__debug/db/info", async (_req, res) => {
  try {
    const [v] = await pool.query("SELECT VERSION() AS version");
    const [ts] = await pool.query("SELECT NOW() AS now_utc");
    res.json({
      ok: true,
      version: v?.[0]?.version,
      now_utc: ts?.[0]?.now_utc,
      cfg: { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database, ssl: sslEnabled },
    });
  } catch (e) {
    res.status(500).json({ ok: false, code: e.code || e.name, message: e.message });
  }
});

// Endpoint para que el front verifique conectividad
app.get(`${API}/debug/echo`, (req, res) => {
  res.json({
    ok: true,
    requestId: req.reqId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    origin: req.get("origin") || null,
    referer: req.get("referer") || null,
    userAgent: req.get("user-agent") || null,
    now: new Date().toISOString(),
  });
});

/* -------------------- HELPERS -------------------- */
const normStr  = (v) => (typeof v === "string" ? v.trim() : v);
const safeEmail = (v) => (normStr(v) || "").toString().trim().toLowerCase();

async function setPasswordHash(userId, hash) {
  try {
    await pool.execute(`UPDATE ${TABLE_MOTORISTAS} SET password_hash = ? WHERE id = ?`, [hash, userId]);
    return;
  } catch (e) {
    if (e?.code !== "ER_BAD_FIELD_ERROR") throw e;
  }
  try {
    await pool.execute(`UPDATE ${TABLE_MOTORISTAS} SET passwordHash = ? WHERE id = ?`, [hash, userId]);
  } catch (e2) {
    console.error("[setPasswordHash] No existe password_hash/passwordHash:", e2?.message || e2);
    throw e2;
  }
}

/* -------------------- AUTH MIDDLEWARES -------------------- */
function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Token faltante" });
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  if ((req.user.role || "user") !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}
function requireDriver(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  if ((req.user.role || "") !== "driver") return res.status(403).json({ error: "Solo motoristas" });
  next();
}

/* -------------------- LOGIN ADMIN -------------------- */
app.post(`${API}/login`, (req, res) => {
  const email = safeEmail(req.body?.email);
  const thePassword = (req.body?.password || "").trim();

  const ADMIN_EMAIL = safeEmail(process.env.ADMIN_EMAIL || "estuardolorenzo@gmail.com");
  const ADMIN_PASS  = (process.env.ADMIN_PASS  || "Lorenzo21").trim();

  if (email === ADMIN_EMAIL && thePassword === ADMIN_PASS) {
    const token = jwt.sign({ id: 1, email, role: "admin" }, SECRET, { expiresIn: "8h" });
    return res.json({ success: true, token, user: { id: 1, email, role: "admin" } });
  }
  return res.status(401).json({ success: false, error: "BAD_CREDENTIALS" });
});

/* -------------- LOGIN MOTORISTA (tolerante + auto-migración) -------------- */
app.post(`${API}/driver/login`, async (req, res) => {
  const dbg = { step: "start" };
  try {
    const email = safeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    dbg.email = email;

    if (!email || !password) {
      dbg.err = "MISSING_FIELDS";
      return res.status(400).json({ error: "EMAIL_OR_PASSWORD_MISSING", dbg });
    }

    let rows;
    dbg.step = "query:password_hash";
    try {
      const r = await pool.execute(
        `SELECT id, email, password_hash, dpi, nombreCompleto
           FROM ${TABLE_MOTORISTAS}
          WHERE email = ? LIMIT 1`,
        [email]
      );
      rows = r[0];
      dbg.schema = "password_hash";
    } catch (e) {
      if (e?.code === "ER_BAD_FIELD_ERROR") {
        dbg.step = "query:passwordHash";
        const r2 = await pool.execute(
          `SELECT id, email, passwordHash AS password_hash, dpi, nombreCompleto
             FROM ${TABLE_MOTORISTAS}
            WHERE email = ? LIMIT 1`,
          [email]
        );
        rows = r2[0];
        dbg.schema = "passwordHash";
      } else {
        throw e;
      }
    }

    dbg.rowCount = rows.length;
    if (!rows.length) {
      dbg.err = "NOT_FOUND";
      return res.status(401).json({ error: "BAD_CREDENTIALS", dbg });
    }

    const m = rows[0];
    const storedHash = m.password_hash || "";
    dbg.step = "inspect_hash";
    dbg.hashLen = storedHash.length;
    dbg.hashPrefix = storedHash.slice(0, 4);

    let ok = false;

    if (storedHash.startsWith("$2") && storedHash.length >= 50) {
      dbg.step = "bcrypt_compare";
      ok = await bcrypt.compare(password, storedHash);
      dbg.compareOk = ok;
    } else {
      dbg.step = "migrate_plain_password";
      if (password === storedHash) {
        const newHash = await bcrypt.hash(password, 10);
        try {
          await setPasswordHash(m.id, newHash);
          ok = true;
          dbg.migrated = true;
        } catch (e) {
          console.error("[driver/login] migrate setPasswordHash error:", e?.message || e);
          ok = true;
          dbg.migrated = false;
        }
      } else {
        ok = false;
      }
    }

    if (!ok) {
      dbg.err = "COMPARE_FALSE";
      return res.status(401).json({ error: "BAD_CREDENTIALS", dbg });
    }

    const token = jwt.sign({ id: m.id, email: m.email, role: "driver" }, SECRET, { expiresIn: "8h" });
    dbg.step = "done";

    return res.json({
      success: true,
      token,
      user: { id: m.id, email: m.email, role: "driver", nombreCompleto: m.nombreCompleto, dpi: m.dpi },
      // dbg, // descomenta si necesitas depurar
    });
  } catch (e) {
    console.error("[POST /driver/login] ERROR", e);
    dbg.catch = e?.message || String(e);
    return res.status(500).json({ error: "LOGIN_FAILED", dbg });
  }
});

/* -------------------- REGISTRO PÚBLICO -------------------- */
app.post(`${API}/public/motoristas`, async (req, res) => {
  let cx;
  try {
    const b = req.body || {};

    const emergencia1Telefono = b.emergencia1Telefono ?? b.emergencia1Tel ?? null;
    const emergencia2Telefono = b.emergencia2Telefono ?? b.emergencia2Tel ?? null;

    const placa  = b.placa ?? b.vehiculoPlaca ?? b.plate ?? null;
    const marca  = b.marca ?? b.vehiculoMarca ?? b.brand ?? null;
    const modelo = b.modelo ?? b.vehiculoModelo ?? b.model ?? null;
    const _anioRaw = b.anio ?? b.vehiculoAnio ?? b.year ?? null;
    const anio = _anioRaw === null || _anioRaw === "" ? null : Number(_anioRaw);
    const hayVehiculo = [placa, marca, modelo, anio].some((v) => v !== null && v !== "");

    const {
      nombreCompleto, dpi, numeroCasa, nombrePadre, nombreMadre,
      emergencia1Nombre, emergencia2Nombre, correo, email, password,
    } = b;

    const correoFinal = safeEmail(correo || email);
    if (!nombreCompleto || !dpi || !correoFinal || !password) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    cx = await pool.getConnection();
    await cx.beginTransaction();

    const [ex] = await cx.execute(
      `SELECT id FROM ${TABLE_MOTORISTAS} WHERE email = ? OR dpi = ? LIMIT 1`,
      [correoFinal, String(dpi).trim()]
    );
    if (ex.length) {
      await cx.rollback(); cx.release();
      return res.status(409).json({ error: "Email o DPI ya existe" });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const [r] = await cx.execute(
      `INSERT INTO ${TABLE_MOTORISTAS}
       (nombreCompleto, dpi, numeroCasa, nombrePadre, nombreMadre, email, password_hash, qr_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
      [nombreCompleto, dpi, numeroCasa || null, nombrePadre || null, nombreMadre || null, correoFinal, hash]
    );
    const motoristaId = r.insertId;

    try {
      await cx.execute(`UPDATE ${TABLE_MOTORISTAS} SET passwordHash = ? WHERE id = ?`, [hash, motoristaId]);
    } catch (_) {}

    const contactos = [];
    if (emergencia1Nombre || emergencia1Telefono) {
      contactos.push([motoristaId, emergencia1Nombre || null, emergencia1Telefono || null, 1]);
    }
    if (emergencia2Nombre || emergencia2Telefono) {
      contactos.push([motoristaId, emergencia2Nombre || null, emergencia2Telefono || null, 2]);
    }
    if (contactos.length) {
      await cx.query(`INSERT INTO ${TABLE_EMERGENCIA} (motorista_id, nombre, telefono, prioridad) VALUES ?`, [contactos]);
    }

    if (hayVehiculo) {
      await cx.execute(
        `INSERT INTO ${TABLE_VEHICULOS} (motorista_id, placa, marca, modelo, anio, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          motoristaId,
          placa ? String(placa).toUpperCase() : null,
          marca || null,
          modelo || null,
          anio || null,
        ]
      );
    }

    const publicUrl = `${PUBLIC_BASE_URL}/emergency/${motoristaId}`;
    const qrImage = await QRCode.toDataURL(publicUrl);

    await cx.execute(
      `UPDATE ${TABLE_MOTORISTAS} SET qr_data = ? WHERE id = ?`,
      [JSON.stringify({ t: "driver", id: motoristaId, dpi, url: publicUrl }), motoristaId]
    );

    await cx.commit(); cx.release();

    const persona = {
      id: motoristaId,
      nombreCompleto,
      dpi,
      email: correoFinal,
      created_at: new Date().toISOString(),
    };

    return res.status(201).json({
      success: true,
      motorista: persona,
      driver: persona,
      vehiculo: hayVehiculo ? {
        placa: placa ? String(placa).toUpperCase() : null,
        marca: marca || null,
        modelo: modelo || null,
        anio: anio || null,
      } : null,
      qrImage,
      qrPayload: { url: publicUrl },
    });
  } catch (e) {
    if (cx) { try { await cx.rollback(); } catch {} try { cx.release(); } catch {} }
    console.error("[POST /public/motoristas]", e);
    return res.status(500).json({ error: e?.sqlMessage || e?.message || "No se pudo registrar" });
  }
});

/* -------------------- EMERGENCIA PÚBLICA (QR) -------------------- */
app.get(`${API}/public/emergency/:id`, async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "BAD_ID" });

  try {
    const [mRows] = await pool.execute(
      `SELECT id, nombreCompleto, dpi, numeroCasa, nombrePadre, nombreMadre, email, created_at
         FROM ${TABLE_MOTORISTAS}
        WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!mRows.length) return res.status(404).json({ error: "NOT_FOUND" });
    const motorista = mRows[0];

    const [cRows] = await pool.execute(
      `SELECT nombre, telefono, prioridad
         FROM ${TABLE_EMERGENCIA}
        WHERE motorista_id = ?
     ORDER BY prioridad ASC, id ASC
        LIMIT 1`,
      [id]
    );
    const contact = cRows[0] || null;

    const [vRows] = await pool.execute(
      `SELECT placa, marca, modelo, anio
         FROM ${TABLE_VEHICULOS}
        WHERE motorista_id = ?
     ORDER BY id DESC
        LIMIT 1`,
      [id]
    );
    const vehicle = vRows[0] || null;

    try {
      await pool.execute(
        `INSERT INTO ${TABLE_QR_SCANS} (motorista_id, user_agent, ip, created_at)
         VALUES (?, ?, ?, NOW())`,
        [id, req.get("user-agent") || null, req.ip || null]
      );
    } catch (_) {}

    return res.json({ motorista, contact, vehicle });
  } catch (e) {
    console.error("[GET /public/emergency/:id]", e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* -------------------- ENDPOINTS DEL MOTORISTA -------------------- */
app.get(`${API}/driver/me`, authRequired, requireDriver, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id,nombreCompleto,dpi,numeroCasa,nombrePadre,nombreMadre,email,qr_data,created_at
         FROM ${TABLE_MOTORISTAS}
        WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ me: rows[0] });
  } catch (e) {
    console.error("[GET /driver/me]", e);
    return res.status(500).json({ error: "ERROR_FETCH_ME" });
  }
});

app.get(`${API}/driver/my-qr`, authRequired, requireDriver, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, dpi, qr_data FROM ${TABLE_MOTORISTAS} WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "NOT_FOUND" });

    const m = rows[0];
    const url = `${PUBLIC_BASE_URL}/emergency/${m.id}`;
    const qrImage = await QRCode.toDataURL(url);
    return res.json({ qrImage, qrPayload: m.qr_data || null, url });
  } catch (e) {
    console.error("[GET /driver/my-qr]", e);
    return res.status(500).json({ error: "ERROR_QR" });
  }
});

app.get(`${API}/driver/vehicle`, authRequired, requireDriver, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, placa, marca, modelo, anio
         FROM ${TABLE_VEHICULOS}
        WHERE motorista_id = ?
     ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    return res.json({ vehicle: rows[0] || null });
  } catch (e) {
    console.error("[GET /driver/vehicle]", e);
    return res.status(500).json({ error: "ERROR_VEHICLE_GET" });
  }
});

app.put(`${API}/driver/vehicle`, authRequired, requireDriver, async (req, res) => {
  try {
    const { placa, marca, modelo, anio } = req.body || {};
    const [rows] = await pool.execute(
      `SELECT id FROM ${TABLE_VEHICULOS}
        WHERE motorista_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    if (rows.length) {
      await pool.execute(
        `UPDATE ${TABLE_VEHICULOS}
            SET placa=?, marca=?, modelo=?, anio=?
          WHERE id=?`,
        [
          placa ? String(placa).toUpperCase() : null,
          marca || null,
          modelo || null,
          anio ? Number(anio) : null,
          rows[0].id,
        ]
      );
    } else {
      await pool.execute(
        `INSERT INTO ${TABLE_VEHICULOS} (motorista_id, placa, marca, modelo, anio, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          req.user.id,
          placa ? String(placa).toUpperCase() : null,
          marca || null,
          modelo || null,
          anio ? Number(anio) : null,
        ]
      );
    }
    return res.json({ success: true });
  } catch (e) {
    console.error("[PUT /driver/vehicle]", e);
    return res.status(500).json({ error: "ERROR_VEHICLE_UPDATE" });
  }
});

/* -------------------- RUTAS PROTEGIDAS EXISTENTES -------------------- */
app.use(`${API}/admin`, authRequired, requireAdmin, adminRouter);
app.use(`${API}/motoristas`, authRequired, requireAdmin, motoristasRouter);

/* -------------------- HEALTHCHECKS -------------------- */
app.get("/", (_req, res) => {
  res.json({ ok: true, apiPrefix: API, uptime: process.uptime() });
});
app.get(`${API}/health`, (_req, res) => res.json({ ok: true }));

/* -------------------- LISTEN -------------------- */
function parsePort(v, fallback = 4010) {
  const raw = (v ?? "").toString().trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback;
}

const PORT = parsePort(process.env.PORT, 4010);
console.log("[BOOT] process.env.PORT=", JSON.stringify(process.env.PORT), "-> using", PORT);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT} (API_PREFIX="${API}")`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`⚠️  El puerto ${PORT} está en uso.`);
  } else if (err.code === "ERR_SOCKET_BAD_PORT") {
    console.error("⚠️  PORT inválido.");
  } else {
    console.error("Error al iniciar el servidor:", err);
  }
});
