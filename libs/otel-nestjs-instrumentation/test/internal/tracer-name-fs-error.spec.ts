/**
 * Tests for tracer-name utility - File system error fallback
 * This test is isolated to test the catch block when fs.readFileSync throws
 */

// Mock fs to throw an error
jest.mock('fs', () => ({
	readFileSync: jest.fn(() => {
		throw new Error('File system error');
	}),
}));

// Mock path
jest.mock('path', () => ({
	resolve: jest.fn(() => '/mock/package.json'),
}));

describe('tracer-name - File system error fallback', () => {
	it('should use fallback name when file system throws error', () => {
		// This should trigger the catch block
		const { tracerName } = require('../../src/internal/tracer-name');

		expect(tracerName).toBe('@codibre/otel-nestjs-instrumentation');
	});
});
