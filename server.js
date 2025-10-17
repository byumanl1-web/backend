// // backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");

const adminRouter = require("./routes/admin");       // si aún no los usas, puedes comentarlos
const motoristasRouter = require("./routes/motoristas");
const pool = require("./db");                        // mysql2/promise

/* -------------------- APP -------------------- */
const app = express();
app.set("trust proxy", true);

/* -------------------- CONFIG -------------------- */
const SECRET = (process.env.JWT_SECRET || "supersecreto").trim();

// Tablas (cámbialas en .env si difieren)
const TABLE_MOTORISTAS = process.env.MOTORISTAS_TABLE || "motoristas";
const TABLE_EMERGENCIA =
  process.env.EMERGENCIA_CONTACTOS_TABLE || "emergencia_contactos";
const TABLE_VEHICULOS = process.env.VEHICULOS_TABLE || "vehiculos";
// ⚠️ Cambiado: usamos INCIDENTES_TABLE (no ACCIDENTES_TABLE)
const TABLE_INCIDENTES = process.env.INCIDENTES_TABLE || "incidentes";
const TABLE_QR_SCANS = process.env.QR_SCANS_TABLE || "qr_scans";

// URL pública del front para el QR (opcional)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").trim();

/* -------------------- MIDDLEWARES GLOBALES -------------------- */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ],
    credentials: false,
  })
);
app.use(express.json({ limit: "2mb" }));

/* -------------------- HELPERS -------------------- */
const normStr = (v) => (typeof v === "string" ? v.trim() : v);
const safeEmail = (v) => (normStr(v) || "").toString().trim().toLowerCase();

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
  if ((req.user.role || "user") !== "admin")
    return res.status(403).json({ error: "Solo admin" });
  next();
}
function requireDriver(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  if ((req.user.role || "") !== "driver")
    return res.status(403).json({ error: "Solo motoristas" });
  next();
}

/* -------------------- LOGIN ADMIN -------------------- */
app.post("/api/login", (req, res) => {
  const email = safeEmail(req.body?.email);
  const thePassword = (req.body?.password || "").trim();

  const ADMIN_EMAIL = safeEmail(process.env.ADMIN_EMAIL || "");
  const ADMIN_PASS = (process.env.ADMIN_PASS || "").trim();

  if (email === ADMIN_EMAIL && thePassword === ADMIN_PASS) {
    const token = jwt.sign({ id: 1, email, role: "admin" }, SECRET, {
      expiresIn: "8h",
    });
    return res.json({
      success: true,
      token,
      user: { id: 1, email, role: "admin" },
    });
  }
  return res.status(401).json({ success: false, error: "BAD_CREDENTIALS" });
});

/* -------------------- LOGIN MOTORISTA (tolerante a schema) -------------------- */
app.post("/api/driver/login", async (req, res) => {
  const dbg = { step: "start" }; // deja el dbg mientras depuras
  try {
    const email = safeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    dbg.email = email;

    if (!email || !password) {
      dbg.err = "MISSING_FIELDS";
      return res.status(400).json({ error: "EMAIL_OR_PASSWORD_MISSING", dbg });
    }

    // 1) Intento con password_hash
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
      // 2) Si la columna no existe, reintenta con passwordHash (alias → password_hash)
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

    if (!storedHash || storedHash.length < 50) {
      dbg.err = "PASSWORD_HASH_INVALID";
      return res.status(500).json({ error: "PASSWORD_HASH_INVALID", dbg });
    }

    dbg.step = "bcrypt_compare";
    const ok = await bcrypt.compare(password, storedHash);
    dbg.compareOk = ok;

    if (!ok) {
      dbg.err = "COMPARE_FALSE";
      return res.status(401).json({ error: "BAD_CREDENTIALS", dbg });
    }

    const token = jwt.sign(
      { id: m.id, email: m.email, role: "driver" },
      SECRET,
      { expiresIn: "8h" }
    );

    dbg.step = "done";
    return res.json({
      success: true,
      token,
      user: {
        id: m.id,
        email: m.email,
        role: "driver",
        nombreCompleto: m.nombreCompleto,
        dpi: m.dpi,
      },
      dbg, // quita esto cuando confirmes
    });
  } catch (e) {
    console.error("[POST /api/driver/login] ERROR", e);
    dbg.catch = e?.message || String(e);
    return res.status(500).json({ error: "LOGIN_FAILED", dbg });
  }
});

