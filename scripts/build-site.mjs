import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISHES } from "../data/dishes/index.js";
import { BOOKS as USE_BOOKS } from "../data/books.js";
import { FLAGSHIP_BOOKS } from "../data/flagship-books.js";
import { SHOP } from "../data/shop.js";
import { DISH_101, GLOSSARY } from "../data/learn.js";
import { JOURNEYS, VEHICLES, nextOnJourney } from "../data/journeys.js";
import { SETTLED } from "../data/settled.js";
import { COUNTRY_NAMES } from "../data/country-names.js";
import {
  BASE_TYPES,
  DIET_IDS,
  DIETS,
  HEATS,
  REGIONS,
  REGION_NAMES,
  USES,
  continentOf,
  labelOf
} from "../data/vocabulary.js";
import { escapeHtml } from "../assets/js/lib/escape.js";
import { isoDuration, formatMinutes } from "../assets/js/lib/format.js";
import { slugify } from "../assets/js/lib/slug.js";
import { faviconSvg, heroSvg, writeIllustration } from "./art.mjs";
import { bookCoverSvg, boxSetCoverSvg, routeMapSvg } from "./covers.mjs";
import { boxSetQuote, notifyHref, priceLabel } from "../assets/js/lib/shop.js";
import { adSlot, page } from "./layout.mjs";

const BOOKS = [...FLAGSHIP_BOOKS, ...USE_BOOKS];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://jonldavis-coder.github.io/flying-bbq";
const TODAY = "2026-11-07";

function write(rel, contents) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function resetGenerated() {
  for (const dir of ["dishes", "explore", "books", "map", "learn", "about", "privacy", "terms", "affiliate", "guidelines", "journeys", "assets/images/dishes", "assets/images/journeys", "assets/images/books"]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  }
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validate(dishes) {
  const errors = [];
  const slugs = new Set();
  const names = new Set();
  const banned = /national geographic|natgeo|lorem ipsum|\bTODO\b|testimonial/i;
  for (const dish of dishes) {
    const where = dish.slug || dish.name || "(missing slug)";
    const need = ["slug", "name", "country", "countryCode", "region", "culture", "baseType", "heat", "flavor", "history", "background", "method", "served", "yieldText"];
    for (const key of need) {
      if (!String(dish[key] || "").trim()) errors.push(`${where}: missing ${key}`);
    }
    if (slugs.has(dish.slug)) errors.push(`${where}: duplicate slug`);
    slugs.add(dish.slug);
    const norm = normalizeName(dish.name);
    if (names.has(norm)) errors.push(`${where}: duplicate or near-duplicate name`);
    names.add(norm);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dish.slug || "")) errors.push(`${where}: bad slug`);
    if (!/^[A-Z]{2}$/.test(dish.countryCode || "")) errors.push(`${where}: countryCode must be ISO alpha-2`);
    if (!REGION_NAMES.includes(dish.region)) errors.push(`${where}: unknown region ${dish.region}`);
    if (!BASE_TYPES.some(([id]) => id === dish.baseType)) errors.push(`${where}: unknown base ${dish.baseType}`);
    if (!HEATS.some(([id]) => id === dish.heat)) errors.push(`${where}: unknown heat ${dish.heat}`);
    if (!Array.isArray(dish.uses) || dish.uses.length < 1) errors.push(`${where}: uses`);
    for (const use of dish.uses || []) if (!USES.some(([id]) => id === use)) errors.push(`${where}: bad use ${use}`);
    for (const diet of dish.diets || []) if (!DIET_IDS.includes(diet)) errors.push(`${where}: bad diet ${diet}`);
    for (const code of dish.alsoCountries || []) {
      if (!/^[A-Z]{2}$/.test(code)) errors.push(`${where}: bad alsoCountries ${code}`);
    }
    if (!Array.isArray(dish.funFacts) || dish.funFacts.length < 1 || dish.funFacts.length > 3) {
      errors.push(`${where}: need 1 to 3 fun facts`);
    }
    for (const fact of dish.funFacts || []) if (String(fact).trim().length < 20) errors.push(`${where}: thin fun fact`);
    if (String(dish.history).length < 80) errors.push(`${where}: history too short`);
    if (String(dish.background).length < 40) errors.push(`${where}: background too short`);
    if (String(dish.whyItTastes || "").trim().length < 80) errors.push(`${where}: why it tastes this way`);
    if (String(dish.authenticTouch || "").trim().length < 40) errors.push(`${where}: authentic touch`);
    if (!Array.isArray(dish.ingredients) || dish.ingredients.length < 3) errors.push(`${where}: ingredients`);
    if (!Array.isArray(dish.steps) || dish.steps.length < 3) errors.push(`${where}: steps`);
    if (!Number.isInteger(dish.prepMinutes) || dish.prepMinutes < 0) errors.push(`${where}: prep`);
    if (!Number.isInteger(dish.cookMinutes) || dish.cookMinutes < 0) errors.push(`${where}: cook`);
    if ((dish.prepMinutes || 0) + (dish.cookMinutes || 0) < 1) errors.push(`${where}: time`);
    if (!Number.isInteger(dish.servings) || dish.servings < 1) errors.push(`${where}: servings`);
    if (!Number.isFinite(dish.lat) || !Number.isFinite(dish.lng)) errors.push(`${where}: map location`);
    if (!Array.isArray(dish.coverage) || dish.coverage.length < 1) errors.push(`${where}: coverage`);
    const blob = JSON.stringify(dish);
    if (banned.test(blob)) errors.push(`${where}: banned phrasing`);
    const allergens = new Set(dish.allergens || []);
    const diets = new Set(dish.diets || []);
    if ((allergens.has("meat") || allergens.has("fish") || allergens.has("shellfish")) && (diets.has("vegetarian") || diets.has("vegan"))) {
      errors.push(`${where}: diet conflicts with meat or fish`);
    }
    if ((allergens.has("dairy") || allergens.has("egg") || allergens.has("honey")) && diets.has("vegan")) {
      errors.push(`${where}: vegan conflict`);
    }
    if (allergens.has("dairy") && diets.has("dairy-free")) errors.push(`${where}: dairy-free conflict`);
    if (allergens.has("wheat") && diets.has("gluten-free")) errors.push(`${where}: gluten-free conflict`);
    if ((allergens.has("peanut") || allergens.has("tree-nut")) && diets.has("nut-free")) errors.push(`${where}: nut-free conflict`);
    if (!COUNTRY_NAMES[dish.countryCode]) errors.push(`${where}: add ${dish.countryCode} to country-names.js`);
    for (const code of dish.alsoCountries || []) {
      if (!COUNTRY_NAMES[code]) errors.push(`${where}: add ${code} to country-names.js`);
    }
  }
  const continents = new Set(dishes.map((dish) => continentOf(dish.region)));
  for (const name of ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]) {
    if (!continents.has(name)) errors.push(`missing continent ${name}`);
  }
  if (dishes.length < 250) errors.push(`need at least 250 dishes, have ${dishes.length}`);
  const coverageCounts = new Map();
  for (const dish of dishes) {
    for (const tag of dish.coverage || []) coverageCounts.set(tag, (coverageCounts.get(tag) || 0) + 1);
  }
  const coverageMin = {
    "Southern US": 12,
    "Eastern US": 6,
    "Northern US": 6,
    "Appalachia": 5,
    Ireland: 2,
    England: 2,
    Africa: 10,
    India: 6,
    "South Korea": 4,
    Japan: 4,
    China: 4,
    Cuba: 2,
    Caribbean: 8,
    Mexico: 8,
    Spain: 3,
    "South America": 10,
    "Middle East": 8,
    "Southeast Asia": 8,
    Oceania: 6
  };
  for (const [tag, min] of Object.entries(coverageMin)) {
    if ((coverageCounts.get(tag) || 0) < min) errors.push(`coverage ${tag} has ${coverageCounts.get(tag) || 0}, need ${min}`);
  }
  const africaCountries = new Set(dishes.filter((dish) => (dish.coverage || []).includes("Africa")).map((dish) => dish.countryCode));
  if (africaCountries.size < 6) errors.push(`Africa coverage should span several countries, has ${africaCountries.size}`);
  if (errors.length) {
    console.error(errors.slice(0, 40).join("\n"));
    throw new Error(`Catalog failed validation (${errors.length} problems).`);
  }
}

