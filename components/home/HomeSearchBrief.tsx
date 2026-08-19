"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Ellipsis,
  House,
  MessageCircle,
  Search,
  Send,
  SlidersHorizontal,
  Store,
  Trees,
  Warehouse,
  X,
} from "lucide-react";
import { useLiveContext } from "../../lib/context/LiveContext";
import { useSwap } from "../../lib/context/SwapContext";
import { parseBudgetToNumber } from "../../lib/search/SearchEngine";
import { getPropertyPriceSnapshot } from "../../lib/search/propertyPrice";
import { type OperationMode } from "../../lib/search/searchConfig";
import { requestInstantTopNavigation } from "../../lib/navigation/instantTopNavigation";
import {
  formatHomePrice,
  getHomePropertyCaption,
} from "./homeExperienceData";
import {
  buildHomeMiniSearchUrl,
  findHomeMiniBudgetSelection,
  getHomeMiniBudgetOptions,
  normalizeHomeMiniOperation,
  normalizeHomeMiniPropertyType,
  searchHomeMiniInventory,
  type HomeMiniSearchSelection,
} from "./homeMiniSearch";

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

const OPERATIONS: Array<{ id: OperationMode; es: string; en: string }> = [
  { id: "SALE", es: "Venta", en: "Sale" },
  { id: "RENT", es: "Renta", en: "Rent" },
  { id: "SWAP", es: "Intercambio", en: "Swap" },
  { id: "ALL", es: "Todo", en: "All" },
];

const PRIMARY_PROPERTY_TYPES = [
  { id: "Casas", es: "Casas", en: "Houses", icon: House },
  { id: "Departamentos", es: "Departamentos", en: "Apartments", icon: Building2 },
  { id: "Terrenos", es: "Terrenos", en: "Land", icon: Trees },
] as const;

const EXTRA_PROPERTY_TYPES = [
  { id: "Lofts", es: "Lofts", en: "Lofts", icon: Warehouse },
  { id: "Locales", es: "Locales", en: "Retail", icon: Store },
  { id: "Oficinas", es: "Oficinas", en: "Offices", icon: Briefcase },
] as const;

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
    <form onSubmit={handleSubmit} className="home-brief-composer relative w-full">
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

