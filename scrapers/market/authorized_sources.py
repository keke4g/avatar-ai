from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import MarketObservation
from .normalization import ascii_key, canonical_url, quality_score


@dataclass(frozen=True, slots=True)
class AuthorizedSourceDescriptor:
    code: str
    organization: str
    name: str
    official_url: str
    authorization_reference: str
    access_method: str = "API"
    geographic_scope: str = "México"
    update_frequency: str = "daily"
    license_name: str = "Authorized inventory feed"
    license_url: str | None = None
    ingestion_metadata: dict[str, str] = field(init=False)

    def __post_init__(self) -> None:
        if not self.authorization_reference.strip():
            raise ValueError("An authorization reference is required")
        object.__setattr__(self, "ingestion_metadata", {
            "usageAuthorization": "AUTHORIZED",
            "accessMethod": self.access_method,
            "authorizationReference": self.authorization_reference.strip(),
            "collector": "official-api",
        })


def _optional_number(value: object, *, allow_negative: bool = False) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, dict):
        value = value.get("value") or value.get("amount")
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if allow_negative or number >= 0 else None


def _first_nonempty(*values: object) -> str:
    for value in values:
        cleaned = str(value or "").strip()
        if cleaned:
            return cleaned
    return ""


def _iso_or_none(value: object) -> str | None:
    cleaned = str(value or "").strip()
    if not cleaned:
        return None
    try:
        return datetime.fromisoformat(cleaned.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def _fingerprint(*values: object) -> str:
    normalized = "|".join(ascii_key(str(value or "")) for value in values)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:40]


def _hashed_identifier(value: object) -> str | None:
    cleaned = str(value or "").strip()
    return _fingerprint(cleaned) if cleaned else None


def _property_type(value: object) -> str | None:
    normalized = ascii_key(str(value or ""))
    if any(token in normalized for token in ("casa", "house", "villa", "residencia")):
        return "HOUSE"
    if any(token in normalized for token in ("departamento", "apartment", "apartamento")):
        return "APARTMENT"
    if "loft" in normalized:
        return "LOFT"
    if any(token in normalized for token in ("terreno", "land", "lote")):
        return "LAND"
    if any(token in normalized for token in ("oficina", "office")):
        return "OFFICE"
    if any(token in normalized for token in ("local", "commercial", "comercial")):
        return "COMMERCIAL"
    return None


def _construction_age(value: object) -> int | None:
    number = _optional_number(value)
    if number is None:
        return None
    year = datetime.now(timezone.utc).year
    rounded = int(number)
    if 1800 <= rounded <= year:
        return year - rounded
    return rounded if rounded <= 200 else None


class JsonApiClient:
    def __init__(self, base_url: str, headers: dict[str, str]) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {"accept": "application/json", **headers}

    def get(self, path: str, query: dict[str, object] | None = None) -> Any:
        url = path if path.startswith("https://") else f"{self.base_url}/{path.lstrip('/')}"
        if query:
            url = f"{url}?{urlencode(query, doseq=True)}"
        request = Request(url, headers=self.headers)
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))


