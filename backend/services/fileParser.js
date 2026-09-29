const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const MAX_ROWS = 200000;

const parseExcelOrCSV = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const headers = parseCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i += 1) {
      const parts = parseCsvLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => { row[h] = coerce(parts[idx]); });
      rows.push(row);
    }
    return rows;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers = [];
  ws.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_ROWS) return;
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      let v = row.getCell(i + 1).value;
      if (v && typeof v === 'object' && 'result' in v) v = v.result;
      if (v instanceof Date) v = v.toISOString();
      if (v && typeof v === 'object' && 'richText' in v) {
        v = v.richText.map((t) => t.text).join('');
      }
      obj[h] = v ?? null;
    });
    rows.push(obj);
  });
  return rows;
};

// Minimal CSV line parser handling quotes and commas
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function coerce(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
  const n = Number(s);
  if (!Number.isNaN(n) && s !== '') return n;
  return s;
}

const parsePDF = async (filePath) => {
  const pdfParse = require('pdf-parse');
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return data.text.split('\n').filter((l) => l.trim())
    .map((line, i) => ({ line: i + 1, content: line.trim() }));
};

const parseDocx = async (filePath) => {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.split('\n').filter((l) => l.trim())
    .map((line, i) => ({ line: i + 1, content: line.trim() }));
};

const parseJSON = (filePath) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Array.isArray(data) ? data.slice(0, MAX_ROWS) : [data];
};

const parseTXT = (filePath) =>
  fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((line, i) => ({ line: i + 1, content: line.trim() }));

const parseFile = async (filePath, mimeType) => {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  switch (ext) {
    case 'xlsx':
    case 'xls':
    case 'csv':
      return { rows: await parseExcelOrCSV(filePath), source: 'tabular' };
    case 'pdf':  return { rows: await parsePDF(filePath),  source: 'text' };
    case 'docx': return { rows: await parseDocx(filePath), source: 'text' };
    case 'json': return { rows: parseJSON(filePath),       source: 'tabular' };
    case 'txt':  return { rows: parseTXT(filePath),        source: 'text' };
    default: throw new Error('Unsupported file extension');
  }
};

module.exports = { parseFile };