"""Holt die Patchnotes von foreverchanges.pro und schreibt data/patchnotes.json.

- RSS-Feed: Titel, Datum und Zusammenfassung jedes Builds/Hotfixes.
- Detailseite: jede einzelne Änderung pro Klasse/Volk und Spec (Buff, Nerf, Änderung),
  inklusive "statt"-Angabe (vorher → jetzt). Die Klassenseiten der Guides lesen das.

Englische Texte werden ins Deutsche übersetzt. Mit gesetzter Umgebungsvariable
DEEPL_API_KEY wird DeepL genutzt, sonst der freie Google-Translate-Endpunkt.
Bereits übersetzte Texte werden aus der vorhandenen JSON wiederverwendet.
Nur Standardbibliothek, läuft lokal und in der GitHub Action.
"""

import html as htmllib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

FEED_URL = "https://foreverchanges.pro/de/patch-notes/feed.xml"
SOURCE_URL = "https://foreverchanges.pro/de/patch-notes"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "patchnotes.json")
UA = "Mozilla/5.0 (compatible; foreverguides-bot/1.0; +https://github.com/syqdur/foreverguides)"

# Typische deutsche Wörter: reicht, um Englisch von Deutsch zu unterscheiden
GERMAN_HINTS = re.compile(r"\b(der|die|das|und|nicht|ist|ein|eine|mit|für|von|zu|den|dem|auf|sich|wird|werden)\b", re.I)
ENGLISH_HINTS = re.compile(r"\b(the|and|is|are|of|to|with|for|from|this|that|which|gets|get)\b", re.I)


def fetch(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def looks_english(text):
    return len(ENGLISH_HINTS.findall(text)) > len(GERMAN_HINTS.findall(text))


def looks_german(text):
    return len(GERMAN_HINTS.findall(text)) > len(ENGLISH_HINTS.findall(text))


def translate_deepl(text, key):
    return deepl_request([text], key)[0]


def deepl_request(texts, key):
    host = "api-free.deepl.com" if key.endswith(":fx") else "api.deepl.com"
    # formality=less: "du" statt "Sie", passend zum Rest der Seite
    params = [("text", t) for t in texts] + [("target_lang", "DE"), ("formality", "less")]
    raw = fetch(f"https://{host}/v2/translate", data=urllib.parse.urlencode(params).encode(),
                headers={"Authorization": f"DeepL-Auth-Key {key}"})
    return [r["text"] for r in json.loads(raw)["translations"]]


def translate_google(text):
    q = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "de", "dt": "t", "q": text})
    raw = fetch(f"https://translate.googleapis.com/translate_a/single?{q}")
    return "".join(part[0] for part in json.loads(raw)[0] if part[0])


def deepl_key():
    return os.environ.get("DEEPL_API_KEY", "").strip()


def translate(text):
    """Liefert (Übersetzung, Dienst). DeepL bevorzugt, Google als Rückfall."""
    if deepl_key():
        try:
            return translate_deepl(text, deepl_key()), "deepl"
        except Exception as exc:
            print(f"DeepL fehlgeschlagen, nutze Google: {exc}", file=sys.stderr)
    try:
        return translate_google(text), "google"
    except Exception as exc:  # Übersetzung ist optional, Original bleibt erhalten
        print(f"Übersetzung fehlgeschlagen: {exc}", file=sys.stderr)
        return None, None


def needs_retranslation(engine):
    """Mit DeepL-Schlüssel werden ältere Google-Übersetzungen einmalig ersetzt."""
    return bool(deepl_key()) and engine != "deepl"


GROUP_NAMES = {
    "warrior": "Krieger", "paladin": "Paladin", "hunter": "Jäger", "rogue": "Schurke",
    "priest": "Priester", "shaman": "Schamane", "mage": "Magier", "warlock": "Hexenmeister",
    "druid": "Druide", "human": "Mensch", "orc": "Orc", "dwarf": "Zwerg", "nightelf": "Nachtelf",
    "night-elf": "Nachtelf", "undead": "Untot", "tauren": "Tauren", "gnome": "Gnom",
    "troll": "Troll", "skyborne": "Skyborne",
}

BUILD_RE = re.compile(r'<li id="([^"]+)"[^>]*><div class="bt-build-id">')
GROUP_RE = re.compile(r'<details class="bt-note-class[^"]*" data-class="([a-z-]+)">(.*?)</details>', re.S)
SPEC_RE = re.compile(r'<h4 class="pn-spec">(.*?)</h4>(.*?)(?=<h4 class="pn-spec">|$)', re.S)
LINE_RE = re.compile(r'<svg class="v2-mark is-([a-z]+)".*?</svg><span class="pn-line">(.*?)</span></li>', re.S)
TAG_RE = re.compile(r"<[^>]+>")


def clean(fragment):
    return re.sub(r"\s+", " ", htmllib.unescape(TAG_RE.sub("", fragment.replace("<!-- -->", "")))).strip()


