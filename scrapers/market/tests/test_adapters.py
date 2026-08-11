from __future__ import annotations

import unittest

from scrapling.parser import Selector

from scrapers.market.adapters import PORTALS
from scrapers.market.normalization import infer_operation, parse_price, parse_surfaces


class MarketAdapterTests(unittest.TestCase):
    def test_money_parser_ignores_surface(self) -> None:
        self.assertEqual(parse_price("MXN $2,650,000 · 93.5 m² construidos"), (2_650_000.0, "MXN"))

    def test_operation_uses_scoped_url_before_generic_portal_copy(self) -> None:
        self.assertEqual(
            infer_operation(
                "Renta, compra y venta de inmuebles en México",
                "https://www.inmuebles24.com/casas-en-venta-en-montebello.html",
            ),
            "ASKING_SALE",
        )

    def test_surfaces_are_separated(self) -> None:
        self.assertEqual(parse_surfaces("Terreno 200 m2 y 289.84 m² de construcción"), (200.0, 289.84))

    def test_lot_only_card_does_not_invent_built_surface(self) -> None:
        self.assertEqual(parse_surfaces("104 m² lote 3 rec. 2 baños 2 estac."), (104.0, None))

    def test_propiedades_card_becomes_internal_observation(self) -> None:
        page = Selector("""
          <html><body><article>
            <a href="/propiedad/casa-30649010"><h3>Casa en venta en La Conquista</h3></a>
            <span>Venta</span><strong>$2,650,000 MXN</strong>
            <p>Privada La Castellana, Col. La Conquista, Culiacán, Sinaloa, ID: 30649010</p>
            <span>3 Recámaras</span><span>3 Baños</span><span>93.5 m² construidos</span>
          </article></body></html>
        """)
        observations = PORTALS["propiedades-com"].extract(
            page,
            "https://propiedades.com/culiacan/casas-venta",
        )
        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.external_reference, "30649010")
        self.assertEqual(observation.neighborhood, "La Conquista")
        self.assertEqual(observation.price_amount, 2_650_000)
        self.assertEqual(observation.surface_built_m2, 93.5)
        self.assertNotIn("phone", observation.to_payload())
        self.assertNotIn("images", observation.to_payload())
        self.assertEqual(observation.city, "Culiacán Rosales")
        self.assertEqual(observation.location_precision, "NEIGHBORHOOD")
        self.assertGreaterEqual(observation.data_completeness or 0, 0.8)
        self.assertEqual(PORTALS["propiedades-com"].ingestion_metadata["usageAuthorization"], "RESEARCH_ONLY")

    def test_custom_market_is_not_hardcoded_as_culiacan(self) -> None:
        page = Selector("""
          <html><body><article>
            <a href="/propiedad/casa-lomas-30649011"><h3>Casa en venta en Lomas de Angelópolis</h3></a>
            <strong>$8,950,000 MXN</strong>
            <p>Col. Lomas de Angelópolis 2, Puebla · 375 m² de construcción</p>
            <span>4 recámaras</span><span>4 baños</span>
          </article></body></html>
        """)
        observations = PORTALS["propiedades-com"].extract(
            page,
            "https://propiedades.com/puebla/casas-venta",
            city="San Bernardino Tlaxcalancingo",
            state="Puebla",
            neighborhood_hint="Lomas de Angelópolis 2",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].city, "San Bernardino Tlaxcalancingo")
        self.assertEqual(observations[0].state, "Puebla")
        self.assertEqual(observations[0].neighborhood, "Lomas de Angelópolis 2")

    def test_json_ld_coordinates_and_publication_date_are_preserved(self) -> None:
        page = Selector("""
          <html><body><article>
            <a href="/propiedad/casa-30649012"><h3>Casa en venta en Montebello</h3></a>
            <strong>$6,500,000 MXN</strong>
            <p>Col. Montebello · 250 m² de construcción · 3 recámaras · 3 baños</p>
            <script type="application/ld+json">{
              "@type":"House", "datePosted":"2026-08-01T10:00:00Z",
              "geo":{"latitude":24.782,"longitude":-107.387}
            }</script>
          </article></body></html>
        """)
        observation = PORTALS["propiedades-com"].extract(
            page,
            "https://propiedades.com/culiacan/casas-venta",
        )[0]
        self.assertEqual(observation.location_precision, "POINT")
        self.assertEqual(observation.latitude, 24.782)
        self.assertEqual(observation.longitude, -107.387)
        self.assertTrue((observation.published_at or "").startswith("2026-08-01"))

    def test_remates_are_not_ingested(self) -> None:
        page = Selector("""
          <html><body><article>
            <a href="/propiedad/remate-12345678"><h3>Remate bancario casa en venta</h3></a>
            <p>$450,000 MXN · Col. Centro · 80 m² construidos · 2 recámaras · 1 baño · ID: 12345678</p>
          </article></body></html>
        """)
        self.assertEqual(
            PORTALS["propiedades-com"].extract(page, "https://propiedades.com/culiacan/casas-remates"),
            [],
        )

    def test_inmuebles_price_is_not_joined_with_surface(self) -> None:
        page = Selector("""
          <html><body><div data-qa="posting PROPERTY">
            <a href="/propiedades/clasificado/veclcain-casa-en-venta-148972445.html">
              <h3>Casa en venta en Chapultepec</h3>
            </a>
            <div data-qa="POSTING_CARD_PRICE">$13,900,000 MXN</div><span>508 m² construidos</span>
            <div data-qa="POSTING_CARD_LOCATION">Chapultepec, Culiacán</div>
            <span>3 recámaras</span><span>4 baños</span>
          </div></body></html>
        """)
        observations = PORTALS["inmuebles24"].extract(
            page,
            "https://www.inmuebles24.com/casas-en-venta-en-culiacan.html",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].price_amount, 13_900_000)
        self.assertEqual(observations[0].neighborhood, "Chapultepec")

    def test_inmuebles_abbreviated_rooms_are_parsed(self) -> None:
        page = Selector("""
          <html><body><div data-qa="posting PROPERTY">
            <a href="/propiedades/clasificado/veclcain-casa-en-venta-149662274.html">
              <h3>Casa en venta</h3>
            </a>
            <div data-qa="POSTING_CARD_PRICE">$2,849,000 MXN</div>
            <div data-qa="POSTING_CARD_LOCATION">Fraccionamiento Villas Del Rio, Culiacán</div>
            <span>104 m² lote 3 rec. 2 baños 2 estac.</span>
          </div></body></html>
        """)
        observation = PORTALS["inmuebles24"].extract(
            page,
            "https://www.inmuebles24.com/casas-en-venta-en-fraccionamiento-villas-del-rio.html",
            neighborhood_hint="Villas del Río",
        )[0]
        self.assertEqual(observation.surface_total_m2, 104)
        self.assertIsNone(observation.surface_built_m2)
        self.assertEqual(observation.bedrooms, 3)
        self.assertEqual(observation.parking_spaces, 2)

    def test_inmuebles_nearby_card_is_not_labeled_as_requested_market(self) -> None:
        page = Selector("""
          <html><body><div data-qa="posting PROPERTY">
            <a href="/propiedades/clasificado/veclcain-casa-en-bosques-del-rey-150467006.html">
              <h3>Casa en venta en Bosques del Rey</h3>
            </a>
            <div data-qa="POSTING_CARD_PRICE">$2,400,000 MXN</div>
            <span>117 m² lote 3 rec. 2 baños</span>
          </div></body></html>
        """)
        observations = PORTALS["inmuebles24"].extract(
            page,
            "https://www.inmuebles24.com/casas-en-venta-en-fraccionamiento-villa-del-cedro.html",
            neighborhood_hint="Villa del Cedro",
        )
        self.assertEqual(observations, [])

    def test_inmuebles_discovers_numbered_result_pages(self) -> None:
        page = Selector("""
          <html><body>
            <a href="/casas-en-venta-en-culiacan-pagina-2.html">2</a>
            <a href="/casas-en-venta-en-culiacan-pagina-3.html">3</a>
          </body></html>
        """)
        links = PORTALS["inmuebles24"].discover_links(
            page,
            "https://www.inmuebles24.com/casas-en-venta-en-culiacan.html",
            include_details=False,
        )
        self.assertEqual(len(links), 2)
        self.assertTrue(links[0].endswith("pagina-2.html"))

    def test_inmuebles_json_ld_listings_are_not_mixed_together(self) -> None:
        page = Selector("""
          <html><body>
            <script type="application/ld+json">[
              {
                "@type":"RealEstateListing",
                "url":"https://www.inmuebles24.com/propiedades/clasificado/veclcain-casa-uno-150466847.html",
                "name":"Casa uno en Montebello",
                "description":"Casa en venta, Col. Montebello, 312 m² de construcción, 3 recámaras, 3 baños",
                "offers":{"lowPrice":5700000,"priceCurrency":"MXN"}
              },
              {
                "@type":"RealEstateListing",
                "url":"https://www.inmuebles24.com/propiedades/clasificado/veclcain-casa-dos-149210684.html",
                "name":"Casa dos en Montebello",
                "description":"Casa en venta, Col. Montebello, 285 m² de construcción, 4 recámaras, 4 baños",
                "offers":{"lowPrice":7600000,"priceCurrency":"MXN"}
              }
            ]</script>
          </body></html>
        """)
        observations = PORTALS["inmuebles24"].extract(
            page,
            "https://www.inmuebles24.com/casas-en-venta-en-fraccionamiento-montebello-ciudad-de-culiacan.html",
            neighborhood_hint="Montebello",
        )
        self.assertEqual(len(observations), 2)
        self.assertEqual(
            [(item.price_amount, item.surface_built_m2) for item in observations],
            [(5_700_000, 312), (7_600_000, 285)],
        )

    def test_inmuebles_aggregate_offer_and_development_are_not_individual_comparables(self) -> None:
        page = Selector("""
          <html><body><script type="application/ld+json">{
            "@type":"RealEstateListing",
            "url":"https://www.inmuebles24.com/propiedades/clasificado/veclcain-casa-150466847.html",
            "offers":{"@type":"AggregateOffer","lowPrice":5700000},
            "mainEntity":[{"url":"https://www.inmuebles24.com/propiedades/clasificado/veclcain-casa-150466847.html"}]
          }</script></body></html>
        """)
        adapter = PORTALS["inmuebles24"]
        page_url = "https://www.inmuebles24.com/casas-en-venta-en-montebello.html"
        self.assertEqual(adapter.extract(page, page_url, neighborhood_hint="Montebello"), [])
        self.assertIn(
            "https://www.inmuebles24.com/propiedades/clasificado/veclcain-casa-150466847.html",
            adapter.discover_links(page, page_url, include_details=True),
        )
        self.assertFalse(adapter.is_detail_url(
            "https://www.inmuebles24.com/propiedades/desarrollo/ememhoin-casas-142261706.html"
        ))


if __name__ == "__main__":
    unittest.main()
