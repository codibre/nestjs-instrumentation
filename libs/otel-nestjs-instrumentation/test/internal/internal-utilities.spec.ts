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

import {
	emitterSymbol,
	getTransactionName,
	otelInstrumentation,
} from '../../src/internal';
import { createMockExecutionContext, createMockOtelSpan } from '../test-utils';

describe('Internal Utilities', () => {
	describe('emitterSymbol', () => {
		it('should be a symbol', () => {
			expect(typeof emitterSymbol).toBe('symbol');
		});

		it('should have a descriptive string representation', () => {
			expect(emitterSymbol.toString()).toContain(
				'otel-nestjs-instrumentation:emitter',
			);
		});
	});

	describe('getTransactionName', () => {
		it('should generate name from controller and handler', () => {
			const context = createMockExecutionContext('http', {
				controller: 'UserController',
				handler: 'getUser',
			});

			const name = getTransactionName(context);

			expect(name).toBe('UserController.getUser');
		});

		it('should handle missing controller name', () => {
			const context = createMockExecutionContext('http', {
				controller: undefined,
				handler: 'getUser',
			});

			// Mock getClass to return undefined name
			context.getClass = jest.fn().mockReturnValue({ name: undefined });

			const name = getTransactionName(context);

			expect(name).toBe('UnknownController.getUser');
		});

		it('should handle missing handler name', () => {
			const context = createMockExecutionContext('http', {
				controller: 'UserController',
				handler: undefined,
			});

			// Mock getHandler to return undefined name
			context.getHandler = jest.fn().mockReturnValue({ name: undefined });

			const name = getTransactionName(context);

			expect(name).toBe('UserController.unknownMethod');
		});

		it('should handle both missing controller and handler', () => {
			const context = createMockExecutionContext();

			// Mock both to return undefined names
			context.getClass = jest.fn().mockReturnValue({ name: undefined });
			context.getHandler = jest.fn().mockReturnValue({ name: undefined });

			const name = getTransactionName(context);

			expect(name).toBe('UnknownController.unknownMethod');
		});

		it('should handle context access errors gracefully', () => {
			const context = createMockExecutionContext();

			// Mock getClass to throw an error
			context.getClass = jest.fn().mockImplementation(() => {
				throw new Error('Context access failed');
			});

			const name = getTransactionName(context);

			expect(name).toBe('UnknownTransaction');
		});

		it('should handle RPC context correctly', () => {
			const context = createMockExecutionContext('rpc', {
				controller: 'MessageProcessor',
				handler: 'processMessage',
			});

			const name = getTransactionName(context);

			expect(name).toBe('MessageProcessor.processMessage');
		});

		it('should handle WebSocket context correctly', () => {
			const context = createMockExecutionContext('ws', {
				controller: 'ChatGateway',
				handler: 'handleMessage',
			});

			const name = getTransactionName(context);

			expect(name).toBe('ChatGateway.handleMessage');
		});

		it('should handle long names appropriately', () => {
			const context = createMockExecutionContext('http', {
				controller: 'VeryLongControllerNameThatExceedsNormalLimits',
				handler: 'veryLongMethodNameThatIsQuiteDescriptive',
			});

			const name = getTransactionName(context);

			expect(name).toBe(
				'VeryLongControllerNameThatExceedsNormalLimits.veryLongMethodNameThatIsQuiteDescriptive',
			);
		});
	});

	describe('otelInstrumentation', () => {
		describe('captureOrCreate', () => {
			it('should return existing span information when span is active', () => {
				const mockSpan = createMockOtelSpan('existing-trace-id');
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

				const context = createMockExecutionContext();
				const traceId = otelInstrumentation.captureOrCreate(
					'TestTransaction',
					context,
				);

				expect(traceId).toBe('existing-trace-id');
			});

			it('should create new span when no active span exists', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan('new-trace-id');
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext();
				const traceId = otelInstrumentation.captureOrCreate(
					'TestTransaction',
					context,
				);

				expect(traceId).toBe('new-trace-id');
				expect(mockTracer.startSpan).toHaveBeenCalledWith(
					'TestTransaction',
					expect.objectContaining({
						kind: mockOtelApi.SpanKind.SERVER,
					}),
					expect.anything(),
				);
			});

			it('should extract distributed tracing headers for HTTP requests', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('http', {
					headers: {
						traceparent:
							'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
					},
				});

				otelInstrumentation.captureOrCreate('TestTransaction', context);

				expect(mockOtelApi.propagation.extract).toHaveBeenCalledWith(
					{},
					expect.objectContaining({
						traceparent:
							'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
					}),
				);
			});

			it('should use SERVER span kind for HTTP requests', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('http');
				otelInstrumentation.captureOrCreate('HttpTransaction', context);

				expect(mockTracer.startSpan).toHaveBeenCalledWith(
					'HttpTransaction',
					expect.objectContaining({
						kind: mockOtelApi.SpanKind.SERVER,
					}),
					expect.anything(),
				);
			});

			it('should use SERVER span kind for RPC requests', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('rpc');
				otelInstrumentation.captureOrCreate('RpcTransaction', context);

				expect(mockTracer.startSpan).toHaveBeenCalledWith(
					'RpcTransaction',
					expect.objectContaining({
						kind: mockOtelApi.SpanKind.SERVER,
					}),
					expect.anything(),
				);
			});

			it('should use INTERNAL span kind for unknown context types', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('ws');
				otelInstrumentation.captureOrCreate('WsTransaction', context);

				expect(mockTracer.startSpan).toHaveBeenCalledWith(
					'WsTransaction',
					expect.objectContaining({
						kind: mockOtelApi.SpanKind.INTERNAL,
					}),
					expect.anything(),
				);
			});

			it('should add HTTP attributes for HTTP requests', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('http', {
					method: 'POST',
					url: '/api/users',
					path: '/api/users',
				});

				otelInstrumentation.captureOrCreate('HttpTransaction', context);

				expect(mockTracer.startSpan).toHaveBeenCalledWith(
					'HttpTransaction',
					expect.objectContaining({
						attributes: expect.objectContaining({
							'http.method': 'POST',
							'http.url': '/api/users',
							'http.route': '/api/users',
						}),
					}),
					expect.anything(),
				);
			});

			it('should handle missing request gracefully', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
				const mockSpan = createMockOtelSpan();
				const mockTracer = { startSpan: jest.fn().mockReturnValue(mockSpan) };
				mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);

				const context = createMockExecutionContext('http');
				// Mock switchToHttp to throw
				context.switchToHttp = jest.fn().mockImplementation(() => {
					throw new Error('Request not available');
				});

				const traceId = otelInstrumentation.captureOrCreate(
					'HttpTransaction',
					context,
				);

				expect(traceId).toBeDefined();
				expect(mockTracer.startSpan).toHaveBeenCalled();
			});
		});

		describe('getCurrentSpanContext', () => {
			it('should return trace and span ID when active span exists', () => {
				const mockSpan = createMockOtelSpan('test-trace-id', 'test-span-id');
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

				const result = otelInstrumentation.getCurrentSpanContext();

				expect(result).toEqual({
					traceId: 'test-trace-id',
					spanId: 'test-span-id',
				});
			});

			it('should return empty object when no active span', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

				const result = otelInstrumentation.getCurrentSpanContext();

				expect(result).toEqual({});
			});

			it('should handle errors gracefully', () => {
				mockOtelApi.trace.getActiveSpan.mockImplementation(() => {
					throw new Error('API error');
				});

				const result = otelInstrumentation.getCurrentSpanContext();

				expect(result).toEqual({});
			});
		});

		describe('addAttributes', () => {
			it('should add attributes to active span', () => {
				const mockSpan = createMockOtelSpan();
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

				const attributes = { 'custom.attr': 'value', 'custom.number': 42 };
				otelInstrumentation.addAttributes(attributes);

				expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
			});

			it('should handle no active span gracefully', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

				// Should not throw
				expect(() => {
					otelInstrumentation.addAttributes({ test: 'value' });
				}).not.toThrow();
			});

			it('should handle errors gracefully', () => {
				const mockSpan = createMockOtelSpan();
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
				mockSpan.setAttributes.mockImplementation(() => {
					throw new Error('Attribute error');
				});

				// Should not throw
				expect(() => {
					otelInstrumentation.addAttributes({ test: 'value' });
				}).not.toThrow();
			});
		});

		describe('recordException', () => {
			it('should record exception on active span', () => {
				const mockSpan = createMockOtelSpan();
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

				const error = new Error('Test error');
				otelInstrumentation.recordException(error);

				expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			});

			it('should handle no active span gracefully', () => {
				mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

				// Should not throw
				expect(() => {
					otelInstrumentation.recordException(new Error('Test'));
				}).not.toThrow();
			});

			it('should handle errors gracefully', () => {
				const mockSpan = createMockOtelSpan();
				mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
				mockSpan.recordException.mockImplementation(() => {
					throw new Error('Record error');
				});

				// Should not throw
				expect(() => {
					otelInstrumentation.recordException(new Error('Test'));
				}).not.toThrow();
			});
		});
	});
});
