#!/usr/bin/env python3
"""Turn the entry modules into the site's data files."""

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path("/workspace")
SCRIPTS = ROOT / "scripts"

MODULES = [
    "entries_us",
    "entries_americas",
    "entries_europe_africa",
    "entries_asia_oceania",
]

COVERAGE_FILL = {
    "pakistani-sajji": ["Pakistan"],
    "pakistani-chapli-kebab": ["Pakistan"],
    "nepali-sekuwa": ["Nepal"],
    "sri-lankan-grilled-prawns": ["Sri Lanka"],
    "afghan-tikka": ["Afghanistan"],
    "taiwanese-grilled-sausage": ["Taiwan"],
    "mongolian-khorkhog": ["Mongolia"],
}

TOP = [
    "central-texas-brisket", "eastern-nc-whole-hog", "lexington-pork-shoulder", "south-carolina-mustard-pork",
    "memphis-dry-ribs", "kansas-city-burnt-ends", "alabama-white-chicken", "kentucky-mutton",
    "south-texas-barbacoa", "santa-maria-tri-tip", "kalua-pig", "huli-huli-chicken",
    "chicago-rib-tips", "st-louis-pork-steaks", "appalachian-hickory-shoulder", "cornell-chicken",
    "baltimore-pit-beef", "northwest-cedar-salmon", "cajun-cochon-de-lait", "new-england-clambake",
    "west-texas-mesquite-beef", "texas-beef-plate-ribs", "yucatan-cochinita-pibil", "poc-chuc",
    "mexico-city-al-pastor", "sonoran-carne-asada", "monterrey-cabrito", "oaxacan-tasajo",
    "yucatan-tikin-xic", "jamaican-jerk-chicken", "jamaican-jerk-pork", "cuban-lechon-asado",
    "puerto-rican-lechon", "haitian-boukannen", "trinidad-grilled-kingfish", "guatemalan-churrasco",
    "argentine-asado", "argentine-vacio", "choripan", "brazilian-picanha", "brazilian-costela",
    "peruvian-anticuchos", "peruvian-pollo-a-la-brasa", "peruvian-pachamanca", "chiloe-curanto",
    "patagonian-cordero-al-asador", "colombian-carne-llanera", "chimichurri",
    "english-hog-roast", "spanish-espetos", "spanish-calcots", "spanish-chuletillas",
    "portuguese-sardines", "portuguese-frango-churrasco", "greek-spit-lamb", "greek-souvlaki",
    "italian-fiorentina", "abruzzo-arrosticini", "german-schwenker", "finnish-loimulohi",
    "bosnian-cevapi", "uzbek-shashlik", "turkish-adana-kebab", "turkish-cag-kebab",
    "lebanese-shish-taouk", "iraqi-masgouf", "iranian-koobideh", "iranian-joojeh",
    "omani-shuwa", "yemeni-mandi", "nigerian-suya", "ghanaian-grilled-tilapia",
    "senegalese-dibi", "south-african-boerewors", "cape-malay-sosaties", "kenyan-nyama-choma",
    "mozambican-peri-peri-chicken", "moroccan-mechoui", "tandoori-chicken", "seekh-kebab",
    "pakistani-sajji", "thai-gai-yang", "char-siu", "xinjiang-lamb-skewers",
    "korean-galbi", "korean-samgyeopsal", "japanese-yakitori", "japanese-yakiniku",
    "filipino-lechon", "balinese-babi-guling", "maori-hangi", "fijian-lovo",
    "australian-lamb-chops", "peking-duck", "siu-yuk", "paneer-tikka",
    "ethiopian-tibs", "door-county-fish-boil", "vietnamese-bun-cha", "dominican-wasakaka-chicken",
]

BELT = [
    "eastern-nc-whole-hog", "lexington-pork-shoulder", "south-carolina-mustard-pork",
    "alabama-white-chicken", "memphis-dry-ribs", "kentucky-mutton", "st-louis-pork-steaks",
    "chicago-rib-tips", "kansas-city-burnt-ends", "east-texas-chopped-beef",
    "central-texas-brisket", "south-texas-barbacoa",
]

