from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .adapters import PORTALS
from .cli import load_dotenv
from .collector import DEFAULT_USER_AGENT, MarketCollector
from .models import MarketObservation
from .storage import upload_to_supabase, write_jsonl

DEFAULT_MANIFEST = Path(__file__).with_name("research_markets.json")


def load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    markets = payload.get("markets")
    if payload.get("version") != 1 or not isinstance(markets, list) or not markets:
        raise ValueError("The research market manifest must contain a non-empty version 1 market list")
    target_ids: list[str] = []
    seen_market_ids: set[str] = set()
    for market in markets:
        market_id = str(market.get("id") or "").strip()
        if not market_id or market_id in seen_market_ids:
            raise ValueError(f"Invalid or duplicate market id: {market_id!r}")
        seen_market_ids.add(market_id)
        target_ids.extend(str(value) for value in market.get("targetPropertyIds", []))
        if not market.get("city") or not market.get("state") or not market.get("neighborhood"):
            raise ValueError(f"Market {market_id} is missing city, state or neighborhood")
        if market.get("expectedOperation") not in {"ASKING_SALE", "ASKING_RENT"}:
            raise ValueError(f"Market {market_id} has an invalid expectedOperation")
        if market.get("expectedType") not in {"HOUSE", "APARTMENT", "LAND", "COMMERCIAL", "OFFICE", "LOFT"}:
            raise ValueError(f"Market {market_id} has an invalid expectedType")
        for source in market.get("sources", []):
            if source.get("portal") not in PORTALS or not source.get("seed"):
                raise ValueError(f"Market {market_id} contains an invalid source")
    if len(target_ids) != len(set(target_ids)):
        raise ValueError("A target property appears in more than one research market")
    if payload.get("inventoryCount") != len(target_ids):
        raise ValueError(
            f"Manifest covers {len(target_ids)} targets, expected {payload.get('inventoryCount')}"
        )
    return payload


def filter_market_observations(
    observations: list[MarketObservation],
    market: dict[str, Any],
) -> list[MarketObservation]:
    excluded = {str(value) for value in market.get("excludeExternalReferences", [])}
    expected_operation = market["expectedOperation"]
    expected_type = market["expectedType"]
    return [
        observation
        for observation in observations
        if observation.observation_kind == expected_operation
        and observation.property_type == expected_type
        and observation.external_reference not in excluded
    ]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect the complete Towers public inventory research scope with Scrapling"
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--market", action="append", default=[], help="Only run this market id (repeatable)")
    parser.add_argument("--portal", action="append", default=[], choices=sorted(PORTALS))
    parser.add_argument("--max-pages", type=int, help="Global upper bound per source")
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--output", default=".market-scraper-cache/all-inventory")
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--env-file", default=".env.local")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv(Path(args.env_file))
    manifest = load_manifest(Path(args.manifest))
    requested_markets = set(args.market)
    requested_portals = set(args.portal)
    unknown_markets = requested_markets - {market["id"] for market in manifest["markets"]}
    if unknown_markets:
        raise SystemExit(f"Unknown market ids: {', '.join(sorted(unknown_markets))}")

    summaries: list[dict[str, Any]] = []
    total_observations = 0
    covered_targets: set[str] = set()
    for market in manifest["markets"]:
        if requested_markets and market["id"] not in requested_markets:
            continue
        market_total = 0
        for source in market["sources"]:
            portal_code = source["portal"]
            if requested_portals and portal_code not in requested_portals:
                continue
            adapter = PORTALS[portal_code]
            configured_pages = max(1, int(source.get("maxPages", 1)))
            max_pages = min(configured_pages, args.max_pages) if args.max_pages else configured_pages
            collector = MarketCollector(
                adapter,
                render_js=bool(source.get("renderJs", False)),
                include_details=bool(source.get("includeDetails", False)),
                min_delay_seconds=args.delay,
                max_pages=max_pages,
                max_observations=max(1, int(source.get("maxObservations", 100))),
                user_agent=os.environ.get("MARKET_SCRAPER_USER_AGENT", DEFAULT_USER_AGENT),
                allow_unavailable_robots=True,
                city=market["city"],
                state=market["state"],
                neighborhood=market["neighborhood"],
            )
            observations = filter_market_observations(
                collector.collect([source["seed"]]),
                market,
            )
            output_path = write_jsonl(
                adapter,
                observations,
                Path(args.output) / market["id"],
            )
            upload_result = upload_to_supabase(adapter, observations) if args.upload and observations else None
            market_total += len(observations)
            total_observations += len(observations)
            summaries.append({
                "marketId": market["id"],
                "targetPropertyIds": market["targetPropertyIds"],
                "portal": portal_code,
                "observations": len(observations),
                "output": str(output_path),
                "stats": asdict(collector.stats),
                "upload": upload_result,
            })
        if market_total > 0:
            covered_targets.update(market["targetPropertyIds"])

    selected_targets = {
        target_id
        for market in manifest["markets"]
        if not requested_markets or market["id"] in requested_markets
        for target_id in market["targetPropertyIds"]
    }
    print(json.dumps({
        "inventoryTargets": len(selected_targets),
        "targetsWithAtLeastOneObservation": len(covered_targets),
        "targetsWithoutObservations": sorted(selected_targets - covered_targets),
        "observations": total_observations,
        "runs": summaries,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
