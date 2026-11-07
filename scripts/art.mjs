import fs from "node:fs";
import path from "node:path";

const COLORS = {
  "low-and-slow": "#8e2f1c",
  "hot-grill": "#c2412d",
  skewer: "#d4762c",
  spit: "#a33b24",
  "earth-oven": "#6e4b32",
  tandoor: "#b5522a",
  plancha: "#8d5a34",
  "open-fire": "#e07a2f",
  smokehouse: "#5c4033",
  rotisserie: "#a32012",
  sauce: "#c4552a",
  rub: "#a9743a",
  side: "#c4a15a"
};

function hash(text) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) % 10000;
  return value;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fire(n) {
  const lean = (n % 5) - 2;
  return `<path d="M390 ${250 + lean}c8-28 28-36 24-62 18 16 28 40 18 62 16-8 20-28 10-40 18 22 8 48-10 56-8 20-28 28-42 16z" fill="#e2b007"/>
  <path d="M400 ${258 + lean}c4-14 14-18 12-32 8 10 10 22 4 30z" fill="#f7f1e4"/>`;
}

function rig(baseType, n) {
  if (baseType === "skewer") {
    return `<line x1="250" y1="300" x2="560" y2="250" stroke="#f7f1e4" stroke-width="4"/>
      <circle cx="320" cy="286" r="16" fill="#8c2f1e"/><circle cx="390" cy="272" r="16" fill="#c2412d"/><circle cx="460" cy="258" r="16" fill="#8c2f1e"/>`;
  }
  if (baseType === "spit" || baseType === "rotisserie") {
    return `<line x1="220" y1="280" x2="600" y2="280" stroke="#f7f1e4" stroke-width="5"/>
      <ellipse cx="400" cy="280" rx="90" ry="36" fill="#8c2f1e"/>
      <rect x="190" y="240" width="16" height="90" fill="#e2b007"/><rect x="590" y="240" width="16" height="90" fill="#e2b007"/>`;
  }
  if (baseType === "earth-oven") {
    return `<ellipse cx="410" cy="330" rx="150" ry="36" fill="#142f38"/>
      <path d="M280 330c20-70 40-120 130-120s110 50 130 120" fill="#6e4b32"/>
      <ellipse cx="410" cy="318" rx="70" ry="16" fill="#1c1915"/>`;
  }
  if (baseType === "tandoor") {
    return `<path d="M330 360c10-140 40-180 80-180s70 40 80 180" fill="#b5522a"/>
      <ellipse cx="410" cy="360" rx="90" ry="22" fill="#6e4b32"/>
      <ellipse cx="410" cy="190" rx="28" ry="12" fill="#1c1915"/>`;
  }
  if (baseType === "plancha") {
    return `<rect x="250" y="300" width="300" height="28" rx="4" fill="#d9d0c1"/>
      <rect x="270" y="328" width="16" height="40" fill="#1c1915"/><rect x="514" y="328" width="16" height="40" fill="#1c1915"/>
      <circle cx="340" cy="292" r="18" fill="#8c2f1e"/><rect x="400" y="276" width="70" height="22" rx="4" fill="#c2412d"/>`;
  }
  if (baseType === "sauce" || baseType === "rub" || baseType === "side") {
    return `<rect x="300" y="230" width="160" height="90" rx="8" fill="#f7f1e4"/>
      <rect x="318" y="248" width="124" height="54" fill="${baseType === "rub" ? "#a9743a" : "#c2412d"}"/>
      <circle cx="520" cy="250" r="28" fill="none" stroke="#e2b007" stroke-width="4"/>`;
  }
  const coals = [0, 1, 2, 3, 4].map((i) => {
    const x = 300 + ((n + i * 37) % 200);
    return `<circle cx="${x}" cy="348" r="${6 + (i % 3)}" fill="#1c1915"/>`;
  }).join("");
  return `<rect x="240" y="320" width="320" height="18" fill="#f7f1e4"/>
    <rect x="250" y="338" width="300" height="28" rx="3" fill="#142f38"/>
    ${coals}
    ${fire(n)}`;
}

export function dishIllustration(dish) {
  const base = COLORS[dish.baseType] || "#c4552a";
  const n = hash(dish.slug);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-labelledby="title">
  <title id="title">Illustration of ${escapeXml(dish.name)}</title>
  <rect width="800" height="520" fill="#f7f1e4"/>
  <rect x="18" y="18" width="764" height="484" fill="none" stroke="#e2b007" stroke-width="16"/>
  <rect x="42" y="42" width="716" height="436" fill="#1e4d5c"/>
  <path d="M80 430c80-40 140-20 200-60s120-30 180 10 140 20 220-20" fill="none" stroke="#e2b007" stroke-width="3" opacity="0.45"/>
  <circle cx="150" cy="120" r="28" fill="none" stroke="#e2b007" stroke-width="3"/>
  <path d="M150 96v16M150 140v-8M128 120h12M172 120h-8" stroke="#e2b007" stroke-width="2"/>
  ${rig(dish.baseType, n)}
  <rect x="70" y="360" width="120" height="14" fill="${base}" opacity="0.85"/>
</svg>`;
}

export function writeIllustration(root, dish) {
  const rel = `assets/images/dishes/${dish.slug}.svg`;
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dishIllustration(dish));
  return rel;
}

export function heroSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
  <rect width="800" height="520" fill="#1e4d5c"/>
  <rect x="16" y="16" width="768" height="488" fill="none" stroke="#e2b007" stroke-width="14"/>
  <circle cx="400" cy="270" r="150" fill="none" stroke="#f7f1e4" stroke-width="3" opacity="0.55"/>
  <ellipse cx="400" cy="270" rx="150" ry="52" fill="none" stroke="#f7f1e4" stroke-width="2" opacity="0.55"/>
  <path d="M250 270h300M400 120v300" stroke="#f7f1e4" stroke-width="2" opacity="0.35"/>
  <ellipse cx="180" cy="150" rx="36" ry="46" fill="#e2b007"/>
  <path d="M164 196h32l-8 22h-16z" fill="#f7f1e4"/>
  <path d="M520 120l28-8-14-16 4 18 16 3-18 5 12 16-4-16z" fill="#e2b007"/>
  <rect x="560" y="300" width="78" height="26" rx="4" fill="#f7f1e4"/>
  <circle cx="578" cy="332" r="7" fill="#e2b007"/><circle cx="618" cy="332" r="7" fill="#e2b007"/>
  <path d="M120 340h90l-14 22H134z" fill="#f7f1e4"/>
  <path d="M164 340v-30h4l22 30" stroke="#f7f1e4" fill="none" stroke-width="3"/>
  <path d="M390 360c10-34 32-44 28-74 20 18 30 46 16 70 18-8 22-32 10-46 20 24 6 54-12 64-10 22-32 30-42 16z" fill="#e2b007"/>
</svg>`;
}

export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#e2b007"/>
  <rect x="6" y="6" width="52" height="52" fill="#1e4d5c"/>
  <ellipse cx="32" cy="26" rx="10" ry="13" fill="#e2b007"/>
  <path d="M26 38h12l-3 8h-6z" fill="#f7f1e4"/>
  <path d="M30 50c2-8 6-10 6-16 4 4 4 10 2 14z" fill="#f7f1e4"/>
</svg>`;
}