class EasyBrokerProvider:
    def __init__(
        self,
        api_key: str,
        authorization_reference: str,
        *,
        base_url: str = "https://api.easybroker.com/v1",
        source_code: str = "easybroker-owner-authorized",
    ) -> None:
        if not api_key.strip():
            raise ValueError("EASYBROKER_API_KEY is required")
        self.client = JsonApiClient(base_url, {"X-Authorization": api_key.strip()})
        self.source = AuthorizedSourceDescriptor(
            code=source_code,
            organization="EasyBroker — agencias conectadas",
            name="Inventario autorizado de agencias EasyBroker",
            official_url="https://www.easybroker.com/",
            authorization_reference=authorization_reference,
            license_name="Inventario propio/autorizado mediante EasyBroker API",
            license_url="https://dev.easybroker.com/docs/api-de-easybroker",
        )

    def collect(self, *, max_pages: int = 5, max_observations: int = 500) -> list[MarketObservation]:
        observations: list[MarketObservation] = []
        seen: set[str] = set()
        for page_number in range(1, max_pages + 1):
            payload = self.client.get("properties", {"page": page_number, "limit": 50})
            rows = payload.get("content", []) if isinstance(payload, dict) else []
            if not isinstance(rows, list) or not rows:
                break
            for summary in rows:
                if not isinstance(summary, dict):
                    continue
                public_id = _first_nonempty(summary.get("public_id"), summary.get("id"))
                if not public_id or public_id in seen:
                    continue
                detail = summary
                if not isinstance(summary.get("operations"), list) or not isinstance(summary.get("location"), dict):
                    detail_payload = self.client.get(f"properties/{public_id}")
                    if isinstance(detail_payload, dict):
                        detail = detail_payload
                observations.extend(self.observations_from_property(detail))
                seen.add(public_id)
                if len(observations) >= max_observations:
                    return observations[:max_observations]
            pagination = payload.get("pagination", {}) if isinstance(payload, dict) else {}
            if pagination and not pagination.get("next_page") and page_number >= int(pagination.get("total_pages") or page_number):
                break
        return observations[:max_observations]

    def observations_from_property(self, row: dict[str, Any]) -> list[MarketObservation]:
        public_id = _first_nonempty(row.get("public_id"), row.get("id"))
        property_type = _property_type(row.get("property_type"))
        location = row.get("location") if isinstance(row.get("location"), dict) else {}
        neighborhood = _first_nonempty(location.get("city_area"), location.get("neighborhood"))
        city = _first_nonempty(location.get("city"), location.get("municipality"))
        state = _first_nonempty(location.get("region"), location.get("state"))
        latitude = _optional_number(location.get("latitude"), allow_negative=True)
        longitude = _optional_number(location.get("longitude"), allow_negative=True)
        built = _optional_number(row.get("construction_size"))
        land = _optional_number(row.get("lot_size"))
        bedrooms = _optional_number(row.get("bedrooms"))
        bathrooms = _optional_number(row.get("bathrooms"))
        parking = _optional_number(row.get("parking_spaces"))
        published_at = _iso_or_none(row.get("created_at"))
        verified_at = _iso_or_none(row.get("updated_at")) or datetime.now(timezone.utc).isoformat()
        source_url = canonical_url(_first_nonempty(row.get("url"), f"https://www.easybroker.com/property/{public_id}"))
        title = _first_nonempty(row.get("title"), f"Propiedad {public_id}")
        if not all((public_id, property_type, neighborhood, city, state, published_at)):
            return []

        critical_values = (
            public_id,
            property_type,
            neighborhood,
            city,
            state,
            built or land,
            bedrooms,
            bathrooms,
            published_at,
            latitude is not None and longitude is not None,
        )
        completeness = sum(bool(value) for value in critical_values) / len(critical_values)
        operations = row.get("operations") if isinstance(row.get("operations"), list) else []
        observations: list[MarketObservation] = []
        for operation in operations:
            if not isinstance(operation, dict):
                continue
            operation_type = ascii_key(str(operation.get("type") or ""))
            observation_kind = "ASKING_SALE" if operation_type == "sale" else (
                "ASKING_RENT" if operation_type in {"rental", "rent"} else None
            )
            price = _optional_number(operation.get("amount"))
            currency = _first_nonempty(operation.get("currency"), "MXN").upper()
            if not observation_kind or not price or currency != "MXN":
                continue
            score = quality_score(
                price=price,
                neighborhood=neighborhood,
                property_type=property_type,
                built=built,
                land=land,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                latitude=latitude,
                longitude=longitude,
            )
            if score < 75 or completeness < 0.80:
                continue
            syndication = _fingerprint(
                location.get("street"), location.get("postal_code"), latitude, longitude,
                built, land, bedrooms, bathrooms,
            )
            observations.append(MarketObservation(
                source_code=self.source.code,
                external_reference=f"{public_id}:{observation_kind}",
                source_url=source_url,
                observation_kind=observation_kind,
                observation_date=date.today().isoformat(),
                property_type=property_type,
                title=title[:240],
                neighborhood=neighborhood[:120],
                city=city[:120],
                state=state[:120],
                price_amount=price,
                currency="MXN",
                latitude=latitude,
                longitude=longitude,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                parking_spaces=int(parking) if parking is not None else None,
                construction_age=_construction_age(row.get("age")),
                surface_total_m2=land,
                surface_built_m2=built,
                quality_score=score,
                parser_version="towers-easybroker-api-v1",
                published_at=published_at,
                last_verified_at=verified_at,
                location_precision="POINT" if latitude is not None and longitude is not None else "NEIGHBORHOOD",
                syndication_fingerprint=syndication,
                data_completeness=completeness,
                attributes={
                    "askingPrice": True,
                    "agencyReferenceHash": _hashed_identifier(row.get("agency_id")),
                    "providerUpdatedAt": verified_at,
                },
            ))
        return observations


