import type { EternaProperty } from './PropertyActions';
import {
  calculateMortgage,
  DEFAULT_MORTGAGE_SCENARIO,
} from '../../finance/mortgage';
import type { MortgageScenario } from '../../finance/mortgage';

export interface MortgageConversationContext extends MortgageScenario {
  propertyId: string;
}

export interface MortgageAnswer {
  reply: string;
  scenario: MortgageConversationContext;
  suggestedReplies: string[];
}

const normalize = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/,/g, '.');

const parseNumber = (value?: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isMortgageQuestion = (prompt: string) => /\b(mensualidad|mensualidades|pago mensual|pagar(?:ia)? al mes|cuanto (?:se |me )?(?:paga(?:ria)?|quedaria|sale)(?: al mes)?|simul(?:a|ar|acion|ador)|hipoteca|credito hipotecario|mortgage|monthly payment)\b/.test(prompt);

const isScenarioChange = (prompt: string) => /\b(enganche|plazo|tasa|anos?|years?|rate)\b/.test(prompt) || /\d+(?:\.\d+)?\s*%/.test(prompt);

const isAffirmative = (prompt: string) => /^(si|claro|ok|okay|yes|por supuesto|dale)$/.test(prompt.trim());

function extractScenario(prompt: string, base: MortgageScenario): MortgageScenario {
  const downPaymentMatch = prompt.match(/enganche(?:\s+(?:de|del))?\s*(\d+(?:\.\d+)?)\s*%?/) 
    ?? prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:de\s+)?enganche/);
  const rateMatch = prompt.match(/tasa(?:\s+(?:de|del))?\s*(\d+(?:\.\d+)?)\s*%?/)
    ?? prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:de\s+)?(?:tasa|anual)/);
  const yearsMatch = prompt.match(/(\d{1,2})\s*(?:anos?|years?)/);

  let downPaymentPercent = parseNumber(downPaymentMatch?.[1]) ?? base.downPaymentPercent;
  const annualRatePercent = parseNumber(rateMatch?.[1]) ?? base.annualRatePercent;
  const years = parseNumber(yearsMatch?.[1]) ?? base.years;

  if (!downPaymentMatch && !rateMatch) {
    const standalonePercent = prompt.match(/(?:con|al)\s*(\d+(?:\.\d+)?)\s*%/);
    downPaymentPercent = parseNumber(standalonePercent?.[1]) ?? downPaymentPercent;
  }

  return { downPaymentPercent, years, annualRatePercent };
}

function getSalePrice(property: EternaProperty) {
  const activeSale = property.offerings?.find((offering) => (
    offering.mode === 'SALE'
    && offering.status === 'ACTIVE'
    && Number(offering.priceAmount) > 0
  ));
  const anySale = property.offerings?.find((offering) => (
    offering.mode === 'SALE' && Number(offering.priceAmount) > 0
  ));
  const offering = activeSale ?? anySale;
  const price = Number(offering?.priceAmount ?? property.price ?? 0);

  return {
    price,
    currency: offering?.currency || 'MXN',
  };
}

const formatMoney = (amount: number, currency: string, lang: 'es' | 'en') => {
  try {
    return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    return `$${Math.round(amount).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}`;
  }
};

export function resolveMortgageQuestion(
  rawPrompt: string,
  property: EternaProperty,
  lang: 'es' | 'en',
  currentContext: MortgageConversationContext | null,
): MortgageAnswer | null {
  const prompt = normalize(rawPrompt.trim());
  const isContinuation = currentContext?.propertyId === property.id;

  if (isContinuation && isAffirmative(prompt)) {
    return {
      reply: lang === 'es'
        ? 'Claro. Dime solo qué quieres cambiar; por ejemplo: “30% de enganche”, “a 20 años” o “tasa del 9.5%”.'
        : 'Of course. Just tell me what to change, for example: “30% down”, “over 20 years”, or “9.5% rate”.',
      scenario: currentContext,
      suggestedReplies: lang === 'es'
        ? ['30% de enganche', 'Calcular a 20 años', 'Tasa del 9.5%']
        : ['30% down payment', 'Calculate over 20 years', 'Use a 9.5% rate'],
    };
  }

  if (!isMortgageQuestion(prompt) && !(isContinuation && isScenarioChange(prompt))) {
    return null;
  }

  const { price, currency } = getSalePrice(property);
  if (!price) {
    const reply = lang === 'es'
      ? 'Esta propiedad no tiene un precio de venta confirmado, así que todavía no puedo calcular una mensualidad fiable.'
      : 'This property does not have a confirmed sale price yet, so I cannot calculate a reliable monthly payment.';
    return {
      reply,
      scenario: {
        propertyId: property.id,
        ...DEFAULT_MORTGAGE_SCENARIO,
      },
      suggestedReplies: [],
    };
  }

  const baseScenario = isContinuation
    ? currentContext
    : DEFAULT_MORTGAGE_SCENARIO;
  const scenario = extractScenario(prompt, baseScenario);
  const calculation = calculateMortgage(price, scenario);

  if (!calculation || scenario.downPaymentPercent > 95 || scenario.years > 40 || scenario.annualRatePercent > 50) {
    const reply = lang === 'es'
      ? 'Ese escenario está fuera de un rango hipotecario razonable. Indícame un enganche menor al 100%, un plazo de hasta 40 años y una tasa anual válida.'
      : 'That scenario is outside a reasonable mortgage range. Please use a down payment below 100%, a term up to 40 years, and a valid annual rate.';
    return {
      reply,
      scenario: {
        propertyId: property.id,
        ...DEFAULT_MORTGAGE_SCENARIO,
      },
      suggestedReplies: lang === 'es'
        ? ['Calcular con 20% de enganche', 'Calcular a 15 años']
        : ['Calculate with 20% down', 'Calculate over 15 years'],
    };
  }

  const reply = lang === 'es'
    ? `Con ${calculation.downPaymentPercent}% de enganche (${formatMoney(calculation.downPaymentAmount, currency, lang)}), a ${calculation.years} años y una tasa anual de ${calculation.annualRatePercent}%, pagarías aproximadamente ${formatMoney(calculation.monthlyPayment, currency, lang)} ${currency === 'MXN' ? 'pesos' : currency} al mes. Es una estimación sin seguros ni comisiones bancarias. ¿Quieres cambiar el enganche, el plazo o la tasa?`
    : `With a ${calculation.downPaymentPercent}% down payment (${formatMoney(calculation.downPaymentAmount, currency, lang)}), a ${calculation.years}-year term, and a ${calculation.annualRatePercent}% annual rate, your estimated payment would be ${formatMoney(calculation.monthlyPayment, currency, lang)} per month. This estimate excludes insurance and bank fees. Would you like to change the down payment, term, or rate?`;

  return {
    reply,
    scenario: {
      propertyId: property.id,
      downPaymentPercent: calculation.downPaymentPercent,
      years: calculation.years,
      annualRatePercent: calculation.annualRatePercent,
    },
    suggestedReplies: lang === 'es'
      ? ['30% de enganche', 'Calcular a 20 años', 'Tasa del 9.5%']
      : ['30% down payment', 'Calculate over 20 years', 'Use a 9.5% rate'],
  };
}
