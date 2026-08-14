"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Building2,
  House,
  MapPin,
  MessageCircle,
  Search,
  Send,
  WalletCards,
  X,
} from "lucide-react";
import { useLiveContext } from "../../lib/context/LiveContext";
import { useSwap } from "../../lib/context/SwapContext";
import { getPropertyPriceSnapshot } from "../../lib/search/propertyPrice";
import { requestInstantTopNavigation } from "../../lib/navigation/instantTopNavigation";
import {
  buildHomeExploreUrl,
  buildHomeMarketRadar,
  formatHomePrice,
  getHomePropertyCaption,
} from "./homeExperienceData";

interface HomeSearchBriefProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  isDark: boolean;
  language: "es" | "en";
}

interface CompactComposerProps {
  value: string;
  setValue: (value: string) => void;
  isDark: boolean;
  language: "es" | "en";
  onSubmit: (prompt: string) => void;
}

function CompactComposer({
  value,
  setValue,
  isDark,
  language,
  onSubmit,
}: CompactComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = value.trim();
    if (!prompt) return;
    onSubmit(prompt);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search
        className={`pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? "text-white/28" : "text-zinc-400"}`}
        aria-hidden="true"
      />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={language === "es" ? "Dile qué estás buscando…" : "Tell Eterna what you need…"}
        className={`h-11 w-full rounded-full border bg-transparent pl-9 pr-12 text-[11px] font-medium outline-none transition-colors placeholder:font-normal focus:border-sky-400/60 ${
          isDark
            ? "border-white/[0.09] text-white placeholder:text-white/25"
            : "border-zinc-200 text-zinc-800 placeholder:text-zinc-400"
        }`}
        aria-label={language === "es" ? "Escribe lo que buscas" : "Describe your search"}
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className={`absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full transition-all disabled:cursor-not-allowed ${
          value.trim()
            ? "bg-sky-500 text-white shadow-[0_6px_18px_rgba(14,165,233,0.28)] hover:bg-sky-600"
            : isDark
              ? "bg-white/[0.04] text-white/18"
              : "bg-zinc-100 text-zinc-300"
        }`}
        aria-label={language === "es" ? "Enviar a Eterna" : "Send to Eterna"}
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

const operationLabel = (
  operation: "sale" | "rent" | "swap" | undefined,
  language: "es" | "en",
): string => {
  if (operation === "sale") return language === "es" ? "Comprar" : "Buy";
  if (operation === "rent") return language === "es" ? "Rentar" : "Rent";
  if (operation === "swap") return language === "es" ? "Intercambiar" : "Exchange";
  return language === "es" ? "Por definir" : "To be defined";
};

const typeLabel = (type: string | undefined, language: "es" | "en"): string => {
  if (!type) return language === "es" ? "Cualquier tipo" : "Any type";
  const normalized = type.toLocaleLowerCase("es-MX");
  if (["villa", "house", "casa", "casas"].includes(normalized)) {
    return language === "es" ? "Casa" : "House";
  }
  if (["apartment", "apartamento", "departamento"].includes(normalized)) {
    return language === "es" ? "Departamento" : "Apartment";
  }
  return type;
};

const budgetLabel = (
  budget: string | number | undefined,
  minBudget: number | undefined,
  language: "es" | "en",
): string => {
  const locale = language === "es" ? "es-MX" : "en-US";
  const money = (value: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

  if (typeof budget === "number" && minBudget) return `${money(minBudget)} – ${money(budget)}`;
  if (typeof budget === "number") return `${language === "es" ? "Hasta" : "Up to"} ${money(budget)}`;
  if (typeof budget === "string" && budget.trim()) return budget.trim();
  if (minBudget) return `${language === "es" ? "Desde" : "From"} ${money(minBudget)}`;
  return language === "es" ? "Presupuesto abierto" : "Open budget";
};

function MatchImage({ source, title }: { source?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-11 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[linear-gradient(145deg,#cbdde5,#65818f)]">
      {source && !failed ? (
        <Image
          src={source}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/75">
          <Building2 className="h-4 w-4" aria-label={title} />
        </div>
      )}
    </div>
  );
}

export default function HomeSearchBrief({
  searchInput,
  setSearchInput,
  isDark,
  language,
}: HomeSearchBriefProps) {
  const router = useRouter();
  const { eternaChatState, sendPrompt } = useLiveContext();
  const { activeSearch, properties } = useSwap();
  const { chatHistory, searchBrief } = eternaChatState;
  const [conversationOpen, setConversationOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const liveMatches = (activeSearch?.results || []).flatMap((property) => {
      const price = getPropertyPriceSnapshot(property, activeSearch?.filters.operation);
      return price ? [{ property, price }] : [];
    });
    if (liveMatches.length > 0) return liveMatches.slice(0, 2);
    return buildHomeMarketRadar(properties, language)
      .slice(0, 2)
      .map(({ property, price }) => ({ property, price }));
  }, [activeSearch, language, properties]);

  useEffect(() => {
    if (!conversationOpen || !transcriptRef.current) return;
    transcriptRef.current.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatHistory, conversationOpen]);

  const statusCopy = {
    idle: language === "es" ? "Lista para descubrir" : "Ready to discover",
    collecting: language === "es" ? "Afinando tu búsqueda" : "Refining your search",
    searching: language === "es" ? "Buscando en tiempo real" : "Searching live inventory",
    ready: language === "es" ? "Búsqueda actualizada" : "Search updated",
    error: language === "es" ? "Revisa los criterios" : "Review your criteria",
  }[searchBrief.status];
  const resultCount = searchBrief.status === "ready"
    ? searchBrief.resultCount
    : properties.filter((property) => property.isPublished !== false && property.isDemo !== true && property.is_demo !== true).length;
  const exploreUrl = buildHomeExploreUrl(activeSearch?.filters);
  const handleExplore = () => {
    requestInstantTopNavigation(window.sessionStorage);
    router.push(exploreUrl, { scroll: false });
  };

  const criteria = [
    {
      icon: WalletCards,
      label: language === "es" ? "Operación" : "Operation",
      value: operationLabel(searchBrief.operation, language),
    },
    {
      icon: MapPin,
      label: language === "es" ? "Zona" : "Area",
      value: searchBrief.city || (language === "es" ? "Cualquier ubicación" : "Any location"),
    },
    {
      icon: House,
      label: language === "es" ? "Propiedad" : "Property",
      value: typeLabel(searchBrief.propertyType, language),
    },
    {
      icon: BedDouble,
      label: language === "es" ? "Recámaras" : "Bedrooms",
      value: searchBrief.rooms
        ? `${searchBrief.rooms}+`
        : (language === "es" ? "Sin límite" : "No limit"),
    },
  ];

  return (
    <section className="flex w-full flex-col" aria-labelledby="home-search-brief-title">
      <div className="mb-3 flex h-4 items-center justify-between gap-3 px-1">
        <h2
          id="home-search-brief-title"
          className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-white/42" : "text-zinc-500/85"}`}
        >
          {language === "es" ? "Tu búsqueda" : "Your search"}
        </h2>
        <button
          type="button"
          onClick={() => setConversationOpen(true)}
          className={`inline-flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] transition-colors ${isDark ? "text-white/36 hover:text-sky-300" : "text-zinc-500 hover:text-sky-700"}`}
        >
          <MessageCircle className="h-3 w-3" aria-hidden="true" />
          {language === "es" ? "Conversación" : "Conversation"}
          {chatHistory.length > 0 ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-sky-500 px-1 text-[8px] text-white">
              {chatHistory.length}
            </span>
          ) : null}
        </button>
      </div>

      <div
        className={`relative flex min-h-[470px] w-full flex-col overflow-hidden rounded-[28px] border p-5 shadow-sm backdrop-blur-xl lg:h-[calc(var(--useful-height)-70px)] lg:max-h-[620px] lg:min-h-[470px] ${
          isDark
            ? "border-white/[0.07] bg-[#0b0e13]/86 shadow-2xl"
            : "border-zinc-200/85 bg-white/88 shadow-[0_22px_60px_rgba(24,24,27,0.07)]"
        }`}
      >
        <div className="flex items-start gap-4">
          <div>
            <span className={`text-[8px] font-extrabold uppercase tracking-[0.16em] ${isDark ? "text-sky-300/60" : "text-sky-700/65"}`}>
              {language === "es" ? "Brief en vivo" : "Live brief"}
            </span>
            <h3 className={`mt-1 text-[19px] font-black tracking-[-0.035em] ${isDark ? "text-white" : "text-zinc-950"}`}>
              {language === "es" ? "Lo que Eterna entendió" : "What Eterna understood"}
            </h3>
          </div>
        </div>

        <div className={`mt-4 flex items-center gap-2 rounded-full border px-3 py-2 ${isDark ? "border-white/[0.06] bg-white/[0.025]" : "border-zinc-200/80 bg-zinc-50/80"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${searchBrief.status === "error" ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
          <span className={`text-[9px] font-bold uppercase tracking-[0.11em] ${isDark ? "text-white/55" : "text-zinc-600"}`}>
            {statusCopy}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {criteria.map(({ icon: Icon, label, value }) => (
            <div key={label} className={`min-w-0 rounded-[16px] border px-3 py-2.5 ${isDark ? "border-white/[0.055] bg-white/[0.022]" : "border-zinc-200/75 bg-white"}`}>
              <div className={`flex items-center gap-1.5 text-[7px] font-extrabold uppercase tracking-[0.12em] ${isDark ? "text-white/30" : "text-zinc-400"}`}>
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </div>
              <p className={`mt-1 truncate text-[11px] font-bold ${isDark ? "text-white/78" : "text-zinc-800"}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className={`mt-2 rounded-[16px] border px-3 py-2.5 ${isDark ? "border-white/[0.055] bg-white/[0.022]" : "border-zinc-200/75 bg-white"}`}>
          <div className={`flex items-center gap-1.5 text-[7px] font-extrabold uppercase tracking-[0.12em] ${isDark ? "text-white/30" : "text-zinc-400"}`}>
            <WalletCards className="h-3 w-3" aria-hidden="true" />
            {language === "es" ? "Presupuesto" : "Budget"}
          </div>
          <p className={`mt-1 truncate text-[11px] font-bold ${isDark ? "text-white/78" : "text-zinc-800"}`}>
            {budgetLabel(searchBrief.budget, searchBrief.minBudget, language)}
          </p>
          {searchBrief.preferences.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {searchBrief.preferences.slice(0, 3).map((preference) => (
                <span key={preference} className={`rounded-full px-2 py-1 text-[7px] font-bold ${isDark ? "bg-sky-300/10 text-sky-200/65" : "bg-sky-50 text-sky-700"}`}>
                  {preference}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className={`text-[8px] font-extrabold uppercase tracking-[0.14em] ${isDark ? "text-white/35" : "text-zinc-500"}`}>
              {language === "es" ? "Coincidencias" : "Matches"}
            </span>
            <b className={`text-[9px] ${isDark ? "text-white/65" : "text-zinc-700"}`}>
              {resultCount} {language === "es" ? "disponibles" : "available"}
            </b>
          </div>
          <div className="mt-2 space-y-1.5">
            {matches.map(({ property, price }) => (
              <Link
                key={property.id}
                href={`/property/${property.id}`}
                prefetch={false}
                className={`group flex items-center gap-2.5 rounded-[15px] border p-1.5 pr-2 transition-colors ${isDark ? "border-white/[0.05] bg-white/[0.018] hover:border-sky-300/25" : "border-zinc-200/75 bg-white hover:border-sky-300"}`}
              >
                <MatchImage source={property.images?.[0]} title={property.title} />
                <span className="min-w-0 flex-1">
                  <strong className={`block truncate text-[9px] font-extrabold ${isDark ? "text-white/78" : "text-zinc-800"}`}>{property.title}</strong>
                  <small className={`mt-0.5 block truncate text-[7px] ${isDark ? "text-white/30" : "text-zinc-400"}`}>
                    {getHomePropertyCaption(property, price, language)}
                  </small>
                </span>
                <b className={`shrink-0 text-[9px] ${isDark ? "text-white/70" : "text-zinc-800"}`}>{formatHomePrice(price, language, true)}</b>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={handleExplore}
            className={`flex h-10 w-full items-center justify-between rounded-full px-4 text-[9px] font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 ${isDark ? "bg-white text-zinc-950 hover:bg-sky-50" : "bg-zinc-950 text-white hover:bg-zinc-800"}`}
          >
            <span>{activeSearch ? (language === "es" ? "Ver búsqueda completa" : "View full search") : (language === "es" ? "Explorar catálogo" : "Explore listings")}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <CompactComposer
            value={searchInput}
            setValue={setSearchInput}
            isDark={isDark}
            language={language}
            onSubmit={sendPrompt}
          />
        </div>

        {conversationOpen ? (
          <div className={`absolute inset-0 z-20 flex flex-col p-5 ${isDark ? "bg-[#0b0e13]/[0.985]" : "bg-white/[0.985]"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className={`text-[8px] font-extrabold uppercase tracking-[0.16em] ${isDark ? "text-sky-300/60" : "text-sky-700/65"}`}>Eterna</span>
                <h3 className={`mt-1 text-[18px] font-black tracking-[-0.03em] ${isDark ? "text-white" : "text-zinc-950"}`}>
                  {language === "es" ? "Conversación" : "Conversation"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConversationOpen(false)}
                className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${isDark ? "border-white/10 text-white/55 hover:bg-white/5 hover:text-white" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}
                aria-label={language === "es" ? "Cerrar conversación" : "Close conversation"}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div ref={transcriptRef} className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
              {chatHistory.length > 0 ? chatHistory.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[92%] rounded-[18px] px-3.5 py-2.5 text-[11px] leading-relaxed ${
                    message.role === "user"
                      ? "rounded-tr-[5px] bg-sky-600 text-white"
                      : isDark
                        ? "rounded-tl-[5px] bg-white/[0.045] text-white/72"
                        : "rounded-tl-[5px] bg-zinc-100 text-zinc-600"
                  }`}>
                    {message.content}
                  </div>
                  {message.role === "assistant" && message.suggestedReplies?.length ? (
                    <div className="mt-1.5 flex max-w-[94%] flex-wrap gap-1">
                      {message.suggestedReplies.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => sendPrompt(suggestion)}
                          className={`rounded-full border px-2.5 py-1 text-left text-[8px] font-bold transition-colors ${isDark ? "border-white/10 text-white/52 hover:border-sky-300/35 hover:text-white" : "border-zinc-200 text-zinc-500 hover:border-sky-300 hover:text-sky-700"}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <MessageCircle className={`h-6 w-6 ${isDark ? "text-white/20" : "text-zinc-300"}`} aria-hidden="true" />
                  <p className={`mt-3 text-[11px] font-semibold ${isDark ? "text-white/55" : "text-zinc-600"}`}>
                    {language === "es" ? "Tu conversación aparecerá aquí al hablar con Eterna." : "Your conversation will appear here when you talk to Eterna."}
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-4 border-t pt-4 ${isDark ? "border-white/[0.07]" : "border-zinc-200"}`}>
              <CompactComposer
                value={searchInput}
                setValue={setSearchInput}
                isDark={isDark}
                language={language}
                onSubmit={sendPrompt}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
