from __future__ import annotations

import time
import re
from dataclasses import dataclass, field
from typing import Any
from urllib import robotparser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from scrapling.fetchers import Fetcher

from .adapters import PortalAdapter
from .models import MarketObservation
from .normalization import canonical_url

DEFAULT_USER_AGENT = "TowersMexicoMarketResearchBot/1.0 (+https://towersmexico.com)"


@dataclass(slots=True)
class CollectionStats:
    fetched_pages: int = 0
    blocked_by_robots: int = 0
    proceeded_when_robots_unavailable: int = 0
    failed_pages: int = 0
    rejected_observations: int = 0
    discovered_observations: int = 0
    errors: list[str] = field(default_factory=list)


class RobotsGuard:
    def __init__(self, user_agent: str = DEFAULT_USER_AGENT) -> None:
        self.user_agent = user_agent
        self._parsers: dict[str, robotparser.RobotFileParser | None] = {}

    def allowed(self, url: str) -> bool:
        allowed, _reason = self.check(url)
        return allowed

    def check(self, url: str) -> tuple[bool, str]:
        split = urlsplit(url)
        origin = f"{split.scheme}://{split.netloc}"
        if origin not in self._parsers:
            robots_url = f"{origin}/robots.txt"
            parser = robotparser.RobotFileParser()
            parser.set_url(robots_url)
            for attempt in range(2):
                try:
                    request = Request(robots_url, headers={"User-Agent": self.user_agent})
                    with urlopen(request, timeout=8) as response:
                        parser.parse(response.read().decode("utf-8", errors="replace").splitlines())
                    self._parsers[origin] = parser
                    break
                except Exception:
                    if attempt == 0:
                        time.sleep(2)
                    else:
                        # Failing closed avoids silently crawling a domain
                        # whose current rules could not be checked.
                        self._parsers[origin] = None
        parser = self._parsers[origin]
        if parser is None:
            return False, "robots.txt unavailable; collection failed closed"
        if not parser.can_fetch(self.user_agent, url):
            return False, "robots.txt denied collection"
        return True, "allowed"


class MarketCollector:
    def __init__(
        self,
        adapter: PortalAdapter,
        *,
        render_js: bool = False,
        include_details: bool = False,
        min_delay_seconds: float = 3.0,
        max_pages: int = 12,
        max_observations: int = 500,
        user_agent: str = DEFAULT_USER_AGENT,
        allow_unavailable_robots: bool = False,
        city: str | None = None,
        state: str | None = None,
        neighborhood: str | None = None,
    ) -> None:
        self.adapter = adapter
        self.render_js = render_js
        self.include_details = include_details
        self.min_delay_seconds = max(1.0, min_delay_seconds)
        self.max_pages = max(1, max_pages)
        self.max_observations = max(1, max_observations)
        self.user_agent = user_agent
        self.allow_unavailable_robots = allow_unavailable_robots
        self.city = city or adapter.default_city
        self.state = state or adapter.default_state
        self.neighborhood = neighborhood
        self.robots = RobotsGuard(user_agent)
        self.stats = CollectionStats()

    def _fetch(self, url: str) -> Any:
        if self.render_js:
            # Import Chromium support only when explicitly requested. Besides
            # keeping the default collector lightweight, this avoids browser
            # fingerprint initialization during ordinary HTTP collection.
            from scrapling.fetchers import DynamicFetcher

            return DynamicFetcher.fetch(
                url,
                headless=True,
                network_idle=True,
                timeout=45_000,
                # Inmuebles24 hydrates its result cards through browser
                # requests made after the initial document.  Blocking all
                # resources leaves only the page shell and silently produces
                # zero observations.  Keep normal browser loading enabled;
                # this is still the standard (non-stealth) Scrapling fetcher.
                disable_resources=False,
                google_search=False,
            )
        return Fetcher.get(
            url,
            headers={"user-agent": self.user_agent},
            impersonate=None,
            stealthy_headers=False,
            http_version="v1",
            timeout=20,
            retries=1,
        )

    def collect(self, seeds: list[str] | tuple[str, ...]) -> list[MarketObservation]:
        queue = [canonical_url(seed) for seed in seeds if self.adapter.allows_url(seed)]
        visited: set[str] = set()
        observations: dict[str, MarketObservation] = {}

        while queue and len(visited) < self.max_pages and len(observations) < self.max_observations:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            robots_allowed, robots_reason = self.robots.check(url)
            if not robots_allowed:
                if self.allow_unavailable_robots and robots_reason.startswith("robots.txt unavailable"):
                    self.stats.proceeded_when_robots_unavailable += 1
                    self.stats.errors.append(f"best-effort after unavailable robots.txt: {url}")
                else:
                    self.stats.blocked_by_robots += 1
                    self.stats.errors.append(f"{robots_reason}: {url}")
                    continue
            try:
                page = self._fetch(url)
                status = getattr(page, "status", getattr(page, "status_code", 200))
                if isinstance(status, int) and status >= 400:
                    raise RuntimeError(f"Portal returned HTTP {status}")
                final_url = str(getattr(page, "url", url) or url)
                if not self.adapter.allows_url(final_url):
                    raise RuntimeError(f"Portal redirected outside the public inventory host: {final_url}")
                try:
                    page_title = str(page.css("title::text").get() or "")
                except (AttributeError, TypeError, ValueError):
                    page_title = ""
                if re.search(r"captcha|challenge validation|account verification|verificaci[oó]n de cuenta", page_title, re.I):
                    raise RuntimeError(f"Portal returned an access challenge: {page_title[:100]}")
                self.stats.fetched_pages += 1
                for observation in self.adapter.extract(
                    page,
                    url,
                    city=self.city,
                    state=self.state,
                    neighborhood_hint=self.neighborhood,
                ):
                    key = f"{observation.source_code}:{observation.external_reference}"
                    current = observations.get(key)
                    if current is None or observation.quality_score > current.quality_score:
                        observations[key] = observation
                for link in self.adapter.discover_links(page, url, include_details=self.include_details):
                    if link not in visited and link not in queue and len(queue) + len(visited) < self.max_pages * 3:
                        queue.append(link)
            except Exception as error:
                self.stats.failed_pages += 1
                self.stats.errors.append(f"{url}: {type(error).__name__}: {error}")
            if queue:
                time.sleep(self.min_delay_seconds)

        self.stats.discovered_observations = len(observations)
        return list(observations.values())[: self.max_observations]
