"""
Build the Network Concept interconnection datasets from PeeringDB exports.

Usage:
    python scripts/build-network-data.py <folder containing fac.json, netfac.json, ix.json [, cities15000.zip]>

Outputs (into public/data/):
    peering-interconnect.json   data centres, per-country stats, country-to-country links
    peering-cities.json         per-country metros, city-to-city links, links abroad

Missing facility coordinates are filled in two passes, and every filled facility is flagged as approximate:
    1. another PeeringDB facility in the same country and city that does have coordinates;
    2. the GeoNames gazetteer (CC BY 4.0): cities500.zip if present, else cities15000.zip —
       exact name match first, then a conservative fuzzy match (>= 0.88 similarity) for misspellings.
"""
import difflib, io, itertools, json, math, os, re, sys, unicodedata, zipfile
from collections import Counter, defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
RETRIEVED = "2026-10-01"
METRO_KM = 20            # facilities within this radius of a metro centre belong to it
REGIONAL_KM = 2500
COUNTRY_MIN_SHARED = 3   # country-to-country links
CITY_MIN_SHARED = 1      # city-to-city links inside a country
ABROAD_MIN_SHARED = 3    # city links to other countries

load = lambda name: json.load(open(os.path.join(SRC, name), encoding="utf-8"))["data"]
fac, netfac, ix = load("fac.json"), load("netfac.json"), load("ix.json")

# ---------- name normalisation ----------
SUFFIX = re.compile(r"(?:-|\s)(?:shi|si|city|ku|gun|machi|cho|town|village|metropolitan|district)$")
def ascii_lower(text):
    return unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower().strip()
def keys(city):
    """Candidate lookup keys for a messy city string, most specific first."""
    raw = re.sub(r"\bcedex\b|\d+", " ", ascii_lower(city)).strip()
    parts = [raw] + [p.strip() for p in re.split(r"[,/()]", raw) if p.strip()]
    out = []
    for part in parts:
        for variant in (part, SUFFIX.sub("", part), part.split(" - ")[0], part.split("-")[0]):
            key = re.sub(r"[^a-z]", "", variant)
            if key and key not in out:
                out.append(key)
    return out

def km(la1, lo1, la2, lo2):
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(min(1, h)))

# ---------- pass 1: same city elsewhere in PeeringDB ----------
known = {}
for f in fac:
    if f.get("latitude") is not None and f.get("longitude") is not None and f.get("country"):
        for key in keys(f.get("city")):
            known.setdefault((f["country"], key), (f["latitude"], f["longitude"]))

# ---------- pass 2: GeoNames gazetteer (optional) ----------
gazetteer = {}
gaz_points = []
zip_name = next((n for n in ("cities500", "cities1000", "cities5000", "cities15000") if os.path.exists(os.path.join(SRC, n + ".zip"))), None)
zip_path = os.path.join(SRC, f"{zip_name}.zip") if zip_name else ""
if zip_name:
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(f"{zip_name}.txt") as handle:
            for line in io.TextIOWrapper(handle, encoding="utf-8"):
                cols = line.rstrip("\n").split("\t")
                if len(cols) < 15:
                    continue
                cc, lat, lon, pop = cols[8], float(cols[4]), float(cols[5]), int(cols[14] or 0)
                gaz_points.append((lat, lon, cc))
                names = {cols[1], cols[2], *cols[3].split(",")}
                for name in names:
                    for key in keys(name)[:2]:
                        best = gazetteer.get((cc, key))
                        if best is None or pop > best[2]:
                            gazetteer[(cc, key)] = (lat, lon, pop)
    print(f"GeoNames {zip_name}: {len(gazetteer):,} name keys indexed")
else:
    print("no GeoNames citiesNNN.zip found — skipping gazetteer pass")
gazetteer_keys = defaultdict(list)
for cc, key in gazetteer:
    gazetteer_keys[cc].append(key)