JOURNEY_DEFS = [
    {
        "slug": "american-bbq-belt",
        "title": "The American BBQ Belt by train",
        "vehicle": "train",
        "dek": "Vinegar, mustard, white sauce, and post oak, from eastern North Carolina to South Texas.",
        "intro": [
            "This train does not pretend the South has one barbecue. It stops where the wood, the animal, and the sauce actually change.",
            "Eastern North Carolina chops a whole hog with vinegar and pepper. Lexington reddens a shoulder dip with a little tomato. The South Carolina Midlands reach for mustard. Alabama’s white sauce is mayonnaise. Memphis leaves the ribs dry. Owensboro cooks mutton. St. Louis and Chicago cut the shoulder into steaks and tips. Kansas City cubes the brisket point. Texas, at the end of the line, salts beef and, in the south of the state, pits a head.",
            "The leg is by train because that is how these regions once sat on the same map of rails, markets, and moving cooks. It is a reading route, not a timetable."
        ],
        "stops": BELT,
    },
    {
        "slug": "caribbean-by-boat",
        "title": "Caribbean by boat",
        "vehicle": "boat",
        "dek": "Mojo, jerk, and island pigs, harbor to harbor.",
        "intro": [
            "These fires moved by sea. Sour orange and garlic in Cuba, allspice and scotch bonnet in Jamaica, a boucan in Haiti, wasakaka in the Dominican Republic, lechón in Puerto Rico, chadon beni in Trinidad, flying fish in Barbados.",
            "The boat is the vehicle because that is how pigs, chile, and citrus actually traveled. Each stop is its own kitchen."
        ],
        "stops": [
            "cuban-lechon-asado", "jamaican-jerk-chicken", "haitian-boukannen",
            "dominican-wasakaka-chicken", "puerto-rican-lechon", "trinidad-grilled-kingfish",
            "barbados-grilled-flying-fish",
        ],
    },
    {
        "slug": "asado-by-plane",
        "title": "Asado and churrasco by plane",
        "vehicle": "plane",
        "dek": "A flight across the southern fires, from the parrilla to picanha.",
        "intro": [
            "The distance from a Buenos Aires parrilla to a Brazilian picanha skewer is a plane ride, not a stroll. The fire idea is shared. The cuts are not.",
            "This route starts with an Argentine asado, crosses the Río de la Plata, looks south to a Patagonian lamb, steps into a Chilean asado, and ends on Brazilian picanha. It is not a ranking of who grills better."
        ],
        "stops": [
            "argentine-asado", "uruguayan-asado-al-espeto", "patagonian-cordero-al-asador",
            "chilean-asado", "brazilian-picanha",
        ],
    },
    {
        "slug": "mediterranean-by-balloon",
        "title": "Mediterranean by balloon",
        "vehicle": "balloon",
        "dek": "A low pass over sardines, calçots, vine shoots, and a spit.",
        "intro": [
            "A balloon is the right speed for this coast. The fire changes with the harbor: sardines on a Malaga beach, spring onions in Catalonia, lamb chops over Rioja vine cuttings, June sardines in Lisbon, an Easter lamb in Greece, a hand-minced kebab in Adana.",
            "Nothing here is a fast transfer. The point is how close these shores are, and how different the grills still are."
        ],
        "stops": [
            "spanish-espetos", "spanish-calcots", "spanish-chuletillas",
            "portuguese-sardines", "greek-spit-lamb", "turkish-adana-kebab",
        ],
    },
    {
        "slug": "africa-by-plane",
        "title": "Africa's fires by plane",
        "vehicle": "plane",
        "dek": "Mechoui, dibi, suya, nyama choma, and a braai.",
        "intro": [
            "Africa does not have one grill. This flight is a way to taste how far the fires sit from each other: a Moroccan celebration lamb, a Dakar street dibi, Hausa suya, a Ghanaian tilapia, Kenyan nyama choma, Mozambican peri-peri chicken, and a South African braai sausage.",
            "The plane is honest about the distance. It is not a claim that one coast taught the others."
        ],
        "stops": [
            "moroccan-mechoui", "senegalese-dibi", "nigerian-suya", "ghanaian-grilled-tilapia",
            "kenyan-nyama-choma", "mozambican-peri-peri-chicken", "south-african-boerewors",
        ],
    },
    {
        "slug": "pacific-by-boat",
        "title": "Pacific earth ovens by boat",
        "vehicle": "boat",
        "dek": "Imu, lovo, umu, and hāngi. Related heat, separate peoples.",
        "intro": [
            "An earth oven holds heat in the ground. Hawaiʻi, Fiji, Samoa, Tonga, and Aotearoa use that idea under different names, with different foods and different obligations.",
            "The boat is the old way between these islands. A home pot in this journal is labeled as a home pot. It is not an imu, a lovo, an umu, or a marae hāngi."
        ],
        "stops": ["kalua-pig", "fijian-lovo", "samoan-umu", "tongan-umu", "maori-hangi"],
    },
    {
        "slug": "asian-grills-by-plane",
        "title": "Asian grills by plane",
        "vehicle": "plane",
        "dek": "Cumin lamb, char siu, galbi, yakitori, gai yang, satay, and lechón.",
        "intro": [
            "This is a long flight on purpose. Xinjiang lamb skewers, a Beijing duck, Cantonese char siu, Korean galbi, yakitori, Isaan grilled chicken, Malaysian satay, and a Cebu lechón do not belong to one cuisine.",
            "The plane is just how a reader covers that distance. Each stop keeps its own wood, sugar, and rule for doneness."
        ],
        "stops": [
            "xinjiang-lamb-skewers", "peking-duck", "char-siu", "korean-galbi",
            "japanese-yakitori", "thai-gai-yang", "malaysian-satay-ayam", "filipino-lechon",
        ],
    },
]


