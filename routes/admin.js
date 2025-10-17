// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ====== Tablas (ajusta si usas otros nombres) ====== */
const T_MOTORISTAS = process.env.MOTORISTAS_TABLE || "motoristas";
const T_VEHICULOS  = process.env.VEHICULOS_TABLE  || "vehiculos";
const T_INCIDENTES = process.env.ACCIDENTES_TABLE || "incidentes"; // si no existe, las rutas lo manejan en try/catch

/* ====== Helpers ====== */
async function safeQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (e) {
    console.error("[DB]", e.sqlMessage || e.message);
    return null;
  }
}
function norm(v) { return (v ?? "").toString().trim(); }

/* ====================================================
 * GET /api/admin/metrics
 * - Totales reales desde motoristas
 * - Altas por mes (motoristas)
 * - Accidentes por mes (incidentes) si existe la tabla
 * ==================================================== */
router.get("/metrics", async (_req, res) => {
  try {
    const [[{ c: usersCount }]] =
      await pool.query(`SELECT COUNT(*) AS c FROM \`${T_MOTORISTAS}\``);

    // si aún no manejas admins en BD, dejamos 1 por el admin de .env
    const adminsCount  = 1;
    const driversCount = usersCount;

    const newUsersByMonth =
      (await safeQuery(
        `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
           FROM \`${T_MOTORISTAS}\`
          WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY 1
          ORDER BY 1 ASC`
      )) || [];

    let accidentsByMonth = [];
    try {
      accidentsByMonth =
        (await safeQuery(
          `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
             FROM \`${T_INCIDENTES}\`
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY 1
            ORDER BY 1 ASC`
        )) || [];
    } catch (_) {
      accidentsByMonth = [];
    }

    res.json({
      usersCount,
      adminsCount,
      driversCount,
      newUsersByMonth,
      accidentsByMonth,
    });
  } catch (e) {
    console.error("[GET /api/admin/metrics]", e);
    res.status(500).json({ error: "METRICS_FAILED" });
  }
});

/* ====================================================
 * GET /api/admin/brands
 * - Lista única de marcas desde 'vehiculos'
 * ==================================================== */
router.get("/brands", async (_req, res) => {
  try {
    const rows = await safeQuery(
      `SELECT DISTINCT marca
         FROM \`${T_VEHICULOS}\`
        WHERE marca IS NOT NULL AND marca <> ''
        ORDER BY marca ASC`
    );
    res.json({ brands: rows?.map(r => r.marca) || [] });
  } catch (e) {
    console.error("[GET /api/admin/brands]", e);
    res.json({ brands: [] });
  }
});

/* ====================================================
 * Subconsulta reutilizable: último vehículo por motorista
 * ==================================================== */
const LATEST_VEH_SUBQUERY = `
  SELECT vv.*
    FROM \`${T_VEHICULOS}\` vv
    JOIN (
      SELECT motorista_id, MAX(id) AS last_id
        FROM \`${T_VEHICULOS}\`
       GROUP BY motorista_id
    ) x ON x.last_id = vv.id
`;

/* ====================================================
 * GET /api/admin/drivers
 * - Lista con vehículo más reciente (marca, modelo, anio, placa)
 * - Filtros:
 *      q:           busca en nombre/email/dpi/modelo/placa
 *      marca:       filtra por marca exacta
 *      date_from:   YYYY-MM-DD (>= created_at)
 *      date_to:     YYYY-MM-DD (<= created_at)
 *   Paginación:
 *      page (1..n), pageSize (1..100)
 * ==================================================== */
