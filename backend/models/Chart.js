const mongoose = require('mongoose');

const chartSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dataset:     { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  title:       { type: String, required: true, maxlength: 200 },
  type:        { type: String, enum: ['bar', 'line', 'pie', 'donut', 'scatter', 'area'], required: true },
  xAxis: String,
  yAxis: String,
  groupBy: String,
  filters:     { type: mongoose.Schema.Types.Mixed },
  colorScheme: { type: String, default: 'default' },
  chartData:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

chartSchema.index({ user: 1, createdAt: -1 });
chartSchema.index({ dataset: 1, user: 1 });

module.exports = mongoose.model('Chart', chartSchema);