class MercadoLibreApiProvider:
    def __init__(
        self,
        access_token: str,
        authorization_reference: str,
        *,
        bbox: tuple[float, float, float, float],
        category_ids: list[str],
        city: str,
        state: str,
    ) -> None:
        if not access_token.strip():
            raise ValueError("MERCADOLIBRE_ACCESS_TOKEN is required")
        if not category_ids:
            raise ValueError("At least one Mercado Libre real-estate category is required")
        self.client = JsonApiClient(
            "https://api.mercadolibre.com",
            {"Authorization": f"Bearer {access_token.strip()}"},
        )
        self.bbox = bbox
        self.category_ids = category_ids
        self.city = city
        self.state = state
        self.source = AuthorizedSourceDescriptor(
            code="mercadolibre-inmuebles-api-authorized",
            organization="Mercado Libre México",
            name="Mercado Libre Inmuebles — API autorizada para AVM",
            official_url="https://inmuebles.mercadolibre.com.mx/",
            authorization_reference=authorization_reference,
            license_name="Mercado Libre Developers + autorización AVM",
            license_url="https://developers.mercadolibre.com.mx/es-mx-terminos-y-condiciones",
        )

    def collect(self, *, max_pages: int = 5, max_observations: int = 500) -> list[MarketObservation]:
        observations: list[MarketObservation] = []
        south, north, west, east = self.bbox
        location_filter = f"lat:{south}_{north},lon:{west}_{east}"
        for category_id in self.category_ids:
            for page_number in range(max_pages):
                payload = self.client.get("sites/MLM/search", {
                    "item_location": location_filter,
                    "category": category_id,
                    "limit": 50,
                    "offset": page_number * 50,
                })
                rows = payload.get("results", []) if isinstance(payload, dict) else []
                if not isinstance(rows, list) or not rows:
                    break
                for row in rows:
                    if isinstance(row, dict):
                        observation = self.observation_from_item(row)
                        if observation:
                            observations.append(observation)
                    if len(observations) >= max_observations:
                        return observations[:max_observations]
        return observations[:max_observations]

    def observation_from_item(self, row: dict[str, Any]) -> MarketObservation | None:
        item_id = _first_nonempty(row.get("id"))
        attributes = {
            str(item.get("id") or "").upper(): item.get("value_name") or item.get("value_id")
            for item in (row.get("attributes") or [])
            if isinstance(item, dict)
        }
        property_type = _property_type(attributes.get("PROPERTY_TYPE") or row.get("title"))
        operation_name = ascii_key(str(attributes.get("OPERATION") or row.get("title") or ""))
        observation_kind = "ASKING_RENT" if any(token in operation_name for token in ("renta", "alquiler")) else "ASKING_SALE"
        price = _optional_number(row.get("price"))
        currency = _first_nonempty(row.get("currency_id"), "MXN").upper()
        location = row.get("location") if isinstance(row.get("location"), dict) else {}
        neighborhood_node = location.get("neighborhood") if isinstance(location.get("neighborhood"), dict) else {}
        city_node = location.get("city") if isinstance(location.get("city"), dict) else {}
        state_node = location.get("state") if isinstance(location.get("state"), dict) else {}
        neighborhood = _first_nonempty(neighborhood_node.get("name"), location.get("address_line"))
        city = _first_nonempty(city_node.get("name"), self.city)
        state = _first_nonempty(state_node.get("name"), self.state)
        latitude = _optional_number(location.get("latitude"), allow_negative=True)
        longitude = _optional_number(location.get("longitude"), allow_negative=True)
        built = _optional_number(attributes.get("COVERED_AREA"))
        land = _optional_number(attributes.get("TOTAL_AREA"))
        bedrooms = _optional_number(attributes.get("BEDROOMS") or attributes.get("ROOMS"))
        bathrooms = _optional_number(attributes.get("FULL_BATHROOMS"))
        parking = _optional_number(attributes.get("PARKING_LOTS"))
        published_at = _iso_or_none(row.get("date_created") or row.get("start_time"))
        verified_at = _iso_or_none(row.get("last_updated")) or datetime.now(timezone.utc).isoformat()
        source_url = canonical_url(_first_nonempty(row.get("permalink")))
        if not all((item_id, source_url, property_type, price, currency == "MXN", neighborhood, city, state, published_at)):
            return None
        completeness_values = (
            item_id, property_type, neighborhood, city, state, built or land,
            bedrooms, bathrooms, published_at, latitude is not None and longitude is not None,
        )
        completeness = sum(bool(value) for value in completeness_values) / len(completeness_values)
        score = quality_score(
            price=price,
            neighborhood=neighborhood,
            property_type=property_type,
            built=built,
            land=land,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            latitude=latitude,
            longitude=longitude,
        )
        if score < 75 or completeness < 0.80:
            return None
        return MarketObservation(
            source_code=self.source.code,
            external_reference=f"{item_id}:{observation_kind}",
            source_url=source_url,
            observation_kind=observation_kind,
            observation_date=date.today().isoformat(),
            property_type=property_type,
            title=_first_nonempty(row.get("title"), item_id)[:240],
            neighborhood=neighborhood[:120],
            city=city[:120],
            state=state[:120],
            price_amount=price,
            currency="MXN",
            latitude=latitude,
            longitude=longitude,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            parking_spaces=int(parking) if parking is not None else None,
            surface_total_m2=land,
            surface_built_m2=built,
            quality_score=score,
            parser_version="towers-mercadolibre-api-v1",
            published_at=published_at,
            last_verified_at=verified_at,
            location_precision="POINT" if latitude is not None and longitude is not None else "NEIGHBORHOOD",
            syndication_fingerprint=_fingerprint(
                location.get("address_line"), location.get("zip_code"), latitude, longitude,
                built, land, bedrooms, bathrooms,
            ),
            data_completeness=completeness,
            attributes={
                "askingPrice": True,
                "sellerReferenceHash": _hashed_identifier(row.get("seller", {}).get("id") if isinstance(row.get("seller"), dict) else None),
                "providerUpdatedAt": verified_at,
            },
        )


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be south,north,west,east")
    south, north, west, east = (float(part) for part in parts)
    if not (14 <= south < north <= 33.5 and -118.5 <= west < east <= -86):
        raise ValueError("bbox must be a valid rectangle inside Mexico")
    return south, north, west, east
