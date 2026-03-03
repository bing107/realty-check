/**
 * Investment calculator for German real estate analysis.
 * Pure TypeScript functions -- no external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  property: {
    address: string | null;
    sqm: number | null;
    units: number | null;
    yearBuilt: number | null;
    type: 'ETW' | 'MFH' | 'other' | null;
  };
  financials: {
    purchasePrice: number | null;
    hausgeld: number | null;
    ruecklage: number | null;
    currentRent: number | null;
    expectedRent: number | null;
    grunderwerbsteuer: number | null;
    notarFees: number | null;
    maklerFees: number | null;
  };
  protocols: {
    upcomingRenovations: string[];
    sonderumlagen: string[];
    maintenanceBacklog: string[];
    disputes: string[];
  };
  wirtschaftsplan: {
    annualBudget: number | null;
    reserveFundStatus: string | null;
    plannedMajorWorks: string[];
  };
  redFlags: string[];
  summary: string;
}

export interface MortgageAssumptions {
  mortgageRate: number;   // annual rate as decimal, default 0.035
  downPayment: number;    // fraction of purchase price, default 0.20
  loanTermYears: number;  // default 25
}

export const DEFAULT_ASSUMPTIONS: MortgageAssumptions = {
  mortgageRate: 0.035,
  downPayment: 0.20,
  loanTermYears: 25,
};

export interface RenovationReserveResult {
  adequate: boolean;
  message: string;
}

export interface CalculatedMetrics {
  grossRentalYield: number | null;
  netRentalYield: number | null;
  totalAcquisitionCost: number | null;
  monthlyMortgagePayment: number | null;
  monthlyCashFlow: number | null;
  pricePerSqm: number | null;
  renovationReserveAdequacy: RenovationReserveResult | null;
  breakEvenYears: number | null;
  assumptions: MortgageAssumptions;
}

// ---------------------------------------------------------------------------
// Individual calculator functions
// ---------------------------------------------------------------------------

/**
 * (annual rent / purchase price) * 100
 */
export function grossRentalYield(annualRent: number, purchasePrice: number): number {
  if (purchasePrice === 0) return 0;
  return (annualRent / purchasePrice) * 100;
}

/**
 * ((annual rent - annual hausgeld - nonRecoverableCosts) / totalAcqCost) * 100
 */
export function netRentalYield(
  annualRent: number,
  annualHausgeld: number,
  nonRecoverableCosts: number,
  totalAcqCost: number,
): number {
  if (totalAcqCost === 0) return 0;
  return ((annualRent - annualHausgeld - nonRecoverableCosts) / totalAcqCost) * 100;
}

/**
 * purchasePrice + grunderwerbsteuer + notarFees + maklerFees
 */
export function totalAcquisitionCost(
  purchasePrice: number,
  grunderwerbsteuer: number,
  notarFees: number,
  maklerFees: number,
): number {
  return purchasePrice + grunderwerbsteuer + notarFees + maklerFees;
}

/**
 * Monthly mortgage payment using the standard annuity formula:
 *   M = P * r * (1+r)^n / ((1+r)^n - 1)
 * where P = loan principal, r = monthly rate, n = total months
 */
export function monthlyMortgagePayment(
  loanAmount: number,
  annualRate: number,
  termYears: number,
): number {
  if (loanAmount === 0) return 0;
  if (annualRate === 0) return loanAmount / (termYears * 12);

  const r = annualRate / 12;
  const n = termYears * 12;
  const factor = Math.pow(1 + r, n);
  return (loanAmount * r * factor) / (factor - 1);
}

/**
 * rent - hausgeld - mortgagePayment (all monthly)
 */
export function monthlyCashFlow(
  monthlyRent: number,
  monthlyHausgeld: number,
  monthlyMortgage: number,
): number {
  return monthlyRent - monthlyHausgeld - monthlyMortgage;
}

/**
 * purchasePrice / livingAreaSqm
 */
export function pricePerSqm(purchasePrice: number, livingAreaSqm: number): number {
  if (livingAreaSqm === 0) return 0;
  return purchasePrice / livingAreaSqm;
}

/**
 * Evaluate whether the renovation reserve (Instandhaltungsruecklage) is adequate.
 * adequate = true if ruecklage > 0 AND no upcomingRenovations AND no maintenanceBacklog
 */
export function renovationReserveAdequacy(
  monthlyRuecklage: number,
  upcomingRenovations: string[],
  maintenanceBacklog: string[],
): RenovationReserveResult {
  const hasRuecklage = monthlyRuecklage > 0;
  const hasRenovations = upcomingRenovations.length > 0;
  const hasBacklog = maintenanceBacklog.length > 0;

  if (hasRuecklage && !hasRenovations && !hasBacklog) {
    return {
      adequate: true,
      message: `Monthly reserve of ${monthlyRuecklage} EUR with no upcoming renovations or maintenance backlog.`,
    };
  }

  const issues: string[] = [];
  if (!hasRuecklage) {
    issues.push('no reserve fund allocation');
  }
  if (hasRenovations) {
    issues.push(`${upcomingRenovations.length} upcoming renovation(s)`);
  }
  if (hasBacklog) {
    issues.push(`${maintenanceBacklog.length} maintenance backlog item(s)`);
  }

  return {
    adequate: false,
    message: `Reserve may be inadequate: ${issues.join(', ')}.`,
  };
}