def parse_details(page):
    """Liefert {build_id: [Änderung, ...]} aus der Detailseite."""
    page = page.split("self.__next_f", 1)[0]  # nur das gerenderte HTML, nicht den JS-Payload
    starts = list(BUILD_RE.finditer(page))
    result = {}
    for idx, match in enumerate(starts):
        end = starts[idx + 1].start() if idx + 1 < len(starts) else len(page)
        changes = []
        for group, block in GROUP_RE.findall(page[match.start():end]):
            # Völker haben keine Spec-Überschriften, dann gilt der ganze Block als "Allgemein"
            for spec, body in SPEC_RE.findall(block) or [("Allgemein", block)]:
                for kind, line in LINE_RE.findall(body):
                    spell_m = re.search(r"<a [^>]*>(.*?)</a>", line, re.S)
                    spell = clean(spell_m.group(1)) if spell_m else ""
                    text = clean(line[spell_m.end():] if spell_m else line).lstrip(": ").strip()
                    changes.append({
                        "group": group,
                        "group_de": GROUP_NAMES.get(group, group.title()),
                        "spec": clean(spec),
                        "type": kind,  # buff | nerf | change
                        "spell": spell,
                        "source": text,
                    })
        result[match.group(1)] = changes
    return result


def translate_many(texts):
    """Übersetzt eine Liste englischer Texte, in kleinen Paketen pro Anfrage.

    Liefert {Original: (Übersetzung, Dienst)}.
    """
    out = {}
    batch = 25
    for i in range(0, len(texts), batch):
        chunk = texts[i:i + batch]
        try:
            if deepl_key():
                results, engine = deepl_request(chunk, deepl_key()), "deepl"
            else:
                results, engine = translate_google("\n".join(chunk)).split("\n"), "google"
            if len(results) != len(chunk):
                raise ValueError("Zeilenzahl passt nicht")
            results = [(r, engine) for r in results]
        except Exception:
            results = [translate(t) for t in chunk]  # Fallback: einzeln
        for src, (dst, engine) in zip(chunk, results):
            if dst:
                out[src] = (dst.strip(), engine)
    return out


def load_previous():
    try:
        with open(OUT_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"items": []}


def main():
    previous = load_previous()
    cache = {item["id"]: item for item in previous.get("items", [])}
    line_cache = {c["source"]: (c["text"], c.get("engine", "google")) for item in previous.get("items", [])
                  for c in item.get("changes", []) if c.get("translated")}

    try:
        details = parse_details(fetch(SOURCE_URL).decode("utf-8"))
    except Exception as exc:  # Detailseite optional: Feed allein reicht für die Liste
        print(f"Detailseite nicht lesbar: {exc}", file=sys.stderr)
        details = {}

    pending = sorted({c["source"] for cs in details.values() for c in cs
                      if not looks_german(c["source"])
                      and (c["source"] not in line_cache or needs_retranslation(line_cache[c["source"]][1]))})
    if pending:
        print(f"Übersetze {len(pending)} Detailzeilen …")
        line_cache.update(translate_many(pending))
    for cs in details.values():
        for c in cs:
            text, engine = line_cache.get(c["source"], (c["source"], None))
            c["text"] = text
            c["translated"] = engine is not None
            if engine:
                c["engine"] = engine

    root = ET.fromstring(fetch(FEED_URL))
    channel = root.find("channel")
    items = []
    for node in channel.iter("item"):
        guid = (node.findtext("guid") or node.findtext("link") or "").strip()
        title = (node.findtext("title") or "").strip()
        summary = (node.findtext("description") or "").strip()
        link = (node.findtext("link") or SOURCE_URL).strip()
        pub = node.findtext("pubDate")
        date = parsedate_to_datetime(pub).date().isoformat() if pub else None

        old = cache.get(guid)
        translated, engine = False, None
        if looks_english(summary):
            if (old and old.get("source_summary") == summary and old.get("translated")
                    and not needs_retranslation(old.get("engine", "google"))):
                summary_de, translated, engine = old["summary"], True, old.get("engine", "google")
            else:
                result, engine = translate(summary)
                summary_de, translated = (result, True) if result else (summary, False)
        else:
            summary_de = summary

        items.append({
            "id": guid,
            "title": title,
            "date": date,
            "kind": "hotfix" if title.lower().startswith("hotfix") else "build",
            "summary": summary_de,
            "source_summary": summary,
            "translated": translated,
            "engine": engine,
            "link": link,
            "changes": details.get(link.split("#", 1)[-1], []),
        })

    data = {
        "source": SOURCE_URL,
        "feed": FEED_URL,
        "last_build": channel.findtext("lastBuildDate"),
        "items": items,
    }

    # Nur schreiben, wenn sich inhaltlich etwas geändert hat (keine leeren Commits)
    if {k: v for k, v in previous.items() if k != "fetched_at"} == data:
        print("Keine Änderungen.")
        return

    data["fetched_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(items)} Einträge geschrieben, {sum(i['translated'] for i in items)} übersetzt.")


if __name__ == "__main__":
    main()
