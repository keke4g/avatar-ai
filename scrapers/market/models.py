from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any, Literal

ObservationKind = Literal["ASKING_SALE", "ASKING_RENT"]


@dataclass(slots=True)
class MarketObservation:
    source_code: str
    external_reference: str
    source_url: str
    observation_kind: ObservationKind
    observation_date: str
    property_type: str
    title: str
    neighborhood: str
    city: str
    state: str
    price_amount: float
    currency: str = "MXN"
    latitude: float | None = None
    longitude: float | None = None
    bedrooms: float | None = None
    bathrooms: float | None = None
    parking_spaces: int | None = None
    construction_age: int | None = None
    conservation_state: str | None = None
    surface_total_m2: float | None = None
    surface_built_m2: float | None = None
    quality_score: float = 0
    parser_version: str = "towers-scrapling-v1"
    published_at: str | None = None
    last_verified_at: str | None = None
    location_precision: str = "UNKNOWN"
    syndication_fingerprint: str | None = None
    data_completeness: float | None = None
    attributes: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.observation_date:
            self.observation_date = date.today().isoformat()
        if self.price_amount <= 0:
            raise ValueError("price_amount must be positive")
        if self.observation_kind not in {"ASKING_SALE", "ASKING_RENT"}:
            raise ValueError(f"Unsupported observation kind: {self.observation_kind}")
        if not self.external_reference or not self.source_url:
            raise ValueError("Every observation needs a source reference and URL")
        if self.location_precision not in {"POINT", "NEIGHBORHOOD", "POSTAL_CODE", "CITY", "UNKNOWN"}:
            raise ValueError(f"Unsupported location precision: {self.location_precision}")
        if self.data_completeness is not None and not 0 <= self.data_completeness <= 1:
            raise ValueError("data_completeness must be between 0 and 1")

    def to_payload(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["attributes"] = {
            **self.attributes,
            "parserVersion": self.parser_version,
        }
        return payload
