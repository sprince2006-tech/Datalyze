export const waitForChartsToRender = (ms = 600) => new Promise((r) => setTimeout(r, ms));

const INLINE_PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'font-family', 'font-size', 'font-weight', 'opacity', 'fill-opacity', 'stroke-opacity',
  'text-anchor', 'dominant-baseline', 'letter-spacing',
];

function inlineStyles(liveRoot, cloneRoot) {
  const live = liveRoot.querySelectorAll('*');
  const clone = cloneRoot.querySelectorAll('*');
  live.forEach((el, i) => {
    const c = clone[i];
    if (!c) return;
    const cs = window.getComputedStyle(el);
    INLINE_PROPS.forEach((p) => {
      const v = cs.getPropertyValue(p);
      // IMPORTANT: keep `none` for fill/stroke
      if (v !== '' && v != null) c.style.setProperty(p, v);
    });
  });
}

export const chartToImage = async (container) => {
  if (!container) return null;
  const svg = container.querySelector('svg');
  if (!svg) return null;

  try {
    const rect = svg.getBoundingClientRect();
    let w = Math.round(rect.width) || 600;
    let h = Math.round(rect.height) || 350;
    if (w < 10) w = 600;
    if (h < 10) h = 350;

    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    inlineStyles(svg, clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    await new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('SVG load timeout'));
      }, 5000);
      img.onload = () => {
        clearTimeout(timer);
        try { ctx.drawImage(img, 0, 0, w, h); resolve(); }
        catch (e) { reject(e); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        reject(new Error('SVG load error'));
      };
      img.src = url;
    });

    const b64 = canvas.toDataURL('image/png').split(',')[1];
    return b64 || null;
  } catch (err) {
    console.warn('[chartExport] failed:', err.message);
    return null;
  }
};

export const exportCharts = async (chartRefs = []) => {
  const out = [];
  for (let i = 0; i < chartRefs.length; i += 1) {
    const { ref, title, chartType, confidence, reason } = chartRefs[i] || {};
    if (!ref?.current) continue;
    const image = await chartToImage(ref.current);
    if (image) out.push({ image, title, chartType, confidence, reason });
  }
  return out;
};