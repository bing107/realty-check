/** @jest-environment node */
import {
  grossRentalYield,
  netRentalYield,
  totalAcquisitionCost,
  monthlyMortgagePayment,
  monthlyCashFlow,
  pricePerSqm,
  renovationReserveAdequacy,
  breakEvenYears,
  computeMetrics,
  DEFAULT_ASSUMPTIONS,
  type AnalysisResult,
} from '../calculator';

// ---------------------------------------------------------------------------
// Helper: a full AnalysisResult fixture for integration tests
// ---------------------------------------------------------------------------
const fullAnalysis: AnalysisResult = {
  property: {
    address: 'Musterstraße 42, 10115 Berlin',
    sqm: 75,
    units: 12,
    yearBuilt: 1985,
    type: 'ETW',
  },
  financials: {
    purchasePrice: 250000,
    hausgeld: 350,
    ruecklage: 50,
    currentRent: 800,
    expectedRent: 900,
    grunderwerbsteuer: 15000,
    notarFees: 5000,
    maklerFees: 8000,
  },
  protocols: {
    upcomingRenovations: [],
    sonderumlagen: [],
    maintenanceBacklog: [],
    disputes: [],
  },
  wirtschaftsplan: {
    annualBudget: 42000,
    reserveFundStatus: 'adequate',
    plannedMajorWorks: [],
  },
  redFlags: ['Low reserve fund'],
  summary: 'Decent investment opportunity.',
};

// ---------------------------------------------------------------------------
// grossRentalYield
// ---------------------------------------------------------------------------
describe('grossRentalYield', () => {
  it('computes basic gross yield correctly', () => {
    // 10800 / 250000 * 100 = 4.32
    expect(grossRentalYield(10800, 250000)).toBeCloseTo(4.32, 2);
  });

  it('returns 0 when purchase price is 0', () => {
    expect(grossRentalYield(10800, 0)).toBe(0);
  });

  it('returns 0 when annual rent is 0', () => {
    expect(grossRentalYield(0, 250000)).toBe(0);
  });

  it('handles negative annual rent', () => {
    expect(grossRentalYield(-1200, 250000)).toBeCloseTo(-0.48, 2);
  });

  it('handles negative purchase price gracefully', () => {
    // Edge case: should not crash; result is mathematically correct but meaningless
    expect(grossRentalYield(10800, -250000)).toBeCloseTo(-4.32, 2);
  });
});