def gazetteer_lookup(cc, city):
    for key in keys(city):
        if (cc, key) in gazetteer:
            return gazetteer[(cc, key)][:2], "geonames"
    for key in keys(city)[:2]:
        if len(key) >= 5:
            match = difflib.get_close_matches(key, gazetteer_keys[cc], n=1, cutoff=0.88)
            if match:
                return gazetteer[(cc, match[0])][:2], "geonames-fuzzy"
    return None, None

filled = Counter()
facs = []
for f in fac:
    cc = f.get("country")
    if not cc:
        continue
    lat, lon, approx = f.get("latitude"), f.get("longitude"), 0
    if lat is None or lon is None:
        hit = next((known[(cc, k)] for k in keys(f.get("city")) if (cc, k) in known), None)
        if hit:
            filled["same-city"] += 1
        else:
            hit, how = gazetteer_lookup(cc, f.get("city"))
            if hit:
                filled[how] += 1
        if not hit:
            filled["unresolved"] += 1
            continue
        (lat, lon), approx = hit, 1
    facs.append({**f, "latitude": lat, "longitude": lon, "approx": approx})
print("coordinates:", dict(filled), "| facilities placed:", len(facs), "of", len(fac))

by_id = {f["id"]: f for f in facs}

# ---------- country level ----------
def unit(lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    return math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)

acc = defaultdict(lambda: [0.0, 0.0, 0.0, 0])
for f in facs:
    w = 1 + (f.get("net_count") or 0)
    x, y, z = unit(f["latitude"], f["longitude"])
    a = acc[f["country"]]; a[0] += x * w; a[1] += y * w; a[2] += z * w; a[3] += 1
centroid = {}
for cc, (x, y, z, _) in acc.items():
    r = math.sqrt(x * x + y * y + z * z) or 1
    centroid[cc] = (math.degrees(math.asin(y / r)), math.degrees(math.atan2(x / r, z / r)))

net_countries = defaultdict(set)
for row in netfac:
    f = by_id.get(row["fac_id"])
    if f:
        net_countries[row["net_id"]].add(f["country"])
nets_in = Counter()
pairs = Counter()
for ccs in net_countries.values():
    for cc in ccs:
        nets_in[cc] += 1
    for a, b in itertools.combinations(sorted(ccs), 2):
        pairs[(a, b)] += 1
country_links = sorted(
    ([a, b, n, round(km(*centroid[a], *centroid[b]))] for (a, b), n in pairs.items() if n >= COUNTRY_MIN_SHARED),
    key=lambda link: -link[2],
)
ix_by = defaultdict(list)
for i in ix:
    if i.get("country"):
        ix_by[i["country"]].append([i["name"], i.get("city") or "", i.get("net_count") or 0])
countries = {
    cc: {
        "lat": round(centroid[cc][0], 3), "lon": round(centroid[cc][1], 3), "facilities": acc[cc][3],
        "ixps": len(ix_by.get(cc, [])), "networks": nets_in.get(cc, 0),
        "topIx": sorted(ix_by.get(cc, []), key=lambda r: -r[2])[:5],
    }
    for cc in acc
}
interconnect = {
    "source": "PeeringDB (peeringdb.com) — operator-maintained interconnection database",
    "retrieved": RETRIEVED,
    "approximateNote": "Facilities flagged approximate were placed at their city's coordinates (PeeringDB same-city match or GeoNames).",
    "facilities": [[round(f["longitude"], 3), round(f["latitude"], 3), f["country"], f.get("net_count") or 0, f["name"], f.get("city") or "", f["approx"]] for f in facs],
    "countries": countries,
    "links": country_links,
}

# ---------- city level (metros) ----------
by_cc = defaultdict(list)
for f in facs:
    by_cc[f["country"]].append(f)
def weight(f):
    return 1 + (f.get("net_count") or 0)

