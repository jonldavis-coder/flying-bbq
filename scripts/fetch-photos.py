#!/usr/bin/env python3
"""Download freely licensed Wikimedia photos for each stop.

A photo is stored as a dish photo only when its file name or description
contains the dish's distinctive words and the license is CC0, CC BY, CC BY-SA,
or public domain. Otherwise the stop gets a landscape or street photograph of
its origin, labeled as a place.
"""

import html
import io
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

OTHER_PLACES = set()
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "dishes" / "raw.json"
OUT_DIR = ROOT / "assets" / "photos"
MANIFEST = ROOT / "data" / "photos.json"
CACHE = ROOT / "data" / "photo-cache.json"
UA = "FlyingBBQPhotoBot/1.0 (https://jonldavis-coder.github.io/flying-bbq/; educational static site; local copies only)"

FOOD_DESC = re.compile(
    r"\b(dish|food|cuisine|grill|grilled|roast|roasted|barbecue|barbeque|bbq|meat|sausage|stew|kebab|bread|sauce|chicken|pork|beef|fish|lamb|seafood|smoke|smoked|pit|skewer)\b",
    re.I,
)
REJECT_ENTITY = re.compile(
    r"\b(human|person|episode|film|television|series|language|family name|given name|footballer|politician|writer|singer|album|song|village in|settlement|company|airline|football club)\b",
    re.I,
)
BAD_CAT = re.compile(
    r"\b(portrait|logo|flag of|coat of arms|diagram|map of|icon|signature|screenshot|stamp|coin|banknote|emblem|seal of)\b",
    re.I,
)
PLACE_CAT = re.compile(
    r"\b(landscape|skyline|view|views|street|downtown|beach|coast|mountain|park|river|harbor|harbour|cityscape|building|church|square|bridge|countryside|lake|waterfall|market|plaza|promenade|waterfront|hill|valley|desert|forest|island|town|city hall|courthouse)\b",
    re.I,
)
FOOD_CAT = re.compile(r"\b(food|cuisine|dish|barbecue|recipe|meal|meat)\b", re.I)
WEAK = {
    "central", "eastern", "western", "northern", "southern", "north", "south", "east", "west",
    "style", "home", "traditional", "classic", "grilled", "smoked", "roast", "roasted", "whole",
    "salt", "pepper", "island", "street", "mixed", "royal", "charcoal", "open", "fire", "slow",
    "sauce", "side", "plate", "fresh", "dry", "wet", "hot", "mild", "red", "white", "black",
    "green", "little", "small", "large", "country", "region", "city",
}
MUST_IF_PRESENT = {
    "chicken", "pork", "beef", "lamb", "mutton", "goat", "duck", "turkey", "fish", "salmon",
    "shrimp", "prawn", "lobster", "oyster", "sausage", "bison", "venison", "eel", "crab", "clam",
    "cheese", "paneer", "tofu", "squid", "octopus", "trout", "mackerel", "sardine",
}
CONFLICT = {
    "bao", "baau", "bun", "buns", "pizza", "burger", "sandwich", "taco", "tacos", "soup",
    "salad", "cake", "cookie", "aloo", "noodle", "noodles", "pasta", "porridge",
    "dumpling", "dumplings", "icecream", "seller", "vendor",
}

OK_LICENSE = re.compile(
    r"^(cc0|cc[ -]?by(?:-sa)?(?:[ -]?\d|$)|cc[ -]?zero|public domain|pdm?\b|no restrictions)",
    re.I,
)
BAD_LICENSE = re.compile(r"nc|noncommercial|no[- ]?deriv|\bnd\b|fair use|all rights reserved|gfdl|copyrighted", re.I)


def strip_html(value):
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(value):
    text = unicodedata.normalize("NFKD", value or "")
    text = text.encode("ascii", "ignore").decode().lower().replace("-", " ")
    return [tok for tok in re.findall(r"[a-z]{3,}", text)]


