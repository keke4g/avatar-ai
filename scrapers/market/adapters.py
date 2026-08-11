from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html import escape
from typing import Any
from urllib.parse import urljoin, urlsplit

from scrapling.parser import Selector

from .models import MarketObservation
from .normalization import (
    EXCLUDED_LISTING,
    ascii_key,
    canonical_url,
    clean_text,
    extract_neighborhood,
    infer_operation,
    infer_property_type,
    iter_json_objects,
    parse_decimal,
    parse_json_scripts,
    parse_price,
    parse_rooms,
    parse_surfaces,
    quality_score,
    stable_reference,
    syndication_fingerprint,
)


def _all_text(node: Any) -> str:
    try:
        return clean_text(node.get_all_text(separator=" ", strip=True))
    except (AttributeError, TypeError):
        try:
            return clean_text(" ".join(node.css("*::text").getall()))
        except (AttributeError, TypeError):
            return clean_text(node)


def _comparison_text_from_json(objects: list[dict[str, Any]]) -> str:
    allowed = {
        "name",
        "headline",
        "description",
        "address",
        "addresslocality",
        "addressregion",
        "addressneighborhood",
        "addresssublocality",
    }
    values: list[str] = []
    for obj in objects:
        for key, value in obj.items():
            if key.lower() in allowed and isinstance(value, (str, int, float)):
                cleaned = clean_text(value)
                if cleaned:
                    values.append(cleaned)
    return clean_text(" ".join(values))


def _first(node: Any, selectors: tuple[str, ...], attribute: str | None = None) -> str | None:
    for selector in selectors:
        try:
            query = f"{selector}::attr({attribute})" if attribute else f"{selector}::text"
            value = node.css(query).get()
        except (AttributeError, TypeError, ValueError):
            value = None
        if clean_text(value):
            return clean_text(value)
    return None


def _first_text_content(node: Any, selectors: tuple[str, ...]) -> str | None:
    for selector in selectors:
        try:
            matches = node.css(selector)
        except (AttributeError, TypeError, ValueError):
            matches = []
        for match in matches:
            value = _all_text(match)
            if value:
                return value
    return None


def _neighborhood_from_location(value: str | None) -> str | None:
    if not value:
        return None
    first = clean_text(re.split(r"[,|]", value, maxsplit=1)[0])
    first = re.sub(r"^(?:col(?:onia)?\.?|fracc(?:ionamiento)?\.?|residencial)\s+", "", first, flags=re.I)
    if not first or re.fullmatch(r"Culiac[aá]n(?: Rosales)?", first, re.I):
        return None
    return first[:120]


def _number_from_json(objects: list[dict[str, Any]], *keys: str) -> float | None:
    normalized = {key.lower() for key in keys}
    for obj in objects:
        for key, value in obj.items():
            if key.lower() not in normalized:
                continue
            if isinstance(value, dict):
                value = value.get("value") or value.get("amount")
            number = parse_decimal(str(value))
            if number is not None:
                return number
    return None


def _signed_number_from_json(objects: list[dict[str, Any]], *keys: str) -> float | None:
    normalized = {key.lower() for key in keys}
    for obj in objects:
        for key, value in obj.items():
            if key.lower() not in normalized:
                continue
            if isinstance(value, dict):
                value = value.get("value") or value.get("amount")
            try:
                number = float(clean_text(value).replace(",", ""))
            except (TypeError, ValueError):
                continue
            if number == number and number not in {float("inf"), float("-inf")}:
                return number
    return None


def _string_from_json(objects: list[dict[str, Any]], *keys: str) -> str | None:
    normalized = {key.lower() for key in keys}
    for obj in objects:
        for key, value in obj.items():
            if key.lower() in normalized and isinstance(value, (str, int, float)) and clean_text(value):
                return clean_text(value)
    return None


