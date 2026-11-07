import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES } from "../data/dishes/index.js";
import { continentOf } from "../data/vocabulary.js";
import { matchesDish } from "../assets/js/lib/filter.js";
import { summarizeRatings } from "../assets/js/lib/ratings.js";
import { createDemoAdapter } from "../assets/js/demo-adapter.js";
import { isSupabaseConfigured } from "../assets/js/adapter.js";
import { boxSetQuote, priceLabel } from "../assets/js/lib/shop.js";
import { FLAGSHIP_BOOKS } from "../data/flagship-books.js";
import { JOURNEYS } from "../data/journeys.js";
import { SHOP } from "../data/shop.js";

const root = path.resolve(import.meta.dirname, "..");

function memoryStorage() {
  let raw = null;
  return {
    load() {
      return raw ? JSON.parse(raw) : null;
    },
    save(next) {
      raw = JSON.stringify(next);
    }
  };
}

test("the passport has at least 250 real dishes and taste notes", () => {
  assert.ok(DISHES.length >= 250);
  const slugs = new Set();
  const continents = new Set();
  for (const dish of DISHES) {
    assert.equal(slugs.has(dish.slug), false);
    slugs.add(dish.slug);
    assert.ok(dish.whyItTastes.length >= 80);
    assert.ok(dish.authenticTouch.length >= 40);
    assert.ok(dish.funFacts.length >= 1 && dish.funFacts.length <= 3);
    assert.ok(dish.ingredients.length >= 3);
    assert.ok(dish.steps.length >= 3);
    continents.add(continentOf(dish.region));
    const blob = `${dish.history} ${dish.background} ${dish.whyItTastes}`;
    assert.equal(/national geographic|natgeo/i.test(blob), false);
  }
  for (const name of ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]) {
    assert.equal(continents.has(name), true);
  }
});

test("filters match region, heat, use, and diet", () => {
  const item = {
    region: "North America",
    baseType: "low-and-slow",
    heat: "mild",
    uses: ["beef"],
    diets: ["gluten-free"],
    countries: ["US"],
    search: "brisket texas"
  };
  assert.equal(matchesDish(item, { query: "texas" }), true);
  assert.equal(matchesDish(item, { region: "North America", use: "beef" }), true);
  assert.equal(matchesDish(item, { diet: "vegan" }), false);
});

test("ratings average once", () => {
  assert.deepEqual(summarizeRatings([5, 4]), { ratingAvg: 4.5, ratingCount: 2 });
});

test("demo mode stores a heart, a rating, a comment, and a twist", async () => {
  const demo = createDemoAdapter({}, { storage: memoryStorage() });
  const human = { honeypot: "", openedAt: Date.now() - 5000 };
  await demo.signUp({ email: "cook@example.com", password: "longpassword", displayName: "Cook" }, human);
  const slug = "central-texas-brisket";
  const rated = await demo.setRating(slug, 5);
  assert.equal(rated.myRating, 5);
  const heart = await demo.setHeart(slug, true);
  assert.equal(heart.heartedByMe, true);
  await demo.addComment(slug, "The pepper bark should stay coarse.", human);
  await demo.addTwist(slug, { title: "Oak", body: "I used red oak because post oak was not in the wood pile." }, human);
  assert.equal((await demo.listComments(slug)).length, 1);
  assert.equal((await demo.listTwists(slug)).length, 1);
});

test("supabase stays off until both slots are filled", () => {
  assert.equal(isSupabaseConfigured({ SUPABASE_URL: "", SUPABASE_ANON_KEY: "" }), false);
  const config = fs.readFileSync(path.join(root, "config.js"), "utf8");
  assert.match(config, /SUPABASE_URL:\s*""/);
  assert.match(config, /SUPABASE_ANON_KEY:\s*""/);
  const ads = fs.readFileSync(path.join(root, "ads-config.js"), "utf8");
  assert.match(ads, /provider:\s*"none"/);
});

test("the box set is 30 percent off the sum of placeholder book prices", () => {
  assert.equal(SHOP.openingSoon, true);
  assert.equal(SHOP.pricesAreFinal, false);
  assert.equal(SHOP.boxSetDiscount, 0.3);
  const quote = boxSetQuote([10, 10], 0.3);
  assert.equal(quote.sum, 20);
  assert.equal(quote.savings, 6);
  assert.equal(quote.total, 14);
  assert.match(priceLabel("14", SHOP), /Placeholder price/);
  assert.match(priceLabel("14", SHOP), /not final/);
  const top = FLAGSHIP_BOOKS.find((book) => book.slug === "top-100-bbq");
  assert.equal(top.slugs.length, 100);
  assert.match(top.selectionNote, /not a ranking/i);
  const appalachia = FLAGSHIP_BOOKS.find((book) => book.slug === "appalachian-smoke");
  for (const slug of ["appalachian-hickory-shoulder", "sorghum-pork-chops", "country-ham-steak", "appalachian-chow-chow"]) {
    assert.equal(appalachia.slugs.includes(slug), true);
  }
  const belt = JOURNEYS.find((journey) => journey.slug === "american-bbq-belt");
  assert.equal(belt.vehicle, "train");
  assert.ok(belt.stops.includes("central-texas-brisket"));
  assert.ok(belt.stops.includes("eastern-nc-whole-hog"));
});

test("pages, route map, books, and taste sections were generated", () => {
  assert.equal(fs.existsSync(path.join(root, ".nojekyll")), true);
  assert.equal(fs.existsSync(path.join(root, "sitemap.xml")), true);
  assert.equal(fs.existsSync(path.join(root, "robots.txt")), true);
  assert.equal(fs.existsSync(path.join(root, "supabase/schema.sql")), true);
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /Growing to 1,000/);
  assert.match(home, /Come aboard/);
  assert.match(home, new RegExp(`${DISHES.length} stops`));
  const dish = fs.readFileSync(path.join(root, "dishes/central-texas-brisket/index.html"), "utf8");
  assert.match(dish, /Arriving in/);
  assert.match(dish, /Next stop/);
  assert.match(dish, /Why it tastes this way/);
  assert.match(dish, /Authentic touch/);
  assert.match(dish, /application\/ld\+json/);
  assert.match(dish, /195/);
  const book = fs.readFileSync(path.join(root, "books/top-100-bbq/index.html"), "utf8");
  assert.match(book, /Why it tastes this way/);
  assert.match(book, /not a ranking/i);
  assert.match(book, /continents/);
  const box = fs.readFileSync(path.join(root, "shop/complete-collection/index.html"), "utf8");
  assert.match(box, /Save 30%/);
  assert.match(box, /Coming soon/);
  const settled = fs.readFileSync(path.join(root, "learn/who-settled-the-flavor/index.html"), "utf8");
  assert.match(settled, /Who settled the flavor/);
  assert.match(settled, /enslaved/i);
  const map = fs.readFileSync(path.join(root, "map/index.html"), "utf8");
  assert.match(map, /vehicle/i);
  assert.match(map, /American BBQ Belt/);
  const css = fs.readFileSync(path.join(root, "assets/css/styles.css"), "utf8");
  assert.match(css, /@media print/);
  assert.match(css, /\.ad-slot/);
});