def cluster(fl):
    """Iterative metro clustering: seed greedily, then repeatedly re-centre, re-assign and merge close centres."""
    centres = []
    for f in sorted(fl, key=lambda f: -weight(f)):
        if not any(km(f["latitude"], f["longitude"], c[0], c[1]) < METRO_KM for c in centres):
            centres.append([f["latitude"], f["longitude"]])
    for _ in range(8):
        groups = defaultdict(list)
        for f in fl:
            best = min(range(len(centres)), key=lambda i: km(f["latitude"], f["longitude"], *centres[i]))
            if km(f["latitude"], f["longitude"], *centres[best]) > METRO_KM:
                centres.append([f["latitude"], f["longitude"]]); best = len(centres) - 1
            groups[best].append(f)
        # re-centre on the network-weighted mean (exact coordinates count more than city-level guesses)
        moved = []
        for members in groups.values():
            w = [weight(f) * (0.25 if f["approx"] else 1) for f in members]
            moved.append([sum(f["latitude"] * x for f, x in zip(members, w)) / sum(w),
                          sum(f["longitude"] * x for f, x in zip(members, w)) / sum(w)])
        # merge centres that ended up closer than 3/4 of the radius
        merged = []
        for c in sorted(moved, key=lambda c: 0):
            twin = next((m for m in merged if km(c[0], c[1], m[0], m[1]) < METRO_KM * 0.75), None)
            if twin is None:
                merged.append(c)
        if len(merged) == len(centres) and all(km(a[0], a[1], b[0], b[1]) < 0.05 for a, b in zip(merged, centres)):
            break
        centres = merged
    final = defaultdict(list)
    for f in fl:
        best = min(range(len(centres)), key=lambda i: km(f["latitude"], f["longitude"], *centres[i]))
        final[best].append(f)
    return [members for _, members in sorted(final.items(), key=lambda kv: -sum(weight(f) for f in kv[1]))]

def metro_name(members):
    """Most common city name (weighted by networks, exact locations preferred); spelling variants are pooled."""
    score, label = Counter(), {}
    for f in members:
        name = (f.get("city") or "").strip()
        key = keys(name)[0] if keys(name) else name.lower()
        score[key] += weight(f) * (0.25 if f["approx"] else 1)
        label.setdefault(key, Counter())[name] += 1
    if not score:
        return "Unknown"
    best = score.most_common(1)[0][0]
    return label[best].most_common(1)[0][0] or "Unknown"

SAME_NAME_MERGE_KM = 80  # one sprawling city split by the radius (e.g. Shanghai) is re-joined; distant namesakes stay apart

def merge_namesakes(groups):
    """Re-join clusters that carry the same normalised city name and lie within SAME_NAME_MERGE_KM."""
    def centre(members):
        w = sum(weight(f) for f in members)
        return (sum(f["latitude"] * weight(f) for f in members) / w, sum(f["longitude"] * weight(f) for f in members) / w)
    def norm(name):
        k = keys(name)
        return k[0] if k else name.lower()
    merged = []
    for members in groups:
        name, (lat, lon) = norm(metro_name(members)), centre(members)
        twin = next((m for m in merged if m["name"] == name and km(lat, lon, *centre(m["members"])) < SAME_NAME_MERGE_KM), None)
        if twin:
            twin["members"] = twin["members"] + members
        else:
            merged.append({"name": name, "members": members})
    return sorted((m["members"] for m in merged), key=lambda ms: -sum(weight(f) for f in ms))

metro_of, metros = {}, {}
for cc, fl in by_cc.items():
    seeds = []
    for members in merge_namesakes(cluster(fl)):
        w = sum(weight(f) for f in members)
        seed = {"facs": members, "name": metro_name(members),
                "lat": sum(f["latitude"] * weight(f) for f in members) / w,
                "lon": sum(f["longitude"] * weight(f) for f in members) / w}
        for f in members:
            metro_of[f["id"]] = (cc, len(seeds))
        seeds.append(seed)
    alias = {}
    for i, seed in enumerate(seeds):
        for f in seed["facs"]:
            for key in keys(f.get("city")):
                alias.setdefault(key, i)
    for seed in seeds:
        seed["alias"] = alias
    metros[cc] = seeds

