from __future__ import annotations

import argparse
import json
from pathlib import Path

from .adapters import PORTALS
from .storage import build_ingestion_request, read_jsonl


def _dollar_quote(value: object, tag: str) -> str:
    serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    delimiter = f"${tag}$"
    if delimiter in serialized:
        raise ValueError("Unexpected SQL dollar-quote delimiter in payload")
    return f"{delimiter}{serialized}{delimiter}::jsonb"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export minimal research observations as an auditable SQL migration")
    parser.add_argument(
        "--input",
        action="append",
        required=True,
        help="PORTAL=PATH to a normalized private JSONL snapshot (repeatable)",
    )
    parser.add_argument(
        "--exclude-reference",
        action="append",
        default=[],
        help="Exclude a portal external reference from the generated migration (repeatable)",
    )
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    excluded_references = {value.strip() for value in args.exclude_reference if value.strip()}

    statements = [
        "-- Generated from minimal public comparable snapshots.",
        "-- Raw descriptions, contacts and media are intentionally absent.",
    ]
    total = 0
    for index, input_spec in enumerate(args.input, start=1):
        if "=" not in input_spec:
            raise SystemExit("Each --input must use PORTAL=PATH")
        portal_code, raw_path = input_spec.split("=", 1)
        if portal_code not in PORTALS:
            raise SystemExit(f"Unknown portal: {portal_code}")
        observations = [
            observation
            for observation in read_jsonl(Path(raw_path))
            if observation.external_reference not in excluded_references
        ]
        if any(item.source_code != portal_code for item in observations):
            raise SystemExit(f"Snapshot source mismatch for {portal_code}")
        rpc_name, payload = build_ingestion_request(PORTALS[portal_code], observations)
        if rpc_name != "ingest_research_market_observations":
            raise SystemExit(f"Refusing to SQL-export a non-research source: {portal_code}")
        statements.extend((
            "",
            f"-- {portal_code}: {len(observations)} observations",
            "select public.ingest_research_market_observations(",
            f"  {_dollar_quote(payload['p_source'], f'research_source_{index}')},",
            f"  {_dollar_quote(payload['p_observations'], f'research_rows_{index}')}",
            ");",
        ))
        total += len(observations)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output_path),
        "sources": len(args.input),
        "observations": total,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
