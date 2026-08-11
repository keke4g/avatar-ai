from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Iterable, Iterator
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

WHITESPACE = re.compile(r"\s+")
MONEY_NUMBER = re.compile(r"(?<!\d)(\d{1,3}(?:[.,\s]\d{3})+|\d{4,})(?:[.,](\d{1,2}))?(?!\d)")
ROOM_PATTERNS = {
    "bedrooms": re.compile(
        r"(\d+(?:[.,]\d+)?)\s*(?:rec(?:[aá�]maras?|\.)|habitaciones?|dormitorios?)",
        re.I,
    ),
    "bathrooms": re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:ba(?:ñ|n|�)os?|ba(?:ñ|n|�)os completos?)", re.I),
    "parking_spaces": re.compile(r"(\d+)\s*(?:estacionamientos?|estac\.?|cocheras?|cajones?)", re.I),
}
BUILT_SURFACE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*m(?:²|2|�)\s*(?:de\s*)?(?:construcci[oó�]n|construidos?|habitables?|constr\.?)",
    re.I,
)
LAND_SURFACE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*m(?:²|2|�)\s*(?:de\s*)?(?:terreno|lote)",
    re.I,
)
BUILT_SURFACE_PREFIX = re.compile(
    r"(?:construcci[oó�]n|construidos?|habitables?|constr\.?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*m(?:²|2|�)",
    re.I,
)
LAND_SURFACE_PREFIX = re.compile(
    r"(?:terreno|lote)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*m(?:²|2|�)",
    re.I,
)
GENERIC_SURFACE = re.compile(r"(\d+(?:[.,]\d+)?)\s*m(?:²|2|�)(?:\b|\s)", re.I)
NEIGHBORHOOD = re.compile(
    r"(?:col(?:onia)?\.?|fracc(?:ionamiento)?\.?|residencial)\s+([^,|;·•\n]{2,70})",
    re.I,
)
POSTAL_CODE = re.compile(r"\bC\.?P\.?\s*(\d{5})\b", re.I)
EXCLUDED_LISTING = re.compile(
    r"\b(remate|remates|adjudicaci[oó]n|cesi[oó]n de derechos|recuperaci[oó]n bancaria|subasta)\b",
    re.I,
)


def clean_text(value: Any) -> str:
    return WHITESPACE.sub(" ", str(value or "").replace("\u00a0", " ")).strip()


def ascii_key(value: str) -> str:
    normalized = unicodedata.normalize("NFD", clean_text(value).lower())
    return "".join(character for character in normalized if unicodedata.category(character) != "Mn")


def canonical_url(value: str) -> str:
    split = urlsplit(value)
    kept_query = [
        (key, val)
        for key, val in parse_qsl(split.query, keep_blank_values=True)
        if not key.lower().startswith(("utm_", "matt_"))
        and not key.lower().startswith("n_")
        and key.lower() not in {"tracking_id", "position", "search_layout", "type"}
    ]
    return urlunsplit((split.scheme.lower(), split.netloc.lower(), split.path.rstrip("/"), urlencode(kept_query), ""))


def stable_reference(source_code: str, url: str) -> str:
    return hashlib.sha256(f"{source_code}:{canonical_url(url)}".encode("utf-8")).hexdigest()[:32]


def syndication_fingerprint(
    *,
    neighborhood: str,
    property_type: str,
    operation: str,
    price: float,
    built: float | None,
    land: float | None,
    bedrooms: float | None,
    bathrooms: float | None,
) -> str:
    """Create a portal-independent hint for the same advertised home.

    It intentionally uses only comparison fields. The fingerprint is a dedupe
    hint, never a public identifier, and does not retain addresses or contacts.
    """
    signature = "|".join((
        ascii_key(neighborhood),
        property_type,
        operation,
        str(round(price / 10_000)),
        str(round(built or 0)),
        str(round(land or 0)),
        str(round((bedrooms or 0) * 2)),
        str(round((bathrooms or 0) * 2)),
    ))
    return hashlib.sha256(signature.encode("utf-8")).hexdigest()[:32]


def parse_decimal(value: str | None) -> float | None:
    if not value:
        return None
    raw = clean_text(value).replace(" ", "")
    if raw.count(",") == 1 and raw.count(".") == 0 and len(raw.split(",")[-1]) <= 2:
        raw = raw.replace(",", ".")
    else:
        raw = raw.replace(",", "")
    try:
        number = float(raw)
    except ValueError:
        return None
    return number if number >= 0 else None