def _date_from_json(objects: list[dict[str, Any]], *keys: str) -> str | None:
    value = _string_from_json(objects, *keys)
    if not value:
        return None
    candidate = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        try:
            parsed = datetime.strptime(value[:10], "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def _same_market(first: str, second: str) -> bool:
    first_key = ascii_key(first)
    second_key = ascii_key(second)
    return bool(first_key and second_key and (
        first_key == second_key
        or first_key in second_key
        or second_key in first_key
    ))


@dataclass(frozen=True, slots=True)
class PortalAdapter:
    code: str
    organization: str
    name: str
    official_url: str
    hosts: tuple[str, ...]
    default_seeds: tuple[str, ...]
    card_selectors: tuple[str, ...]
    price_selectors: tuple[str, ...]
    location_selectors: tuple[str, ...]
    detail_url_patterns: tuple[re.Pattern[str], ...]
    next_selectors: tuple[str, ...]
    default_city: str = "Culiacán Rosales"
    default_state: str = "Sinaloa"
    geographic_scope: str = "México"
    update_frequency: str = "on-demand"
    license_name: str = "Investigación comparativa de anuncios públicos"
    license_url: str | None = None

    @property
    def ingestion_metadata(self) -> dict[str, str]:
        return {
            "usageAuthorization": "RESEARCH_ONLY",
            "accessMethod": "PUBLIC_WEB_RESEARCH",
            "researchBasis": "user-directed-comparative-market-research",
            "researchScope": "minimal-asking-price-comparables",
        }

    def allows_url(self, url: str) -> bool:
        host = urlsplit(url).hostname or ""
        return host.lower() in self.hosts and urlsplit(url).scheme in {"http", "https"}

    def is_detail_url(self, url: str) -> bool:
        if self.code == "inmuebles24" and "/propiedades/desarrollo/" in urlsplit(url).path.lower():
            return False
        return any(pattern.search(url) for pattern in self.detail_url_patterns)

    def external_reference(self, url: str, text: str) -> str:
        if self.code == "propiedades-com":
            match = re.search(r"\bID\s*:\s*(\d{5,})\b", text, re.I)
            if match:
                return match.group(1)
        if self.code == "mercadolibre-inmuebles":
            match = re.search(r"\bMLM-?(\d{6,})\b", url, re.I)
            if match:
                return f"MLM{match.group(1)}"
        if self.code == "inmuebles24":
            match = re.search(r"-(\d{6,})(?:\.html)?(?:[?#]|$)", url, re.I)
            if match:
                return match.group(1)
        return stable_reference(self.code, url)

    def discover_links(self, page: Any, page_url: str, *, include_details: bool) -> list[str]:
        selectors = ["a[href]"] if include_details else []
        selectors.extend(self.next_selectors)
        output: dict[str, None] = {}
        for selector in selectors:
            try:
                hrefs = page.css(f"{selector}::attr(href)").getall()
            except (AttributeError, TypeError, ValueError):
                hrefs = []
            for href in hrefs:
                candidate = canonical_url(urljoin(page_url, href))
                if not self.allows_url(candidate):
                    continue
                if self.is_detail_url(candidate) or self._is_pagination_url(candidate):
                    output[candidate] = None
        if include_details:
            try:
                scripts = page.css('script[type="application/ld+json"]::text').getall()
            except (AttributeError, TypeError, ValueError):
                scripts = []
            for obj in parse_json_scripts(scripts):
                for key in ("url", "@id"):
                    value = obj.get(key)
                    if not isinstance(value, str):
                        continue
                    candidate = canonical_url(urljoin(page_url, value))
                    if self.allows_url(candidate) and self.is_detail_url(candidate):
                        output[candidate] = None
        return list(output)

    def _is_pagination_url(self, url: str) -> bool:
        return bool(re.search(r"(?:[?&](?:page|pagina|offset)=\d+|pagina-\d+|_Desde_\d+)", url, re.I))

    def extract(
        self,
        page: Any,
        page_url: str,
        *,
        city: str | None = None,
        state: str | None = None,
        neighborhood_hint: str | None = None,
    ) -> list[MarketObservation]:
        observations: list[MarketObservation] = []
        seen: set[str] = set()
        for selector in self.card_selectors:
            try:
                nodes = page.css(selector)
            except (AttributeError, TypeError, ValueError):
                nodes = []
            for node in nodes:
                observation = self._extract_node(
                    node,
                    page_url,
                    city=city or self.default_city,
                    state=state or self.default_state,
                    neighborhood_hint=neighborhood_hint,
                )
                if observation and observation.external_reference not in seen:
                    observations.append(observation)
                    seen.add(observation.external_reference)
        for observation in self._extract_structured_listings(
            page,
            page_url,
            city=city or self.default_city,
            state=state or self.default_state,
            neighborhood_hint=neighborhood_hint,
        ):
            if observation.external_reference not in seen:
                observations.append(observation)
                seen.add(observation.external_reference)
        if not observations and self.is_detail_url(page_url):
            observation = self._extract_node(
                page,
                page_url,
                city=city or self.default_city,
                state=state or self.default_state,
                neighborhood_hint=neighborhood_hint,
            )
            if observation and (self.is_detail_url(page_url) or self.is_detail_url(observation.source_url)):
                observations.append(observation)
        return observations

    def _extract_structured_listings(
        self,
        page: Any,
        page_url: str,
        *,
        city: str,
        state: str,
        neighborhood_hint: str | None,
    ) -> list[MarketObservation]:
        try:
            scripts = page.css('script[type="application/ld+json"]::text').getall()
        except (AttributeError, TypeError, ValueError):
            return []
        candidates: list[dict[str, Any]] = []
        for script in scripts:
            try:
                parsed = json.loads(script)
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
            for obj in iter_json_objects(parsed):
                schema_type = obj.get("@type")
                schema_types = schema_type if isinstance(schema_type, list) else [schema_type]
                if not any(str(value).lower() in {
                    "realestatelisting",
                    "house",
                    "apartment",
                    "residence",
                } for value in schema_types):
                    continue
                offers = obj.get("offers")
                if isinstance(offers, dict) and str(offers.get("@type", "")).lower() == "aggregateoffer":
                    continue
                if any(
                    isinstance(obj.get(key), str)
                    and self.is_detail_url(canonical_url(urljoin(page_url, str(obj[key]))))
                    for key in ("url", "@id")
                ):
                    candidates.append(obj)

        output: list[MarketObservation] = []
        seen_urls: set[str] = set()
        for candidate in candidates:
            detail_url = next((
                canonical_url(urljoin(page_url, str(candidate[key])))
                for key in ("url", "@id")
                if isinstance(candidate.get(key), str)
                and self.is_detail_url(canonical_url(urljoin(page_url, str(candidate[key]))))
            ), None)
            if not detail_url or detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)
            serialized = json.dumps(candidate, ensure_ascii=False, separators=(",", ":"))
            serialized = serialized.replace("</script", "<\\/script")
            synthetic = Selector(
                f'<article><a href="{escape(detail_url, quote=True)}"></a>'
                f'<script type="application/ld+json">{serialized}</script></article>'
            )
            observation = self._extract_node(
                synthetic,
                page_url,
                city=city,
                state=state,
                neighborhood_hint=neighborhood_hint,
            )
            if observation:
                output.append(observation)
        return output

    def _extract_node(
        self,
        node: Any,
        page_url: str,
        *,
        city: str,
        state: str,
        neighborhood_hint: str | None,
    ) -> MarketObservation | None:
        scripts: list[str] = []
        try:
            scripts = node.css('script[type="application/ld+json"]::text').getall()
        except (AttributeError, TypeError, ValueError):
            pass
        objects = parse_json_scripts(scripts)
        structured_detail_url: str | None = None
        for obj in objects:
            for key in ("url", "@id"):
                structured_url = obj.get(key)
                if not isinstance(structured_url, str):
                    continue
                candidate_url = canonical_url(urljoin(page_url, structured_url))
                if self.allows_url(candidate_url) and self.is_detail_url(candidate_url):
                    structured_detail_url = candidate_url
                    break
            if structured_detail_url:
                break
        visible_text = "" if structured_detail_url and not self.is_detail_url(page_url) else _all_text(node)
        text = clean_text(f"{visible_text} {_comparison_text_from_json(objects)} {page_url}")
        if not text or EXCLUDED_LISTING.search(text):
            return None
        href = _first(node, ("a[href]",), "href")
        source_url = canonical_url(page_url) if self.is_detail_url(page_url) else (
            canonical_url(urljoin(page_url, href)) if href else canonical_url(page_url)
        )
        if structured_detail_url:
            source_url = structured_detail_url
        if not self.allows_url(source_url):
            source_url = canonical_url(page_url)

        title = (
            _first(node, ("h1", "h2", "h3", "[itemprop='name']"))
            or _string_from_json(objects, "name", "headline")
            or text[:180]
        )
        price_text = _first_text_content(node, self.price_selectors)
        price, currency = parse_price(price_text or text)
        json_price = _number_from_json(objects, "price", "lowPrice")
        if json_price and json_price > 0:
            price = json_price
        json_currency = _string_from_json(objects, "priceCurrency")
        if json_currency:
            currency = json_currency.upper()
        operation = infer_operation(text, source_url)
        property_type = infer_property_type(text, source_url)
        if not price or not operation or not property_type:
            return None

        land, built = parse_surfaces(text)
        built = built or _number_from_json(objects, "floorSize", "constructionSize")
        land = land or _number_from_json(objects, "lotSize", "landSize")
        rooms = parse_rooms(text)
        bedrooms = _number_from_json(objects, "numberOfBedrooms", "numberOfRooms") or rooms["bedrooms"]
        bathrooms = _number_from_json(objects, "numberOfBathroomsTotal", "numberOfBathrooms") or rooms["bathrooms"]
        latitude = _signed_number_from_json(objects, "latitude")
        longitude = _signed_number_from_json(objects, "longitude")
        location_text = _first_text_content(node, self.location_selectors)
        neighborhood = (
            _string_from_json(objects, "addressNeighborhood", "addressSubLocality", "neighborhood")
            or _neighborhood_from_location(location_text)
            or extract_neighborhood(text)
        )
        # The search job's market is authoritative. Some portals overload
        # schema.org address fields with a full breadcrumb or neighborhood,
        # which previously mislabeled a neighborhood as the state.
        parsed_city = city
        parsed_state = state
        if neighborhood and _same_market(neighborhood, parsed_city):
            neighborhood = extract_neighborhood(text)
        if neighborhood_hint:
            if neighborhood and not _same_market(neighborhood, neighborhood_hint):
                return None
            if neighborhood and _same_market(neighborhood, neighborhood_hint):
                neighborhood = neighborhood_hint
            if not neighborhood:
                # The result-page URL always contains the requested market.  Using
                # it here made nearby/recommended cards look like exact matches
                # even when the card itself belonged to another neighborhood.
                # Require the individual card/detail URL to carry the market.
                if ascii_key(neighborhood_hint) not in ascii_key(f"{text} {source_url}"):
                    return None
                neighborhood = neighborhood_hint
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
        if not neighborhood or score < 55:
            return None
        if operation == "ASKING_SALE" and not 200_000 <= price <= 300_000_000:
            return None
        if operation == "ASKING_RENT" and not 1_000 <= price <= 2_000_000:
            return None
        if built and built > 0:
            price_per_m2 = price / built
            if operation == "ASKING_SALE" and not 1_500 <= price_per_m2 <= 250_000:
                return None
            if operation == "ASKING_RENT" and not 10 <= price_per_m2 <= 10_000:
                return None

        verified_at = datetime.now(timezone.utc).isoformat()
        published_at = _date_from_json(
            objects,
            "datePosted",
            "datePublished",
            "dateCreated",
            "startTime",
            "start_time",
        )
        location_precision = "POINT" if latitude is not None and longitude is not None else "NEIGHBORHOOD"
        critical_fields = (
            price,
            property_type,
            neighborhood,
            parsed_city and parsed_state,
            built or land,
            bedrooms,
            bathrooms,
            verified_at,
        )
        completeness = sum(value is not None and value != "" for value in critical_fields) / len(critical_fields)

        return MarketObservation(
            source_code=self.code,
            external_reference=self.external_reference(source_url, text),
            source_url=source_url,
            observation_kind=operation,
            observation_date=date.today().isoformat(),
            property_type=property_type,
            title=title[:240],
            neighborhood=neighborhood[:120],
            city=parsed_city[:120],
            state=parsed_state[:120],
            price_amount=price,
            currency=currency,
            latitude=latitude,
            longitude=longitude,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            parking_spaces=rooms["parking_spaces"] if isinstance(rooms["parking_spaces"], int) else None,
            surface_total_m2=land,
            surface_built_m2=built,
            quality_score=score,
            parser_version="towers-scrapling-research-v2",
            published_at=published_at,
            last_verified_at=verified_at,
            location_precision=location_precision,
            syndication_fingerprint=syndication_fingerprint(
                neighborhood=neighborhood,
                property_type=property_type,
                operation=operation,
                price=price,
                built=built,
                land=land,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
            ),
            data_completeness=completeness,
            attributes={
                "collector": "Scrapling",
                "askingPrice": True,
                "originalCurrency": currency,
                "researchOnly": True,
                "publicationDateKnown": published_at is not None,
                "capturedFields": [
                    "price",
                    "surface",
                    "propertyType",
                    "operation",
                    "neighborhood",
                    "rooms",
                    "coordinatesWhenPublished",
                    "sourceUrl",
                ],
            },
        )


