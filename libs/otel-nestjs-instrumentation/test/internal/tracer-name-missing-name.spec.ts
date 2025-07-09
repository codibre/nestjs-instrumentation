/**
 * Tests for tracer-name utility - Missing name fallback
 * This test is isolated to test when package.json has no name field
 */

// Mock fs to return package.json without name
jest.mock('fs', () => ({
	readFileSync: jest.fn(() => JSON.stringify({ version: '1.0.0' })),
}));

// Mock path
jest.mock('path', () => ({
	resolve: jest.fn(() => '/mock/package.json'),
}));

describe('tracer-name - Missing name fallback', () => {
	it('should use fallback name when package.json has no name', () => {
		// This should use the ?? fallback since name is undefined
		const { tracerName } = require('../../src/internal/tracer-name');

		expect(tracerName).toBe('@codibre/otel-nestjs-instrumentation');
	});
});
