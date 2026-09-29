const PDFDocument = require('pdfkit');

/**
 * Generate a comprehensive PDF report with visual charts
 * @param {Object} data       - Analysis data: kpis, recommendations/charts, columns, insights, correlations
 * @param {String} fileName   - Original filename
 * @param {Array}  chartImages - [{image: base64, title, chartType, confidence, reason}]
 * @returns {Promise<Buffer>}  - PDF binary buffer
 */
const generateAnalysisReport = async (data, fileName, chartImages = []) => {
  console.log('[PDF] Request received');
  console.log('[PDF] fileName:', fileName);
  console.log('[PDF] kpis:', (data.kpis || []).length);
  console.log('[PDF] chartImages:', chartImages.length);
  console.log('[PDF] columns:', (data.columns || []).length);
  console.log('[PDF] insights:', (data.insights || []).length);

    return new Promise((resolve, reject) => {
    try {
      // bufferPages:true is REQUIRED for switchToPage / bufferedPageRange to work
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: `DataLyze Report – ${fileName}`,
          Author: 'DataLyze',
          Subject: 'Data Analysis Report',
        },
      });

      const chunks = [];
      doc.on('data',  c  => chunks.push(c));
      doc.on('end',   ()  => {
        console.log('[PDF] PDF generation completed, buffer size:', Buffer.concat(chunks).length);
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', err => {
        console.error('[PDF] PDFKit stream error:', err);
        reject(err);
      });

      const W      = 595.28;   // A4 width  (pt)
      const H      = 841.89;   // A4 height (pt)
      const margin = 50;
      const cw     = W - margin * 2;  // content width

      // ── helpers ──────────────────────────────────────────────────────────────
      const needPage = (needed = 100) => {
        if (doc.y + needed > H - margin - 30) doc.addPage();
      };

      const sectionTitle = (text) => {
        needPage(60);
        doc.moveDown(0.5)
           .fillColor('#e03e2d')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(text, { continued: false });
        doc.moveDown(0.5);
      };

      // ── PAGE 1: HEADER ────────────────────────────────────────────────────────
      console.log('[PDF] Writing header');

      doc.fillColor('#e03e2d').fontSize(30).font('Helvetica-Bold').text('DataLyze');
      doc.fillColor('#111827').fontSize(20).font('Helvetica-Bold').text('Dashboard Report');
      doc.moveDown(0.4);
      doc.strokeColor('#e5e7eb').lineWidth(1)
         .moveTo(margin, doc.y).lineTo(W - margin, doc.y).stroke();
      doc.moveDown(0.8);

      // metadata block
      doc.fillColor('#6b7280').fontSize(10).font('Helvetica');
      const infoY = doc.y;
      doc.text(`File: ${fileName || 'Unknown'}`,           margin, infoY);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, infoY + 14);
      if (data.row_count != null)
        doc.text(`Rows: ${Number(data.row_count).toLocaleString()}`, margin, infoY + 28);
      if (data.col_count != null)
        doc.text(`Columns: ${data.col_count}`,             margin, infoY + 42);
      doc.y = infoY + 60;

      // ── KPI CARDS ────────────────────────────────────────────────────────────
      const kpis = data.kpis || [];
      if (kpis.length > 0) {
        console.log('[PDF] Writing KPIs');
        sectionTitle('Key Metrics');

        const perRow   = 2;
        const cardW    = (cw - 10) / perRow;
        const cardH    = 85;
        let   cx       = margin;
        let   cy       = doc.y;

        kpis.forEach((kpi, idx) => {
          if (idx > 0 && idx % perRow === 0) {
            cx  = margin;
            cy += cardH + 10;
          }
          if (cy + cardH > H - margin - 30) {
            doc.addPage();
            cy = margin;
            cx = margin;
          }

          // card background
          doc.roundedRect(cx, cy, cardW - 5, cardH, 4)
             .fillAndStroke('#f9fafb', '#e5e7eb');

          // label
          doc.fillColor('#9ca3af').fontSize(8).font('Helvetica-Bold')
             .text((kpi.label || kpi.column || '').toUpperCase(),
                   cx + 10, cy + 10, { width: cardW - 20, lineBreak: false });

          // main value
          doc.fillColor('#111827').fontSize(22).font('Helvetica-Bold')
             .text(fmt(kpi.sum), cx + 10, cy + 24, { width: cardW - 20, lineBreak: false });

          // stats
          doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
             .text(
               `Avg: ${fmt(kpi.avg)}    Min: ${fmt(kpi.min)}    Max: ${fmt(kpi.max)}`,
               cx + 10, cy + 52, { width: cardW - 20 }
             );

          cx += cardW + 5;
        });

        doc.y = cy + cardH + 20;
      }

      // ── AI INSIGHTS ──────────────────────────────────────────────────────────
      const insights = data.insights || [];
      if (insights.length > 0) {
        console.log('[PDF] Writing insights');
        sectionTitle('AI Insights');

        insights.slice(0, 8).forEach(ins => {
          const txt = typeof ins === 'string' ? ins : (ins.message || '');
          if (!txt) return;
          doc.fillColor('#374151').fontSize(10).font('Helvetica');
          const fullText = `• ${txt}`;
          const textHeight = doc.heightOfString(fullText, { width: cw });
          needPage(textHeight + 8);
          doc.text(fullText, margin, doc.y, { width: cw, lineGap: 2 });
          doc.moveDown(0.4);
        });
      }

      // ── CORRELATIONS ─────────────────────────────────────────────────────────
      const corrs = data.correlations || [];
      if (corrs.length > 0) {
        console.log('[PDF] Writing correlations');
        sectionTitle('Column Correlations');

        corrs.slice(0, 10).forEach(corr => {
          doc.fillColor('#374151').fontSize(10).font('Helvetica');
          const colA = corr.col_a || '';
          const colB = corr.col_b || '';
          const r = corr.correlation != null ? `r = ${corr.correlation}` : '';
          const strength = corr.strength || '';
          const line = `${colA} ↔ ${colB}` +
            (r ? `          ${r}` : '') +
            (strength ? `          ${strength}` : '');
          const textHeight = doc.heightOfString(line, { width: cw });
          needPage(textHeight + 8);
          doc.text(line, margin, doc.y, { width: cw, lineGap: 2 });
          doc.moveDown(0.4);
        });
      }

      // ── CHART IMAGES ─────────────────────────────────────────────────────────
      if (chartImages.length > 0) {
        console.log('[PDF] Writing chart images');
        if (doc.y > margin + 50) doc.addPage();
        sectionTitle('Dashboard Visualizations');

        chartImages.forEach((ci, idx) => {
          console.log(`[PDF] Embedding chart ${idx + 1}/${chartImages.length}: ${ci.title}`);
          needPage(280);

          // title
          if (ci.title) {
            doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold')
               .text(ci.title, { width: cw });
            doc.moveDown(0.2);
          }

          // type / confidence meta
          const meta = [
            ci.chartType ? `Type: ${ci.chartType}` : '',
            ci.confidence ? `Confidence: ${ci.confidence}%` : '',
          ].filter(Boolean).join('  |  ');
          if (meta) {
            doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text(meta, { width: cw });
            doc.moveDown(0.2);
          }

          // image
          try {
            const buf = Buffer.from(ci.image, 'base64');
            const imgY = doc.y;
            doc.image(buf, margin, imgY, { fit: [cw, 210], align: 'center' });
            doc.y = imgY + 220;
          } catch (imgErr) {
            console.error(`[PDF] Failed to embed chart image "${ci.title}":`, imgErr.message);
            doc.fillColor('#dc2626').fontSize(9)
               .text('[Chart image could not be rendered]', { width: cw });
          }

          // reason / description
          if (ci.reason) {
            doc.fillColor('#9ca3af').fontSize(8).font('Helvetica-Oblique')
               .text(ci.reason, { width: cw });
          }

          doc.moveDown(1);
        });
      }

      // ── COLUMN ANALYSIS TABLE ────────────────────────────────────────────────
      const cols = data.columns || [];
      if (cols.length > 0) {
        console.log('[PDF] Writing column analysis');
        if (doc.y > margin + 50) doc.addPage();
        sectionTitle('Column Analysis');

        const colW    = [115, 60, 58, 48, 65, 65];
        const headers = ['Column', 'Type', 'Unique', 'Nulls', 'Min', 'Max'];

        // header row
        let xp = margin;
        const hY = doc.y;
        doc.fillColor('#6b7280').fontSize(8).font('Helvetica-Bold');
        headers.forEach((h, i) => {
          doc.text(h, xp, hY, { width: colW[i], lineBreak: false });
          xp += colW[i];
        });
        doc.moveDown(0.4);
        doc.strokeColor('#e5e7eb').lineWidth(0.5)
           .moveTo(margin, doc.y).lineTo(W - margin, doc.y).stroke();
        doc.moveDown(0.3);

        cols.slice(0, 40).forEach((col, ri) => {
          needPage(20);
          const rY = doc.y;
          xp = margin;
          doc.fillColor(ri % 2 === 0 ? '#374151' : '#4b5563').fontSize(8).font('Helvetica');
          const vals = [
            trunc(col.name, 20),
            col.role || col.type || '—',
            col.unique != null ? String(col.unique) : '—',
            String(col.null_count ?? col.nullCount ?? 0),
            col.min != null ? trunc(String(col.min), 12) : '—',
            col.max != null ? trunc(String(col.max), 12) : '—',
          ];
          vals.forEach((v, i) => {
            doc.text(v, xp, rY, { width: colW[i], lineBreak: false });
            xp += colW[i];
          });
          doc.moveDown(0.45);
        });

        if (cols.length > 40) {
          needPage(20);
          doc.fillColor('#9ca3af').fontSize(8).font('Helvetica-Oblique')
             .text(`… and ${cols.length - 40} more columns`, { align: 'center', width: cw });
        }
      }

      // ── FOOTER (all pages) ────────────────────────────────────────────────────
      // Write a footer to every page using switchToPage. We use bufferPages:true
      // so PDFKit keeps all pages in memory; the footer text is drawn at a y
      // position well within the page bounds to avoid triggering an auto
      // page-break (which is what created the extra blank pages previously).
      const range = doc.bufferedPageRange();
      const total = range.count;
      console.log('[PDF] Writing footers. Total pages:', total);
      const footerY = H - 65;  // safely within page (H=841.89, margin=50)

      for (let i = 0; i < total; i++) {
        doc.switchToPage(range.start + i);
        doc.fillColor('#9ca3af').fontSize(7).font('Helvetica')
           .text(
             `Page ${i + 1} of ${total}  ·  DataLyze  ·  ${new Date().toLocaleDateString()}`,
             margin, footerY,
             { align: 'center', width: cw, lineBreak: false }
           );
      }

      console.log('[PDF] Finalising document');
      doc.end();
    } catch (err) {
      console.error('[PDF] Unhandled error during generation:', err);
      reject(err);
    }
  });
};

// ── Number formatter ──────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (isNaN(v)) return String(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function trunc(s, max) {
  if (!s) return '—';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

module.exports = { generateAnalysisReport };