PORTALS: dict[str, PortalAdapter] = {
    "mercadolibre-inmuebles": PortalAdapter(
        code="mercadolibre-inmuebles",
        organization="Mercado Libre México",
        name="Mercado Libre Inmuebles — observaciones públicas",
        official_url="https://inmuebles.mercadolibre.com.mx/",
        hosts=("inmuebles.mercadolibre.com.mx", "inmueble.mercadolibre.com.mx"),
        default_seeds=(
            "https://inmuebles.mercadolibre.com.mx/casas/venta/sinaloa/culiacan/",
            "https://inmuebles.mercadolibre.com.mx/departamentos/venta/sinaloa/culiacan/",
            "https://inmuebles.mercadolibre.com.mx/casas/renta/sinaloa/culiacan/",
            "https://inmuebles.mercadolibre.com.mx/departamentos/renta/sinaloa/culiacan/",
        ),
        card_selectors=("li.ui-search-layout__item", ".ui-search-result__wrapper", ".poly-card"),
        price_selectors=(".andes-money-amount", ".poly-price__current", "[class*='price-tag']"),
        location_selectors=(".poly-component__location", ".ui-search-item__location", "[class*='location']"),
        detail_url_patterns=(re.compile(r"https://inmueble\.mercadolibre\.com\.mx/MLM-?\d+", re.I),),
        next_selectors=("a.andes-pagination__link", "a[title='Siguiente']"),
    ),
    "inmuebles24": PortalAdapter(
        code="inmuebles24",
        organization="Inmuebles24",
        name="Inmuebles24 — observaciones públicas",
        official_url="https://www.inmuebles24.com/",
        hosts=("www.inmuebles24.com", "inmuebles24.com"),
        default_seeds=(
            "https://www.inmuebles24.com/casas-en-venta-en-culiacan.html",
            "https://www.inmuebles24.com/departamentos-en-venta-en-culiacan.html",
            "https://www.inmuebles24.com/casas-en-renta-en-culiacan.html",
            "https://www.inmuebles24.com/departamentos-en-renta-en-culiacan.html",
        ),
        card_selectors=("[data-qa='posting PROPERTY']", "[data-qa='posting-card']", ".postingCard", ".postings-container article"),
        price_selectors=("[data-qa='POSTING_CARD_PRICE']", "[data-qa='posting-card-price']", "[class*='postingPrice']"),
        location_selectors=("[data-qa='POSTING_CARD_LOCATION']", "[data-qa='POSTING_CARD_ADDRESS']", "[class*='postingLocation']"),
        detail_url_patterns=(re.compile(r"/propiedades/(?:clasificado/)?[^?#]+-\d+(?:\.html)?", re.I),),
        next_selectors=("a[href*='pagina-']", "a[aria-label='Siguiente']", "a[title='Siguiente']", ".pagination a"),
    ),
    "propiedades-com": PortalAdapter(
        code="propiedades-com",
        organization="Propiedades.com",
        name="Propiedades.com — observaciones públicas",
        official_url="https://propiedades.com/",
        hosts=("propiedades.com", "www.propiedades.com"),
        default_seeds=(
            "https://propiedades.com/culiacan/casas-venta",
            "https://propiedades.com/culiacan/departamentos-venta",
            "https://propiedades.com/culiacan/casas-renta",
            "https://propiedades.com/culiacan/departamentos-renta",
        ),
        card_selectors=("article", "[data-testid='property-card']", ".property-card", ".properties-list > div"),
        price_selectors=("[data-testid='price']", "[itemprop='price']", ".price"),
        location_selectors=("[data-testid='location']", "[itemprop='address']", ".location", ".address"),
        detail_url_patterns=(re.compile(r"/propiedad(?:es)?/", re.I), re.compile(r"/inmuebles?/", re.I)),
        next_selectors=("a[href*='pagina-']", "a[rel='next']", "a[aria-label='Siguiente']", ".pagination a"),
    ),
}
