from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .authorized_sources import EasyBrokerProvider, MercadoLibreApiProvider, parse_bbox
from .cli import load_dotenv
from .storage import upload_to_supabase, write_jsonl


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "si", "sí"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Collect contractually authorized real-estate inventory")
    parser.add_argument("--provider", choices=("easybroker", "mercadolibre-api"), required=True)
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument("--max-observations", type=int, default=500)
    parser.add_argument("--output", default=".market-authorized-cache")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--base-url", help="EasyBroker API base URL (for official staging tests only)")
    parser.add_argument("--bbox", help="Mercado Libre south,north,west,east")
    parser.add_argument("--category", action="append", default=[], help="Mercado Libre category ID")
    parser.add_argument("--city", default="")
    parser.add_argument("--state", default="")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv(Path(args.env_file))

    if args.provider == "easybroker":
        if not _truthy(os.environ.get("EASYBROKER_AVM_USE_AUTHORIZED")):
            raise SystemExit("Set EASYBROKER_AVM_USE_AUTHORIZED=true only after the inventory owner has consented")
        provider = EasyBrokerProvider(
            os.environ.get("EASYBROKER_API_KEY", ""),
            os.environ.get("EASYBROKER_AUTHORIZATION_REFERENCE", ""),
            base_url=args.base_url or "https://api.easybroker.com/v1",
            source_code=os.environ.get("EASYBROKER_SOURCE_CODE", "easybroker-owner-authorized"),
        )
    else:
        if not _truthy(os.environ.get("MERCADOLIBRE_AVM_USE_AUTHORIZED")):
            raise SystemExit("Mercado Libre ingestion requires explicit contractual AVM authorization")
        bbox_value = args.bbox or os.environ.get("MERCADOLIBRE_SEARCH_BBOX", "")
        categories = args.category or [
            item.strip() for item in os.environ.get("MERCADOLIBRE_CATEGORY_IDS", "").split(",") if item.strip()
        ]
        provider = MercadoLibreApiProvider(
            os.environ.get("MERCADOLIBRE_ACCESS_TOKEN", ""),
            os.environ.get("MERCADOLIBRE_AVM_CONTRACT_ID", ""),
            bbox=parse_bbox(bbox_value),
            category_ids=categories,
            city=args.city or os.environ.get("MERCADOLIBRE_SEARCH_CITY", ""),
            state=args.state or os.environ.get("MERCADOLIBRE_SEARCH_STATE", ""),
        )

    observations = provider.collect(
        max_pages=max(1, args.max_pages),
        max_observations=max(1, args.max_observations),
    )
    output_path = write_jsonl(provider.source, observations, Path(args.output))
    upload_result = upload_to_supabase(provider.source, observations) if args.upload and observations else None
    print(json.dumps({
        "provider": args.provider,
        "observations": len(observations),
        "output": str(output_path),
        "upload": upload_result,
    }, ensure_ascii=False, indent=2))
    return 0 if observations else 1


if __name__ == "__main__":
    raise SystemExit(main())