/* -------------------- REGISTRO PÚBLICO (SIN TOKEN) -------------------- */
app.post("/api/public/motoristas", async (req, res) => {
  let cx;
  try {
    const b = req.body || {};

    // Normalizar teléfonos y vehículo (acepta alias del front)
    const emergencia1Telefono =
      b.emergencia1Telefono ?? b.emergencia1Tel ?? null;
    const emergencia2Telefono =
      b.emergencia2Telefono ?? b.emergencia2Tel ?? null;

    const placa = b.placa ?? b.vehiculoPlaca ?? b.plate ?? null;
    const marca = b.marca ?? b.vehiculoMarca ?? b.brand ?? null;
    const modelo = b.modelo ?? b.vehiculoModelo ?? b.model ?? null;
    const _anioRaw = b.anio ?? b.vehiculoAnio ?? b.year ?? null;
    const anio = _anioRaw === null || _anioRaw === "" ? null : Number(_anioRaw);
    const hayVehiculo = [placa, marca, modelo, anio].some(
      (v) => v !== null && v !== ""
    );

    // Campos del motorista
    const {
      nombreCompleto,
      dpi,
      numeroCasa,
      nombrePadre,
      nombreMadre,
      emergencia1Nombre,
      emergencia2Nombre,
      correo,
      email,
      password,
    } = b;

    const correoFinal = safeEmail(correo || email);

    if (!nombreCompleto || !dpi || !correoFinal || !password) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    cx = await pool.getConnection();
    await cx.beginTransaction();

    // Duplicados
    const [ex] = await cx.execute(
      `SELECT id FROM ${TABLE_MOTORISTAS} WHERE email = ? OR dpi = ? LIMIT 1`,
      [correoFinal, String(dpi).trim()]
    );
    if (ex.length) {
      await cx.rollback();
      cx.release();
      return res.status(409).json({ error: "Email o DPI ya existe" });
    }

    const hash = await bcrypt.hash(String(password), 10);

    // 1) Motorista
    const [r] = await cx.execute(
      `INSERT INTO ${TABLE_MOTORISTAS}
       (nombreCompleto, dpi, numeroCasa, nombrePadre, nombreMadre, email, password_hash, qr_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
      [
        nombreCompleto,
        dpi,
        numeroCasa || null,
        nombrePadre || null,
        nombreMadre || null,
        correoFinal,
        hash,
      ]
    );
    const motoristaId = r.insertId;

    // 2) Contactos
    const contactos = [];
    if (emergencia1Nombre || emergencia1Telefono) {
      contactos.push([
        motoristaId,
        emergencia1Nombre || null,
        emergencia1Telefono || null,
        1,
      ]);
    }
    if (emergencia2Nombre || emergencia2Telefono) {
      contactos.push([
        motoristaId,
        emergencia2Nombre || null,
        emergencia2Telefono || null,
        2,
      ]);
    }
    if (contactos.length) {
      await cx.query(
        `INSERT INTO ${TABLE_EMERGENCIA} (motorista_id, nombre, telefono, prioridad) VALUES ?`,
        [contactos]
      );
    }

    // 3) Vehículo
    if (hayVehiculo) {
      await cx.execute(
        `INSERT INTO ${TABLE_VEHICULOS}
           (motorista_id, placa, marca, modelo, anio, created_at)
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

    // 4) QR -> preferimos URL pública si está configurada
    const publicUrl = `${PUBLIC_BASE_URL}/emergency/${motoristaId}`;
    const qrImage = await QRCode.toDataURL(publicUrl);

    await cx.execute(
      `UPDATE ${TABLE_MOTORISTAS} SET qr_data = ? WHERE id = ?`,
      [JSON.stringify({ t: "driver", id: motoristaId, dpi, url: publicUrl }), motoristaId]
    );

    await cx.commit();
    cx.release();

    return res.status(201).json({
      success: true,
      driver: {
        id: motoristaId,
        nombreCompleto,
        dpi,
        email: correoFinal,
        created_at: new Date().toISOString(),
      },
      vehiculo: hayVehiculo
        ? {
            placa: placa ? String(placa).toUpperCase() : null,
            marca: marca || null,
            modelo: modelo || null,
            anio: anio || null,
          }
        : null,
      qrImage,
      qrPayload: { url: publicUrl },
    });
  } catch (e) {
    if (cx) {
      try {
        await cx.rollback();
      } catch {}
      try {
        cx.release();
      } catch {}
    }
    console.error("[POST /api/public/motoristas]", e);
    return res
      .status(500)
      .json({ error: e?.sqlMessage || e?.message || "No se pudo registrar" });
  }
});

/* -------------------- EMERGENCIA PÚBLICA (QR) -------------------- */
app.get("/api/public/emergency/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "BAD_ID" });

  try {
    // Motorista
    const [mRows] = await pool.execute(
      `SELECT id, nombreCompleto, dpi, numeroCasa, nombrePadre, nombreMadre, email, created_at
         FROM ${TABLE_MOTORISTAS}
        WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!mRows.length) return res.status(404).json({ error: "NOT_FOUND" });
    const motorista = mRows[0];

    // Contacto principal
    const [cRows] = await pool.execute(
      `SELECT nombre, telefono, prioridad
         FROM ${TABLE_EMERGENCIA}
        WHERE motorista_id = ?
     ORDER BY prioridad ASC, id ASC
        LIMIT 1`,
      [id]
    );
    const contact = cRows[0] || null;

    // Vehículo
    const [vRows] = await pool.execute(
      `SELECT placa, marca, modelo, anio
         FROM ${TABLE_VEHICULOS}
        WHERE motorista_id = ?
     ORDER BY id DESC
        LIMIT 1`,
      [id]
    );
    const vehicle = vRows[0] || null;

    // Log de escaneo (best-effort)
    try {
      await pool.execute(
        `INSERT INTO ${TABLE_QR_SCANS} (motorista_id, user_agent, ip, created_at)
         VALUES (?, ?, ?, NOW())`,
        [id, req.get("user-agent") || null, req.ip || null]
      );
    } catch (_) {}

    return res.json({ motorista, contact, vehicle });
  } catch (e) {
    console.error("[GET /api/public/emergency/:id]", e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* -------------------- ENDPOINTS DEL MOTORISTA (SELF) -------------------- */
// Perfil
app.get("/api/driver/me", authRequired, requireDriver, async (req, res) => {
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
    console.error("[GET /api/driver/me]", e);
    return res.status(500).json({ error: "ERROR_FETCH_ME" });
  }
});

// QR del motorista (devolvemos también la URL pública si existe)
app.get("/api/driver/my-qr", authRequired, requireDriver, async (req, res) => {
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
    console.error("[GET /api/driver/my-qr]", e);
    return res.status(500).json({ error: "ERROR_QR" });
  }
});

// Vehículo (GET/PUT 1:1 por motorista)
app.get("/api/driver/vehicle", authRequired, requireDriver, async (req, res) => {
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
    console.error("[GET /api/driver/vehicle]", e);
    return res.status(500).json({ error: "ERROR_VEHICLE_GET" });
  }
});

app.put("/api/driver/vehicle", authRequired, requireDriver, async (req, res) => {
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
    console.error("[PUT /api/driver/vehicle]", e);
    return res.status(500).json({ error: "ERROR_VEHICLE_UPDATE" });
  }
});

/* -------------------- RUTAS PROTEGIDAS EXISTENTES -------------------- */
// Admin: router de administración solo para admin
app.use("/api/admin", authRequired, requireAdmin, adminRouter);
// Si tu router /routes/motoristas es de administración, protégelo como admin
app.use("/api/motoristas", authRequired, requireAdmin, motoristasRouter);

/* -------------------- HEALTHCHECK -------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* -------------------- LISTEN (robusto) -------------------- */
function parsePort(v, fallback = 4010) {
  const raw = (v ?? "").toString().trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback;
}
const PORT = parsePort(process.env.PORT, 4010);
console.log("[BOOT] process.env.PORT=", JSON.stringify(process.env.PORT), "-> using", PORT);

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`⚠️  El puerto ${PORT} está en uso.`);
    console.error(
      `Soluciones: (1) "npx kill-port ${PORT}" y reintenta, o (2) cambia PORT en .env`
    );
  } else if (err.code === "ERR_SOCKET_BAD_PORT") {
    console.error(
      "⚠️  PORT inválido. Asegúrate que .env tenga: PORT=4010 (sin comillas)."
    );
  } else {
    console.error("Error al iniciar el servidor:", err);
  }
  process.exit(1);
});

/* -------------------- REPORTE PÚBLICO DE INCIDENTES -------------------- */
/*
   Este endpoint se utiliza cuando se escanea el QR y se envía un reporte
   desde el formulario público (encuesta). Guarda los datos en la tabla "incidentes".
   ⚠️ Sin lat/lng (los quitaste del formulario).
*/
app.post("/api/public/incidentes", async (req, res) => {
  const b = req.body || {};

  const motorista_id = Number(b.motorista_id);
  const tipo = (b.tipo || "").trim(); // ejemplo: "accidente", "fallecimiento", "robo", etc.
  const descripcion = (b.descripcion || "").trim();
  const ubicacion = (b.ubicacion || "").trim();
  const reportado_por = (b.reportado_por || "").trim();
  const telefono_reportante = (b.telefono_reportante || "").trim();
  const estado = (b.estado || "pendiente").trim();

  if (!motorista_id || !tipo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    await pool.execute(
      `INSERT INTO ${TABLE_INCIDENTES}
         (motorista_id, tipo, descripcion, ubicacion, reportado_por, telefono_reportante, estado, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        motorista_id,
        tipo,
        descripcion || null,
        ubicacion || null,
        reportado_por || null,
        telefono_reportante || null,
        estado,
      ]
    );

    console.log(
      `[INCIDENTE] Nuevo reporte de tipo "${tipo}" guardado para motorista_id=${motorista_id}`
    );

    return res.json({
      success: true,
      message: "Incidente registrado correctamente",
    });
  } catch (e) {
    console.error("[POST /api/public/incidentes]", e);
    return res.status(500).json({
      error: e?.sqlMessage || e?.message || "Error al guardar el incidente",
    });
  }
});