def load_entries():
    entries = []
    for name in MODULES:
        path = SCRIPTS / f"{name}.py"
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        entries.extend(module.ENTRIES)
    return entries


def normalize(entries):
    seen = set()
    cleaned = []
    for index, dish in enumerate(entries, start=1):
        slug = dish["slug"]
        if slug in seen:
            raise SystemExit(f"duplicate slug {slug}")
        seen.add(slug)
        dish = dict(dish)
        if not dish.get("coverage"):
            dish["coverage"] = COVERAGE_FILL.get(slug, ["World"])
        dish["voyage"] = index
        dish.pop("sets", None)
        cleaned.append(dish)
    return cleaned


def require(slugs, known, label):
    missing = [slug for slug in slugs if slug not in known]
    if missing:
        raise SystemExit(f"{label} missing {missing}")


def book(slug, title, dek, vehicle, intro, slugs, selection=None):
    data = {
        "slug": slug,
        "title": title,
        "dek": dek,
        "vehicle": vehicle,
        "intro": intro,
        "slugs": slugs,
    }
    if selection:
        data["selectionNote"] = selection
    return data


def emit_js(path, source):
    path.write_text(source)
    print("wrote", path)


def main():
    entries = normalize(load_entries())
    known = {dish["slug"]: dish for dish in entries}
    require(TOP, known, "top 100")
    if len(TOP) != 100 or len(set(TOP)) != 100:
        raise SystemExit(f"top list is {len(TOP)} unique {len(set(TOP))}")
    require(BELT, known, "belt")
    for journey in JOURNEY_DEFS:
        require(journey["stops"], known, journey["slug"])
        journey["route"] = [[known[slug]["lat"], known[slug]["lng"]] for slug in journey["stops"]]

    by_set_source = []
    for name in MODULES:
        path = SCRIPTS / f"{name}.py"
        spec = importlib.util.spec_from_file_location(name + "_sets", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        by_set_source.extend(module.ENTRIES)

    def slugs_for(tag):
        return [dish["slug"] for dish in by_set_source if tag in (dish.get("sets") or [])]

    for tag in ["south", "appalachia", "asado", "asian", "africa", "caribbean", "mexico", "british", "middle-east", "oceania", "india", "east-asia"]:
        found = slugs_for(tag)
        if len(found) < 3:
            raise SystemExit(f"set {tag} has {len(found)}")

    flagship = [
        book(
            "top-100-bbq",
            "Flying BBQ: The Top 100 Barbecue Dishes of the World",
            "A reading route through a hundred live-fire dishes chosen for reach and usefulness, not a prize list.",
            "plane",
            [
                "These hundred stops are a route, not a contest. Each one is already in the passport. Nothing was invented to fill a slot.",
                "They were chosen because a cook meets them far from home, or because they teach a method: a pit, a skewer, a spit, a tandoor, an earth oven. The order is a flight plan. Another editor would pack a different hundred.",
                "The number of continents is counted from this list. It is not set in advance.",
            ],
            TOP,
            "This is not a ranking and not an official list. The hundred were chosen for cultural reach and for how clearly a dish teaches a live-fire method. Dishes that traveled, and dishes that explain a place, come first. The order is a reading route. Another editor would pick a different hundred.",
        ),
        book(
            "appalachian-smoke",
            "Appalachian Smoke",
            "Hickory shoulder, sorghum chops, a bought country-ham steak, and the pots that sit beside them.",
            "train",
            [
                "Appalachian stops in this book are the ones that can be tied to a real smoke or a real pot: hickory shoulder, sorghum-glazed chops, ramp-season trout, a purchased country-ham steak, vinegar chicken, a holiday turkey, chow-chow, soup beans, and skillet cornbread.",
                "Scots-Irish and English settlers brought pork and vinegar habits into the mountains. German-speaking families brought sweet-sour pickling. Black Appalachian cooks worked the same farms and kitchens. Cherokee and other Native nations of these mountains had their own fire and corn long before those settlements. This book does not hand them a modern pulled-pork recipe.",
                "Country ham here is a cured product you buy. The page cooks a steak of it. It does not teach home curing.",
            ],
            slugs_for("appalachia"),
        ),
        book(
            "across-the-american-south",
            "Across the American South",
            "Whole hog, chopped pork, ribs, mutton, and the Gulf, told as a southern route.",
            "train",
            [
                "The South in this book is a set of pits, not a single sauce. Vinegar in the east, a little tomato in the Piedmont, mustard in the Midlands, white sauce in Alabama, dry ribs in Memphis, mutton in Owensboro, beef in Texas.",
                "Enslaved cooks and their descendants built much of this public food. English, Scots-Irish, German, and Mexican traditions sit in particular places. The essays on each stop say which is which.",
            ],
            slugs_for("south"),
        ),
        book(
            "american-bbq-belt",
            "The American BBQ Belt",
            "A train route from eastern North Carolina vinegar to South Texas barbacoa.",
            "train",
            [
                "The barbecue belt is a corridor of disagreement. That is why it is worth riding.",
                "This book follows the train journey of the same name. The stops are in route order. Kansas City and Chicago are on the line because their pits are part of the story, even when a map calls them the Midwest.",
            ],
            BELT,
        ),
        book(
            "asado-and-churrasco",
            "Asado & Churrasco",
            "Parrillas, spits, and Saturday fires from the pampas to Brazil.",
            "plane",
            [
                "Asado and churrasco are related words and different tables. Argentina and Uruguay cook on a parrilla or a cross of wood. Brazil salts a picanha and turns it on a skewer.",
                "This book keeps the southern-cone and Brazilian fires that are actually in the passport. It is a route, not a claim that one capital invented the grill.",
            ],
            slugs_for("asado"),
        ),
        book(
            "asian-grills",
            "Asian Grills",
            "Tandoor, charcoal, table grills, and satay, from the Punjab to the Philippines.",
            "plane",
            [
                "Asia is not a flavor. This book gathers live-fire dishes from South, Southeast, and East Asia that teach a method: clay oven, skewer, table grill, spit, or glaze.",
                "Soy, fish sauce, peanut, and chile do different jobs. The pages do not fold them into one sweet brown sauce.",
            ],
            slugs_for("asian"),
        ),
        book(
            "africas-fires",
            "Africa's Fires",
            "Suya, dibi, nyama choma, mechoui, and the braai.",
            "plane",
            [
                "Several countries, several fires. Hausa suya is not a Cape Town braai, and a Moroccan mechoui is not a Dakar dibi.",
                "Where a dish was shaped by enslaved people, the page says so in plain language. Where it is a street grill or a feast, it says that instead.",
            ],
            slugs_for("africa"),
        ),
        book(
            "caribbean-jerk-and-island-roasts",
            "Caribbean Jerk & Island Roasts",
            "Jerk, lechón, and the harbor fires of the islands.",
            "boat",
            [
                "Jerk is Jamaican. Lechón in Cuba is not the lechón in Puerto Rico. A Haitian boukannen is not a rebranded pulled pork.",
                "The boat route in the journal is the reading order for the island stops. This book holds the wider Caribbean shelf, including the sauces and sides that belong on those tables.",
            ],
            slugs_for("caribbean"),
        ),
        book(
            "british-and-irish-fires",
            "Britain & Ireland at the Fire",
            "A hog on a spit, mackerel, salt-marsh lamb, and mint sauce.",
            "train",
            [
                "These islands do not have one barbecue tradition wearing a different hat. A Cornish mackerel, an Irish mackerel, a Welsh salt-marsh chop, and an English hog roast are different cooks.",
                "Mint sauce is here because it is what many British tables expect with lamb. It is a sauce, and it is labeled as one.",
            ],
            slugs_for("british"),
        ),
        book(
            "middle-eastern-grills",
            "Middle Eastern Grills",
            "Adana, kofte, masgouf, koobideh, shuwa, and mandi.",
            "plane",
            [
                "Kebabs are not one skewer with a passport stamp. Adana is hand-minced and hot. Urfa is its milder cousin. Masgouf is a river fish. Shuwa and mandi are celebration pits.",
                "Home versions in this book say when a vertical spit or an earth oven has been replaced by a grill or a covered pot.",
            ],
            slugs_for("middle-east"),
        ),
        book(
            "india-tandoor-and-seekh",
            "India: Tandoor & Seekh",
            "Clay-oven chicken, minced seekh, and the kebabs of the north.",
            "train",
            [
                "A tandoor is an oven, not a backyard kettle. Seekh is minced meat on a skewer. Paneer tikka is a vegetarian stop in the same heat.",
                "The restaurant tandoori chicken of Delhi is a 20th-century chapter. Older tandoor bread and meat in the northwest are a different chapter. The pages keep them apart.",
            ],
            slugs_for("india"),
        ),
        book(
            "east-asian-grills",
            "East Asian Grills",
            "Char siu, galbi, yakitori, and the table grill.",
            "plane",
            [
                "Cantonese roast meat, Korean table grilling, and Japanese yakitori share charcoal and almost nothing else.",
                "Yakiniku’s history in Japan runs through Korean restaurants. The page says that plainly.",
            ],
            slugs_for("east-asia"),
        ),
        book(
            "mexico-and-the-pit",
            "Mexico and the Pit",
            "Pibil, pastor, carne asada, and barbacoa’s home country.",
            "train",
            [
                "Mexico’s live fire is older than the English word barbecue and more specific than a fajita platter. Pib, trompo, disc, and parrilla are different tools.",
                "The Yucatán pages say what is Maya and what arrived after Spanish contact. The northern pages say what mesquite and flour tortillas are doing.",
            ],
            slugs_for("mexico"),
        ),
        book(
            "oceania-fires",
            "Oceania's Fires",
            "Earth ovens of the Pacific and the backyard grills of Australia and Aotearoa.",
            "boat",
            [
                "A lovo, an umu, and a hāngi are kin and not copies. A Torres Strait kup murri is not an Australian sausage on a kettle grill.",
                "Home recipes are labeled as home recipes. They are not ceremonies.",
            ],
            slugs_for("oceania"),
        ),
    ]

    (ROOT / "data" / "dishes").mkdir(parents=True, exist_ok=True)
    raw_path = ROOT / "data" / "dishes" / "raw.json"
    raw_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
    print("wrote", raw_path, "dishes", len(entries))

    emit_js(
        ROOT / "data" / "flagship-books.js",
        "// Generated by scripts/make_catalog.py. Edit the entry modules, then rerun it.\n"
        f"export const FLAGSHIP_BOOKS = {json.dumps(flagship, ensure_ascii=False, indent=2)};\n",
    )

    match_books = r'''export const BOOKS = [
  {
    slug: "rubs-mops-and-sauces",
    title: "Rubs, Mops & Sauces",
    dek: "The dry coats, thin mops, and table sauces that travel with the fire.",
    intro: [
      "A rub is salt and spice on the surface. A mop is a thin liquid during the cook. A sauce may be the whole point, as in eastern North Carolina, or a bowl on the side, as in many Central Texas markets.",
      "This booklet is every passport entry whose method is a sauce or a rub. Print it when you want the seasonings without the whole animal."
    ],
    match: (dish) => dish.baseType === "sauce" || dish.baseType === "rub"
  },
  {
    slug: "sides-of-the-pit",
    title: "Sides of the Pit",
    dek: "Beans, slaw, bread, and the plates that show up beside the meat.",
    intro: [
      "A pit has a table. Pinto beans, vinegar slaw, pap, farofa, elote, and banana pudding are not the same idea, and they are not all cooked on the fire.",
      "Each page says whether the side is grilled, boiled, baked, or fried. Fried sides are labeled as fried."
    ],
    match: (dish) => dish.baseType === "side"
  },
  {
    slug: "seafood-on-the-coals",
    title: "Seafood on the Coals",
    dek: "Fish, oysters, lobster, and the fires that suit them.",
    intro: [
      "Fish wants a hot, clean fire and a thermometer that reaches 145°F (63°C). Shellfish should turn opaque.",
      "This booklet gathers passport entries tagged as fish or shellfish, including a few smokehouse fishes that are not grilled."
    ],
    match: (dish) => dish.uses.includes("fish") || dish.uses.includes("seafood")
  },
  {
    slug: "skewers-of-the-world",
    title: "Skewers of the World",
    dek: "Suya, souvlaki, satay, anticuchos, yakitori, and their cousins.",
    intro: [
      "A skewer is a method and a portion. What changes is the meat, the fat, the spice, and whether a sauce is dipped or painted on.",
      "Ground meat on a stick is cooked to the ground-meat temperature. Whole muscles are cooked to theirs. The pages do not swap those numbers."
    ],
    match: (dish) => dish.baseType === "skewer"
  }
];
'''
    emit_js(ROOT / "data" / "books.js", match_books)

    journeys_js = {
        "VEHICLES": {
            "balloon": "Hot air balloon",
            "plane": "Plane",
            "train": "Train",
            "boat": "Boat",
        },
        "JOURNEYS": [
            {
                "slug": journey["slug"],
                "title": journey["title"],
                "vehicle": journey["vehicle"],
                "dek": journey["dek"],
                "intro": journey["intro"],
                "stops": journey["stops"],
                "route": journey["route"],
            }
            for journey in JOURNEY_DEFS
        ],
    }
    emit_js(
        ROOT / "data" / "journeys.js",
        "// Curated voyages. Stops are dish slugs. Routes use the stop coordinates, not a GPS track.\n"
        f"export const VEHICLES = {json.dumps(journeys_js['VEHICLES'], indent=2)};\n\n"
        f"export const JOURNEYS = {json.dumps(journeys_js['JOURNEYS'], ensure_ascii=False, indent=2)};\n\n"
        """export function journeyFor(slug) {
  return JOURNEYS.find((journey) => journey.stops.includes(slug)) || null;
}

export function nextOnJourney(slug, known) {
  const journey = journeyFor(slug);
  if (!journey) return null;
  const stops = journey.stops.filter((stop) => known.has(stop));
  const index = stops.indexOf(slug);
  if (index === -1 || stops.length < 2) return null;
  const next = stops[(index + 1) % stops.length];
  return { slug: next, journey };
}
""",
    )

    prices = {
        "top-100-bbq": "24",
        "appalachian-smoke": "16",
        "across-the-american-south": "18",
        "american-bbq-belt": "18",
        "asado-and-churrasco": "18",
        "asian-grills": "18",
        "africas-fires": "18",
        "caribbean-jerk-and-island-roasts": "16",
        "british-and-irish-fires": "16",
        "middle-eastern-grills": "16",
        "india-tandoor-and-seekh": "16",
        "east-asian-grills": "16",
        "mexico-and-the-pit": "16",
        "oceania-fires": "16",
        "rubs-mops-and-sauces": "14",
        "sides-of-the-pit": "14",
        "seafood-on-the-coals": "14",
        "skewers-of-the-world": "14",
    }
    shop = {
        "openingSoon": True,
        "pricesAreFinal": False,
        "notifyEmail": "",
        "boxSetDiscount": 0.3,
        "defaultPrice": "14",
        "prices": prices,
    }
    emit_js(
        ROOT / "data" / "shop.js",
        "// Placeholder prices for field books. Not an offer and not final.\n"
        "// The box set price is not stored here. It is 30% off the sum of these prices.\n"
        f"export const SHOP = {json.dumps(shop, indent=2)};\n",
    )

    # Country names and pins for small places.
    names_path = ROOT / "data" / "country-names.js"
    text = names_path.read_text()
    existing = set(re.findall(r"\b([A-Z]{2}):", text))
    additions = {
        "AG": "Antigua and Barbuda",
        "AO": "Angola",
        "AZ": "Azerbaijan",
        "BA": "Bosnia and Herzegovina",
        "BB": "Barbados",
        "BS": "Bahamas",
        "BW": "Botswana",
        "BZ": "Belize",
        "CK": "Cook Islands",
        "CY": "Cyprus",
        "FJ": "Fiji",
        "GD": "Grenada",
        "GP": "Guadeloupe",
        "IS": "Iceland",
        "KH": "Cambodia",
        "LA": "Laos",
        "LC": "Saint Lucia",
        "LK": "Sri Lanka",
        "MM": "Myanmar",
        "MN": "Mongolia",
        "MQ": "Martinique",
        "MZ": "Mozambique",
        "NA": "Namibia",
        "NP": "Nepal",
        "OM": "Oman",
        "PF": "French Polynesia",
        "PG": "Papua New Guinea",
        "PY": "Paraguay",
        "SR": "Suriname",
        "TO": "Tonga",
        "VU": "Vanuatu",
        "ZM": "Zambia",
        "ZW": "Zimbabwe",
    }
    missing = {code: name for code, name in additions.items() if code not in existing}
    if missing:
        block = "\n".join(f'  {code}: "{name}",' for code, name in sorted(missing.items()))
        text = text.replace("\n};", f"\n{block}\n}};")
        names_path.write_text(text)
        print("country names added", sorted(missing))

    print("centroids left as edited in data/extra-centroids.js")


if __name__ == "__main__":
    main()
