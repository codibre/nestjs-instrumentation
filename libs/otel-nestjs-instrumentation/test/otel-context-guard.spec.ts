const mockOtelApi = {
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
		extract: jest.fn((context, _headers) => context),
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
};

jest.mock('@opentelemetry/api', () => mockOtelApi);

import { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { OtelContextGuard } from '../src/otel-context-guard';
import { InternalContext } from '../src/internal';
import {
	createMockExecutionContext,
	createMockEventEmitter,
	createMockInternalContext,
	createMockOtelSpan,
} from './test-utils';

describe('OtelContextGuard', () => {
	let guard: OtelContextGuard;
	let mockEmitter: EventEmitter;
	let mockInternalContext: InternalContext;
	let mockExecutionContext: ExecutionContext;

	beforeEach(() => {
		mockEmitter = createMockEventEmitter();
		mockInternalContext = createMockInternalContext();
		mockExecutionContext = createMockExecutionContext();

		guard = new OtelContextGuard(mockEmitter, mockInternalContext);
	});

	afterEach(() => {
		mockEmitter.removeAllListeners();
	});

	describe('canActivate', () => {
		it('should return true when existing span is found', async () => {
			const mockSpan = createMockOtelSpan();
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockOtelApi.trace.getActiveSpan).toHaveBeenCalled();
		});

		it('should return true and create new span when no existing span found', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockOtelApi.trace.getActiveSpan).toHaveBeenCalled();
			expect(mockOtelApi.trace.getTracer).toHaveBeenCalled();
			expect(mockTracer.startSpan).toHaveBeenCalled();
		});

		it('should emit spanStarted event when existing span is found', async () => {
			const mockSpan = createMockOtelSpan('existing-trace-id');
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

			await guard.canActivate(mockExecutionContext);

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanStarted',
				'existing-trace-id',
				mockExecutionContext,
			);
		});

		it('should emit spanStarted event when new span is created', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan('new-trace-id');
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			await guard.canActivate(mockExecutionContext);

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanStarted',
				'new-trace-id',
				mockExecutionContext,
			);
		});

		it('should emit spanStartFailed event when OpenTelemetry operations fail', async () => {
			mockOtelApi.trace.getActiveSpan.mockImplementation(() => {
				throw new Error('OTEL API error');
			});

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true); // Guard should not block requests on errors
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanStartFailed',
				expect.any(Error),
			);
		});

		it('should extract distributed tracing headers for HTTP requests', async () => {
			const mockContext = createMockExecutionContext('http', {
				headers: {
					traceparent:
						'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
					tracestate: 'congo=t61rcWkgMzE',
				},
			});

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			await guard.canActivate(mockContext);

			expect(mockOtelApi.propagation.extract).toHaveBeenCalledWith(
				{},
				expect.objectContaining({
					traceparent:
						'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
					tracestate: 'congo=t61rcWkgMzE',
				}),
			);
		});

		it('should create span with SERVER kind for HTTP requests', async () => {
			const mockContext = createMockExecutionContext('http', {
				method: 'POST',
				url: '/api/test',
				path: '/api/test',
			});

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			await guard.canActivate(mockContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				expect.stringContaining('TestController.testMethod'),
				expect.objectContaining({
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: expect.objectContaining({
						'http.method': 'POST',
						'http.url': '/api/test',
						'http.route': '/api/test',
					}),
				}),
				expect.anything(),
			);
		});

		it('should create span with SERVER kind for RPC requests', async () => {
			const mockContext = createMockExecutionContext('rpc', {
				handler: 'processMessage',
			});

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			await guard.canActivate(mockContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				expect.stringContaining('TestController.processMessage'),
				expect.objectContaining({
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: expect.objectContaining({
						'rpc.method': 'processMessage',
					}),
				}),
				expect.anything(),
			);
		});

		it('should create span with INTERNAL kind for unknown context types', async () => {
			const mockContext = createMockExecutionContext('ws');

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			await guard.canActivate(mockContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				expect.stringContaining('TestController.testMethod'),
				expect.objectContaining({
					kind: mockOtelApi.SpanKind.INTERNAL,
				}),
				expect.anything(),
			);
		});

		it('should handle missing request gracefully for HTTP context', async () => {
			const mockContext = createMockExecutionContext('http');
			// Mock switchToHttp to throw an error
			mockContext.switchToHttp = jest.fn().mockImplementation(() => {
				throw new Error('Request not available');
			});

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			const result = await guard.canActivate(mockContext);

			expect(result).toBe(true);
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				expect.stringContaining('testMethod'),
				expect.objectContaining({
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: expect.any(Object), // Attributes may not be set if request is missing
				}),
				expect.anything(),
			);
		});

		it('should use fallback tracer name when package.json is not readable', async () => {
			// Mock fs.readFileSync to throw an error
			const fs = require('fs');
			fs.readFileSync.mockImplementation(() => {
				throw new Error('File not found');
			});

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockSpan = createMockOtelSpan();
			const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
			mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

			// Create a new guard to trigger the tracer name initialization
			const newGuard = new OtelContextGuard(mockEmitter, mockInternalContext);
			await newGuard.canActivate(mockExecutionContext);

			expect(mockOtelApi.trace.getTracer).toHaveBeenCalledWith('test-otel-app');
		});
	});
});