class Client:
    def __init__(self):
        self.cache = {}
        if CACHE.exists():
            self.cache = json.loads(CACHE.read_text())
        self.writes = 0

    def get(self, url, params):
        key = url + "?" + urllib.parse.urlencode(params)
        if key in self.cache:
            return self.cache[key]
        time.sleep(0.12)
        req = urllib.request.Request(key, headers={"User-Agent": UA, "Accept": "application/json"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    data = json.load(response)
                break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        else:
            data = {}
        self.cache[key] = data
        self.writes += 1
        if self.writes % 40 == 0:
            CACHE.write_text(json.dumps(self.cache))
        return data

    def save(self):
        CACHE.write_text(json.dumps(self.cache))


def license_ok(meta):
    short = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    usage = strip_html(meta.get("UsageTerms", {}).get("value", ""))
    blob = f"{short} {usage}"
    if BAD_LICENSE.search(blob):
        return False
    if not OK_LICENSE.search(short):
        return False
    return True


def artist_of(meta):
    artist = strip_html(meta.get("Artist", {}).get("value", ""))
    credit = strip_html(meta.get("Credit", {}).get("value", ""))
    name = artist or credit
    name = re.sub(r"\b(Own work|own work)\b", "", name).strip(" -·,")
    return name[:180]


def file_info(client, filename):
    data = client.get("https://commons.wikimedia.org/w/api.php", {
        "action": "query",
        "titles": "File:" + filename,
        "prop": "imageinfo|categories",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": "1600",
        "cllimit": "30",
        "format": "json",
    })
    page = next(iter(data.get("query", {}).get("pages", {}).values()), {})
    if "missing" in page or not page.get("imageinfo"):
        return None
    info = page["imageinfo"][0]
    cats = " ".join(cat.get("title", "") for cat in page.get("categories", []))
    meta = info.get("extmetadata") or {}
    if not license_ok(meta):
        return None
    mime = info.get("mime") or ""
    if not mime.startswith("image/") or "svg" in mime:
        return None
    artist = artist_of(meta)
    short = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    if re.search(r"cc[ -]?by", short, re.I) and not artist:
        return None
    thumb = info.get("thumburl") or ""
    if not thumb:
        return None
    description = strip_html(meta.get("ImageDescription", {}).get("value", ""))
    return {
        "file": filename,
        "thumb": thumb,
        "artist": artist or "Unknown photographer",
        "license": short,
        "licenseUrl": strip_html(meta.get("LicenseUrl", {}).get("value", "")) or "https://commons.wikimedia.org/wiki/Commons:Copyright_tags",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(filename.replace(" ", "_")),
        "description": description,
        "categories": cats,
        "width": info.get("thumbwidth") or info.get("width") or 0,
        "height": info.get("thumbheight") or info.get("height") or 0,
    }


def entity_images(client, qid):
    data = client.get("https://www.wikidata.org/w/api.php", {
        "action": "wbgetentities",
        "ids": qid,
        "props": "claims",
        "format": "json",
    })
    claims = data.get("entities", {}).get(qid, {}).get("claims", {})
    names = []
    for claim in claims.get("P18", []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
        if value:
            names.append(value)
    return names


def search_entities(client, term):
    data = client.get("https://www.wikidata.org/w/api.php", {
        "action": "wbsearchentities",
        "search": term,
        "language": "en",
        "format": "json",
        "limit": 6,
        "type": "item",
    })
    return data.get("search", [])


def search_files(client, term):
    data = client.get("https://commons.wikimedia.org/w/api.php", {
        "action": "query",
        "list": "search",
        "srsearch": term,
        "srnamespace": 6,
        "srlimit": 8,
        "format": "json",
    })
    titles = []
    for hit in data.get("query", {}).get("search", []):
        title = hit.get("title", "")
        if title.startswith("File:"):
            titles.append(title[5:])
    return titles


def geo_files(client, lat, lng, radius=15000):
    data = client.get("https://commons.wikimedia.org/w/api.php", {
        "action": "query",
        "list": "geosearch",
        "gscoord": f"{lat}|{lng}",
        "gsradius": min(int(radius), 10000),
        "gslimit": 12,
        "gsnamespace": 6,
        "format": "json",
    })
    return [hit.get("title", "")[5:] for hit in data.get("query", {}).get("geosearch", []) if hit.get("title", "").startswith("File:")]


def is_geo_token(tok, geo):
    if tok in geo or tok in WEAK:
        return True
    for place in geo:
        if len(place) >= 5 and len(tok) >= 5 and place[:5] == tok[:5]:
            return True
    return False


def dish_keys(dish, distinctive, geo):
    name_tokens = [tok for tok in tokens(dish["name"]) if not is_geo_token(tok, geo)]
    keys = [tok for tok in name_tokens if tok in distinctive or len(tok) >= 3]
    keys = [tok for tok in keys if tok not in WEAK]
    return keys[:5]


def text_has_keys(info, keys, dish):
    filename = info["file"].lower()
    lead = (filename + " " + (info["description"] or "")[:160]).lower()
    name_blob = " ".join(tokens(dish["name"]))
    locale_tokens = set(tokens(dish.get("locale") or ""))
    foodish = bool(FOOD_DESC.search(info["description"] or "") or re.search(
        r"grill|roast|smoked|barbecue|barbeque|bbq|sauce|skewer|taco|dish|plate of|cooked",
        lead,
    ))
    if not foodish:
        return False
    if re.search(r"construction|storefront|parade|float|cartoon|mascot|illustration|painting|drawing|logo", filename):
        return False
    if re.search(r"\b(house|shop|restaurant|store|mall|market)\b", filename) and not re.search(r"grill|plate|roast|smoked|bbq|barbecue", filename):
        return False
    if re.search(r"species|fauna|taxonomy|fish of the|birds of|mammals of", info["categories"], re.I):
        return False
    other_places = []
    # filled by caller via dish countries at runtime; checked below from a global set if present
    for place in OTHER_PLACES:
        if place in tokens(dish["country"]) or place in tokens(dish.get("locale") or ""):
            continue
        if len(place) >= 5 and word_in(filename, place):
            return False
    for word in CONFLICT:
        if re.search(rf"\b{re.escape(word)}\b", filename) and word not in name_blob:
            return False
    must = [word for word in MUST_IF_PRESENT if word in tokens(dish["name"])]
    unique = [key for key in keys if len(key) >= 7 and key not in locale_tokens]
    if must and not unique and any(word not in lead for word in must):
        return False
    if dish.get("baseType") in {"sauce", "rub"}:
        if not re.search(r"\b(sauce|dip|relish|vinaigrette|paste|rub|spice|glaze|marinade|chutney|salsa)\b", lead):
            return False
    specific = []
    for key in keys:
        if key in must or key in WEAK or key in locale_tokens:
            continue
        if len(key) >= 5 and (key.endswith("ese") or key.endswith("ian") or key.endswith("ish")):
            continue
        specific.append(key)
    if not specific:
        specific = [key for key in keys if key not in must and len(key) >= 4]
    if not specific:
        return bool(must) and bool(FOOD_DESC.search(lead))
    longest = max(specific, key=len)
    in_file = longest in filename or (len(longest) <= 4 and re.search(rf"\b{re.escape(longest)}\b", filename))
    if not in_file:
        return False
    if longest in locale_tokens and must and any(word not in filename for word in must):
        return False
    generic = {"chopped", "shoulder", "steak", "steaks", "ribs", "chicken", "pork", "beef", "lamb", "sauce", "grill", "barbecue", "smoked", "roast", "sausage", "fish", "meat", "plate", "style", "white", "vinegar"}
    named_place = [tok for tok in tokens(dish["name"]) if tok in locale_tokens and len(tok) >= 5]
    if named_place and (longest in generic or longest in named_place):
        if not any(tok in lead for tok in named_place):
            return False
    return True


PLACE_ONLY = {
    "new-mexico-green-chile-pork",
    "barbados-grilled-flying-fish",
    "icelandic-hot-smoked-lamb",
    "portuguese-frango-churrasco",
    "zambian-charcoal-chicken",
    "sri-lankan-grilled-prawns",
    "taiwanese-grilled-sausage",
    "australian-prawns",
    "country-ham-steak",
    "banana-pudding",
    "trinidad-grilled-kingfish",
}

DENY_FILES = {
    "asado uruguayo.jpg",
    "vietnamese prawns, kostheim.jpg",
    "spicy char-siu onigiri.jpg",
}


def denied(info):
    name = (info.get("file") or "").lower()
    if name in DENY_FILES or "cracker barrel" in name or "onigiri" in name:
        return True
    fragments = (
        "steak jawa", "pork loin ham", "banana foster", "goan kingfish", "sailfin flyingfish",
        "breadfruit dry curry", "asado uruguayo", "costela de porco", "chicken egg without",
        "lula kebab", "vegan lamb", "menu for", "fish cakes", "squid skewers", "gurame bakar",
        "braised beef ribs", "maquereaux etal", "chorizo sausage", "st martin", "vietnamese prawns",
        "chatsworth lamb", "cwm ivy", "lamb meat.jpg", "sauce criolla accompagnant", "bourne park",
        "iowa state fair", "hickory hillz", "steak and bread", "christmas table", "bread pudding",
        "yellowtail kingfish", "thorpe park", "pork asado", "brochette de picanha", "rogan josh",
        "gallus gallus", "malai kofta", "prawns-2024", "sausage making", "armenien", "arménien",
    )
    return any(fragment in name for fragment in fragments)


def bad_image(info):
    blob = info["file"] + " " + info["categories"] + " " + info["description"]
    return bool(BAD_CAT.search(blob))


def consider_dish(client, filenames, keys, dish):
    best = None
    for name in filenames:
        info = file_info(client, name)
        if not info or bad_image(info) or denied(info):
            continue
        if info["width"] and info["width"] < 480:
            continue
        if not text_has_keys(info, keys, dish):
            continue
        score = sum(key in (info["file"] + " " + info["description"]).lower() for key in keys)
        score += 2 if FOOD_CAT.search(info["categories"] + " " + info["description"]) else 0
        if not best or score > best[0]:
            best = (score, info)
    return best[1] if best else None


def find_dish_photo(client, dish, keys):
    phrases = []
    name = dish["name"]
    if keys:
        phrases.append(" ".join(key for key in keys if key not in WEAK))
    phrases.append(name)
    short = " ".join(tok for tok in tokens(name) if tok not in WEAK)
    if short and short not in phrases:
        phrases.append(short)
    seen = set()
    candidates = []
    for phrase in phrases[:3]:
        for hit in search_entities(client, phrase):
            label = hit.get("label") or ""
            description = hit.get("description") or ""
            if REJECT_ENTITY.search(description):
                continue
            if not FOOD_DESC.search(description + " " + label):
                continue
            label_tokens = set(tokens(label))
            if keys and not (set(keys) & label_tokens or any(key in description.lower() for key in keys)):
                continue
            qid = hit.get("id")
            if not qid or qid in seen:
                continue
            seen.add(qid)
            candidates.extend(entity_images(client, qid))
            if len(candidates) >= 4:
                break
        if candidates:
            found = consider_dish(client, candidates, keys, dish)
            if found:
                return found
        files = search_files(client, phrase)
        found = consider_dish(client, files, keys, dish)
        if found:
            return found
        files = search_files(client, phrase + " food")
        found = consider_dish(client, files, keys, dish)
        if found:
            return found
    return None


def word_in(text, word):
    return re.search(rf"\b{re.escape(word)}\b", (text or "").lower()) is not None


def mentions(info, words, need=1):
    blob = info["file"] + " " + info["description"]
    found = [word for word in words if len(word) >= 4 and word_in(blob, word)]
    return len(found) >= need


def good_place(info):
    if not info or bad_image(info):
        return False
    blob = info["categories"] + " " + info["description"] + " " + info["file"]
    if re.search(r"\b(book|pdf|scan|manuscript|poster|map|pictorial)\b", blob, re.I):
        return False
    if FOOD_CAT.search(blob) and not PLACE_CAT.search(blob):
        return False
    if re.search(r"\b(london|paris|tokyo|sydney|new york)\b", info["file"], re.I):
        return False
    return bool(PLACE_CAT.search(blob))


def find_place_photo(client, dish, place_cache):
    locale = dish.get("locale") or dish["country"]
    locale_words = [tok for tok in tokens(locale) if len(tok) >= 4]
    country_words = [tok for tok in tokens(dish["country"]) if len(tok) >= 4]
    queries = [locale, f"{locale} {dish['country']}"]
    for query in queries:
        for hit in search_entities(client, query):
            description = (hit.get("description") or "") + " " + (hit.get("label") or "")
            if not re.search(r"city|town|village|capital|state|region|county|district|island|municipality|borough|community", description, re.I):
                continue
            if REJECT_ENTITY.search(description):
                continue
            need = 2 if len(locale_words) >= 2 else 1
            if not mentions({"file": "", "description": description, "categories": ""}, locale_words, need):
                continue
            for name in entity_images(client, hit["id"])[:3]:
                info = file_info(client, name)
                if good_place(info):
                    info["where"] = locale
                    return info
    for name in geo_files(client, dish["lat"], dish["lng"]):
        info = file_info(client, name)
        if good_place(info):
            info["where"] = locale
            return info
    for name in geo_files(client, dish["lat"], dish["lng"], 40000)[:8]:
        info = file_info(client, name)
        if info and not bad_image(info) and not denied(info) and not FOOD_CAT.search(info["categories"] + info["description"]):
            info["where"] = locale
            return info
    for name in search_files(client, f"{locale} skyline") + search_files(client, locale):
        info = file_info(client, name)
        need = 2 if len(locale_words) >= 2 else 1
        if info and good_place(info) and not denied(info) and mentions({"file": info["file"], "description": info["description"], "categories": ""}, locale_words, need):
            info["where"] = locale
            return info
    return None


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def write_variants(blob, slug):
    image = Image.open(io.BytesIO(blob)).convert("RGB")
    paths = {}
    sizes = {}
    for width in (640, 1280):
        copy = image
        if copy.width > width:
            height = max(1, round(copy.height * width / copy.width))
            copy = copy.resize((width, height), Image.Resampling.LANCZOS)
        rel = f"assets/photos/{slug}-{width}.webp"
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        copy.save(dest, "WEBP", quality=72, method=4)
        paths[width] = rel
        sizes[width] = [copy.width, copy.height]
    return paths, sizes


def alt_text(dish, kind, info):
    if kind == "dish":
        return f"{dish['name']}, the dish from {dish.get('locale') or dish['country']}"
    where = info.get("where") or dish["country"]
    return f"A place in {where}, shown for {dish['name']} because this is not a photograph of the dish"


def main():
    dishes = json.loads(RAW.read_text())
    geo = set()
    for dish in dishes:
        geo.update(tokens(dish["country"]))
        geo.update(tokens(dish["region"]))
    counts = {}
    for dish in dishes:
        for tok in set(tokens(dish["name"])) - geo - WEAK:
            counts[tok] = counts.get(tok, 0) + 1
    distinctive = {tok for tok, count in counts.items() if count <= 8 and len(tok) >= 3}
    OTHER_PLACES.clear()
    for dish in dishes:
        OTHER_PLACES.update(tok for tok in tokens(dish["country"]) if len(tok) >= 5)
        OTHER_PLACES.update(tok for tok in tokens(dish.get("locale") or "") if len(tok) >= 5)

    client = Client()
    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())
    place_cache = {}
    dish_n = place_n = missed = 0
    for index, dish in enumerate(dishes, start=1):
        slug = dish["slug"]
        if slug in manifest and (ROOT / manifest[slug]["src1280"]).exists():
            if manifest[slug]["kind"] == "dish":
                dish_n += 1
            else:
                place_n += 1
            continue
        keys = dish_keys(dish, distinctive, geo)
        info = None if slug in PLACE_ONLY else find_dish_photo(client, dish, keys)
        kind = "dish" if info else "place"
        if not info:
            info = find_place_photo(client, dish, place_cache)
        if not info:
            missed += 1
            print(f"{index}/{len(dishes)} MISS {slug} keys={keys}", flush=True)
            continue
        try:
            blob = download(info["thumb"])
            paths, sizes = write_variants(blob, slug)
        except Exception as error:
            missed += 1
            print(f"{index}/{len(dishes)} FAIL {slug} {error}", flush=True)
            continue
        width, height = sizes[1280]
        manifest[slug] = {
            "kind": kind,
            "alt": alt_text(dish, kind, info),
            "artist": info["artist"],
            "license": info["license"],
            "licenseUrl": info["licenseUrl"],
            "sourceUrl": info["sourceUrl"],
            "file": info["file"],
            "src640": paths[640],
            "src1280": paths[1280],
            "width": width,
            "height": height,
        }
        if kind == "dish":
            dish_n += 1
        else:
            place_n += 1
        print(f"{index}/{len(dishes)} {kind:5} {slug} <- {info['file'][:70]}", flush=True)
        if index % 15 == 0:
            MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
            client.save()
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    client.save()
    print(f"DONE dish={dish_n} place={place_n} missed={missed} total={len(manifest)}")


if __name__ == "__main__":
    main()
