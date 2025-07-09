/**
 * Tests for tracer-name utility - Working with jest setup mocks
 */

describe('tracer-name', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	it('should export a tracerName', () => {
		const { tracerName } = require('../../src/internal/tracer-name');

		expect(typeof tracerName).toBe('string');
		expect(tracerName.length).toBeGreaterThan(0);
	});

	it('should use the name from package.json when available', () => {
		// With the jest setup mock, it returns 'test-otel-app'
		const { tracerName } = require('../../src/internal/tracer-name');

		expect(tracerName).toBe('test-otel-app');
	});
});
