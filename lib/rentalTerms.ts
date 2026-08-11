export interface RentalSigningCosts {
  monthsDueAtSigning: number;
  rentDueAtSigning: number | null;
  securityDeposit: number | null;
  totalDueAtSigning: number | null;
}

export function calculateRentalSigningCosts({
  monthlyRent,
  advanceMonths,
  securityDeposit,
}: {
  monthlyRent?: number | null;
  advanceMonths?: number | null;
  securityDeposit?: number | null;
}): RentalSigningCosts {
  const monthsDueAtSigning = Math.max(1, Math.floor(advanceMonths ?? 1));
  const normalizedRent = monthlyRent != null && Number.isFinite(monthlyRent)
    ? Math.max(0, monthlyRent)
    : null;
  const normalizedDeposit = securityDeposit != null && Number.isFinite(securityDeposit)
    ? Math.max(0, securityDeposit)
    : null;
  const rentDueAtSigning = normalizedRent == null
    ? null
    : normalizedRent * monthsDueAtSigning;

  return {
    monthsDueAtSigning,
    rentDueAtSigning,
    securityDeposit: normalizedDeposit,
    totalDueAtSigning: rentDueAtSigning == null
      ? null
      : rentDueAtSigning + (normalizedDeposit || 0),
  };
}

export function shouldSyncSuggestedRentalDeposit(
  currentDeposit: number | null | undefined,
  previousMonthlyRent: number | null | undefined,
): boolean {
  return (currentDeposit ?? 0) === 0
    || (previousMonthlyRent != null && currentDeposit === previousMonthlyRent);
}