function countriesOf(dish) {
  return [dish.countryCode, ...(dish.alsoCountries || [])];
}

function searchText(dish) {
  return [
    dish.name,
    dish.country,
    dish.region,
    dish.locale,
    dish.culture,
    dish.flavor,
    dish.background,
    labelOf(BASE_TYPES, dish.baseType),
    labelOf(HEATS, dish.heat),
    ...(dish.uses || []),
    ...(dish.pairings || []),
    ...(dish.funFacts || [])
  ].join(" ").toLowerCase();
}

function og(title, description, url) {
  return `<meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="${ORIGIN}/assets/images/hero.svg">`;
}

function selectOptions(list, blank) {
  const head = `<option value="">${escapeHtml(blank)}</option>`;
  const rest = list.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  return head + rest;
}

function filterForm(countryOptions) {
  return `<form id="filters" class="filters" role="search">
      <div class="filter-grid">
        <label>Search
          <input name="q" type="search" placeholder="Brisket, Oaxaca, oak…" autocomplete="off">
        </label>
        <label>Region
          <select name="region">${selectOptions(REGIONS.map(([name]) => [name, name]), "All regions")}</select>
        </label>
        <label>Fire method
          <select name="type">${selectOptions(BASE_TYPES, "All methods")}</select>
        </label>
        <label>Heat
          <select name="heat">${selectOptions(HEATS, "Any heat")}</select>
        </label>
        <label>Use
          <select name="use">${selectOptions(USES, "Any use")}</select>
        </label>
        <label>Diet
          <select name="diet">${selectOptions(DIETS, "Any diet")}</select>
        </label>
        <label>Country
          <select name="country">${countryOptions}</select>
        </label>
      </div>
    </form>`;
}

function card(dish) {
  const countries = countriesOf(dish).join(",");
  return `<article class="card" data-slug="${escapeHtml(dish.slug)}" data-region="${escapeHtml(dish.region)}" data-type="${escapeHtml(dish.baseType)}" data-heat="${escapeHtml(dish.heat)}" data-uses="${escapeHtml(dish.uses.join(","))}" data-diets="${escapeHtml((dish.diets || []).join(","))}" data-countries="${escapeHtml(countries)}" data-search="${escapeHtml(searchText(dish))}">
        <a class="card-media" href="dishes/${dish.slug}/">
          <img src="${dish.photo}" alt="Illustration of ${escapeHtml(dish.name)}" width="800" height="520">
          <span class="badge">${escapeHtml(dish.country)}</span>
        </a>
        <div class="card-body">
          <p class="eyebrow">${escapeHtml(dish.region)} · ${escapeHtml(labelOf(BASE_TYPES, dish.baseType))}</p>
          <h2><a href="dishes/${dish.slug}/">${escapeHtml(dish.name)}</a></h2>
          <p>${escapeHtml(dish.flavor)}</p>
          <p class="meta">${escapeHtml(labelOf(HEATS, dish.heat))} · ${formatMinutes(dish.prepMinutes + dish.cookMinutes)} · ${escapeHtml(dish.yieldText)}</p>
          <p class="meta rating">No ratings yet</p>
          <p class="meta hearts">No hearts yet</p>
        </div>
      </article>`;
}

function recipeBody(dish, { book = false } = {}) {
  const facts = dish.funFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const ingredients = dish.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = dish.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const variations = (dish.variations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const pairings = (dish.pairings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const uses = dish.uses.map((item) => `<li>${escapeHtml(labelOf(USES, item))}</li>`).join("");
  const diets = (dish.diets || []).map((item) => `<li>${escapeHtml(labelOf(DIETS, item))}</li>`).join("");
  const safety = dish.safety ? `<p class="safety">${escapeHtml(dish.safety)}</p>` : "";
  return `<p class="print-only print-brand">Flying BBQ of the World</p>
      <p class="eyebrow">${escapeHtml(dish.country)} · ${escapeHtml(dish.region)}</p>
      <h2 class="dish-title">${book ? escapeHtml(dish.name) : ""}</h2>
      ${book ? "" : ""}
      <p class="dek">${escapeHtml(dish.flavor)}</p>
      <p class="meta recipe-meta">${formatMinutes(dish.prepMinutes)} prep · ${formatMinutes(dish.cookMinutes)} cook · Serves ${dish.servings} · ${escapeHtml(dish.yieldText)}</p>
      <div class="story-block">
        <h3>History</h3>
        <p>${escapeHtml(dish.history)}</p>
        <h3>Cultural background</h3>
        <p>${escapeHtml(dish.background)}</p>
        <h3>Why it tastes this way</h3>
        <p>${escapeHtml(dish.whyItTastes)}</p>
        <h3>How it is made</h3>
        <p>${escapeHtml(dish.method)}</p>
        <p class="authentic-touch"><strong>Authentic touch. </strong>${escapeHtml(dish.authenticTouch)}</p>
        <h3>How it is used</h3>
        <p>${escapeHtml(dish.served)}</p>
      </div>
      <aside class="fun-facts">
        <h3>Field notes</h3>
        <ul>${facts}</ul>
      </aside>
      <h3>Ingredients</h3>
      <ul class="ingredients">${ingredients}</ul>
      <h3 class="steps-heading">Steps</h3>
      <ol class="steps">${steps}</ol>
      ${safety}
      <p class="note">${escapeHtml(dish.storage)} Home cooking, not a professional food-safety instruction.</p>
      <div class="variations">
        <h3>Variations</h3>
        ${variations ? `<ul>${variations}</ul>` : "<p>The classic version is the one written above.</p>"}
      </div>
      <div class="pairings">
        <h3>Pairings and uses</h3>
        <ul class="tag-row">${uses}</ul>
        ${pairings ? `<ul>${pairings}</ul>` : ""}
        ${diets ? `<ul class="tag-row">${diets}</ul>` : ""}
      </div>`;
}

function dishJson(dish) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: dish.name,
    description: `${dish.flavor} ${dish.history}`.slice(0, 480),
    image: `${ORIGIN}/${dish.photo}`,
    recipeCategory: labelOf(BASE_TYPES, dish.baseType),
    recipeCuisine: dish.culture || dish.country,
    recipeYield: dish.yieldText,
    prepTime: isoDuration(dish.prepMinutes),
    cookTime: isoDuration(dish.cookMinutes),
    totalTime: isoDuration(dish.prepMinutes + dish.cookMinutes),
    recipeIngredient: dish.ingredients,
    recipeInstructions: dish.steps.map((text) => ({ "@type": "HowToStep", text })),
    keywords: [dish.region, dish.country, labelOf(HEATS, dish.heat), ...dish.uses].join(", "),
    author: { "@type": "Organization", name: "Flying BBQ of the World" },
    url: `${ORIGIN}/dishes/${dish.slug}/`
  };
}

function breadcrumb(dish) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Field guide", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: dish.region, item: `${ORIGIN}/explore/region/${slugify(dish.region)}/` },
      { "@type": "ListItem", position: 3, name: dish.name, item: `${ORIGIN}/dishes/${dish.slug}/` }
    ]
  };
}