/**
 * Years to recoup initial equity (down payment + closing costs) from positive annual cash flow.
 * Returns null if annual cash flow is zero or negative (never breaks even).
 */
export function breakEvenYears(
  purchasePrice: number,
  grunderwerbsteuer: number,
  notarFees: number,
  maklerFees: number,
  annualCashFlow: number,
  downPayment: number,
): number | null {
  if (annualCashFlow <= 0) return null;

  const initialEquity =
    purchasePrice * downPayment + grunderwerbsteuer + notarFees + maklerFees;
  return initialEquity / annualCashFlow;
}

// ---------------------------------------------------------------------------
// High-level compute function
// ---------------------------------------------------------------------------

/**
 * Compute all investment metrics from an AnalysisResult and optional assumptions.
 * Fields that cannot be computed due to null inputs are returned as null.
 */
export function computeMetrics(
  analysis: AnalysisResult,
  assumptions?: Partial<MortgageAssumptions>,
): CalculatedMetrics {
  const merged: MortgageAssumptions = { ...DEFAULT_ASSUMPTIONS, ...assumptions };
  const { financials, property, protocols } = analysis;

  const monthlyRent = financials.expectedRent ?? financials.currentRent;

  // grossRentalYield
  let computedGrossYield: number | null = null;
  if (monthlyRent != null && financials.purchasePrice != null) {
    computedGrossYield = grossRentalYield(monthlyRent * 12, financials.purchasePrice);
  }

  // totalAcquisitionCost
  let computedTotalAcqCost: number | null = null;
  if (
    financials.purchasePrice != null &&
    financials.grunderwerbsteuer != null &&
    financials.notarFees != null &&
    financials.maklerFees != null
  ) {
    computedTotalAcqCost = totalAcquisitionCost(
      financials.purchasePrice,
      financials.grunderwerbsteuer,
      financials.notarFees,
      financials.maklerFees,
    );
  }

  // netRentalYield
  let computedNetYield: number | null = null;
  if (
    monthlyRent != null &&
    financials.hausgeld != null &&
    financials.ruecklage != null &&
    computedTotalAcqCost != null
  ) {
    computedNetYield = netRentalYield(
      monthlyRent * 12,
      financials.hausgeld * 12,
      financials.ruecklage * 12,
      computedTotalAcqCost,
    );
  }

  // monthlyMortgagePayment
  let computedMonthlyMortgage: number | null = null;
  if (financials.purchasePrice != null) {
    const loanAmount = financials.purchasePrice * (1 - merged.downPayment);
    computedMonthlyMortgage = monthlyMortgagePayment(
      loanAmount,
      merged.mortgageRate,
      merged.loanTermYears,
    );
  }

  // monthlyCashFlow
  let computedMonthlyCashFlow: number | null = null;
  if (
    monthlyRent != null &&
    financials.hausgeld != null &&
    computedMonthlyMortgage != null
  ) {
    computedMonthlyCashFlow = monthlyCashFlow(
      monthlyRent,
      financials.hausgeld,
      computedMonthlyMortgage,
    );
  }

  // pricePerSqm
  let computedPricePerSqm: number | null = null;
  if (financials.purchasePrice != null && property.sqm != null) {
    computedPricePerSqm = pricePerSqm(financials.purchasePrice, property.sqm);
  }

  // renovationReserveAdequacy
  let computedReserve: RenovationReserveResult | null = null;
  if (financials.ruecklage != null) {
    computedReserve = renovationReserveAdequacy(
      financials.ruecklage,
      protocols.upcomingRenovations,
      protocols.maintenanceBacklog,
    );
  }

  // breakEvenYears
  let computedBreakEven: number | null = null;
  if (
    financials.purchasePrice != null &&
    financials.grunderwerbsteuer != null &&
    financials.notarFees != null &&
    financials.maklerFees != null &&
    computedMonthlyCashFlow != null
  ) {
    const annualCF = computedMonthlyCashFlow * 12;
    computedBreakEven = breakEvenYears(
      financials.purchasePrice,
      financials.grunderwerbsteuer,
      financials.notarFees,
      financials.maklerFees,
      annualCF,
      merged.downPayment,
    );
  }

  return {
    grossRentalYield: computedGrossYield,
    netRentalYield: computedNetYield,
    totalAcquisitionCost: computedTotalAcqCost,
    monthlyMortgagePayment: computedMonthlyMortgage,
    monthlyCashFlow: computedMonthlyCashFlow,
    pricePerSqm: computedPricePerSqm,
    renovationReserveAdequacy: computedReserve,
    breakEvenYears: computedBreakEven,
    assumptions: merged,
  };
}
