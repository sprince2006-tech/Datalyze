const router = require("express").Router();
const Chart = require("../models/Chart");
const Dataset = require("../models/Dataset");
const { protect } = require("../middleware/auth");

const EDITABLE = [
  "title",
  "type",
  "xAxis",
  "yAxis",
  "groupBy",
  "filters",
  "colorScheme",
  "chartData",
];
const pick = (obj) =>
  EDITABLE.reduce(
    (acc, k) => (obj[k] !== undefined && (acc[k] = obj[k]), acc),
    {},
  );

router.get("/", protect, async (req, res, next) => {
  try {
    const charts = await Chart.find({ user: req.user._id })
      .select("-chartData")
      .populate("dataset", "name rowCount")
      .sort("-createdAt");
    res.json({ success: true, data: charts });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.body.dataset,
      user: req.user._id,
    });
    if (!dataset)
      return res
        .status(404)
        .json({ success: false, message: "Dataset not found" });
    const chart = await Chart.create({
      user: req.user._id,
      dataset: dataset._id,
      ...pick(req.body),
    });
    res.status(201).json({ success: true, data: chart });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid chart data" });
    }
    return next(err);
  }
});

router.put("/:id", protect, async (req, res, next) => {
  try {
    if (req.body.dataset) {
      const ok = await Dataset.findOne({
        _id: req.body.dataset,
        user: req.user._id,
      }).select("_id");
      if (!ok)
        return res
          .status(404)
          .json({ success: false, message: "Dataset not found" });
    }
    const updates = pick(req.body);
    if (req.body.dataset) updates.dataset = req.body.dataset;
    const chart = await Chart.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true, context: "query" },
    );
    if (!chart)
      return res
        .status(404)
        .json({ success: false, message: "Chart not found" });
    res.json({ success: true, data: chart });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    const chart = await Chart.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!chart)
      return res
        .status(404)
        .json({ success: false, message: "Chart not found" });
    res.json({ success: true, message: "Chart deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
