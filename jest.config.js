/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testRegex: '\\.spec\\.ts$',
  preset: 'ts-jest',
  coverageDirectory: './coverage',
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['**/src/**/*.ts'],
  testEnvironment: 'node',
  cacheDirectory: '../../.jest',
  forceExit: true,
  cache: true,
  moduleDirectories: ['node_modules', '../node_modules'],
  clearMocks: true,
  resetModules: true,
  detectOpenHandles: false,
  restoreMocks: true,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        astTransformers: {
          before: [
            '../../node_modules/tsconfig-paths-hook/transformer',
          ],
        },
      },
    ],
  },
  setupFilesAfterEnv: ['jest-extended/all', '<rootDir>/test/jest-setup.ts'],
};
