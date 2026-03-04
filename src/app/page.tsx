import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Know Before You Buy
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Upload German real estate broker documents and get instant AI-powered
          investment analysis — financials, red flags, yield metrics, and more.
        </p>
        <Link
          href="/analyze"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors"
        >
          Analyze a Property
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-2xl mb-3">📄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Document Extraction
            </h3>
            <p className="text-gray-500 text-sm">
              Upload exposés, Teilungserklärungen, WEG protocols, and
              Wirtschaftspläne. Supports scanned PDFs via OCR.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI Analysis
            </h3>
            <p className="text-gray-500 text-sm">
              Claude AI extracts key data: purchase price, rent, fees,
              upcoming renovations, and flags potential risks.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-2xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Financial Metrics
            </h3>
            <p className="text-gray-500 text-sm">
              Gross and net yield, monthly cash flow, total acquisition cost,
              and price-per-sqm comparison — calculated automatically.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-2xl mb-3">📝</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Investment Report
            </h3>
            <p className="text-gray-500 text-sm">
              Get a full investment summary with market comparison and
              actionable insights — saved automatically for registered users.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
