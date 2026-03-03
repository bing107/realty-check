# Realty Check

German real estate investment analysis tool. Upload broker PDFs (Exposés), extract property data, and calculate key investment metrics.

Built with Next.js, TypeScript, and the Anthropic SDK.

## Screenshots

### Upload & Extract

Upload broker PDFs (Exposés, Protokolle, Wirtschaftspläne) and extract text for analysis.

![Upload and extraction](docs/screenshot-upload.png)

### AI Analysis

Claude analyzes extracted documents and returns structured property data, financials, and risk assessment.

![AI analysis results](docs/screenshot-analysis.png)

### Protocol Findings & Wirtschaftsplan

Surfaces renovation plans, Sonderumlagen, maintenance backlog, and budget details from owner meeting protocols.

![Protocol findings and Wirtschaftsplan](docs/screenshot-details.png)

### Market Price Comparison & Investment Report

Compares the property's price per m² against city-level market data (35+ German cities), with acquisition cost breakdown, cash flow projection, and AI-generated investment summary.

![Market comparison and investment report](docs/screenshot-dashboard.png)

## Features

- **PDF Upload** — drag-and-drop or click to upload broker PDFs via `react-dropzone`
- **Text Extraction** — extracts text from uploaded PDFs using `pdf-parse`
- **AI Analysis** — sends extracted text to Claude to identify property details and financials (address, sqm, purchase price, Hausgeld, rent, etc.)
- **Investment Calculator** — computes key German real estate metrics:
  - Kaufnebenkosten (purchase costs: Grunderwerbsteuer, Notar, Grundbuch, Makler)
  - Net rental yield
  - Cashflow analysis
- **Market Price Comparison** — compares price/m² against city-level reference data for 35+ German cities, with percentile ranking and price trend
- **Visualization** — charts via `recharts`

## Tech Stack

| | |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF parsing | `pdf-parse` |
| AI | Anthropic SDK (Claude) |
| Charts | Recharts |
| Testing | Jest |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/extract` | POST | Extract text from PDFs (accepts FormData) |
| `/api/analyze` | POST | AI analysis of extracted text |
| `/api/calculate` | POST | Calculate investment metrics |
| `/api/compare` | POST | Compare price/m² against market data |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/       # Claude-powered property analysis
│   │   ├── calculate/     # Investment metric calculations
│   │   ├── compare/       # Market price comparison
│   │   └── extract/       # PDF text extraction
│   ├── components/
│   │   └── UploadZone.tsx # Drag-and-drop upload component
│   ├── layout.tsx
│   └── page.tsx           # Main UI
├── lib/
│   ├── calculator.ts      # Investment calculation logic
│   └── market-data.ts     # City-level market reference data
└── types/
    └── pdf-parse.d.ts     # Type definitions
```

## Development

```bash
npm test              # Run tests
npm run build         # Production build
npm run lint          # ESLint
npx tsc --noEmit      # Type check
```

## CI

This repo is onboarded to [dev-agents](https://github.com/bing107/dev-agents). Label any issue with `dev-agents` to trigger an automated pipeline that designs, implements, tests, reviews, and merges a PR.

## License

Private.
