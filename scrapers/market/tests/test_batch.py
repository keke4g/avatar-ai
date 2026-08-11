from __future__ import annotations

import unittest
from datetime import date

from scrapers.market.batch_cli import DEFAULT_MANIFEST, filter_market_observations, load_manifest
from scrapers.market.models import MarketObservation


class ResearchBatchTests(unittest.TestCase):
    def test_manifest_covers_every_current_inventory_target_once(self) -> None:
        manifest = load_manifest(DEFAULT_MANIFEST)
        target_ids = [
            target_id
            for market in manifest["markets"]
            for target_id in market["targetPropertyIds"]
        ]
        self.assertEqual(len(target_ids), 12)
        self.assertEqual(len(target_ids), len(set(target_ids)))
        self.assertEqual(len(manifest["markets"]), 11)

    def test_market_filter_rejects_wrong_operation_type_and_subject(self) -> None:
        def observation(reference: str, operation: str, property_type: str) -> MarketObservation:
            return MarketObservation(
                source_code="inmuebles24",
                external_reference=reference,
                source_url=f"https://www.inmuebles24.com/propiedades/casa-{reference}.html",
                observation_kind=operation,  # type: ignore[arg-type]
                observation_date=date.today().isoformat(),
                property_type=property_type,
                title="Comparable",
                neighborhood="Villas de Oriente II",
                city="Tonalá",
                state="Jalisco",
                price_amount=4_000_000,
            )

        market = {
            "expectedOperation": "ASKING_SALE",
            "expectedType": "HOUSE",
            "excludeExternalReferences": ["subject"],
        }
        rows = [
            observation("keep", "ASKING_SALE", "HOUSE"),
            observation("subject", "ASKING_SALE", "HOUSE"),
            observation("rent", "ASKING_RENT", "HOUSE"),
            observation("apartment", "ASKING_SALE", "APARTMENT"),
        ]
        self.assertEqual(
            [row.external_reference for row in filter_market_observations(rows, market)],
            ["keep"],
        )


if __name__ == "__main__":
    unittest.main()