ix_city = Counter()
for i in ix:
    cc = i.get("country")
    if cc in metros:
        match = next((metros[cc][0]["alias"][k] for k in keys(i.get("city")) if k in metros[cc][0]["alias"]), None)
        if match is not None:
            ix_city[(cc, match)] += 1

# ---------- extra city nodes: IXPs outside data-centre metros, submarine-cable landing stations ----------
def nearest_seed(cc, lat, lon, radius=METRO_KM):
    best = min(range(len(metros.get(cc, []))), key=lambda i: km(lat, lon, metros[cc][i]["lat"], metros[cc][i]["lon"]), default=None)
    if best is not None and km(lat, lon, metros[cc][best]["lat"], metros[cc][best]["lon"]) <= radius:
        return best
    return None

def new_seed(cc, name, lat, lon):
    seeds = metros.setdefault(cc, [])
    seeds.append({"facs": [], "name": name, "lat": lat, "lon": lon, "alias": seeds[0]["alias"] if seeds else {}, "extra": True})
    return len(seeds) - 1

added = Counter()
for i in ix:
    cc = i.get("country")
    alias = metros[cc][0]["alias"] if metros.get(cc) else {}
    if not cc or any(k in alias for k in keys(i.get("city"))):
        continue  # already counted at a data-centre metro
    hit = next((known[(cc, k)] for k in keys(i.get("city")) if (cc, k) in known), None) or gazetteer_lookup(cc, i.get("city"))[0]
    if not hit:
        continue
    j = nearest_seed(cc, *hit)
    if j is None:
        j = new_seed(cc, (i.get("city") or "").strip() or i["name"], *hit); added["ix-city"] += 1
    ix_city[(cc, j)] += 1