def parse_price(text: str) -> tuple[float | None, str]:
    normalized = clean_text(text)
    currency = "USD" if re.search(r"\b(?:USD|US\$|U\$S|D[oó]LARES?)\b", normalized, re.I) else "MXN"
    lowered = ascii_key(normalized)
    for match in MONEY_NUMBER.finditer(normalized):
        amount = parse_decimal(match.group(0))
        if amount is None:
            continue
        tail = lowered[match.end(): match.end() + 18]
        if re.match(r"\s*(?:m2|m²|recamar|ban|estacion)", tail):
            continue
        prefix = lowered[max(0, match.start() - 16):match.start()]
        if "$" in normalized[max(0, match.start() - 8):match.start()] or re.search(
            r"(?:mxn|usd|mn|precio)\s*$", prefix
        ):
            return amount, currency
    match = MONEY_NUMBER.search(normalized)
    return (parse_decimal(match.group(0)), currency) if match else (None, currency)


def parse_rooms(text: str) -> dict[str, float | int | None]:
    values: dict[str, float | int | None] = {}
    for field, pattern in ROOM_PATTERNS.items():
        match = pattern.search(text)
        value = parse_decimal(match.group(1)) if match else None
        values[field] = int(value) if field == "parking_spaces" and value is not None else value
    return values


def parse_surfaces(text: str) -> tuple[float | None, float | None]:
    built_match = BUILT_SURFACE.search(text) or BUILT_SURFACE_PREFIX.search(text)
    land_match = LAND_SURFACE.search(text) or LAND_SURFACE_PREFIX.search(text)
    built = parse_decimal(built_match.group(1)) if built_match else None
    land = parse_decimal(land_match.group(1)) if land_match else None
    # A portal card commonly renders only ``104 m² lote``.  Treating that
    # same number as both land and construction creates a false price/m².
    # An unlabeled generic surface is usable as construction only when the
    # text did not explicitly identify either kind of surface.
    if built is None and land is None:
        generic = GENERIC_SURFACE.search(text)
        built = parse_decimal(generic.group(1)) if generic else None
    return land, built


def infer_operation(text: str, url: str) -> str | None:
    url_value = ascii_key(url)
    if re.search(r"(?:^|[/_-])(renta|alquiler|arrendamiento)(?:[/_.-]|$)", url_value):
        return "ASKING_RENT"
    if re.search(r"(?:^|[/_-])(venta|comprar)(?:[/_.-]|$)", url_value):
        return "ASKING_SALE"
    value = ascii_key(text)
    if re.search(r"\b(renta|alquiler|arrendamiento)\b", value):
        return "ASKING_RENT"
    if re.search(r"\b(venta|comprar)\b", value):
        return "ASKING_SALE"
    return None


def infer_property_type(text: str, url: str) -> str | None:
    value = ascii_key(f"{url} {text}")
    types = (
        (r"\b(casa|casas|villa|residencia)\b", "HOUSE"),
        (r"\b(departamento|departamentos|depto|apartamento)\b", "APARTMENT"),
        (r"\b(terreno|terrenos|lote)\b", "LAND"),
        (r"\b(local|locales)\b", "COMMERCIAL"),
        (r"\b(oficina|oficinas)\b", "OFFICE"),
        (r"\b(loft|lofts)\b", "LOFT"),
    )
    for pattern, property_type in types:
        if re.search(pattern, value):
            return property_type
    return None


def extract_neighborhood(text: str) -> str | None:
    match = NEIGHBORHOOD.search(text)
    if not match:
        return None
    value = re.split(r"\b(?:C\.?P\.?|Culiac[aá]n|Sinaloa|M[eé]xico)\b", match.group(1), maxsplit=1, flags=re.I)[0]
    return clean_text(value).strip(" .,-") or None


def quality_score(*, price: float | None, neighborhood: str | None, property_type: str | None,
                  built: float | None, land: float | None, bedrooms: float | None,
                  bathrooms: float | None, latitude: float | None, longitude: float | None) -> float:
    score = 0.0
    score += 25 if price and price > 0 else 0
    score += 20 if neighborhood else 0
    score += 12 if property_type else 0
    score += 18 if built and built > 0 else 0
    score += 8 if land and land > 0 else 0
    score += 5 if bedrooms is not None else 0
    score += 5 if bathrooms is not None else 0
    score += 7 if latitude is not None and longitude is not None else 0
    return min(100.0, score)


def iter_json_objects(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_json_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_json_objects(child)


def parse_json_scripts(values: Iterable[str]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for value in values:
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        output.extend(iter_json_objects(parsed))
    return output
