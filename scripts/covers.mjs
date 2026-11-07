function vehiclePath(vehicle) {
  if (vehicle === "train") {
    return `<rect x="0" y="18" width="92" height="28" rx="4" fill="#f6efe6"/><rect x="8" y="24" width="16" height="10" fill="#2a1814"/><rect x="30" y="24" width="16" height="10" fill="#2a1814"/><circle cx="22" cy="50" r="7" fill="#e07a3d"/><circle cx="70" cy="50" r="7" fill="#e07a3d"/>`;
  }
  if (vehicle === "boat") {
    return `<path d="M8 28h96l-14 20H22z" fill="#f7f1e4"/><path d="M52 28V6h4l28 22" stroke="#f7f1e4" fill="none" stroke-width="3"/>`;
  }
  if (vehicle === "balloon") {
    return `<ellipse cx="48" cy="28" rx="26" ry="32" fill="#e2b007"/><path d="M36 60h24l-6 16H42z" fill="#f7f1e4"/>`;
  }
  return `<path d="M8 36l40-10-18-22 6 24 20 4-24 6 18 22-6-24z" fill="#e2b007"/>`;
}

function woodGrain() {
  return `<g fill="none" stroke="#2a0a10" stroke-width="1.2" opacity="0.5">
    <path d="M0 40c40-8 70 10 120 4s70-12 110-2 80 10 150 0 90-8 220 4"/>
    <path d="M0 90c50 8 80-10 140-2s80 12 130 2 90-8 200 4"/>
    <path d="M0 150c36-6 90 12 150 2s80-10 140-2 100 8 210 0"/>
    <path d="M0 220c44 6 70-12 130-2s90 10 140 2 80-8 230 4"/>
    <path d="M0 300c30-8 100 10 160 2s70-10 120-2 90 8 200 0"/>
    <path d="M0 380c48 6 80-10 140-2s80 12 150 2 70-6 210 4"/>
    <path d="M0 460c40-6 90 10 150 2s80-8 130 0 90 6 220-2"/>
    <path d="M0 540c32 8 100-10 160 0s70 8 140 2 80-6 200 2"/>
    <path d="M0 620c46-6 80 12 150 2s90-10 140-2 80 8 210 0"/>
    <path d="M0 700c28 6 90-8 150 2s80 6 140 0 90-4 210 2"/>
  </g>
  <g fill="#1a100e">
    <circle cx="48" cy="760" r="5"/>
    <circle cx="70" cy="754" r="3.5"/>
    <circle cx="90" cy="762" r="4.2"/>
    <circle cx="112" cy="756" r="3"/>
  </g>
  <g fill="none" stroke="#f6efe6" stroke-width="3" opacity="0.28">
    <path d="M80 640c20-30 10-70 30-100"/>
    <path d="M120 660c16-24 8-54 22-80"/>
  </g>`;
}

export function bookCoverSvg({ title, eyebrow, vehicle = "plane" }) {
  const lines = wrap(title, 22).slice(0, 4);
  const text = lines.map((line, i) => `<text x="48" y="${210 + i * 42}" fill="#f6efe6" font-family="Georgia, serif" font-size="34">${escapeXml(line)}</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#4a121c"/>
  ${woodGrain()}
  <rect x="18" y="18" width="564" height="764" fill="none" stroke="#e07a3d" stroke-width="16"/>
  <text x="48" y="90" fill="#e8a05a" font-family="Georgia, serif" font-size="18" letter-spacing="3">${escapeXml(eyebrow || "FLYING BBQ")}</text>
  ${text}
  <g transform="translate(430, 620)">${vehiclePath(vehicle)}</g>
  <text x="48" y="720" fill="#f6efe6" font-family="Georgia, serif" font-size="16">Field book · Not a ranking</text>
</svg>`;
}

export function boxSetCoverSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
  <rect width="800" height="520" fill="#4a121c"/>
  <g fill="none" stroke="#2a0a10" stroke-width="1" opacity="0.5">
    <path d="M0 40c80-8 120 10 200 2s140-8 220 0 160 8 380-2"/>
    <path d="M0 100c70 6 140-8 220 0s150 8 240 2 140-6 340 2"/>
    <path d="M0 170c90-6 110 10 210 2s160-8 230 0 150 6 360-2"/>
  </g>
  <rect x="16" y="16" width="768" height="488" fill="none" stroke="#e07a3d" stroke-width="14"/>
  <rect x="90" y="150" width="170" height="240" fill="#2a1814" stroke="#e8a05a" stroke-width="6"/>
  <rect x="230" y="120" width="170" height="270" fill="#5c1824" stroke="#e8a05a" stroke-width="6"/>
  <rect x="370" y="90" width="190" height="300" fill="#f6efe6" stroke="#e07a3d" stroke-width="6"/>
  <text x="90" y="450" fill="#f6efe6" font-family="Georgia, serif" font-size="28">Complete Collection</text>
  <text x="90" y="482" fill="#e8a05a" font-family="Georgia, serif" font-size="16">Save 30% · Coming soon</text>
</svg>`;
}

export function routeMapSvg(points) {
  const width = 800;
  const height = 360;
  const pad = 36;
  const projected = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (projected.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 120"><rect width="800" height="120" fill="#f7f1e4"/><text x="24" y="68" font-family="Georgia, serif" font-size="18">The stops are listed in the contents.</text></svg>`;
  }
  const xy = projected.map((p) => ({
    x: pad + ((p.lng + 180) / 360) * (width - pad * 2),
    y: pad + ((90 - p.lat) / 180) * (height - pad * 2),
    label: p.label || ""
  }));
  const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dots = xy.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#8c2f1e"/>`).join("");
  const labels = xy.filter((_, i) => i === 0 || i === xy.length - 1 || i % Math.ceil(xy.length / 6) === 0)
    .map((p) => `<text x="${(p.x + 8).toFixed(1)}" y="${(p.y - 8).toFixed(1)}" font-family="Georgia, serif" font-size="12">${escapeXml(p.label)}</text>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f4efe4"/>
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#e2b007" stroke-width="6"/>
  <path d="${d}" fill="none" stroke="#1e4d5c" stroke-width="3" stroke-dasharray="7 6"/>
  ${dots}
  ${labels}
</svg>`;
}

function wrap(text, size) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > size && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
