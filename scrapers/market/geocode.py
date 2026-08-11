from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .adapters import PORTALS
from .cli import load_dotenv
from .normalization import ascii_key, syndication_fingerprint
from .storage import read_jsonl, write_jsonl

STREET_HINT = re.compile(
    r"(?:#\s*\d+|\b(?:calle|av(?:enida)?\.?|blvd\.?|boulevard|circuito|privada|carretera)\b[^,]{0,80}\b\d+\b)",
    re.I,
)
POINT_LOCATION_TYPES = {"ROOFTOP", "RANGE_INTERPOLATED"}


def _first_seen_timestamp(observation_date: str) -> str:
    try:
        parsed = datetime.strptime(observation_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        parsed = datetime.now(timezone.utc)
    return parsed.isoformat()


def _geocode(query: str, api_key: str) -> dict[str, object] | None:
    params = urlencode({
        "address": query,
        "components": "country:MX",
        "language": "es",
        "region": "mx",
        "key": api_key,
    })
    request = Request(
        f"https://maps.googleapis.com/maps/api/geocode/json?{params}",
        headers={"User-Agent": "TowersMexicoMarketResearchBot/1.0 (+https://towersmexico.com)"},
    )
    with urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("status") != "OK" or not payload.get("results"):
        return None
    return payload["results"][0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Enrich public comparables with conservative Google geocoding")
    parser.add_argument("--portal", choices=PORTALS.keys(), required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default=".market-scraper-cache/research-20260809")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--max-requests", type=int, default=12)
    parser.add_argument("--delay", type=float, default=0.25)
    args = parser.parse_args()

    load_dotenv(Path(args.env_file))
    api_key = (
        os.environ.get("GOOGLE_API_KEY", "").strip()
        or os.environ.get("NEXT_PUBLIC_GOOGLE_API_KEY", "").strip()
        or os.environ.get("REACT_APP_GOOGLE_MAPS_API_KEY", "").strip()
    )
    if not api_key:
        raise SystemExit("A Google geocoding API key is required")

    observations = read_jsonl(Path(args.input))
    requested = 0
    point_matches = 0
    approximate_matches = 0
    failures = 0
    for observation in observations:
        first_seen = _first_seen_timestamp(observation.observation_date)
        observation.published_at = observation.published_at or first_seen
        observation.last_verified_at = observation.last_verified_at or first_seen
        observation.location_precision = "POINT" if (
            observation.latitude is not None and observation.longitude is not None
        ) else "NEIGHBORHOOD"
        observation.parser_version = "towers-public-research-v2"
        observation.syndication_fingerprint = observation.syndication_fingerprint or syndication_fingerprint(
            neighborhood=observation.neighborhood,
            property_type=observation.property_type,
            operation=observation.observation_kind,
            price=observation.price_amount,
            built=observation.surface_built_m2,
            land=observation.surface_total_m2,
            bedrooms=observation.bedrooms,
            bathrooms=observation.bathrooms,
        )
        critical_fields = (
            observation.price_amount,
            observation.property_type,
            observation.neighborhood,
            observation.city and observation.state,
            observation.surface_built_m2 or observation.surface_total_m2,
            observation.bedrooms,
            observation.bathrooms,
            observation.source_url,
        )
        observation.data_completeness = sum(
            value is not None and value != "" for value in critical_fields
        ) / len(critical_fields)
        observation.attributes = {
            **observation.attributes,
            "researchOnly": True,
            "publicationDateKnown": bool(observation.attributes.get("publicationDateKnown", False)),
            "firstPublicEvidenceAt": first_seen,
        }

        if observation.location_precision == "POINT" or requested >= max(0, args.max_requests):
            continue
        title = observation.title or ""
        if not STREET_HINT.search(title):
            continue
        query_title = re.sub(r"\bID\s*:\s*\d+\b", "", title, flags=re.I)
        query = f"{query_title}, {observation.neighborhood}, {observation.city}, {observation.state}, México"
        requested += 1
        try:
            result = _geocode(query, api_key)
        except Exception:
            failures += 1
            continue
        if not result:
            failures += 1
            continue
        formatted_address = str(result.get("formatted_address") or "")
        geometry = result.get("geometry") if isinstance(result.get("geometry"), dict) else {}
        location = geometry.get("location") if isinstance(geometry.get("location"), dict) else {}
        location_type = str(geometry.get("location_type") or "").upper()
        latitude = location.get("lat")
        longitude = location.get("lng")
        same_neighborhood = ascii_key(observation.neighborhood) in ascii_key(formatted_address)
        if (
            location_type in POINT_LOCATION_TYPES
            and same_neighborhood
            and isinstance(latitude, (int, float))
            and isinstance(longitude, (int, float))
            and 14 <= float(latitude) <= 33.5
            and -118.5 <= float(longitude) <= -86
        ):
            observation.latitude = float(latitude)
            observation.longitude = float(longitude)
            observation.location_precision = "POINT"
            observation.attributes["geocodeProvider"] = "Google Geocoding"
            observation.attributes["geocodeLocationType"] = location_type
            observation.attributes["geocodedAt"] = datetime.now(timezone.utc).isoformat()
            point_matches += 1
        else:
            approximate_matches += 1
        time.sleep(max(0.1, args.delay))

    output_path = write_jsonl(PORTALS[args.portal], observations, Path(args.output))
    print(json.dumps({
        "portal": args.portal,
        "observations": len(observations),
        "geocodeRequests": requested,
        "pointMatches": point_matches,
        "approximateMatches": approximate_matches,
        "failures": failures,
        "output": str(output_path),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
