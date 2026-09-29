const router = require("express").Router();
const fs = require("fs");
const upload = require("../middleware/upload");
const { parseFile } = require("../services/fileParser");
const { analyseColumns, computeAnalysis } = require("../services/analytics");
const { isMLAvailable, autoDashboardML } = require("../services/mlProxy");
const { generateAnalysisReport } = require("../services/pdfGenerator");

// Anonymous analysis — no persistence, file deleted after processing.
router.post("/analyse", upload.single("file"), async (req, res, next) => {
  const file = req.file;
  if (!file)
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  const cleanup = () => fs.unlink(file.path, () => {});
  try {
    const { rows, source } = await parseFile(file.path, file.mimetype);
    if (!rows.length)
      return res.status(400).json({ success: false, message: "Empty file" });

    let result = null;
    const ml = source === "tabular" && (await isMLAvailable());
    if (ml) {
      try {
        result = await autoDashboardML(rows, `pub_${Date.now()}`);
      } catch (_) {
        result = null;
      }
    }
    if (!result) {
      const columns =
        source === "tabular"
          ? analyseColumns(rows)
          : [
              { name: "line", type: "string" },
              { name: "content", type: "string" },
            ];
      const analysis =
        source === "tabular"
          ? computeAnalysis(rows, columns)
          : { kpis: [], insights: [], columns: [] };
      result = {
        ...analysis,
        row_count: rows.length,
        col_count: columns.length,
        columns,
        source: "node",
      };
    }
    cleanup();
    return res.json({ success: true, data: result });
  } catch (err) {
    cleanup();
    return next(err);
  }
});

// PDF report — validated at route + services layer.
router.post("/generate-pdf", async (req, res, next) => {
  try {
    const { data, fileName, chartImages } = req.body || {};
    if (!data || typeof data !== "object") {
      return res
        .status(400)
        .json({ success: false, message: "Analysis data required" });
    }
    if (Array.isArray(chartImages) && chartImages.length > 20) {
      return res
        .status(400)
        .json({ success: false, message: "Too many chart images" });
    }
    const totalB64 = (chartImages || []).reduce(
      (s, c) => s + (c.image || "").length,
      0,
    );
    if (totalB64 > 20 * 1024 * 1024) {
      return res
        .status(413)
        .json({ success: false, message: "Chart images too large" });
    }
    const buf = await generateAnalysisReport(
      data,
      String(fileName || "Analysis").slice(0, 100),
      chartImages || [],
    );
    if (!buf || !buf.length) throw new Error("Empty PDF");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DataLyze-Report-${Date.now()}.pdf"`,
    );
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