router.get("/drivers", async (req, res) => {
  try {
    const q        = norm(req.query.q).toLowerCase();
    const marca    = norm(req.query.marca);
    const dateFrom = norm(req.query.date_from);
    const dateTo   = norm(req.query.date_to);
    const page     = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));
    const off      = (page - 1) * pageSize;

    const params = [];
    const where = [];

    if (q) {
      // LOWER en texto + LIKE
      where.push(`(
        LOWER(m.nombreCompleto) LIKE ? OR
        LOWER(m.email)          LIKE ? OR
        m.dpi                   LIKE ? OR
        LOWER(v.modelo)         LIKE ? OR
        LOWER(v.placa)          LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (marca) {
      where.push(`v.marca = ?`);
      params.push(marca);
    }
    if (dateFrom) {
      where.push(`DATE(m.created_at) >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`DATE(m.created_at) <= ?`);
      params.push(dateTo);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sqlBase = `
      FROM \`${T_MOTORISTAS}\` m
      LEFT JOIN (${LATEST_VEH_SUBQUERY}) v ON v.motorista_id = m.id
      ${whereSql}
    `;

    const [cntRows] = await pool.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);
    const total = cntRows?.[0]?.total || 0;

    const [rows] = await pool.query(
      `SELECT
         m.id, m.nombreCompleto, m.dpi, m.email, m.created_at,
         v.marca, v.modelo, v.anio, v.placa
       ${sqlBase}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );

    res.json({
      total,
      page,
      pageSize,
      drivers: rows || []
    });
  } catch (e) {
    console.error("[GET /api/admin/drivers]", e);
    res.status(500).json({ error: "DRIVERS_FAILED" });
  }
});

/* ====================================================
 * GET /api/admin/drivers/export
 * - Devuelve filas listas para Excel y RESPETA filtros:
 *   q, marca, date_from, date_to
 * ==================================================== */
router.get("/drivers/export", async (req, res) => {
  try {
    const q        = norm(req.query.q).toLowerCase();
    const marca    = norm(req.query.marca);
    const dateFrom = norm(req.query.date_from);
    const dateTo   = norm(req.query.date_to);

    const params = [];
    const where = [];

    if (q) {
      where.push(`(
        LOWER(m.nombreCompleto) LIKE ? OR
        LOWER(m.email)          LIKE ? OR
        m.dpi                   LIKE ? OR
        LOWER(v.modelo)         LIKE ? OR
        LOWER(v.placa)          LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (marca) {
      where.push(`v.marca = ?`);
      params.push(marca);
    }
    if (dateFrom) {
      where.push(`DATE(m.created_at) >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`DATE(m.created_at) <= ?`);
      params.push(dateTo);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows =
      (await safeQuery(
        `SELECT 
           m.id                                  AS ID,
           m.nombreCompleto                      AS Nombre,
           m.dpi                                  AS DPI,
           m.email                                AS Email,
           IFNULL(v.marca,'')                     AS Marca,
           IFNULL(v.modelo,'')                    AS Modelo,
           IFNULL(v.anio,'')                      AS Anio,
           IFNULL(v.placa,'')                     AS Placa,
           DATE_FORMAT(m.created_at,'%d/%m/%Y')   AS Registro
         FROM \`${T_MOTORISTAS}\` m
         LEFT JOIN (${LATEST_VEH_SUBQUERY}) v ON v.motorista_id = m.id
         ${whereSql}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 20000`,
        params
      )) || [];

    res.json({ rows });
  } catch (e) {
    console.error("[GET /api/admin/drivers/export]", e);
    res.status(500).json({ error: "EXPORT_FAILED" });
  }
});

/* ====================================================
 * GET /api/admin/accidents   (opcional)
 * Requiere tabla 'incidentes' con FK motorista_id
 * ==================================================== */
router.get("/accidents", async (_req, res) => {
  try {
    const rows =
      (await safeQuery(
        `SELECT i.id,
                DATE(i.created_at)            AS fecha,
                m.nombreCompleto              AS motorista,
                i.tipo                        AS gravedad,
                i.ubicacion,
                i.descripcion
           FROM \`${T_INCIDENTES}\` i
           JOIN \`${T_MOTORISTAS}\` m ON m.id = i.motorista_id
          ORDER BY i.created_at DESC
          LIMIT 500`
      )) || [];
    res.json(rows);
  } catch (e) {
    console.error("[GET /api/admin/accidents]", e);
    res.status(500).json({ error: "ACCIDENTS_FAILED" });
  }
});

/* ====================================================
 * GET /api/admin/models
 * Conteo real de modelos desde 'vehiculos'
 * ==================================================== */
router.get("/models", async (_req, res) => {
  try {
    const rows =
      (await safeQuery(
        `SELECT IFNULL(modelo,'(Sin modelo)') AS modelo,
                COUNT(*)                      AS count
           FROM \`${T_VEHICULOS}\`
          GROUP BY IFNULL(modelo,'(Sin modelo)')
          ORDER BY count DESC, modelo ASC`
      )) || [];
    res.json(rows);
  } catch (e) {
    console.error("[GET /api/admin/models]", e);
    res.status(500).json({ error: "MODELS_FAILED" });
  }
});

module.exports = router;
