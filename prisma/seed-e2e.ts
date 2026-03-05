import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@realty-check.dev';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPassword!123';

const SEEDED_ANALYSIS = {
  address: 'Musterstraße 42, 10115 Berlin',
  purchasePrice: 350000,
  monthlyRent: 1200,
  maintenanceCosts: 150,
  managementCosts: 80,
  squareMeters: 75,
  yearBuilt: 1990,
  rooms: 3,
  floor: 2,
  totalFloors: 5,
  condition: 'gut',
  heizung: 'Zentralheizung',
  energieeffizienzklasse: 'C',
  stellplatz: true,
  keller: true,
  aufzug: true,
  redFlags: ['Hausgeld könnte steigen'],
  positives: ['Gute Lage', 'Sanierter Altbau'],
  nebenkosten: 50000,
  grunderwerbsteuer: 17500,
  notar: 7000,
  makler: 10500,
};

const SEEDED_METRICS = {
  bruttorendite: 4.11,
  nettorendite: 3.42,
  kaufpreisfaktor: 24.3,
  cashflowMonatlich: 270,
  cashflowJaehrlich: 3240,
  gesamtinvestition: 385000,
  eigenkapitalrendite: 5.8,
};

const SEEDED_SUMMARY = {
  overallScore: 7,
  recommendation: 'kaufen',
  summary: 'Solides Investment in guter Berliner Lage. Stabile Mietrendite über dem Stadtdurchschnitt.',
  risks: ['Steigende Hausgeldrücklagen möglich'],
  opportunities: ['Wertsteigerungspotenzial durch Sanierung', 'Langfristige Mietstabilität'],
  priceComparison: {
    city: 'Berlin',
    district: 'Mitte',
    propertyType: 'Eigentumswohnung',
    pricePerSqm: 4667,
    marketAvgPricePerSqm: 5200,
    percentageVsMarket: -10.2,
    assessment: 'unter Marktwert',
  },
};

async function main() {
  console.log('Seeding E2E test data...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Upsert test user
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      password: passwordHash,
      name: 'E2E Test User',
      tier: 'free',
    },
  });

  console.log(`Test user: ${user.email} (${user.id})`);

  // Check if seeded analysis already exists
  const existingAnalysis = await prisma.analysis.findFirst({
    where: {
      userId: user.id,
      filename: 'e2e-seeded-analysis.pdf',
    },
  });

  if (!existingAnalysis) {
    const analysis = await prisma.analysis.create({
      data: {
        userId: user.id,
        filename: 'e2e-seeded-analysis.pdf',
        analysisJson: JSON.stringify(SEEDED_ANALYSIS),
        metrics: JSON.stringify(SEEDED_METRICS),
        summary: JSON.stringify(SEEDED_SUMMARY),
      },
    });
    console.log(`Created seeded analysis: ${analysis.id}`);
  } else {
    console.log(`Seeded analysis already exists: ${existingAnalysis.id}`);
  }

  console.log('E2E seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
