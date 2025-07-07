/**
 * Jest Setup for OTEL NestJS Instrumentation Tests
 */

import 'reflect-metadata';

// Mock OpenTelemetry modules to avoid requiring actual instrumentation
jest.mock('@opentelemetry/api', () => ({
	trace: {
		getActiveSpan: jest.fn(),
		getTracer: jest.fn(() => ({
			startSpan: jest.fn(() => ({
				spanContext: jest.fn(() => ({ traceId: 'test-trace-id-123' })),
				setStatus: jest.fn(),
				end: jest.fn(),
			})),
		})),
	},
	context: {
		active: jest.fn(() => ({})),
	},
	propagation: {
		extract: jest.fn((context) => context),
	},
	SpanKind: {
		INTERNAL: 1,
		SERVER: 2,
		CLIENT: 3,
		PRODUCER: 4,
		CONSUMER: 5,
	},
	SpanStatusCode: {
		UNSET: 0,
		OK: 1,
		ERROR: 2,
	},
}));

// Mock fs for dynamic package.json reading
jest.mock('fs', () => ({
	readFileSync: jest.fn((path: string) => {
		if (path.includes('package.json')) {
			return JSON.stringify({ name: 'test-otel-app' });
		}
		throw new Error('File not found');
	}),
}));
jest.spyOn(console, 'error').mockImplementation(() => undefined);
// Mock path module
jest.mock('path', () => ({
	resolve: jest.fn(() => '/mock/path/package.json'),
}));

afterEach(() => {
	jest.clearAllMocks();
});
