from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .adapters import PortalAdapter
from .models import MarketObservation


def write_jsonl(adapter: PortalAdapter, observations: list[MarketObservation], root: Path) -> Path:
    run_date = datetime.now(timezone.utc).strftime("%Y%m%d")
    output_dir = root / run_date
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{adapter.code}.jsonl"
    with output_path.open("w", encoding="utf-8") as output:
        for observation in observations:
            output.write(json.dumps(observation.to_payload(), ensure_ascii=False, separators=(",", ":")))
            output.write("\n")
    return output_path


def read_jsonl(path: Path) -> list[MarketObservation]:
    observations: list[MarketObservation] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            observations.append(MarketObservation(**json.loads(line)))
    return observations


def build_ingestion_request(
    adapter: PortalAdapter,
    observations: list[MarketObservation],
) -> tuple[str, dict[str, Any]]:
    source_metadata = dict(getattr(adapter, "ingestion_metadata", {}) or {})
    usage_authorization = source_metadata.get("usageAuthorization")
    access_method = source_metadata.get("accessMethod")
    if usage_authorization not in {"AUTHORIZED", "RESEARCH_ONLY"}:
        raise RuntimeError(
            "Upload blocked: the source must be AUTHORIZED or explicitly scoped RESEARCH_ONLY."
        )
    if usage_authorization == "RESEARCH_ONLY":
        if access_method != "PUBLIC_WEB_RESEARCH" or adapter.code not in {
            "mercadolibre-inmuebles",
            "inmuebles24",
            "propiedades-com",
        }:
            raise RuntimeError("Research upload is restricted to the approved public portal adapters")
        rpc_name = "ingest_research_market_observations"
    else:
        rpc_name = "ingest_market_listing_observations"
    request_payload = {
        "p_source": {
            "source_code": adapter.code,
            "organization": adapter.organization,
            "name": adapter.name,
            "official_url": adapter.official_url,
            "geographic_scope": getattr(adapter, "geographic_scope", "México"),
            "update_frequency": getattr(adapter, "update_frequency", "daily"),
            "license_name": getattr(adapter, "license_name", "Authorized inventory feed"),
            "license_url": getattr(adapter, "license_url", None),
            "metadata": {
                **source_metadata,
                "visibility": "internal",
                "dataPolicyVersion": "minimal-comparables-v1",
                "storedFieldsExclude": ["phone", "email", "fullDescription", "photos"],
            },
        },
        "p_observations": [observation.to_payload() for observation in observations],
    }
    return rpc_name, request_payload


def upload_to_supabase(adapter: PortalAdapter, observations: list[MarketObservation]) -> dict[str, Any]:
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --upload")
    rpc_name, request_payload = build_ingestion_request(adapter, observations)
    payload = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        f"{supabase_url}/rest/v1/rpc/{rpc_name}",
        data=payload,
        method="POST",
        headers={
            "apikey": service_key,
            "authorization": f"Bearer {service_key}",
            "content-type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase ingestion failed ({error.code}): {body}") from error
