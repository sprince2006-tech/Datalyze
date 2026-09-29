const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: String, type: String, role: String,
  nullCount: Number, null_count: Number,
  unique: Number,
  min: mongoose.Schema.Types.Mixed,
  max: mongoose.Schema.Types.Mixed,
  mean: Number, median: Number, std: Number, sum: Number,
}, { _id: false });

const datasetSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId:  { type: String, default: null, index: true },
  name:       { type: String, required: true, maxlength: 200 },
  originalName: String,
  fileType:   String,
  filePath:   String,
  fileSize:   Number,
  rowCount:   Number,
  colCount:   Number,
  columns:    [columnSchema],
  // rows is intentionally NOT stored on the document (16 MB BSON limit).
  // Rows live on disk at filePath and are parsed on demand.
  preview:    { type: mongoose.Schema.Types.Mixed }, // first N rows only
  analysis:   { type: mongoose.Schema.Types.Mixed },
  aiInsights: [String],
  status:     { type: String, enum: ['processing', 'ready', 'error'], default: 'processing', index: true },
  error:      String,
}, { timestamps: true });

datasetSchema.index({ user: 1, createdAt: -1 });
datasetSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('Dataset', datasetSchema);