from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from .adapters import PORTALS
from .cli import load_dotenv
from .models import MarketObservation
from .normalization import canonical_url, quality_score
from .storage import upload_to_supabase, write_jsonl


def _optional_number(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def observations_from_browser_json(
    payload: object,
    *,
    portal_code: str,
    neighborhood: str,
    city: str,
    state: str,
) -> list[MarketObservation]:
    adapter = PORTALS[portal_code]
    rows = payload.get("listings", []) if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("The browser payload must be a list or contain a listings list")

    observations: list[MarketObservation] = []
    seen: set[str] = set()
    for row in rows[:500]:
        if not isinstance(row, dict):
            continue
        source_url = canonical_url(str(row.get("source_url") or ""))
        if not adapter.allows_url(source_url) or not adapter.is_detail_url(source_url):
            continue
        title = str(row.get("title") or "").strip()
        if neighborhood.casefold() not in title.casefold():
            continue
        external_reference = str(row.get("external_id") or adapter.external_reference(source_url, title))
        if external_reference in seen:
            continue

        price = _optional_number(row.get("price"))
        built = _optional_number(row.get("construction_area_m2"))
        bedrooms = _optional_number(row.get("bedrooms"))
        bathrooms = _optional_number(row.get("bathrooms"))
        if price is None or price < 200_000 or price > 300_000_000:
            continue
        if built is not None and built < 25:
            continue
        if built is not None and not 1_500 <= price / built <= 250_000:
            continue

        score = quality_score(
            price=price,
            neighborhood=neighborhood,
            property_type="HOUSE",
            built=built,
            land=None,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            latitude=None,
            longitude=None,
        )
        if score < 55:
            continue
        observations.append(MarketObservation(
            source_code=portal_code,
            external_reference=external_reference,
            source_url=source_url,
            observation_kind="ASKING_SALE",
            observation_date=date.today().isoformat(),
            property_type="HOUSE",
            title=title[:240],
            neighborhood=neighborhood[:120],
            city=city[:120],
            state=state[:120],
            price_amount=price,
            currency="MXN",
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            surface_built_m2=built,
            quality_score=score,
            parser_version="towers-browser-research-v2",
            last_verified_at=datetime.now(timezone.utc).isoformat(),
            location_precision="NEIGHBORHOOD",
            data_completeness=sum(value is not None for value in (
                price,
                "HOUSE",
                neighborhood,
                city and state,
                built,
                bedrooms,
                bathrooms,
                source_url,
            )) / 8,
            attributes={
                "collector": "controlled-public-browser-fallback",
                "askingPrice": True,
                "originalCurrency": "MXN",
                "fallbackReason": "portal transport unavailable to automated fetcher",
                "researchOnly": True,
                "publicationDateKnown": False,
            },
        ))
        seen.add(external_reference)
    return observations


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a minimal public browser snapshot into private market observations")
    parser.add_argument("--portal", choices=PORTALS.keys(), required=True)
    parser.add_argument("--neighborhood", required=True)
    parser.add_argument("--city", default="Culiacán Rosales")
    parser.add_argument("--state", default="Sinaloa")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--output", default=".market-scraper-cache")
    parser.add_argument("--upload", action="store_true")
    args = parser.parse_args()

    load_dotenv(Path(args.env_file))
    payload = json.load(sys.stdin)
    adapter = PORTALS[args.portal]
    observations = observations_from_browser_json(
        payload,
        portal_code=args.portal,
        neighborhood=args.neighborhood,
        city=args.city,
        state=args.state,
    )
    output_path = write_jsonl(adapter, observations, Path(args.output))
    upload_result = upload_to_supabase(adapter, observations) if args.upload and observations else None
    print(json.dumps({
        "portal": args.portal,
        "observations": len(observations),
        "output": str(output_path),
        "upload": upload_result,
    }, ensure_ascii=False, indent=2))
    return 0 if observations else 1


if __name__ == "__main__":
    raise SystemExit(main())
