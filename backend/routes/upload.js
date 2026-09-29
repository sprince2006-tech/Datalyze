const router = require("express").Router();
const path = require("path");
const Dataset = require("../models/Dataset");
const { optionalAuth } = require("../middleware/auth");
const { sessionAuth } = require("../middleware/sessionAuth");
const upload = require("../middleware/upload");
const { parseFile } = require("../services/fileParser");
const {
  analyseColumns,
  generateInsights,
  computeAnalysis,
} = require("../services/analytics");
const { isMLAvailable, autoDashboardML } = require("../services/mlProxy");

router.post(
  "/",
  optionalAuth,
  sessionAuth,
  upload.single("file"),
  async (req, res, next) => {
    const file = req.file;
    if (!file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const userId = req.user?._id;
    const sessionId = req.sessionId;
    if (!userId && !sessionId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Authentication or session required",
        });
    }

    try {
      const ds = await Dataset.create({
        user: userId || null,
        sessionId: sessionId || null,
        name: String(
          req.body.name || file.originalname.replace(/\.[^.]+$/, ""),
        ).slice(0, 200),
        originalName: file.originalname,
        fileType: path
          .extname(file.originalname)
          .replace(".", "")
          .toLowerCase(),
        filePath: file.path,
        fileSize: file.size,
        status: "processing",
      });

      const roomId = userId ? userId.toString() : sessionId;
      req.io?.to(roomId).emit("dataset:processing", { id: ds._id });

      // Fire-and-forget analysis
      setImmediate(async () => {
        try {
          const { rows, source } = await parseFile(file.path, file.mimetype);
          const columns =
            source === "tabular"
              ? analyseColumns(rows)
              : [
                  { name: "line", type: "string" },
                  { name: "content", type: "string" },
                ];

          let analysis = null;
          const ml = source === "tabular" && (await isMLAvailable());
          if (ml) {
            try {
              analysis = await autoDashboardML(rows, String(ds._id));
            } catch (_) {
              analysis = null;
            }
          }
          if (!analysis && source === "tabular") {
            analysis = computeAnalysis(rows, columns);
          }

          const insights = generateInsights(columns, rows.length);

          await Dataset.findByIdAndUpdate(ds._id, {
            rowCount: rows.length,
            colCount: columns.length,
            columns,
            preview: rows.slice(0, 50),
            analysis,
            aiInsights: insights,
            status: "ready",
          });

          req.io
            ?.to(roomId)
            .emit("dataset:ready", { id: ds._id, rowCount: rows.length });
        } catch (err) {
          console.error("[UPLOAD] analysis failed:", err.message);
          await Dataset.findByIdAndUpdate(ds._id, {
            status: "error",
            error: "Analysis failed",
          });
          req.io?.to(roomId).emit("dataset:error", { id: ds._id });
        }
      });

      return res
        .status(202)
        .json({ success: true, datasetId: ds._id, message: "Processing" });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
