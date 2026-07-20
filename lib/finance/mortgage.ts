export const DEFAULT_MORTGAGE_SCENARIO = {
  downPaymentPercent: 20,
  years: 15,
  annualRatePercent: 10.5,
} as const;

export const MORTGAGE_SIMULATION_EVENT = 'auraswap:mortgage-simulation';

export interface MortgageScenario {
  downPaymentPercent: number;
  years: number;
  annualRatePercent: number;
}

export interface MortgageCalculation extends MortgageScenario {
  price: number;
  downPaymentAmount: number;
  loanAmount: number;
  monthlyPayment: number;
}

export interface MortgageSimulationEventDetail extends MortgageScenario {
  propertyId: string;
}

export function calculateMortgage(
  price: number,
  scenario: Partial<MortgageScenario> = {},
): MortgageCalculation | null {
  const downPaymentPercent = scenario.downPaymentPercent ?? DEFAULT_MORTGAGE_SCENARIO.downPaymentPercent;
  const years = scenario.years ?? DEFAULT_MORTGAGE_SCENARIO.years;
  const annualRatePercent = scenario.annualRatePercent ?? DEFAULT_MORTGAGE_SCENARIO.annualRatePercent;

  if (
    !Number.isFinite(price)
    || price <= 0
    || !Number.isFinite(downPaymentPercent)
    || downPaymentPercent < 0
    || downPaymentPercent >= 100
    || !Number.isFinite(years)
    || years <= 0
    || !Number.isFinite(annualRatePercent)
    || annualRatePercent < 0
  ) {
    return null;
  }

  const downPaymentAmount = price * (downPaymentPercent / 100);
  const loanAmount = price - downPaymentAmount;
  const totalPayments = Math.round(years * 12);
  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / totalPayments
    : loanAmount * (
      monthlyRate * Math.pow(1 + monthlyRate, totalPayments)
    ) / (Math.pow(1 + monthlyRate, totalPayments) - 1);

  return {
    price,
    downPaymentPercent,
    years,
    annualRatePercent,
    downPaymentAmount,
    loanAmount,
    monthlyPayment,
  };
}
