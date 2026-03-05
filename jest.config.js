const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/layout.tsx',
    '!src/lib/types.ts',
    '!src/lib/prisma.ts',
    '!src/lib/stripe.ts',
    '!src/auth.ts',
    '!src/app/api/auth/\\[...nextauth\\]/route.ts',
  ],
}

module.exports = createJestConfig(config)
