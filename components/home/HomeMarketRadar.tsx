"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Building2, LoaderCircle } from "lucide-react";
import { useSwap } from "../../lib/context/SwapContext";
import {
  buildHomeMarketRadar,
  formatHomePrice,
  getHomePropertyCaption,
  type HomeMarketRadarEntry,
} from "./homeExperienceData";

interface HomeMarketRadarProps {
  isDark: boolean;
  language: "es" | "en";
  highlighted?: boolean;
}

function RadarImage({ entry }: { entry: HomeMarketRadarEntry }) {
  const [failed, setFailed] = useState(false);
  const source = entry.property.images?.[0];

  return (
    <div className="home-radar-image relative h-28 overflow-hidden bg-[linear-gradient(145deg,#b8d6e2_0%,#7fa4b5_44%,#314650_100%)] lg:h-auto lg:min-h-[70px] lg:flex-1">
      {source && !failed ? (
        <Image
          src={source}
          alt={`Vista de ${entry.property.title}`}
          fill
          sizes="(max-width: 1023px) 78vw, (max-width: 1279px) 240px, 270px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/75">
          <Building2 className="h-7 w-7" aria-hidden="true" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-black/5 to-transparent" aria-hidden="true" />
      <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/58 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.11em] text-white backdrop-blur-md">
        {entry.tag}
      </span>
    </div>
  );
}

export default function HomeMarketRadar({
  isDark,
  language,
  highlighted = false,
}: HomeMarketRadarProps) {
  const { properties, loading } = useSwap();
  const entries = useMemo(
    () => buildHomeMarketRadar(properties, language),
    [language, properties],
  );

  return (
    <section className="home-market-radar flex w-full flex-col lg:h-full lg:min-h-0" aria-labelledby="home-market-radar-title">
      <div className="home-market-radar-heading mb-3 flex h-4 shrink-0 items-center justify-between gap-3 px-1">
        <h2
          id="home-market-radar-title"
          className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
            isDark ? "text-white/42" : "text-zinc-500/85"
          }`}
        >
          {language === "es" ? "Radar del mercado" : "Market radar"}
        </h2>
        <span className={`text-[8px] font-bold uppercase tracking-[0.12em] ${isDark ? "text-sky-300/50" : "text-sky-700/55"}`}>
          {language === "es" ? "Inventario real" : "Live inventory"}
        </span>
      </div>

      <div
        className={`home-market-radar-frame rounded-[23px] p-[2px] transition-all duration-500 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
          highlighted
            ? "scale-[1.012] bg-gradient-to-br from-sky-400 via-cyan-300 to-blue-600 shadow-[0_0_32px_rgba(14,165,233,0.22)]"
            : "bg-transparent"
        }`}
      >
        <div
          className={`home-market-radar-list grid snap-x snap-mandatory grid-flow-col auto-cols-[82%] gap-3 overflow-x-auto rounded-[21px] p-1 pb-2 scrollbar-none sm:auto-cols-[54%] lg:h-full lg:min-h-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-rows-[repeat(3,minmax(0,1fr))] lg:gap-2.5 lg:overflow-hidden lg:p-1 ${
            highlighted ? (isDark ? "bg-[#080b10]/96" : "bg-white/96") : "bg-transparent"
          }`}
        >
          {loading && entries.length === 0 ? (
            <div className={`col-span-full flex min-h-40 items-center justify-center rounded-[20px] border lg:row-span-3 lg:min-h-0 ${isDark ? "border-white/8 bg-white/[0.025] text-white/40" : "border-zinc-200 bg-white text-zinc-400"}`}>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="text-xs">{language === "es" ? "Leyendo el mercado…" : "Reading the market…"}</span>
            </div>
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <Link
                key={entry.property.id}
                href={`/property/${entry.property.id}`}
                prefetch={false}
                className={`home-radar-card group snap-start overflow-hidden rounded-[20px] border text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:flex lg:min-h-0 lg:flex-col ${
                  isDark
                    ? "border-white/[0.07] bg-[#0d1117]/92 hover:border-sky-400/30"
                    : "border-zinc-200/90 bg-white hover:border-sky-400/45"
                }`}
                aria-label={`${entry.tag}: ${entry.property.title}`}
              >
                <RadarImage entry={entry} />
                <div className="home-radar-content min-h-0 shrink-0 px-3 py-2.5 lg:px-3 lg:py-2">
                  <strong className={`home-radar-title block truncate text-[12px] font-extrabold tracking-[-0.02em] ${isDark ? "text-white/90" : "text-zinc-900"}`}>
                    {entry.property.title}
                  </strong>
                  <span className={`home-radar-caption mt-1 block truncate text-[9px] ${isDark ? "text-white/38" : "text-zinc-500"}`}>
                    {getHomePropertyCaption(entry.property, entry.price, language)}
                  </span>
                  <div className="home-radar-price-row mt-2 flex items-center justify-between gap-2">
                    <b className={`text-[12px] font-black tracking-[-0.02em] ${isDark ? "text-white" : "text-zinc-950"}`}>
                      {formatHomePrice(entry.price, language, true)}
                    </b>
                    <span className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.08em] ${isDark ? "text-sky-300/75" : "text-sky-700/75"}`}>
                      {language === "es" ? "Ver" : "View"}
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className={`col-span-full rounded-[20px] border px-5 py-7 text-center lg:row-span-3 ${isDark ? "border-white/8 bg-white/[0.025]" : "border-zinc-200 bg-white"}`}>
              <Building2 className={`mx-auto h-6 w-6 ${isDark ? "text-white/25" : "text-zinc-300"}`} aria-hidden="true" />
              <p className={`mt-3 text-xs font-semibold ${isDark ? "text-white/65" : "text-zinc-700"}`}>
                {language === "es" ? "El radar se está actualizando" : "The radar is updating"}
              </p>
            </div>
          )}
        </div>
      </div>

      {entries[0] ? (
        <p className={`home-radar-insight mt-3 hidden shrink-0 px-1 text-[9px] leading-relaxed lg:block ${isDark ? "text-white/28" : "text-zinc-400"}`}>
          {entries[0].insight}
        </p>
      ) : null}
    </section>
  );
}