// ---------------------------------------------------------------------------
// netRentalYield
// ---------------------------------------------------------------------------
describe('netRentalYield', () => {
  it('computes basic net yield correctly', () => {
    // (10800 - 4200 - 600) / 278000 * 100 = 2.158...
    expect(netRentalYield(10800, 4200, 600, 278000)).toBeCloseTo(2.158, 2);
  });

  it('returns 0 when total acquisition cost is 0', () => {
    expect(netRentalYield(10800, 4200, 600, 0)).toBe(0);
  });

  it('returns negative yield when costs exceed rent', () => {
    expect(netRentalYield(1000, 4200, 600, 278000)).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// totalAcquisitionCost
// ---------------------------------------------------------------------------
describe('totalAcquisitionCost', () => {
  it('sums all components', () => {
    expect(totalAcquisitionCost(250000, 15000, 5000, 8000)).toBe(278000);
  });

  it('works with zero closing costs', () => {
    expect(totalAcquisitionCost(200000, 0, 0, 0)).toBe(200000);
  });
});

// ---------------------------------------------------------------------------
// monthlyMortgagePayment
// ---------------------------------------------------------------------------
describe('monthlyMortgagePayment', () => {
  it('computes annuity payment for a known scenario', () => {
    // 200000 loan, 3.5% rate, 25 years => ~1001.25/month
    const payment = monthlyMortgagePayment(200000, 0.035, 25);
    expect(payment).toBeCloseTo(1001.25, 0);
  });

  it('returns 0 when loan amount is 0', () => {
    expect(monthlyMortgagePayment(0, 0.035, 25)).toBe(0);
  });

  it('handles 0% interest rate (simple division)', () => {
    // 120000 / (10 * 12) = 1000
    expect(monthlyMortgagePayment(120000, 0, 10)).toBeCloseTo(1000, 2);
  });

  it('returns a higher payment for higher rates', () => {
    const lowRate = monthlyMortgagePayment(200000, 0.02, 25);
    const highRate = monthlyMortgagePayment(200000, 0.05, 25);
    expect(highRate).toBeGreaterThan(lowRate);
  });

  it('handles very small loan amounts correctly', () => {
    const payment = monthlyMortgagePayment(1, 0.035, 25);
    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// monthlyCashFlow
// ---------------------------------------------------------------------------
describe('monthlyCashFlow', () => {
  it('returns positive cash flow when rent exceeds costs', () => {
    expect(monthlyCashFlow(900, 350, 400)).toBe(150);
  });

  it('returns negative cash flow when costs exceed rent', () => {
    expect(monthlyCashFlow(500, 350, 400)).toBe(-250);
  });

  it('returns zero when perfectly balanced', () => {
    expect(monthlyCashFlow(750, 350, 400)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pricePerSqm
// ---------------------------------------------------------------------------
describe('pricePerSqm', () => {
  it('computes basic price per sqm', () => {
    expect(pricePerSqm(250000, 75)).toBeCloseTo(3333.33, 2);
  });

  it('returns 0 when living area is 0', () => {
    expect(pricePerSqm(250000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renovationReserveAdequacy
// ---------------------------------------------------------------------------
describe('renovationReserveAdequacy', () => {
  it('adequate when ruecklage > 0 and no renovations or backlog', () => {
    const result = renovationReserveAdequacy(50, [], []);
    expect(result.adequate).toBe(true);
    expect(result.message).toContain('50');
  });

  it('inadequate when ruecklage is 0', () => {
    const result = renovationReserveAdequacy(0, [], []);
    expect(result.adequate).toBe(false);
    expect(result.message).toContain('no reserve fund');
  });

  it('inadequate when upcoming renovations exist', () => {
    const result = renovationReserveAdequacy(50, ['Roof repair'], []);
    expect(result.adequate).toBe(false);
    expect(result.message).toContain('renovation');
  });

  it('inadequate when maintenance backlog exists', () => {
    const result = renovationReserveAdequacy(50, [], ['Facade cracks']);
    expect(result.adequate).toBe(false);
    expect(result.message).toContain('backlog');
  });

  it('inadequate when ruecklage is 0 AND renovations AND backlog exist', () => {
    const result = renovationReserveAdequacy(0, ['Roof'], ['Pipes']);
    expect(result.adequate).toBe(false);
    expect(result.message).toContain('no reserve fund');
    expect(result.message).toContain('renovation');
    expect(result.message).toContain('backlog');
  });

  it('treats negative ruecklage as inadequate', () => {
    const result = renovationReserveAdequacy(-10, [], []);
    expect(result.adequate).toBe(false);
    expect(result.message).toContain('no reserve fund');
  });
});

// ---------------------------------------------------------------------------
// breakEvenYears
// ---------------------------------------------------------------------------
describe('breakEvenYears', () => {
  it('returns years for positive cash flow', () => {
    // initialEquity = 250000 * 0.20 + 15000 + 5000 + 8000 = 78000
    // annualCashFlow = 3600
    // 78000 / 3600 = 21.666...
    const result = breakEvenYears(250000, 15000, 5000, 8000, 3600, 0.20);
    expect(result).toBeCloseTo(21.667, 2);
  });

  it('returns null when annual cash flow is zero', () => {
    expect(breakEvenYears(250000, 15000, 5000, 8000, 0, 0.20)).toBeNull();
  });

  it('returns null when annual cash flow is negative', () => {
    expect(breakEvenYears(250000, 15000, 5000, 8000, -1200, 0.20)).toBeNull();
  });

  it('computes break-even with zero purchase price (closing costs only)', () => {
    // initialEquity = 0 * 0.20 + 15000 + 5000 + 8000 = 28000
    // 28000 / 3600 = 7.778
    const result = breakEvenYears(0, 15000, 5000, 8000, 3600, 0.20);
    expect(result).toBeCloseTo(7.778, 2);
  });
});

// ---------------------------------------------------------------------------
// computeMetrics (integration)
// ---------------------------------------------------------------------------
describe('computeMetrics', () => {
  it('computes all metrics from a complete analysis', () => {
    const metrics = computeMetrics(fullAnalysis);

    // Uses expectedRent (900) * 12 = 10800 / 250000 * 100 = 4.32
    expect(metrics.grossRentalYield).toBeCloseTo(4.32, 2);

    // totalAcqCost = 278000
    expect(metrics.totalAcquisitionCost).toBe(278000);

    // netRentalYield: (10800 - 4200 - 0) / 278000 * 100 = 2.374...
    // hausgeld is inclusive of ruecklage per WEG convention, so nonRecoverableCosts = 0
    expect(metrics.netRentalYield).toBeCloseTo(2.374, 2);

    // Loan = 250000 * 0.80 = 200000, 3.5%, 25 years => ~1001.25
    expect(metrics.monthlyMortgagePayment).toBeCloseTo(1001.25, 0);

    // monthlyCashFlow = 900 - 350 - 1001.25 = -451.25
    expect(metrics.monthlyCashFlow).toBeCloseTo(-451.25, 0);

    // pricePerSqm = 250000 / 75 = 3333.33
    expect(metrics.pricePerSqm).toBeCloseTo(3333.33, 2);

    // renovationReserveAdequacy: ruecklage=50, no renovations, no backlog => adequate
    expect(metrics.renovationReserveAdequacy).not.toBeNull();
    expect(metrics.renovationReserveAdequacy!.adequate).toBe(true);

    // breakEvenYears: negative cash flow => null
    expect(metrics.breakEvenYears).toBeNull();

    // Default assumptions
    expect(metrics.assumptions).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it('uses currentRent when expectedRent is null', () => {
    const analysis: AnalysisResult = {
      ...fullAnalysis,
      financials: { ...fullAnalysis.financials, expectedRent: null },
    };

    const metrics = computeMetrics(analysis);
    // currentRent = 800, annualRent = 9600, grossYield = 9600/250000*100 = 3.84
    expect(metrics.grossRentalYield).toBeCloseTo(3.84, 2);
  });

  it('merges custom assumptions with defaults', () => {
    const metrics = computeMetrics(fullAnalysis, { mortgageRate: 0.04 });

    expect(metrics.assumptions.mortgageRate).toBe(0.04);
    expect(metrics.assumptions.downPayment).toBe(0.20);
    expect(metrics.assumptions.loanTermYears).toBe(25);

    // Higher rate means higher monthly payment
    expect(metrics.monthlyMortgagePayment).not.toBeNull();
    expect(metrics.monthlyMortgagePayment!).toBeGreaterThan(1001.25);
  });

  it('returns nulls for metrics when financials are missing', () => {
    const analysis: AnalysisResult = {
      ...fullAnalysis,
      financials: {
        purchasePrice: null,
        hausgeld: null,
        ruecklage: null,
        currentRent: null,
        expectedRent: null,
        grunderwerbsteuer: null,
        notarFees: null,
        maklerFees: null,
      },
    };

    const metrics = computeMetrics(analysis);

    expect(metrics.grossRentalYield).toBeNull();
    expect(metrics.netRentalYield).toBeNull();
    expect(metrics.totalAcquisitionCost).toBeNull();
    expect(metrics.monthlyMortgagePayment).toBeNull();
    expect(metrics.monthlyCashFlow).toBeNull();
    expect(metrics.pricePerSqm).toBeNull();
    expect(metrics.renovationReserveAdequacy).toBeNull();
    expect(metrics.breakEvenYears).toBeNull();
  });

  it('uses expectedRent of 0 rather than falling back to currentRent', () => {
    // expectedRent=0 should NOT fall back to currentRent via ??
    // because ?? only coalesces null/undefined, not 0
    const analysis: AnalysisResult = {
      ...fullAnalysis,
      financials: { ...fullAnalysis.financials, expectedRent: 0, currentRent: 800 },
    };

    const metrics = computeMetrics(analysis);
    // annualRent = 0 * 12 = 0, grossYield = 0 / 250000 * 100 = 0
    expect(metrics.grossRentalYield).toBe(0);
  });

  it('computes metrics with 100% down payment (no loan)', () => {
    const metrics = computeMetrics(fullAnalysis, { downPayment: 1.0 });

    // loanAmount = 250000 * (1 - 1.0) = 0
    expect(metrics.monthlyMortgagePayment).toBe(0);

    // monthlyCashFlow = 900 - 350 - 0 = 550
    expect(metrics.monthlyCashFlow).toBe(550);

    // breakEvenYears: annualCF = 550 * 12 = 6600
    // initialEquity = 250000 * 1.0 + 15000 + 5000 + 8000 = 278000
    // 278000 / 6600 = 42.121...
    expect(metrics.breakEvenYears).toBeCloseTo(42.121, 2);
  });

  it('computes metrics with 0% down payment (full loan)', () => {
    const metrics = computeMetrics(fullAnalysis, { downPayment: 0 });

    // loanAmount = 250000 * 1.0 = 250000
    // monthlyMortgage at 3.5%, 25yr on 250000 => ~1251.56
    expect(metrics.monthlyMortgagePayment).toBeCloseTo(1251.56, 0);

    // monthlyCashFlow = 900 - 350 - 1251.56 = -701.56
    expect(metrics.monthlyCashFlow).toBeCloseTo(-701.56, 0);

    // Negative cash flow => breakEvenYears is null
    expect(metrics.breakEvenYears).toBeNull();
  });

  it('handles partial financials gracefully', () => {
    const analysis: AnalysisResult = {
      ...fullAnalysis,
      financials: {
        purchasePrice: 250000,
        hausgeld: null,
        ruecklage: null,
        currentRent: 800,
        expectedRent: null,
        grunderwerbsteuer: null,
        notarFees: null,
        maklerFees: null,
      },
    };

    const metrics = computeMetrics(analysis);

    // grossRentalYield should still work (only needs rent + price)
    expect(metrics.grossRentalYield).toBeCloseTo(3.84, 2);

    // These require hausgeld or closing costs
    expect(metrics.netRentalYield).toBeNull();
    expect(metrics.totalAcquisitionCost).toBeNull();
    expect(metrics.monthlyCashFlow).toBeNull();
    expect(metrics.breakEvenYears).toBeNull();

    // monthlyMortgagePayment only needs purchasePrice
    expect(metrics.monthlyMortgagePayment).not.toBeNull();

    // pricePerSqm needs sqm (available) and purchasePrice (available)
    expect(metrics.pricePerSqm).toBeCloseTo(3333.33, 2);

    // renovationReserveAdequacy needs ruecklage (null)
    expect(metrics.renovationReserveAdequacy).toBeNull();
  });
});