const getEnglishBudgetLabel = (
  value: string,
  previousValue: string | undefined,
  isLast: boolean,
): string => {
  if (!value) return "Any budget";
  const money = (amount: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  const maximum = Number(value);
  const minimum = Number(previousValue);
  if (isLast && minimum > 0) return `Over ${money(minimum)}`;
  if (!minimum) return `Up to ${money(maximum)}`;
  return `${money(minimum)} – ${money(maximum)}`;
};

export default function HomeSearchBrief({
  searchInput,
  setSearchInput,
  isDark,
  language,
}: HomeSearchBriefProps) {
  const router = useRouter();
  const { eternaChatState, sendPrompt } = useLiveContext();
  const { activeSearch, properties, setActiveSearch } = useSwap();
  const { chatHistory, searchBrief } = eternaChatState;
  const [conversationOpen, setConversationOpen] = useState(false);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<{
    baseline: string;
    value: HomeMiniSearchSelection;
  } | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const budgetRef = useRef<HTMLDivElement | null>(null);

  const externalOperation = activeSearch?.filters.operation || searchBrief.operation;
  const externalZone = activeSearch?.filters.city || searchBrief.city || "";
  const externalPropertyType = activeSearch?.filters.type || searchBrief.propertyType;
  const externalBudget = activeSearch?.filters.budget
    ?? (typeof searchBrief.budget === "number"
      ? searchBrief.budget
      : parseBudgetToNumber(searchBrief.budget || "", searchBrief.operation === "rent" ? "rent" : "sale"));
  const externalSelection = useMemo<HomeMiniSearchSelection>(() => {
    const nextOperation = normalizeHomeMiniOperation(externalOperation);
    return {
      operation: nextOperation,
      zone: externalZone,
      propertyType: normalizeHomeMiniPropertyType(externalPropertyType),
      budget: findHomeMiniBudgetSelection(nextOperation, externalBudget || undefined),
    };
  }, [externalBudget, externalOperation, externalPropertyType, externalZone]);
  const externalSelectionKey = `${externalSelection.operation}|${externalSelection.zone}|${externalSelection.propertyType}|${externalSelection.budget}`;
  const selection = draftSelection?.baseline === externalSelectionKey
    ? draftSelection.value
    : externalSelection;
  const { operation, zone, propertyType, budget } = selection;

  const updateSelection = (patch: Partial<HomeMiniSearchSelection>) => {
    setDraftSelection({
      baseline: externalSelectionKey,
      value: { ...selection, ...patch },
    });
  };

  useEffect(() => {
    if (!conversationOpen || !transcriptRef.current) return;
    transcriptRef.current.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatHistory, conversationOpen]);

  useEffect(() => {
    if (!budgetOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!budgetRef.current?.contains(event.target as Node)) setBudgetOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBudgetOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [budgetOpen]);

  const filteredProperties = useMemo(() => (
    searchHomeMiniInventory(properties, selection)
  ), [properties, selection]);

  const matches = useMemo(() => filteredProperties.slice(0, 2).map((property) => ({
    property,
    price: getPropertyPriceSnapshot(
      property,
      operation === "SALE" ? "sale" : operation === "RENT" ? "rent" : undefined,
    ),
  })), [filteredProperties, operation]);

  const budgetOptions = getHomeMiniBudgetOptions(operation);
  const selectedBudgetIndex = budgetOptions.findIndex((option) => option.value === budget);
  const selectedBudgetOption = selectedBudgetIndex >= 0
    ? budgetOptions[selectedBudgetIndex]
    : budgetOptions[0];
  const selectedBudgetLabel = selectedBudgetOption
    ? language === "es"
      ? selectedBudgetOption.label
      : getEnglishBudgetLabel(
          selectedBudgetOption.value,
          budgetOptions[selectedBudgetIndex - 1]?.value,
          selectedBudgetIndex === budgetOptions.length - 1,
        )
    : language === "es" ? "Elige venta o renta" : "Choose sale or rent";
  const exploreUrl = buildHomeMiniSearchUrl(selection);
  const fieldClass = isDark
    ? "border-white/[0.07] bg-white/[0.025] focus-within:border-sky-300/35"
    : "border-zinc-200/80 bg-white focus-within:border-sky-400";
  const labelClass = isDark ? "text-white/34" : "text-zinc-400";
  const controlClass = isDark ? "text-white/82" : "text-zinc-800";

  const navigateToExplore = (url: string) => {
    setActiveSearch(null);
    requestInstantTopNavigation(window.sessionStorage);
    router.push(url, { scroll: false });
  };

  return (
    <section className="home-search-brief flex w-full flex-col lg:h-full lg:min-h-0" aria-labelledby="home-search-brief-title">
      <div className="home-search-brief-heading mb-3 flex h-4 shrink-0 items-center justify-between gap-3 px-1">
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
        className={`home-search-brief-box relative flex min-h-[470px] w-full flex-col overflow-hidden rounded-[28px] border p-5 shadow-sm backdrop-blur-xl lg:min-h-0 lg:flex-1 ${
          isDark
            ? "border-white/[0.07] bg-[#0b0e13]/86 shadow-2xl"
            : "border-zinc-200/85 bg-white/88 shadow-[0_22px_60px_rgba(24,24,27,0.07)]"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`grid h-8 w-8 place-items-center rounded-full ${isDark ? "bg-sky-300/10 text-sky-200" : "bg-sky-50 text-sky-700"}`}>
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h3 className={`home-search-brief-title text-[18px] font-black tracking-[-0.035em] ${isDark ? "text-white" : "text-zinc-950"}`}>
              {language === "es" ? "Buscar propiedades" : "Search listings"}
            </h3>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[8px] font-extrabold tabular-nums ${isDark ? "bg-white/[0.05] text-white/55" : "bg-zinc-100 text-zinc-600"}`}>
            {filteredProperties.length}
          </span>
        </div>

        <div
          className={`home-mini-operation-tabs mt-3 grid shrink-0 grid-cols-4 gap-1 rounded-full p-1 ${isDark ? "bg-white/[0.035]" : "bg-zinc-100/90"}`}
          role="tablist"
          aria-label={language === "es" ? "Tipo de operación" : "Operation type"}
        >
          {OPERATIONS.map((option) => {
            const isActive = operation === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  updateSelection({ operation: option.id, budget: "" });
                  setBudgetOpen(false);
                }}
                className={`min-w-0 rounded-full px-1 py-2 text-[7px] font-black uppercase tracking-[0.08em] transition-all ${
                  isActive
                    ? isDark
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "bg-zinc-950 text-white shadow-sm"
                    : isDark
                      ? "text-white/44 hover:text-white/80"
                      : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {language === "es" ? option.es : option.en}
              </button>
            );
          })}
        </div>

        <label className={`home-mini-search-field relative mt-2.5 flex h-11 shrink-0 items-center rounded-[17px] border pl-10 pr-3 transition-colors ${fieldClass}`}>
          <Search className={`pointer-events-none absolute left-3.5 h-4 w-4 ${isDark ? "text-sky-300/70" : "text-sky-600"}`} aria-hidden="true" />
          <input
            value={zone}
            onChange={(event) => updateSelection({ zone: event.target.value })}
            className={`h-full w-full bg-transparent text-[11px] font-bold outline-none placeholder:font-semibold ${controlClass} ${isDark ? "placeholder:text-white/28" : "placeholder:text-zinc-400"}`}
            placeholder={language === "es" ? "Ciudad, zona, título o ID" : "City, area, title or ID"}
            aria-label={language === "es" ? "Ciudad, zona, título o ID" : "City, area, title or ID"}
          />
        </label>

        <div className="home-mini-property-types mt-2.5 shrink-0">
          <div className="flex items-center px-0.5">
            <span className={`text-[7px] font-extrabold uppercase tracking-[0.14em] ${labelClass}`}>
              {language === "es" ? "Tipo de propiedad" : "Property type"}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="group" aria-label={language === "es" ? "Tipos principales" : "Main property types"}>
            {PRIMARY_PROPERTY_TYPES.map((type) => {
              const isActive = propertyType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => updateSelection({ propertyType: isActive ? "All" : type.id })}
                  aria-pressed={isActive}
                  className={`home-mini-type-card flex min-w-0 flex-col items-center justify-center gap-1 rounded-[13px] border px-1 py-2 transition-all ${
                    isActive
                      ? isDark ? "border-white bg-white text-zinc-950" : "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                      : isDark ? "border-white/[0.07] bg-white/[0.025] text-white/55 hover:border-white/20 hover:text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                  }`}
                >
                  <type.icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                  <span className="w-full truncate text-center text-[7px] font-extrabold tracking-[-0.01em]">
                    {language === "es" ? type.es : type.en}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowMoreTypes((value) => !value)}
              aria-expanded={showMoreTypes}
              className={`home-mini-type-card flex min-w-0 flex-col items-center justify-center gap-1 rounded-[13px] border px-1 py-2 transition-all ${
                showMoreTypes
                  ? isDark ? "border-white bg-white text-zinc-950" : "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                  : isDark ? "border-white/[0.07] bg-white/[0.025] text-sky-200/70 hover:border-white/20 hover:text-white" : "border-zinc-200 bg-white text-sky-700 hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              <Ellipsis className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
              <span className="w-full truncate text-center text-[7px] font-extrabold tracking-[-0.01em]">
                {language === "es" ? "Ver más" : "More"}
              </span>
            </button>
          </div>

          {showMoreTypes ? (
            <div className="home-mini-extra-types mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label={language === "es" ? "Más tipos" : "More property types"}>
              {EXTRA_PROPERTY_TYPES.map((type) => {
                const isActive = propertyType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateSelection({ propertyType: isActive ? "All" : type.id })}
                    aria-pressed={isActive}
                    className={`flex items-center justify-center gap-1.5 rounded-[12px] border px-2 py-1.5 text-[7px] font-extrabold transition-all ${
                      isActive
                        ? isDark ? "border-white bg-white text-zinc-950" : "border-zinc-950 bg-zinc-950 text-white"
                        : isDark ? "border-white/[0.07] text-white/55 hover:text-white" : "border-zinc-200 text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    <type.icon className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" />
                    {language === "es" ? type.es : type.en}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div ref={budgetRef} className="home-mini-budget relative z-20 mt-2.5 shrink-0">
          <button
            type="button"
            onClick={() => budgetOptions.length > 0 && setBudgetOpen((value) => !value)}
            disabled={budgetOptions.length === 0}
            aria-haspopup="listbox"
            aria-expanded={budgetOpen}
            className={`flex h-9 w-full items-center rounded-[14px] border px-3 text-left transition-all disabled:cursor-not-allowed ${fieldClass} ${budgetOptions.length === 0 ? "opacity-60" : budgetOpen ? isDark ? "border-sky-300/40" : "border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.08)]" : ""}`}
          >
            <span className={`mr-2 shrink-0 text-[7px] font-extrabold uppercase tracking-[0.12em] ${labelClass}`}>
              {language === "es" ? "Precio" : "Price"}
            </span>
            <span className={`min-w-0 flex-1 truncate text-[9px] font-bold ${controlClass}`}>
              {selectedBudgetLabel}
            </span>
            <ChevronDown className={`ml-2 h-3 w-3 shrink-0 transition-transform ${budgetOpen ? "rotate-180" : ""} ${labelClass}`} aria-hidden="true" />
          </button>

          {budgetOpen && budgetOptions.length > 0 ? (
            <div
              role="listbox"
              aria-label={language === "es" ? "Rango de precio" : "Price range"}
              className={`absolute inset-x-0 top-full z-30 mt-1.5 max-h-[190px] overflow-y-auto rounded-[16px] border p-1.5 shadow-[0_18px_45px_rgba(9,9,11,0.18)] backdrop-blur-xl scrollbar-thin ${isDark ? "border-white/10 bg-[#12161d]/[0.98]" : "border-zinc-200 bg-white/[0.98]"}`}
            >
              {budgetOptions.map((option, index) => {
                const isSelected = option.value === budget;
                const optionLabel = language === "es"
                  ? option.label
                  : getEnglishBudgetLabel(
                      option.value,
                      budgetOptions[index - 1]?.value,
                      index === budgetOptions.length - 1,
                    );
                return (
                  <button
                    key={option.value || "any"}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      updateSelection({ budget: option.value });
                      setBudgetOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-[11px] px-3 py-2 text-left text-[9px] font-bold transition-colors ${
                      isSelected
                        ? isDark ? "bg-white text-zinc-950" : "bg-zinc-950 text-white"
                        : isDark ? "text-white/62 hover:bg-white/[0.06] hover:text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                    }`}
                  >
                    <span>{optionLabel}</span>
                    {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="home-brief-matches mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <span className={`text-[8px] font-extrabold uppercase tracking-[0.14em] ${isDark ? "text-white/35" : "text-zinc-500"}`}>
              {language === "es" ? "Coincidencias" : "Matches"}
            </span>
            <b className={`text-[9px] tabular-nums ${isDark ? "text-white/65" : "text-zinc-700"}`}>
              {filteredProperties.length} {language === "es" ? "disponibles" : "available"}
            </b>
          </div>
          <div className="home-brief-match-list mt-2 space-y-1.5 overflow-hidden" aria-live="polite">
            {matches.length > 0 ? matches.map(({ property, price }, matchIndex) => (
              <Link
                key={property.id}
                href={`/property/${property.id}`}
                prefetch={false}
                className={`group flex items-center gap-2.5 rounded-[15px] border p-1.5 pr-2 transition-colors ${matchIndex > 0 ? "home-brief-secondary-match" : ""} ${isDark ? "border-white/[0.05] bg-white/[0.018] hover:border-sky-300/25" : "border-zinc-200/75 bg-white hover:border-sky-300"}`}
              >
                <MatchImage source={property.images?.[0]} title={property.title} />
                <span className="min-w-0 flex-1">
                  <strong className={`block truncate text-[9px] font-extrabold ${isDark ? "text-white/78" : "text-zinc-800"}`}>{property.title}</strong>
                  <small className={`mt-0.5 block truncate text-[7px] ${isDark ? "text-white/30" : "text-zinc-400"}`}>
                    {price
                      ? getHomePropertyCaption(property, price, language)
                      : `${property.location} · ${language === "es" ? "Intercambio" : "Swap"}`}
                  </small>
                </span>
                <b className={`shrink-0 text-[9px] ${isDark ? "text-white/70" : "text-zinc-800"}`}>
                  {price ? formatHomePrice(price, language, true) : "Swap"}
                </b>
              </Link>
            )) : (
              <div className={`rounded-[15px] border border-dashed px-3 py-4 text-center text-[10px] font-semibold ${isDark ? "border-white/10 text-white/38" : "border-zinc-200 text-zinc-500"}`}>
                {language === "es" ? "Sin coincidencias. Ajusta un filtro." : "No matches. Adjust a filter."}
              </div>
            )}
          </div>
        </div>

        <div className="home-brief-actions mt-4 flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => navigateToExplore(exploreUrl)}
            className="home-mini-search-submit flex h-10 w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(14,165,233,0.22)] transition-all hover:-translate-y-0.5 hover:bg-sky-600"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {language === "es" ? "Buscar" : "Search"}
          </button>
          <button
            type="button"
            onClick={() => navigateToExplore("/explore")}
            className={`home-brief-explore flex h-9 w-full items-center justify-between rounded-full px-4 text-[8px] font-black uppercase tracking-[0.1em] shadow-sm transition-all hover:-translate-y-0.5 ${isDark ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"}`}
          >
            <span>{language === "es" ? "Explora todo el catálogo" : "Explore the full catalog"}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {conversationOpen ? (
          <div className={`home-brief-conversation absolute inset-0 z-20 flex flex-col p-5 ${isDark ? "bg-[#0b0e13]/[0.985]" : "bg-white/[0.985]"}`}>
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
