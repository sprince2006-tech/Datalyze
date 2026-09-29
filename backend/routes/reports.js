const router = require("express").Router();
const ExcelJS = require("exceljs");
const { optionalAuth } = require("../middleware/auth");
const { sessionAuth } = require("../middleware/sessionAuth");
const Dataset = require("../models/Dataset");
const Chart = require("../models/Chart");

const ownershipFilter = (req) => {
  if (req.user) return { user: req.user._id };
  if (req.sessionId) return { sessionId: req.sessionId };
  return null;
};

router.use(optionalAuth, sessionAuth);

// ── GET /api/reports/export/:datasetId?format=xlsx|csv ──────────────
router.get("/export/:datasetId", async (req, res, next) => {
  try {
    const filter = ownershipFilter(req);
    if (!filter) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const ds = await Dataset.findOne({ _id: req.params.datasetId, ...filter });
    if (!ds) {
      return res
        .status(404)
        .json({ success: false, message: "Dataset not found" });
    }

    const data = Array.isArray(ds.preview) ? ds.preview : [];
    const format = (req.query.format || "csv").toLowerCase();
    const safeName = String(ds.name || "dataset")
      .replace(/[^a-z0-9._-]/gi, "_")
      .slice(0, 80);

    // ── CSV path: stream directly, no workbook needed ───────────────
    if (format === "csv") {
      const keys = data.length ? Object.keys(data[0]) : [];
      const header = keys.join(",");
      const body = data
        .map((row) =>
          keys
            .map((k) => {
              const v = row[k];
              if (v == null) return "";
              const s = String(v);
              return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"`
                : s;
            })
            .join(","),
        )
        .join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.csv"`,
      );
      return res.end(keys.length ? `${header}\n${body}` : "");
    }

    // ── XLSX path: build a workbook with data + column stats ────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "DataLyze";
    wb.created = new Date();

    // Sheet 1: raw data
    const dataSheet = wb.addWorksheet("Data");
    const keys = data.length ? Object.keys(data[0]) : [];
    if (keys.length) {
      dataSheet.columns = keys.map((k) => ({
        header: k,
        key: k,
        width: Math.min(Math.max(k.length + 4, 14), 40),
      }));
      dataSheet.getRow(1).font = { bold: true };
      data.forEach((row) => dataSheet.addRow(row));
    }

    // Sheet 2: column stats
    if (Array.isArray(ds.columns) && ds.columns.length) {
      const statsSheet = wb.addWorksheet("Column Stats");
      statsSheet.columns = [
        { header: "Column", key: "name", width: 24 },
        { header: "Type", key: "type", width: 12 },
        { header: "Null Count", key: "nullCount", width: 12 },
        { header: "Unique", key: "unique", width: 10 },
        { header: "Min", key: "min", width: 16 },
        { header: "Max", key: "max", width: 16 },
        { header: "Mean", key: "mean", width: 16 },
      ];
      statsSheet.getRow(1).font = { bold: true };

      ds.columns.forEach((c) => {
        statsSheet.addRow({
          name: c.name,
          type: c.type || c.role || "",
          nullCount: c.nullCount ?? c.null_count ?? 0,
          unique: c.unique ?? null,
          min: c.min ?? null,
          max: c.max ?? null,
          mean: c.mean ?? null,
        });
      });
    }

    // ── Stream the workbook to the response ─────────────────────────
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.xlsx"`,
    );

    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/reports/summary/:datasetId ─────────────────────────────
router.get("/summary/:datasetId", async (req, res, next) => {
  try {
    const filter = ownershipFilter(req);
    if (!filter) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const ds = await Dataset.findOne({
      _id: req.params.datasetId,
      ...filter,
    }).select(
      "name rowCount colCount columns aiInsights fileType fileSize createdAt",
    );

    if (!ds) {
      return res
        .status(404)
        .json({ success: false, message: "Dataset not found" });
    }

    let charts = [];
    if (req.user) {
      charts = await Chart.find({ dataset: ds._id, user: req.user._id }).select(
        "title type createdAt",
      );
    }

    return res.json({
      success: true,
      data: { dataset: ds, charts, generatedAt: new Date() },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
