import { escapeHtml, safeJsonLd } from "../assets/js/lib/escape.js";

const NAV = [
  ["index.html", "Journal", "home"],
  ["map/", "Route map", "map"],
  ["journeys/", "Journeys", "journeys"],
  ["explore/", "Explore", "explore"],
  ["books/", "Recipe books", "books"],
  ["shop/", "Shop", "shop"],
  ["learn/who-settled-the-flavor/", "Who settled the flavor", "settled"],
  ["learn/fire-101/", "Fire 101", "learn"],
  ["submit.html", "Submit a dish", "submit"],
  ["about/", "About", "about"]
];

export function page({
  title,
  description,
  current = "",
  robots = "",
  extraHead = "",
  extraFoot = "",
  main,
  pageName = "static",
  jsonLd = null,
  canonical = "",
  dishCount = 0
}) {
  const nav = NAV.map(([href, label, id]) => {
    const currentAttr = id === current ? ' aria-current="page"' : "";
    return `<a href="${href}"${currentAttr}>${escapeHtml(label)}</a>`;
  }).join("\n          ");
  const issue = dishCount
    ? `${dishCount} stops in this passport · Growing to 1,000`
    : "Growing to 1,000 stops";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="/flying-bbq/">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#1e4d5c">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,680&amp;family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&amp;display=swap">
  <link rel="stylesheet" href="assets/css/styles.css">
  ${robots ? `<meta name="robots" content="${escapeHtml(robots)}">` : ""}
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
  ${jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : ""}
  ${extraHead}
</head>
<body data-page="${escapeHtml(pageName)}" data-print="full">
  <a class="skip-link" href="#content">Skip to content</a>
  <div class="frame">
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="index.html">
          <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="8" fill="#e2b007"/>
            <rect x="6" y="6" width="52" height="52" fill="#1e4d5c"/>
            <circle cx="34" cy="36" r="12" fill="none" stroke="#f7f1e4" stroke-width="2"/>
            <path d="M12 20l16-3-10-12 3 14 12 2-14 3 10 12-3-14z" fill="#f7f1e4"/>
          </svg>
          <span class="brand-text">
            <span class="brand-kicker">Travel journal</span>
            <span class="brand-name">Flying BBQ</span>
          </span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <nav id="site-nav" aria-label="Primary">
          ${nav}
        </nav>
        <div id="auth-slot"></div>
      </div>
      <p class="issue-line">${escapeHtml(issue)}</p>
    </header>
    <p id="demo-banner" class="demo-banner" role="status" hidden></p>
    <noscript>
      <p class="demo-banner">JavaScript is off. You can still read the field guide. Search, the shaded map, and community notes need JavaScript.</p>
    </noscript>
    <main id="content" tabindex="-1">
      ${main}
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <nav aria-label="Footer">
          <a href="shop/">Shop</a>
          <a href="books/">Recipe books</a>
          <a href="journeys/">Journeys</a>
          <a href="map/">Route map</a>
          <a href="about/">About</a>
          <a href="learn/who-settled-the-flavor/">Who settled the flavor</a>
          <a href="learn/fire-101/">Fire 101</a>
          <a href="learn/glossary/">Glossary</a>
          <a href="credits/">Photo credits</a>
          <a href="guidelines/">Community guidelines</a>
          <a href="affiliate/">Affiliate disclosure</a>
          <a href="privacy/">Privacy</a>
          <a href="terms/">Terms</a>
          <a href="submit.html">Submit a dish</a>
        </nav>
        <p id="mode-note"></p>
        <p>Recipes are for home cooking. They are not professional food-safety, medical, or dietary advice. The passport is growing toward 1,000 stops. Counts on this site are the edited entries in this issue, nothing else.</p>
      </div>
    </footer>
  </div>
  ${extraFoot}
  <script src="config.js"></script>
  <script src="ads-config.js"></script>
  <script type="module" src="assets/js/boot.js"></script>
</body>
</html>
`;
}

export function adSlot(name) {
  return `<aside class="ad-slot" data-ad-slot="${escapeHtml(name)}" hidden></aside>`;
}
