from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict
from pathlib import Path

from .adapters import PORTALS
from .collector import DEFAULT_USER_AGENT, MarketCollector
from .storage import read_jsonl, upload_to_supabase, write_jsonl


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Collect private asking-price observations with Scrapling")
    parser.add_argument("--portal", choices=["all", *PORTALS.keys()], default="all")
    parser.add_argument("--seed", action="append", default=[], help="Override seed URL (repeatable; one portal only)")
    parser.add_argument("--city", help="City assigned to custom seeds; defaults to the portal seed market")
    parser.add_argument("--state", help="State assigned to custom seeds; defaults to the portal seed market")
    parser.add_argument("--neighborhood", help="Keep only observations from this micromarket")
    parser.add_argument("--max-pages", type=int, default=12)
    parser.add_argument("--max-observations", type=int, default=500)
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--render-js", action="store_true", help="Use Chromium without stealth or CAPTCHA bypass")
    parser.add_argument("--include-details", action="store_true", help="Visit detail links in addition to result cards")
    parser.add_argument("--upload", action="store_true", help="Upload normalized observations through the service-role RPC")
    parser.add_argument("--output", default=".market-scraper-cache")
    parser.add_argument("--env-file", default=".env.local", help="Environment file used for the private upload")
    parser.add_argument("--input", help="Upload an existing private JSONL file without fetching pages")
    parser.add_argument(
        "--allow-unavailable-robots",
        action="store_true",
        help="Proceed only when robots.txt is unavailable; an explicit deny still blocks collection",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv(Path(args.env_file))
    requested = list(PORTALS.values()) if args.portal == "all" else [PORTALS[args.portal]]
    if args.seed and len(requested) != 1:
        raise SystemExit("--seed requires a single --portal")
    if args.seed and (not args.city or not args.state):
        raise SystemExit("Custom --seed URLs require explicit --city and --state")
    if args.input and len(requested) != 1:
        raise SystemExit("--input requires a single --portal")

    summaries = []
    exit_code = 0
    for adapter in requested:
        collector = MarketCollector(
            adapter,
            render_js=args.render_js,
            include_details=args.include_details,
            min_delay_seconds=args.delay,
            max_pages=args.max_pages,
            max_observations=args.max_observations,
            user_agent=os.environ.get("MARKET_SCRAPER_USER_AGENT", DEFAULT_USER_AGENT),
            allow_unavailable_robots=args.allow_unavailable_robots,
            city=args.city or adapter.default_city,
            state=args.state or adapter.default_state,
            neighborhood=args.neighborhood,
        )
        observations = read_jsonl(Path(args.input)) if args.input else collector.collect(args.seed or adapter.default_seeds)
        output_path = Path(args.input) if args.input else write_jsonl(adapter, observations, Path(args.output))
        upload_result = upload_to_supabase(adapter, observations) if args.upload and observations else None
        summaries.append({
            "portal": adapter.code,
            "market": {
                "city": args.city or adapter.default_city,
                "state": args.state or adapter.default_state,
                "neighborhood": args.neighborhood,
            },
            "observations": len(observations),
            "output": str(output_path),
            "stats": asdict(collector.stats),
            "upload": upload_result,
        })
        if collector.stats.failed_pages and not observations:
            exit_code = 1
    print(json.dumps({"runs": summaries}, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
