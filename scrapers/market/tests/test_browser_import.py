import unittest

from scrapers.market.browser_import import observations_from_browser_json


class BrowserImportTests(unittest.TestCase):
    def test_keeps_requested_micromarket_and_rejects_placeholder_area(self) -> None:
        payload = {"listings": [
        {
            "source_url": "https://propiedades.com/inmuebles/casa-en-venta-montebello-sinaloa-12345678",
            "external_id": "12345678",
            "title": "Casa, Col. Montebello, Culiacán, ID: 12345678",
            "price": 5_000_000,
            "construction_area_m2": 250,
            "bedrooms": 3,
            "bathrooms": 3,
        },
        {
            "source_url": "https://propiedades.com/inmuebles/casa-en-venta-montebello-sinaloa-87654321",
            "external_id": "87654321",
            "title": "Casa, Col. Montebello, Culiacán, ID: 87654321",
            "price": 3_700_000,
            "construction_area_m2": 1,
        },
        {
            "source_url": "https://propiedades.com/inmuebles/casa-en-venta-guadalupe-sinaloa-11223344",
            "external_id": "11223344",
            "title": "Casa, Col. Guadalupe, Culiacán, ID: 11223344",
            "price": 4_000_000,
            "construction_area_m2": 200,
        },
        ]}

        observations = observations_from_browser_json(
            payload,
            portal_code="propiedades-com",
            neighborhood="Montebello",
            city="Culiacán Rosales",
            state="Sinaloa",
        )

        self.assertEqual([item.external_reference for item in observations], ["12345678"])
        self.assertEqual(observations[0].surface_built_m2, 250)
        self.assertEqual(observations[0].attributes["collector"], "controlled-public-browser-fallback")
