from __future__ import annotations

import unittest

from scrapers.market.authorized_sources import (
    EasyBrokerProvider,
    MercadoLibreApiProvider,
    parse_bbox,
)


class AuthorizedSourceTests(unittest.TestCase):
    def test_easybroker_owner_inventory_maps_minimal_authorized_fields(self) -> None:
        provider = EasyBrokerProvider("test-key", "consent-2026-001")
        rows = provider.observations_from_property({
            "public_id": "EB-TEST1",
            "title": "Casa en Montebello",
            "created_at": "2026-07-01T12:00:00-07:00",
            "updated_at": "2026-08-08T12:00:00-07:00",
            "url": "https://www.easybroker.com/mx/listings/eb-test1-casa-en-montebello",
            "description": "This private description must never be persisted",
            "property_type": "Casa",
            "bedrooms": 3,
            "bathrooms": 3,
            "parking_spaces": 2,
            "lot_size": 250,
            "construction_size": 205,
            "age": 2021,
            "agency_id": "private-agency-id",
            "location": {
                "region": "Sinaloa",
                "city": "Culiacán Rosales",
                "city_area": "Montebello",
                "street": "Private street",
                "postal_code": "80227",
                "latitude": 24.799,
                "longitude": -107.391,
            },
            "operations": [{"type": "sale", "amount": 5_250_000, "currency": "MXN"}],
        })

        self.assertEqual(len(rows), 1)
        observation = rows[0]
        self.assertEqual(observation.source_code, "easybroker-owner-authorized")
        self.assertEqual(observation.city, "Culiacán Rosales")
        self.assertEqual(observation.location_precision, "POINT")
        self.assertGreaterEqual(observation.quality_score, 75)
        self.assertGreaterEqual(observation.data_completeness or 0, 0.8)
        serialized = observation.to_payload()
        self.assertNotIn("description", serialized)
        self.assertNotIn("agency_id", serialized)
        self.assertNotEqual(serialized["attributes"]["agencyReferenceHash"], "private-agency-id")
        self.assertEqual(provider.source.ingestion_metadata["usageAuthorization"], "AUTHORIZED")

    def test_mercadolibre_api_requires_contract_reference_and_maps_api_payload(self) -> None:
        provider = MercadoLibreApiProvider(
            "oauth-token",
            "ml-avm-contract-001",
            bbox=parse_bbox("24.70,24.90,-107.50,-107.30"),
            category_ids=["MLM1459"],
            city="Culiacán Rosales",
            state="Sinaloa",
        )
        observation = provider.observation_from_item({
            "id": "MLM123456789",
            "title": "Casa en venta en Montebello",
            "price": 5_100_000,
            "currency_id": "MXN",
            "permalink": "https://inmueble.mercadolibre.com.mx/MLM-123456789",
            "date_created": "2026-07-10T12:00:00.000Z",
            "last_updated": "2026-08-08T12:00:00.000Z",
            "seller": {"id": 998877},
            "location": {
                "neighborhood": {"name": "Montebello"},
                "city": {"name": "Culiacán Rosales"},
                "state": {"name": "Sinaloa"},
                "latitude": 24.799,
                "longitude": -107.391,
                "address_line": "Private address",
                "zip_code": "80227",
            },
            "attributes": [
                {"id": "PROPERTY_TYPE", "value_name": "Casa"},
                {"id": "OPERATION", "value_name": "Venta"},
                {"id": "TOTAL_AREA", "value_name": "250"},
                {"id": "COVERED_AREA", "value_name": "200"},
                {"id": "BEDROOMS", "value_name": "3"},
                {"id": "FULL_BATHROOMS", "value_name": "3"},
                {"id": "PARKING_LOTS", "value_name": "2"},
            ],
        })

        self.assertIsNotNone(observation)
        self.assertEqual(observation.observation_kind, "ASKING_SALE")
        self.assertEqual(observation.surface_built_m2, 200)
        self.assertEqual(provider.source.ingestion_metadata["accessMethod"], "API")

    def test_bbox_must_be_inside_mexico(self) -> None:
        self.assertEqual(parse_bbox("24.7,24.9,-107.5,-107.3"), (24.7, 24.9, -107.5, -107.3))
        with self.assertRaises(ValueError):
            parse_bbox("35,36,139,140")


if __name__ == "__main__":
    unittest.main()