function formatCoord(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

function nextStopFor(dish, dishes) {
  const known = new Set(dishes.map((item) => item.slug));
  const onJourney = nextOnJourney(dish.slug, known);
  if (onJourney) {
    const stop = dishes.find((item) => item.slug === onJourney.slug);
    if (stop) return { stop, journey: onJourney.journey };
  }
  const ordered = [...dishes].sort((a, b) => (a.voyage || 0) - (b.voyage || 0) || a.name.localeCompare(b.name));
  const index = ordered.findIndex((item) => item.slug === dish.slug);
  if (index === -1 || ordered.length < 2) return null;
  return { stop: ordered[(index + 1) % ordered.length], journey: null };
}

function dishPage(dish, count, dishes) {
  const description = `${dish.name}: ${dish.flavor} A stop in ${dish.locale || dish.country}, with a workable recipe, a history, and a map pin.`;
  const shared = (dish.alsoCountries || []).map((code) => COUNTRY_NAMES[code]).filter(Boolean);
  const originExtra = shared.length ? `<p>Also cooked as a staple in ${escapeHtml(shared.join(", "))}.</p>` : "";
  const next = nextStopFor(dish, dishes);
  const nextHtml = next ? `<p class="next-stop no-print"><a href="dishes/${next.stop.slug}/">Next stop: ${escapeHtml(next.stop.name)}</a>${next.journey ? ` · on ${escapeHtml(next.journey.title)}, by ${escapeHtml(VEHICLES[next.journey.vehicle] || next.journey.vehicle)}` : " · continuing the voyage"}</p>` : "";
  return page({
    title: `${dish.name} · Flying BBQ`,
    description,
    current: "home",
    pageName: "dish",
    dishCount: count,
    canonical: `${ORIGIN}/dishes/${dish.slug}/`,
    jsonLd: [dishJson(dish), breadcrumb(dish)],
    extraHead: og(dish.name, description, `${ORIGIN}/dishes/${dish.slug}/`),
    main: `<article id="dish-root" class="wrap dish-layout" data-slug="${escapeHtml(dish.slug)}">
      <div>
        <p class="print-only print-brand">Flying BBQ of the World</p>
        <p class="arriving">Arriving in ${escapeHtml(dish.locale || dish.country)}.</p>
        <p class="eyebrow">${escapeHtml(dish.country)} · ${escapeHtml(dish.region)}</p>
        <h1 class="dish-title">${escapeHtml(dish.name)}</h1>
        ${nextHtml}
        ${dish.pronunciation ? `<p class="meta">Pronounced ${escapeHtml(dish.pronunciation)}</p>` : ""}
        <p class="dek">${escapeHtml(dish.flavor)}</p>
        <p class="meta recipe-meta">${formatMinutes(dish.prepMinutes)} prep · ${formatMinutes(dish.cookMinutes)} cook · Serves ${dish.servings} · ${escapeHtml(dish.yieldText)}</p>
        <p class="meta" id="rating-summary">No ratings yet</p>
        <p class="meta" id="heart-summary">No hearts yet</p>
        <ul class="tag-row">
          <li>${escapeHtml(labelOf(BASE_TYPES, dish.baseType))}</li>
          <li>${escapeHtml(labelOf(HEATS, dish.heat))}</li>
          ${(dish.diets || []).map((diet) => `<li>${escapeHtml(labelOf(DIETS, diet))}</li>`).join("")}
        </ul>
        <div class="story-block">
          <h2>History</h2>
          <p>${escapeHtml(dish.history)}</p>
          <h2>Cultural background</h2>
          <p>${escapeHtml(dish.background)}</p>
          <h2>Why it tastes this way</h2>
          <p>${escapeHtml(dish.whyItTastes)}</p>
          <h2>How it is made</h2>
          <p>${escapeHtml(dish.method)}</p>
          <aside class="authentic-touch">
            <h2>Authentic touch</h2>
            <p>${escapeHtml(dish.authenticTouch)}</p>
          </aside>
          <h2>How it is used</h2>
          <p>${escapeHtml(dish.served)}</p>
        </div>
        <aside class="fun-facts">
          <h2>Field notes</h2>
          <ul>${dish.funFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
        </aside>
        ${adSlot("dish_rail")}
        <h2>Ingredients</h2>
        <ul class="ingredients">${dish.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 class="steps-heading">Steps</h2>
        <ol class="steps">${dish.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        ${dish.safety ? `<p class="safety">${escapeHtml(dish.safety)}</p>` : ""}
        <p class="note">${escapeHtml(dish.storage)} This is a home recipe, not professional food-safety advice.</p>
        <div class="variations section-rule">
          <h2>Variations</h2>
          ${(dish.variations || []).length ? `<ul>${dish.variations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>The classic version is the one written above.</p>"}
        </div>
        <div class="pairings">
          <h2>Pairings</h2>
          <ul>${(dish.pairings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div id="print-actions" class="no-print button-row"></div>
        <div id="community-actions" class="no-print section-rule"></div>
        <section id="twists" class="no-print section-rule"></section>
        <section id="comments" class="no-print section-rule" aria-label="Comments"></section>
      </div>
      <aside class="rail">
        <figure class="dish-photo">
          <img src="${dish.photo}" alt="Original illustration of ${escapeHtml(dish.name)} over a fire" width="800" height="520">
          <figcaption>${escapeHtml(dish.photoCredit)}</figcaption>
        </figure>
        <div class="passport-stamp no-print" aria-hidden="true"><span>Arrived</span><strong>${escapeHtml(dish.country)}</strong><span>${escapeHtml(labelOf(BASE_TYPES, dish.baseType))}</span></div>
        <div class="origin-card">
          <h2>Origin</h2>
          <dl>
            <dt>Country</dt><dd>${escapeHtml(dish.country)}</dd>
            <dt>Region</dt><dd><a href="explore/region/${slugify(dish.region)}/">${escapeHtml(dish.region)}</a></dd>
            <dt>Locale</dt><dd>${escapeHtml(dish.locale || dish.country)}</dd>
            <dt>Culture</dt><dd>${escapeHtml(dish.culture)}</dd>
            <dt>Method</dt><dd><a href="explore/type/${dish.baseType}/">${escapeHtml(labelOf(BASE_TYPES, dish.baseType))}</a></dd>
            <dt>Heat</dt><dd>${escapeHtml(labelOf(HEATS, dish.heat))}</dd>
            <dt>Map</dt><dd>${escapeHtml(formatCoord(dish.lat, dish.lng))}</dd>
          </dl>
          ${originExtra}
          <p><a href="map/?country=${escapeHtml(dish.countryCode)}">See this stop on the route map</a></p>
        </div>
      </aside>
    </article>`
  });
}

function feature(region, copy, dishes) {
  const examples = dishes.filter((dish) => dish.region === region).slice(0, 3).map((dish) => dish.name).join(" · ");
  const count = dishes.filter((dish) => dish.region === region).length;
  return `<a class="feature" href="explore/region/${slugify(region)}/">
        <span class="count">${count} dishes</span>
        <p class="eyebrow">${escapeHtml(region)}</p>
        <h2>${escapeHtml(copy.title)}</h2>
        <p>${escapeHtml(copy.text)} ${escapeHtml(examples)}.</p>
      </a>`;
}

function explorePage({ title, description, current, crumbs, dishes, count }) {
  return page({
    title: `${title} · Flying BBQ`,
    description,
    current,
    pageName: "explore",
    dishCount: count,
    canonical: crumbs,
    extraHead: og(title, description, crumbs),
    main: `<div class="wrap">
      ${adSlot("explore_top")}
      <p class="eyebrow">Explore</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(description)}</p>
      <p class="results-count">${dishes.length} ${dishes.length === 1 ? "dish" : "dishes"}</p>
      <div class="grid">${dishes.map(card).join("\n") || "<p>None yet.</p>"}</div>
    </div>`
  });
}

function bookDishes(book, dishes) {
  if (book.slugs) {
    return book.slugs.map((slug) => dishes.find((dish) => dish.slug === slug)).filter(Boolean);
  }
  return dishes.filter(book.match);
}

function checkboxGroup(name, list) {
  return `<div class="checks">${list.map(([value, label]) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`).join("")}</div>`;
}

resetGenerated();
validate(DISHES);
const dishes = DISHES.map((dish) => ({
  ...dish,
  photo: writeIllustration(root, dish),
  photoCredit: "Original illustration for Flying BBQ of the World."
}));
dishes.sort((a, b) => a.name.localeCompare(b.name));
const count = dishes.length;

write("assets/images/hero.svg", heroSvg());
write("favicon.svg", faviconSvg());

const countryName = new Map(Object.entries(COUNTRY_NAMES));
for (const dish of dishes) countryName.set(dish.countryCode, dish.country);
const countryOptions = `<option value="">All countries</option>` + [...countryName.entries()]
  .filter(([code]) => dishes.some((dish) => countriesOf(dish).includes(code)))
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`)
  .join("");

const catalog = dishes.map((dish) => ({
  slug: dish.slug,
  name: dish.name,
  country: dish.country,
  countryCode: dish.countryCode,
  alsoCountries: dish.alsoCountries || [],
  region: dish.region,
  baseType: dish.baseType,
  heat: dish.heat,
  diets: dish.diets || [],
  uses: dish.uses,
  flavor: dish.flavor,
  search: searchText(dish)
}));
write("assets/js/catalog.js", `// Generated by scripts/build-site.mjs. Do not edit by hand.\nexport const DISH_COUNT = ${count};\nexport const COUNTRY_NAMES = ${JSON.stringify(Object.fromEntries(countryName))};\nexport const CATALOG = ${JSON.stringify(catalog)};\n`);
write("data/index.json", JSON.stringify({ count, growingTo: 1000, dishes: catalog }, null, 2));

const homeDesc = `A travel journal of barbecue and live-fire cooking: ${count} stops so far, with workable recipes, histories, and a route map. Growing to 1,000.`;
const features = [
  ["North America", { title: "The barbecue belt and the coasts", text: "Whole hog, brisket, mutton, pit beef, and the fires of the Atlantic and the Great Lakes." }],
  ["Mexico & Central America", { title: "Pits, trompos, and carne asada", text: "Barbacoa, pibil, al pastor, and the grilled meats of the isthmus." }],
  ["East Asia", { title: "Charcoal, forks, and table grills", text: "Char siu, lamb skewers, galbi, and yakitori." }],
  ["South America", { title: "Asado and churrasco", text: "Parrillas, spits, and the Saturday fire from the pampas to the Andes." }]
].map(([region, copy]) => feature(region, copy, dishes)).join("\n");
const journeyCards = JOURNEYS.slice(0, 4).map((journey) => `<a class="feature journey-card" href="journeys/${journey.slug}/">
        <span class="count">${escapeHtml(VEHICLES[journey.vehicle] || journey.vehicle)}</span>
        <p class="eyebrow">Journey</p>
        <h2>${escapeHtml(journey.title)}</h2>
        <p>${escapeHtml(journey.dek)}</p>
      </a>`).join("\n");

write("index.html", page({
  title: "Flying BBQ of the World",
  description: homeDesc,
  current: "home",
  pageName: "home",
  dishCount: count,
  canonical: `${ORIGIN}/`,
  extraHead: og("Flying BBQ of the World", homeDesc, `${ORIGIN}/`) + `
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Flying BBQ of the World",
    url: `${ORIGIN}/`,
    description: homeDesc,
    potentialAction: {
      "@type": "SearchAction",
      target: `${ORIGIN}/?q={query}`,
      "query-input": "required name=query"
    }
  })}</script>`,
  main: `<div class="wrap">
      <section class="hero">
        <div>
          <p class="eyebrow">A travel journal · Issue 01</p>
          <h1>Come aboard. The fire is already going.</h1>
          <p class="lede">This passport follows barbecue and live-fire cooking by hot-air balloon, plane, train, and boat. Each stop has a workable recipe, a history, and a reason the food tastes the way it does. This issue holds ${count} stops. The route is growing to 1,000.</p>
          <p class="button-row"><a class="button" href="map/">Open the route map</a> <a class="button button-quiet" href="journeys/">Curated journeys</a> <a class="button button-quiet" href="learn/who-settled-the-flavor/">Who settled the flavor</a></p>
        </div>
        <div class="hero-media">
          <img src="assets/images/hero.svg" alt="Original illustration of a hot-air balloon, a plane, a train, and a boat circling a small cook fire" width="800" height="520">
        </div>
      </section>
      ${adSlot("home_after_hero")}
      <section class="feature-band" aria-label="Journeys">
        ${journeyCards}
      </section>
      <section class="feature-band" aria-label="Regional features">
        <a class="feature" href="learn/who-settled-the-flavor/">
          <span class="count">United States</span>
          <p class="eyebrow">Feature</p>
          <h2>Who settled the flavor</h2>
          <p>How Native nations, Spanish and Caribbean barbacoa, enslaved Africans, and later immigrants shaped regional barbecue in the United States.</p>
        </a>
        ${features}
      </section>
      ${adSlot("home_mid")}
      <h2>Browse the passport</h2>
      ${filterForm(countryOptions)}
      <p id="results-count" class="results-count" aria-live="polite">${count} dishes</p>
      <p id="empty-results" hidden>No dishes match. Clear a filter and try a country, a heat level, or a single ingredient.</p>
      <div id="dish-list" class="grid">
        ${dishes.map(card).join("\n")}
      </div>
    </div>`
}));

const routePayload = JOURNEYS.map((journey) => ({
  slug: journey.slug,
  title: journey.title,
  vehicle: journey.vehicle,
  points: (journey.route || []).map((pair, index) => {
    const stop = dishes.find((dish) => dish.slug === journey.stops[index]);
    return { lat: pair[0], lng: pair[1], label: stop ? stop.name : (journey.stops[index] || "") };
  })
}));
write("assets/js/routes.js", `// Generated by scripts/build-site.mjs. Do not edit by hand.\nexport const JOURNEY_ROUTES = ${JSON.stringify(routePayload)};\n`);

const journeyIndex = JOURNEYS.map((journey) => {
  const stops = journey.stops.map((slug) => dishes.find((dish) => dish.slug === slug)).filter(Boolean);
  return `<article class="journey-card feature">
      <span class="count">${escapeHtml(VEHICLES[journey.vehicle] || journey.vehicle)}</span>
      <p class="eyebrow">${stops.length} stops</p>
      <h2><a href="journeys/${journey.slug}/">${escapeHtml(journey.title)}</a></h2>
      <p>${escapeHtml(journey.dek)}</p>
    </article>`;
}).join("\n");

write("map/index.html", page({
  title: "Route map · Flying BBQ",
  description: "A route map of barbecue journeys. Vehicle icons mark each leg. Countries are shaded by how many stops name them.",
  current: "map",
  pageName: "map",
  dishCount: count,
  canonical: `${ORIGIN}/map/`,
  extraHead: `<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">` + og("Route map", "A world route map of barbecue journeys.", `${ORIGIN}/map/`),
  extraFoot: `<script src="assets/vendor/leaflet/leaflet.js"></script>`,
  main: `<div class="wrap">
      ${adSlot("map_top")}
      <p class="eyebrow">Route map</p>
      <h1>The voyage, leg by leg</h1>
      <p class="lede">Colored lines are curated journeys. A small vehicle icon sits on each leg: balloon, plane, train, or boat. Countries are shaded by how many stops name them. Pins mark places too small to see as a shape. The lists under the map work without JavaScript.</p>
      <div class="journey-key">${JOURNEYS.map((journey) => `<a href="journeys/${journey.slug}/">${escapeHtml(VEHICLES[journey.vehicle] || journey.vehicle)} · ${escapeHtml(journey.title)}</a>`).join("")}</div>
      ${filterForm(countryOptions)}
      <p id="map-status" class="results-count" role="status">${count} dishes for all countries.</p>
      <div id="world-map" role="application" aria-label="World route map of barbecue journeys"></div>
      <div id="country-results" class="section-rule"></div>
      <h2>Journeys on this map</h2>
      <div class="journey-list">${JOURNEYS.map((journey) => {
        const stops = journey.stops.map((slug, index) => {
          const stop = dishes.find((dish) => dish.slug === slug);
          if (!stop) return "";
          return `<li><a href="dishes/${stop.slug}/">${escapeHtml(stop.name)}</a> · ${escapeHtml(stop.locale || stop.country)}${index < journey.stops.length - 1 ? ` · next leg by ${escapeHtml((VEHICLES[journey.vehicle] || journey.vehicle).toLowerCase())}` : ""}</li>`;
        }).join("");
        return `<section><h3><a href="journeys/${journey.slug}/">${escapeHtml(journey.title)}</a></h3><p>${escapeHtml(journey.dek)} Vehicle: ${escapeHtml(VEHICLES[journey.vehicle] || journey.vehicle)}.</p><ol>${stops}</ol></section>`;
      }).join("")}</div>
    </div>`
}));

write("journeys/index.html", page({
  title: "Journeys · Flying BBQ",
  description: "Curated voyages through barbecue and live-fire cooking, each with a vehicle and a next stop.",
  current: "journeys",
  pageName: "explore",
  dishCount: count,
  canonical: `${ORIGIN}/journeys/`,
  main: `<div class="wrap">
      <p class="eyebrow">Voyages</p>
      <h1>Curated journeys</h1>
      <p class="lede">These are reading routes, not official trails. Each one names the vehicle for the leg. On a stop that belongs to a journey, Next stop follows that route.</p>
      <div class="feature-band">${journeyIndex}</div>
    </div>`
}));

for (const journey of JOURNEYS) {
  const stops = journey.stops.map((slug) => dishes.find((dish) => dish.slug === slug)).filter(Boolean);
  if (stops.length < 3) throw new Error(`Journey ${journey.slug} is short`);
  const missing = journey.stops.filter((slug) => !dishes.some((dish) => dish.slug === slug));
  if (missing.length) throw new Error(`Journey ${journey.slug} missing ${missing.join(", ")}`);
  write(`journeys/${journey.slug}/index.html`, page({
    title: `${journey.title} · Flying BBQ`,
    description: journey.dek,
    current: "journeys",
    pageName: "explore",
    dishCount: count,
    canonical: `${ORIGIN}/journeys/${journey.slug}/`,
    main: `<article class="wrap prose">
        <p class="eyebrow">${escapeHtml(VEHICLES[journey.vehicle] || journey.vehicle)}</p>
        <h1>${escapeHtml(journey.title)}</h1>
        <p class="dek">${escapeHtml(journey.dek)}</p>
        ${journey.intro.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        <figure class="route-map">
          <img src="assets/images/journeys/${journey.slug}-route.svg" alt="Schematic route for ${escapeHtml(journey.title)}" width="800" height="360">
          <figcaption>A schematic of the journey, not a navigation chart. The vehicle on every leg is the ${escapeHtml((VEHICLES[journey.vehicle] || journey.vehicle).toLowerCase())}.</figcaption>
        </figure>
        <ol class="contents">
          ${stops.map((stop, index) => `<li><a href="dishes/${stop.slug}/">${escapeHtml(stop.name)}</a> · Arriving in ${escapeHtml(stop.locale || stop.country)}${index < stops.length - 1 ? ` · <a href="dishes/${stops[index + 1].slug}/">Next stop</a>` : ""}</li>`).join("")}
        </ol>
      </article>`
  }));
  const points = (journey.route || []).map((pair, index) => ({
    lat: pair[0],
    lng: pair[1],
    label: stops[index]?.country || ""
  }));
  write(`assets/images/journeys/${journey.slug}-route.svg`, routeMapSvg(points));
}

const exploreLinks = (items, hrefFor, labelFor) => items.map((item) => {
  const key = Array.isArray(item) ? item[0] : item;
  const label = labelFor(item);
  const n = dishes.filter((dish) => hrefFor.count(dish, key)).length;
  return `<a class="explore-card" href="${hrefFor.href(key)}"><p class="eyebrow">${n} dishes</p><h2>${escapeHtml(label)}</h2></a>`;
}).join("\n");

write("explore/index.html", page({
  title: "Explore · Flying BBQ",
  description: "Browse dishes by region, base type, and use.",
  current: "explore",
  pageName: "explore",
  dishCount: count,
  canonical: `${ORIGIN}/explore/`,
  main: `<div class="wrap">
      <p class="eyebrow">Explore</p>
      <h1>Three ways through the passport</h1>
      <h2>By region</h2>
      <div class="explore-grid">${exploreLinks(REGIONS, {
        href: (key) => `explore/region/${slugify(key)}/`,
        count: (dish, key) => dish.region === key
      }, ([name]) => name)}</div>
      <h2>By type</h2>
      <div class="explore-grid">${exploreLinks(BASE_TYPES, {
        href: (key) => `explore/type/${key}/`,
        count: (dish, key) => dish.baseType === key
      }, ([, label]) => label)}</div>
      <h2>By use</h2>
      <div class="explore-grid">${exploreLinks(USES, {
        href: (key) => `explore/use/${key}/`,
        count: (dish, key) => dish.uses.includes(key)
      }, ([, label]) => label)}</div>
    </div>`
}));

for (const [name] of REGIONS) {
  const group = dishes.filter((dish) => dish.region === name);
  if (!group.length) continue;
  const url = `${ORIGIN}/explore/region/${slugify(name)}/`;
  write(`explore/region/${slugify(name)}/index.html`, explorePage({
    title: name,
    description: `${group.length} dishes from ${name}.`,
    current: "explore",
    crumbs: url,
    dishes: group,
    count
  }));
}
for (const [id, label] of BASE_TYPES) {
  const group = dishes.filter((dish) => dish.baseType === id);
  if (!group.length) continue;
  write(`explore/type/${id}/index.html`, explorePage({
    title: label,
    description: `${group.length} dishes with the base type ${label}.`,
    current: "explore",
    crumbs: `${ORIGIN}/explore/type/${id}/`,
    dishes: group,
    count
  }));
}
for (const [id, label] of USES) {
  const group = dishes.filter((dish) => dish.uses.includes(id));
  if (!group.length) continue;
  write(`explore/use/${id}/index.html`, explorePage({
    title: label,
    description: `Dishes used for ${label.toLowerCase()}.`,
    current: "explore",
    crumbs: `${ORIGIN}/explore/use/${id}/`,
    dishes: group,
    count
  }));
}

for (const dish of dishes) write(`dishes/${dish.slug}/index.html`, dishPage(dish, count, dishes));

const centroids = loadCentroids();
const builtBooks = BOOKS.map((book) => {
  const members = bookDishes(book, dishes);
  const missing = (book.slugs || []).filter((slug) => !dishes.some((dish) => dish.slug === slug));
  if (missing.length) throw new Error(`Book ${book.slug} is missing ${missing.join(", ")}`);
  if (members.length < 3) throw new Error(`Book ${book.slug} has only ${members.length} dishes`);
  const price = SHOP.prices[book.slug] || SHOP.defaultPrice;
  return { ...book, members, price };
});
if (builtBooks.some((book) => book.slug === "top-100-bbq" && book.members.length !== 100)) {
  const found = builtBooks.find((book) => book.slug === "top-100-bbq");
  throw new Error(`Top 100 book has ${found?.members.length || 0} dishes`);
}

const quote = boxSetQuote(builtBooks.map((book) => book.price), SHOP.boxSetDiscount);
write("assets/images/books/complete-collection.svg", boxSetCoverSvg());
write("assets/js/shop-config.js", `// Generated from data/shop.js. Placeholder prices, not final.\nwindow.FLYING_BBQ_SHOP = ${JSON.stringify({
  openingSoon: SHOP.openingSoon,
  pricesAreFinal: SHOP.pricesAreFinal,
  notifyEmail: SHOP.notifyEmail,
  boxSetDiscount: SHOP.boxSetDiscount,
  products: builtBooks.map((book) => ({
    id: book.slug,
    name: book.title,
    pricePlaceholder: book.price,
    page: `books/${book.slug}/`
  })),
  boxSet: {
    id: "complete-collection",
    name: "Complete Collection",
    page: "shop/complete-collection/",
    discount: SHOP.boxSetDiscount
  }
}, null, 2)};\n`);

function buyBox(title, price) {
  return `<aside class="buy-box no-print">
      <p class="status-pill">Coming soon</p>
      <p class="price">${escapeHtml(priceLabel(price, SHOP))}</p>
      <p><a class="button" href="${escapeHtml(notifyHref(SHOP, title))}">Coming soon</a></p>
    </aside>`;
}

function bookRoute(book) {
  if (book.route?.length) {
    return book.route.map((pair, index) => ({
      lat: pair[0],
      lng: pair[1],
      label: book.members[index]?.country || ""
    }));
  }
  const seen = new Set();
  const points = [];
  for (const dish of book.members) {
    if (seen.has(dish.countryCode)) continue;
    seen.add(dish.countryCode);
    const center = centroids[dish.countryCode];
    if (!center) continue;
    points.push({ lat: center[0], lng: center[1], label: dish.country });
  }
  return points;
}

const boxCard = `<a class="book-card box-card" href="shop/complete-collection/">
        <img src="assets/images/books/complete-collection.svg" alt="Cover design for the Complete Collection box set" width="800" height="520">
        <p class="eyebrow">Box set · Save 30%</p>
        <h2>Complete Collection</h2>
        <p>Every field book in this issue. The set price is 30% off the sum of the individual placeholder prices.</p>
        <p class="price">${escapeHtml(priceLabel(quote.total, SHOP))}</p>
      </a>`;

write("books/index.html", page({
  title: "Recipe books · Flying BBQ",
  description: "Flagship recipe books and field booklets, printable now. Buying the books is coming soon. Prices are placeholders.",
  current: "books",
  pageName: "books",
  dishCount: count,
  canonical: `${ORIGIN}/books/`,
  main: `<div class="wrap">
      <p class="eyebrow">Field books</p>
      <h1>Recipe books</h1>
      <p class="lede">Curated books for a later print or download edition, plus the use-based booklets. You can read and print them now. The buy buttons say coming soon, and every price is a placeholder, not an offer.</p>
      <div class="book-list">
        ${boxCard}
        ${builtBooks.map((book) => `<a class="book-card" href="books/${book.slug}/">
          <img src="assets/images/books/${book.slug}.svg" alt="Cover design for ${escapeHtml(book.title)}" width="600" height="800">
          <p class="eyebrow">${book.members.length} dishes · ${escapeHtml(priceLabel(book.price, SHOP))}</p>
          <h2>${escapeHtml(book.title)}</h2>
          <p>${escapeHtml(book.dek)}</p>
        </a>`).join("\n")}
      </div>
    </div>`
}));

write("shop/index.html", page({
  title: "Shop · Flying BBQ",
  description: "Coming soon: printable recipe books. Prices are placeholders, not final.",
  current: "shop",
  pageName: "shop",
  dishCount: count,
  canonical: `${ORIGIN}/shop/`,
  main: `<div class="wrap">
      <p class="status-pill">Coming soon</p>
      <h1>Shop</h1>
      <p class="lede">The books can be read and printed now. Selling them comes later. Prices below are placeholders, not an offer and not final. Nothing is for sale while this sign is up.</p>
      <div class="book-list">
        ${boxCard}
        ${builtBooks.map((book) => `<a class="book-card" href="books/${book.slug}/"><p class="eyebrow">${escapeHtml(priceLabel(book.price, SHOP))}</p><h2>${escapeHtml(book.title)}</h2><p>${escapeHtml(book.dek)}</p></a>`).join("\n")}
      </div>
    </div>`
}));

write("shop/complete-collection/index.html", page({
  title: "Complete Collection · Flying BBQ",
  description: "The box set of every Flying BBQ recipe book. The price is 30% off the sum of the individual placeholder prices.",
  current: "shop",
  pageName: "shop",
  dishCount: count,
  canonical: `${ORIGIN}/shop/complete-collection/`,
  main: `<article class="wrap book-hero">
      <img class="cover" src="assets/images/books/complete-collection.svg" alt="Original cover design for the Complete Collection box set" width="800" height="520">
      <div>
        <p class="status-pill">Coming soon</p>
        <h1>Complete Collection</h1>
        <p class="dek">Every recipe book in this issue, in one set. The discount is 30% off the sum of the individual placeholder prices. It is computed from those prices, not typed in as a separate amount.</p>
        <p class="save-flag">Save 30%</p>
        <ul class="price-lines">
          <li>Individual books, added up: ${escapeHtml(priceLabel(quote.sum, SHOP))}</li>
          <li>You save: ${escapeHtml(priceLabel(quote.savings, SHOP))}</li>
          <li>Set price: ${escapeHtml(priceLabel(quote.total, SHOP))}</li>
        </ul>
        ${buyBox("Complete Collection", quote.total)}
        <p class="note">Placeholder prices, not final. No checkout is turned on.</p>
      </div>
      <h2>Books in the set</h2>
      <ol class="contents">
        ${builtBooks.map((book) => `<li><a href="books/${book.slug}/">${escapeHtml(book.title)}</a> · ${escapeHtml(priceLabel(book.price, SHOP))}</li>`).join("")}
      </ol>
    </article>`
}));

for (const book of builtBooks) {
  const url = `${ORIGIN}/books/${book.slug}/`;
  const coverPath = `assets/images/books/${book.slug}.svg`;
  write(coverPath, bookCoverSvg({ title: book.title, eyebrow: "Flying BBQ", vehicle: book.vehicle || "plane" }));
  const route = bookRoute(book);
  const routePath = `assets/images/books/${book.slug}-route.svg`;
  write(routePath, routeMapSvg(route));
  const continents = [];
  for (const dish of book.members) {
    const name = continentOf(dish.region);
    if (name && !continents.includes(name)) continents.push(name);
  }
  const continentLine = book.slug === "top-100-bbq"
    ? `<p>This reading route crosses ${continents.length} continents: ${escapeHtml(continents.join(", "))}.</p>`
    : "";
  write(`books/${book.slug}/index.html`, page({
    title: `${book.title} · Flying BBQ`,
    description: book.dek,
    current: "books",
    pageName: "book",
    dishCount: count,
    canonical: url,
    extraHead: og(book.title, book.dek, url),
    main: `<article class="wrap book">
        <div class="book-hero">
          <img class="cover" src="${coverPath}" alt="Original cover design for ${escapeHtml(book.title)}" width="600" height="800">
          <header class="book-cover">
            <p class="eyebrow">Recipe book${book.vehicle ? ` · ${escapeHtml(book.vehicle)}` : ""}</p>
            <h1>${escapeHtml(book.title)}</h1>
            <p class="dek">${escapeHtml(book.dek)}</p>
            ${book.intro.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
            ${continentLine}
            ${book.selectionNote ? `<aside class="authentic-touch"><h2>How this list was chosen</h2><p>${escapeHtml(book.selectionNote)}</p></aside>` : ""}
            ${buyBox(book.title, book.price)}
            <p class="no-print"><button id="print-book" type="button">Print this book</button></p>
            ${adSlot("book_after_intro")}
          </header>
        </div>
        <h2>Route</h2>
        <figure class="route-map">
          <img src="${routePath}" alt="Schematic route for ${escapeHtml(book.title)}" width="800" height="360">
          <figcaption>A schematic of the route, not a navigation chart.</figcaption>
        </figure>
        <h2>Contents</h2>
        <ol class="contents">
          ${book.members.map((dish, index) => `<li><a href="dishes/${dish.slug}/">${escapeHtml(dish.name)}</a> · ${escapeHtml(dish.country)} · <a href="#dish-${dish.slug}">recipe ${index + 1}</a></li>`).join("")}
        </ol>
        ${book.members.map((dish) => `<article class="book-recipe" id="dish-${dish.slug}">
          <p class="meta">${escapeHtml(dish.country)} · ${escapeHtml(labelOf(HEATS, dish.heat))} · ${escapeHtml(dish.yieldText)}</p>
          ${recipeBody(dish, { book: true }).replace("<h2 class=\"dish-title\"></h2>", `<h2 class="dish-title">${escapeHtml(dish.name)}</h2>`)}
          <p class="no-print"><a href="dishes/${dish.slug}/">Open the field-guide page</a></p>
        </article>`).join("\n")}
      </article>`
  }));
}

function loadCentroids() {
  const data = JSON.parse(fs.readFileSync(path.join(root, "assets/maps/countries.geojson"), "utf8"));
  const map = {};
  for (const feature of data.features) {
    const iso = feature.properties.iso;
    let minX = 180;
    let maxX = -180;
    let minY = 90;
    let maxY = -90;
    const walk = (node) => {
      if (typeof node?.[0] === "number") {
        minX = Math.min(minX, node[0]);
        maxX = Math.max(maxX, node[0]);
        minY = Math.min(minY, node[1]);
        maxY = Math.max(maxY, node[1]);
        return;
      }
      if (Array.isArray(node)) node.forEach(walk);
    };
    walk(feature.geometry?.coordinates);
    if (minX <= maxX) map[iso] = [(minY + maxY) / 2, (minX + maxX) / 2];
  }
  return map;
}

write("learn/who-settled-the-flavor/index.html", page({
  title: "Who Settled the Flavor · Flying BBQ",
  description: "How Native nations, Spanish and Caribbean barbacoa, enslaved Africans, and later immigrants shaped barbecue in the United States.",
  current: "settled",
  pageName: "static",
  dishCount: count,
  canonical: `${ORIGIN}/learn/who-settled-the-flavor/`,
  main: `<article class="wrap prose">
      <p class="eyebrow">United States</p>
      <h1>Who settled the flavor</h1>
      <p class="lede">Regional barbecue in the United States is a creole food. No one people owns the whole map. This note stays with what can be said plainly, and it links to the stops.</p>
      ${SETTLED.map((section) => `<section><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</section>`).join("\n")}
    </article>`
}));

write("learn/fire-101/index.html", page({
  title: "Fire 101 · Flying BBQ",
  description: "Heat, smoke, safe temperatures, wood, and earth ovens, explained for the home fire.",
  current: "learn",
  pageName: "static",
  dishCount: count,
  canonical: `${ORIGIN}/learn/fire-101/`,
  main: `<article class="wrap prose">
      <p class="eyebrow">School</p>
      <h1>Fire 101</h1>
      <p class="lede">A short course in the fire itself: heat, smoke, the stall, safe temperatures, wood, and earth ovens.</p>
      ${DISH_101.map((section) => `<section><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("\n")}
      <p><a href="learn/glossary/">Read the glossary</a></p>
    </article>`
}));

write("learn/glossary/index.html", page({
  title: "Glossary · Flying BBQ",
  description: "A glossary of live-fire words, from bark and stall to hāngi, suya, and tare.",
  current: "learn",
  pageName: "static",
  dishCount: count,
  canonical: `${ORIGIN}/learn/glossary/`,
  main: `<article class="wrap prose">
      <p class="eyebrow">School</p>
      <h1>Glossary</h1>
      <dl class="glossary">
        ${GLOSSARY.map(([term, definition]) => `<dt id="${slugify(term)}">${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd>`).join("\n")}
      </dl>
    </article>`
}));

function prosePage({ file, canonical, title, description, current, paragraphs, robots = "" }) {
  write(file, page({
    title: `${title} · Flying BBQ`,
    description,
    current,
    pageName: "static",
    dishCount: count,
    robots,
    canonical: `${ORIGIN}/${canonical}`,
    main: `<article class="wrap prose"><h1>${escapeHtml(title)}</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</article>`
  }));
}

prosePage({
  file: "about/index.html",
  canonical: "about/",
  title: "About",
  description: "What Flying BBQ of the World is, and how the recipes and histories were chosen.",
  current: "about",
  paragraphs: [
    `Flying BBQ of the World is a travel journal of barbecue and live-fire cooking. This issue has ${count} stops. The public goal is 1,000. The count on the site is the number of edited entries.`,
    "Each stop reads like an arrival. It has a workable home recipe with a safe cooking temperature, an origin, a history, a cultural note, a section called Why it tastes this way, an authentic touch, and a next stop. If a popular origin story is disputed, the page says so or leaves it out.",
    "Illustrations are drawn for this site. They are not photographs of people, and they are not borrowed marks. The route map uses Natural Earth country shapes and Leaflet, with no paid map key. Curated journeys draw a vehicle on each leg.",
    "The community tools follow the same pattern as the related project <a href=\"https://jonldavis-coder.github.io/flying-sauces/\">Flying Sauces</a>: comments, hearts, star ratings, and reader submissions. Additions, called twists, are a reader’s change to a published recipe. Until Supabase is connected, a banner says that those notes stay in the browser.",
    "<a href=\"learn/who-settled-the-flavor/\">Who settled the flavor</a> is the United States essay on Native foodways, Spanish and Caribbean barbacoa, enslaved Africans, and later immigrants.",
    "The site is published by jonldavis-coder and hosted on GitHub Pages from the main branch."
  ]
});

prosePage({
  file: "guidelines/index.html",
  canonical: "guidelines/",
  title: "Community guidelines",
  description: "Rules for comments, twists, and submitted dishes.",
  current: "about",
  paragraphs: [
    "Be specific and decent. Comment on the dish, not on a person.",
    "A twist is your change to a published recipe. Say what you changed. Do not present a twist as the classic.",
    "Do not submit a copied paywalled recipe, a fabricated history, or instructions for making someone sick.",
    "Do not post garlic-in-oil storage tricks, home canning times, or raw bitter-cassava processing. Refrigerator dishes and commercial cassareep or tucupi are as far as this site goes.",
    "The owner can hide comments, twists, and submitted dishes. Reports are for spam, harassment, dangerous instructions, and recipes that are simply wrong."
  ]
});

prosePage({
  file: "affiliate/index.html",
  canonical: "affiliate/",
  title: "Affiliate disclosure",
  description: "How affiliate links and ads would be labeled if they are added.",
  current: "about",
  paragraphs: [
    "This draft explains the policy. It is not a legal contract.",
    "Flying BBQ does not currently run advertisements. The ads configuration is set to provider “none”, and the empty slots are hidden. They are omitted from print views even if a provider is turned on later.",
    "There are no affiliate links in this issue. If a link later earns a commission, the page that carries it will say so near the link. A commission would not change the recipe or the history.",
    "Product names appear only to identify a well-known commercial example of a style, such as a bottled dish from a known maker. Naming a product is not an endorsement and not an offer to sell it."
  ]
});

prosePage({
  file: "privacy/index.html",
  canonical: "privacy/",
  title: "Privacy",
  description: "Draft privacy notes for Flying BBQ.",
  current: "about",
  paragraphs: [
    "This is a draft, not a lawyer’s privacy policy.",
    "The field guide itself is static files on GitHub Pages. In demo mode, accounts, comments, hearts, ratings, twists, and submitted dishes are stored in your browser’s localStorage. They are not sent to a server. Anyone with access to that browser profile can read them.",
    "If Supabase is connected later, account email, display name, comments, ratings, hearts, twists, reports, and submitted dishes are stored in that project. The anon key is public. Row level security is what limits access. The service-role key is never placed in this repository.",
    "The ads provider is none, and this repository does not include an analytics tracker. Type on the pages may be requested from Google Fonts, which is a third-party request. The map file and Leaflet are served from this site.",
    "Do not submit another person’s private information in a comment or a dish."
  ]
});

prosePage({
  file: "terms/index.html",
  canonical: "terms/",
  title: "Terms",
  description: "Draft terms for using Flying BBQ.",
  current: "about",
  paragraphs: [
    "This is a draft for readers, not legal advice and not a complete contract.",
    "Recipes are home cooking notes. You are responsible for allergens, doneness, and storage. The diet tags match the written recipe and are not a medical diet.",
    "You keep your own words when you comment, add a twist, or submit a dish. You give the site permission to display them on the field guide. Do not post what you do not have the right to post.",
    "The owner may remove community posts. The edited field guide can be corrected when a history or a recipe is wrong.",
    "The site is offered as-is. Counts, maps, and pages can change as the guide grows toward 1,000 dishes."
  ]
});

write("404.html", page({
  title: "Page not found · Flying BBQ",
  description: "That page is not in the field guide.",
  current: "",
  pageName: "static",
  robots: "noindex",
  dishCount: count,
  main: `<div class="wrap prose"><h1>That page is not on the map</h1><p>The link may be mistyped, or the dish may not be in this issue yet.</p><p><a class="button" href="index.html">Back to the field guide</a></p></div>`
}));

write("login.html", page({
  title: "Sign in · Flying BBQ",
  description: "Sign in to rate, comment, heart, and submit a dish.",
  current: "",
  pageName: "auth",
  robots: "noindex",
  dishCount: count,
  main: `<div class="wrap prose">
      <h1>Sign in</h1>
      <p id="auth-status" role="status"></p>
      <form id="signin-form" class="form-card" data-auth>
        <h2>Have an account</h2>
        <label for="signin-email">Email</label>
        <input id="signin-email" name="email" type="email" autocomplete="username" required>
        <label for="signin-password">Password</label>
        <input id="signin-password" name="password" type="password" autocomplete="current-password" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Sign in</button>
      </form>
      <form id="signup-form" class="form-card" data-auth>
        <h2>Create an account</h2>
        <label for="display-name">Display name</label>
        <input id="display-name" name="displayName" maxlength="40" required>
        <label for="signup-email">Email</label>
        <input id="signup-email" name="email" type="email" autocomplete="username" required>
        <label for="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autocomplete="new-password" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Create account</button>
      </form>
      <form id="magic-form" class="form-card" data-auth>
        <h2>Email a one-time link</h2>
        <label for="magic-email">Email</label>
        <input id="magic-email" name="email" type="email" autocomplete="username" required>
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Send a link</button>
      </form>
    </div>`
}));

write("moderate.html", page({
  title: "Moderate · Flying BBQ",
  description: "Owner tools for hiding community posts.",
  current: "",
  pageName: "moderate",
  robots: "noindex",
  dishCount: count,
  main: `<div class="wrap prose"><h1>Moderation desk</h1><div id="moderate-root"></div></div>`
}));

write("submit.html", page({
  title: "Submit a dish · Flying BBQ",
  description: "Submit a dish that is not already in the field guide.",
  current: "submit",
  pageName: "submit",
  dishCount: count,
  canonical: `${ORIGIN}/submit.html`,
  main: `<div class="wrap">
      <h1>Submit a dish</h1>
      <p class="lede">Use this for a real dish that is missing from the guide. For a change to a published recipe, add a twist on that dish’s page.</p>
      <p id="submit-auth-note" class="note" hidden></p>
      <form id="submit-form" class="form-card">
        <label for="name">Name</label>
        <input id="name" name="name" required maxlength="120">
        <label for="country">Country</label>
        <input id="country" name="country" required maxlength="60">
        <label for="region">Region</label>
        <select id="region" name="region" required>${selectOptions(REGIONS.map(([name]) => [name, name]), "Choose a region")}</select>
        <label for="baseType">Fire method</label>
        <select id="baseType" name="baseType" required>${selectOptions(BASE_TYPES, "Choose a type")}</select>
        <label for="heat">Heat</label>
        <select id="heat" name="heat" required>${selectOptions(HEATS, "Choose a heat")}</select>
        <label for="flavor">Flavor, in one line</label>
        <input id="flavor" name="flavor" required maxlength="400">
        <label for="story">Origin note</label>
        <textarea id="story" name="story" required maxlength="2000" rows="5"></textarea>
        <label for="funFact">One field note</label>
        <input id="funFact" name="funFact" required maxlength="400">
        <label for="yieldText">Yield</label>
        <input id="yieldText" name="yieldText" required maxlength="80" placeholder="about 1 cup">
        <label for="servings">Servings</label>
        <input id="servings" name="servings" type="number" min="1" max="100" required>
        <label for="prepMinutes">Prep minutes</label>
        <input id="prepMinutes" name="prepMinutes" type="number" min="0" max="1440" required>
        <label for="cookMinutes">Cook minutes</label>
        <input id="cookMinutes" name="cookMinutes" type="number" min="0" max="1440" required>
        <fieldset><legend>Uses</legend>${checkboxGroup("uses", USES)}</fieldset>
        <fieldset><legend>Diet, if the recipe matches</legend>${checkboxGroup("diets", DIETS)}</fieldset>
        <label for="ingredients">Ingredients, one per line</label>
        <textarea id="ingredients" name="ingredients" required rows="8"></textarea>
        <label for="steps">Steps, one per line</label>
        <textarea id="steps" name="steps" required rows="8"></textarea>
        <label for="photo">Optional picture, illustration or food only</label>
        <input id="photo" name="photo" type="file" accept="image/*">
        <p class="visually-hidden"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
        <p class="form-error" role="alert"></p>
        <button type="submit">Submit dish</button>
      </form>
    </div>`
}));

write("dish.html", page({
  title: "Community dish · Flying BBQ",
  description: "A dish submitted by a reader.",
  current: "home",
  pageName: "dynamic",
  robots: "noindex",
  dishCount: count,
  main: `<div class="wrap"><article id="dish-root"></article><noscript><p>This page needs JavaScript to show a dish saved in the browser.</p></noscript></div>`
}));

const urls = [];
function collect(rel) {
  if (!rel.endsWith(".html")) return;
  if (["404.html", "login.html", "moderate.html", "dish.html"].includes(rel)) return;
  if (rel === "index.html") urls.push(`${ORIGIN}/`);
  else if (rel.endsWith("/index.html")) urls.push(`${ORIGIN}/${rel.slice(0, -"index.html".length)}`);
  else urls.push(`${ORIGIN}/${rel}`);
}
function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (["node_modules", "scripts", "test", "supabase", "data", "assets"].includes(entry.name) && prefix === "") continue;
      walk(path.join(dir, entry.name), rel);
    } else if (entry.name.endsWith(".html")) collect(rel);
  }
}
walk(root);
const uniqueUrls = [...new Set(urls)].sort();
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map((loc) => `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write(".nojekyll", "");

console.log(`Built ${count} dishes, ${builtBooks.length} books, ${uniqueUrls.length} sitemap URLs.`);
