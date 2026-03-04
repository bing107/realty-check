export interface AnalysisResult {
  property: {
    address: string | null;
    sqm: number | null;
    units: number | null;
    yearBuilt: number | null;
    type: "ETW" | "MFH" | "other" | null;
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