landing_at = Counter()
lp_path = next((p for p in (os.path.join(SRC, "landing-point-geo.json"), "landing-point-geo.json") if os.path.exists(p)), None)
if lp_path and gaz_points:
    grid = defaultdict(list)
    for la, lo, cc in gaz_points:
        grid[(int(la // 1), int(lo // 1))].append((la, lo, cc))
    def country_at(la, lo):
        best = (1e9, None)
        for r in range(0, 4):
            for a in range(int(la // 1) - r, int(la // 1) + r + 1):
                for b in range(int(lo // 1) - r, int(lo // 1) + r + 1):
                    for pla, plo, cc in grid.get((a, b), ()):
                        d = km(la, lo, pla, plo)
                        if d < best[0]:
                            best = (d, cc)
            if best[1] and best[0] < 111 * r:
                break
        return best[1] if best[0] < 300 else None
    features = json.load(open(lp_path, encoding="utf-8"))["features"]
    nearest = [country_at(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]) for f in features]
    by_label = defaultdict(Counter)  # TeleGeography's country label -> majority ISO code
    for f, cc in zip(features, nearest):
        if cc:
            by_label[f["properties"]["name"].rsplit(",", 1)[-1].strip()][cc] += 1
    for feat, near in zip(features, nearest):
        lo, la = feat["geometry"]["coordinates"][:2]
        label = by_label.get(feat["properties"]["name"].rsplit(",", 1)[-1].strip())
        cc = near if near in ("HK", "MO") or not label else label.most_common(1)[0][0]
        if not cc:
            continue
        j = nearest_seed(cc, la, lo)
        if j is None:
            j = new_seed(cc, feat["properties"]["name"].rsplit(",", 1)[0].strip(), la, lo); added["landing-station"] += 1
        landing_at[(cc, j)] += 1
    print("landing points:", sum(landing_at.values()))
print("extra city nodes:", dict(added))

# ---------- China: national backbone direct-connection points (MIIT 国家级互联网骨干直联点) ----------
# Cities individually confirmed in MIIT / provincial announcements; MIIT reported 30 approved points in total (Apr 2026).
CN_BACKBONE = ["Beijing", "Shanghai", "Guangzhou", "Chengdu", "Wuhan", "Xi'an", "Shenyang", "Nanjing", "Chongqing",
               "Zhengzhou", "Hangzhou", "Guiyang", "Fuzhou", "Hohhot", "Nanning", "Taiyuan", "Jinan", "Qingdao",
               "Nanchang", "Changsha", "Xining", "Hefei", "Kunming", "Lhasa", "Shenzhen"]
backbone = set()
for city in CN_BACKBONE:
    hit = gazetteer_lookup("CN", city)[0]
    if not hit:
        print("backbone city not geocoded:", city); continue
    j = nearest_seed("CN", *hit, radius=60)  # same metro even if PeeringDB's facility sits in the outskirts
    if j is None:
        j = new_seed("CN", city, *hit)
    backbone.add(("CN", j))
print("CN backbone points:", len(backbone))

# ---------- measured carrier links from public RIPE Atlas traceroutes (see scripts/data/ripe-atlas-cn-links.json) ----------
CARRIER_INDEX = {"telecom": 0, "unicom": 1, "mobile": 2, "cernet": 3}
traced = defaultdict(list)  # cc -> [(i, j, carrier, hop_pairs, observations)]
traced_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ripe-atlas-cn-links.json")
if os.path.exists(traced_path):
    for a_name, a_lat, a_lon, b_name, b_lat, b_lon, carrier, hops, seen in json.load(open(traced_path, encoding="utf-8"))["links"]:
        ends = []
        for name, la, lo in ((a_name, a_lat, a_lon), (b_name, b_lat, b_lon)):
            j = nearest_seed("CN", la, lo, radius=60)
            ends.append(new_seed("CN", name, la, lo) if j is None else j)
        if ends[0] != ends[1]:
            traced["CN"].append((ends[0], ends[1], CARRIER_INDEX[carrier], hops, seen))
    print("traceroute-measured CN links:", len(traced["CN"]))

# Same method, every other country with RIPE Atlas probes: carriers are the AS seen on both hops.
carriers = {"CN": ["China Telecom", "China Unicom", "China Mobile", "CERNET"]}
world_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ripe-atlas-world-links.json")
if os.path.exists(world_path):
    world = json.load(open(world_path, encoding="utf-8"))
    for cc, rows in world["links"].items():
        if cc == "CN":
            continue
        names = carriers.setdefault(cc, [])
        for a_name, a_lat, a_lon, b_name, b_lat, b_lon, asn, hops, seen in rows:
            label = f"AS{asn} {world['holders'].get(str(asn), '')}".strip()
            if label not in names:
                names.append(label)
            ends = []
            for name, la, lo in ((a_name, a_lat, a_lon), (b_name, b_lat, b_lon)):
                j = nearest_seed(cc, la, lo, radius=60)
                ends.append(new_seed(cc, name, la, lo) if j is None else j)
            if ends[0] != ends[1]:
                traced[cc].append((ends[0], ends[1], names.index(label), hops, seen))
    print("traceroute-measured links, other countries:", sum(len(v) for k, v in traced.items() if k != "CN"))

nets_at = defaultdict(set)
net_metros = defaultdict(set)
for row in netfac:
    m = metro_of.get(row["fac_id"])
    if m:
        nets_at[m].add(row["net_id"]); net_metros[row["net_id"]].add(m)
domestic, abroad = Counter(), Counter()
for ms in net_metros.values():
    for a, b in itertools.combinations(sorted(ms), 2):
        (domestic if a[0] == b[0] else abroad)[(a, b)] += 1

dom_by, abr_by = defaultdict(list), defaultdict(list)
for (a, b), n in domestic.items():
    if n >= CITY_MIN_SHARED:
        dom_by[a[0]].append((n, a[1], b[1]))
for (a, b), n in abroad.items():
    if n >= ABROAD_MIN_SHARED:
        abr_by[a[0]].append((n, a, b)); abr_by[b[0]].append((n, b, a))

def city_links(cc, seeds, links):
    """kind 0 = measured (n networks present in both metros, PeeringDB);
    kind 1 = modelled backhaul: minimum spanning tree over all points so no city is left unattached;
    kind 3 = measured carrier link (RIPE Atlas traceroutes);
    kind 2 = modelled backbone: each MIIT direct-connection point to its 3 nearest peers (China Telecom, Unicom, Mobile all meet at every point)."""
    d = lambda i, j: round(km(seeds[i]["lat"], seeds[i]["lon"], seeds[j]["lat"], seeds[j]["lon"]))
    out = [[i, j, n, d(i, j), 0] for n, i, j in links]
    have = {frozenset((i, j)) for _, i, j in links}
    # kind 3 = measured by traceroute: carrier's routers seen in both cities on consecutive hops
    for i, j, carrier, hops, seen in traced.get(cc, []):
        out.append([i, j, hops, d(i, j), 3, carrier, seen]); have.add(frozenset((i, j)))
    hubs = sorted(j for c, j in backbone if c == cc)
    for i in hubs:
        for j in sorted((h for h in hubs if h != i), key=lambda h: d(i, h))[:3]:
            if frozenset((i, j)) not in have:
                have.add(frozenset((i, j))); out.append([i, j, 0, d(i, j), 2])
    n = len(seeds)
    if n > 1:  # Prim's MST
        inside, best = {0}, {j: (d(0, j), 0) for j in range(1, n)}
        while best:
            j = min(best, key=lambda k: best[k][0]); dist, i = best.pop(j); inside.add(j)
            if frozenset((i, j)) not in have:
                have.add(frozenset((i, j))); out.append([i, j, 0, dist, 1])
            for k in best:
                dk = d(j, k)
                if dk < best[k][0]:
                    best[k] = (dk, j)
    return out

cities_out = {}
for cc, seeds in metros.items():
    ranked_links = sorted(dom_by[cc], reverse=True)
    links = ranked_links[:400]  # strongest pairs; plus each city's own strongest pair so no measured city drops out
    covered = {i for _, i, j in links} | {j for _, i, j in links}
    for n, i, j in ranked_links[400:]:
        if i not in covered or j not in covered:
            links.append((n, i, j)); covered |= {i, j}
    ext = sorted(abr_by[cc], reverse=True)[:30]
    cities_out[cc] = {
        "cities": [[s["name"], round(s["lat"], 3), round(s["lon"], 3), len(s["facs"]), len(nets_at[(cc, i)]), ix_city[(cc, i)],
                    sum(f["approx"] for f in s["facs"]), landing_at[(cc, i)], int((cc, i) in backbone)] for i, s in enumerate(seeds)],
        "links": city_links(cc, seeds, links),
        "carriers": carriers.get(cc, []),
        "abroad": [[mine[1], other[0], metros[other[0]][other[1]]["name"], round(metros[other[0]][other[1]]["lat"], 3),
                    round(metros[other[0]][other[1]]["lon"], 3), n,
                    round(km(seeds[mine[1]]["lat"], seeds[mine[1]]["lon"], metros[other[0]][other[1]]["lat"], metros[other[0]][other[1]]["lon"]))]
                   for n, mine, other in ext],
    }
cities = {"source": "PeeringDB + TeleGeography landing points + RIPE Atlas traceroutes", "retrieved": RETRIEVED, "metroRadiusKm": METRO_KM, "countries": cities_out}

os.makedirs(OUT, exist_ok=True)
for name, payload in (("peering-interconnect.json", interconnect), ("peering-cities.json", cities)):
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(text)
    print(f"wrote {name}: {len(text) // 1024} KB")
print(f"countries: {len(countries)} | metros: {sum(len(v['cities']) for v in cities_out.values())} | country links: {len(country_links)}")
