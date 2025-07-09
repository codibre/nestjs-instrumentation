const mockOtelApi = {
	trace: {
		getTracer: jest.fn(),
		getActiveSpan: jest.fn(),
	},
	context: {
		active: jest.fn(() => ({})),
	},
	propagation: {
		extract: jest.fn((context, headers) => ({ extracted: true, headers })),
	},
	SpanKind: {
		INTERNAL: 0,
		SERVER: 1,
		CLIENT: 2,
		PRODUCER: 3,
		CONSUMER: 4,
	},
};

jest.mock('@opentelemetry/api', () => mockOtelApi);

import { ExecutionContext } from '@nestjs/common';
import { otelInstrumentation } from '../../src/internal/otel-instrumentation';
import { createMockExecutionContext } from '../test-utils';

describe('OtelInstrumentation', () => {
	let mockExecutionContext: ExecutionContext;
	let mockTracer: any;
	let mockSpan: any;

	beforeEach(() => {
		mockExecutionContext = createMockExecutionContext();

		mockSpan = {
			spanContext: jest.fn(() => ({ traceId: 'test-trace-id' })),
			setAttributes: jest.fn(),
			recordException: jest.fn(),
		};

		mockTracer = {
			startSpan: jest.fn(() => mockSpan),
		};

		mockOtelApi.trace.getTracer.mockReturnValue(mockTracer);
		mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);

		jest.clearAllMocks();
	});

	describe('create', () => {
		it('should return undefined when tracer is not available', () => {
			mockOtelApi.trace.getTracer.mockReturnValue(null);

			const result = otelInstrumentation.create(
				'test-transaction',
				mockExecutionContext,
			);

			expect(result).toBeUndefined();
		});

		it('should create span with HTTP context and extract headers', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
				method: 'GET',
				url: '/test/path',
				path: '/test/:id',
				headers: { 'x-trace-id': 'external-trace' },
			});

			const result = otelInstrumentation.create(
				'TestController.testHandler',
				httpContext,
			);

			expect(mockOtelApi.propagation.extract).toHaveBeenCalledWith(
				{},
				{ 'x-trace-id': 'external-trace' },
			);
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'GET',
						'http.url': '/test/path',
						'http.route': '/test/:id',
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{ extracted: true, headers: { 'x-trace-id': 'external-trace' } },
			);
			expect(result).toBe('test-trace-id');
		});

		it('should handle HTTP context without headers', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
				method: 'POST',
				url: '/api/users',
				path: '/test',
			});

			otelInstrumentation.create('TestController.testHandler', httpContext);

			// Extract should still be called since headers exist (empty object)
			expect(mockOtelApi.propagation.extract).toHaveBeenCalledWith({}, {});
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'POST',
						'http.url': '/api/users',
						'http.route': '/test',
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{ extracted: true, headers: {} },
			);
		});

		it('should handle HTTP context without request.headers', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
				method: 'POST',
				url: '/api/users',
			});

			// Mock the request to not have headers property
			jest.spyOn(httpContext.switchToHttp(), 'getRequest').mockReturnValue({
				method: 'POST',
				url: '/api/users',
				// No headers property at all
			});

			otelInstrumentation.create('TestController.testHandler', httpContext);

			// Extract should not be called when headers don't exist
			expect(mockOtelApi.propagation.extract).not.toHaveBeenCalled();
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'POST',
						'http.url': '/api/users',
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{},
			);
		});

		it('should handle HTTP context without route.path', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
				method: 'GET',
				url: '/dynamic',
			});

			// Mock the request to not have route.path
			jest.spyOn(httpContext.switchToHttp(), 'getRequest').mockReturnValue({
				method: 'GET',
				url: '/dynamic',
				route: {}, // Empty route object
				headers: {},
			});

			otelInstrumentation.create('TestController.testHandler', httpContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'GET',
						'http.url': '/dynamic',
						// No http.route since route.path is undefined
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{ extracted: true, headers: {} },
			);
		});

		it('should create span with RPC context', () => {
			const rpcContext = createMockExecutionContext('rpc', {
				controller: 'RpcController',
				handler: 'rpcHandler',
			});

			const result = otelInstrumentation.create(
				'RpcController.rpcHandler',
				rpcContext,
			);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'RpcController.rpcHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'rpc.method': 'rpcHandler',
						'nestjs.controller': 'RpcController',
						'nestjs.handler': 'rpcHandler',
					},
				},
				{},
			);
			expect(result).toBe('test-trace-id');
		});

		it('should handle unknown context type', () => {
			const unknownContext = createMockExecutionContext('ws', {
				controller: 'WsController',
				handler: 'wsHandler',
			});

			otelInstrumentation.create('WsController.wsHandler', unknownContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'WsController.wsHandler',
				{
					kind: mockOtelApi.SpanKind.INTERNAL, // Default for unknown contexts
					attributes: {
						'nestjs.controller': 'WsController',
						'nestjs.handler': 'wsHandler',
					},
				},
				{},
			);
		});

		it('should handle empty RPC handler name gracefully', () => {
			const rpcContext = createMockExecutionContext('rpc', {
				controller: 'RpcController',
				handler: 'rpcHandler',
			});

			// Mock getHandler to return a function without name property
			const mockHandler = jest.fn();
			Object.defineProperty(mockHandler, 'name', { value: '' });
			jest.spyOn(rpcContext, 'getHandler').mockReturnValue(mockHandler);

			otelInstrumentation.create('RpcController.rpcHandler', rpcContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'RpcController.rpcHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'rpc.method': 'Call', // Fallback when no name
						'nestjs.controller': 'RpcController',
						'nestjs.handler': 'unknown', // Falls back to 'unknown' when name is empty
					},
				},
				{},
			);
		});

		it('should handle errors during header extraction gracefully', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
			});

			jest.spyOn(httpContext, 'switchToHttp').mockReturnValue({
				getRequest: () => {
					throw new Error('Request extraction failed');
				},
				getResponse: jest.fn(),
				getNext: jest.fn(),
			});

			const result = otelInstrumentation.create(
				'TestController.testHandler',
				httpContext,
			);

			// Should still create span with default context
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{},
			);
			expect(result).toBe('test-trace-id');
		});

		it('should handle errors during RPC context extraction gracefully', () => {
			const rpcContext = createMockExecutionContext('rpc', {
				controller: 'RpcController',
				handler: 'rpcHandler',
			});

			jest.spyOn(rpcContext, 'getHandler').mockImplementation(() => {
				throw new Error('Handler extraction failed');
			});

			otelInstrumentation.create('RpcController.rpcHandler', rpcContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'RpcController.rpcHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						// Both RPC and NestJS context extraction should fail since getHandler throws
						// No attributes should be set when the entire block fails
					},
				},
				{},
			);
		});

		it('should handle errors during NestJS context extraction gracefully', () => {
			const faultyContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
			});

			jest.spyOn(faultyContext, 'getClass').mockImplementation(() => {
				throw new Error('Class extraction failed');
			});

			otelInstrumentation.create('TestController.testHandler', faultyContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'GET',
						'http.url': '/test',
						'http.route': '/test',
						// nestjs attributes should not be set if getClass throws
					},
				},
				{ extracted: true, headers: {} },
			);
		});

		it('should handle HTTP context with undefined method and url', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
			});

			// Mock the request to have undefined method and url
			jest.spyOn(httpContext.switchToHttp(), 'getRequest').mockReturnValue({
				method: undefined,
				url: undefined,
				headers: {},
			});

			otelInstrumentation.create('TestController.testHandler', httpContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': '', // Fallback for undefined method
						'http.url': '', // Fallback for undefined url
						'nestjs.controller': 'TestController',
						'nestjs.handler': 'testHandler',
					},
				},
				{ extracted: true, headers: {} },
			);
		});

		it('should handle context with undefined controller and handler names', () => {
			const httpContext = createMockExecutionContext('http', {
				controller: 'TestController',
				handler: 'testHandler',
			});

			// Mock getClass and getHandler to return objects without name
			const mockClass = jest.fn();
			const mockHandler = jest.fn();
			Object.defineProperty(mockClass, 'name', { value: undefined });
			Object.defineProperty(mockHandler, 'name', { value: undefined });

			jest.spyOn(httpContext, 'getClass').mockReturnValue(mockClass as any);
			jest.spyOn(httpContext, 'getHandler').mockReturnValue(mockHandler);

			otelInstrumentation.create('TestController.testHandler', httpContext);

			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'TestController.testHandler',
				{
					kind: mockOtelApi.SpanKind.SERVER,
					attributes: {
						'http.method': 'GET',
						'http.url': '/test',
						'http.route': '/test', // This comes from the mock
						'nestjs.controller': 'Unknown', // Fallback for undefined name
						'nestjs.handler': 'unknown', // Fallback for undefined name
					},
				},
				{ extracted: true, headers: {} },
			);
		});
	});

	describe('addAttributes', () => {
		it('should add attributes to active span', () => {
			const attributes = {
				'custom.attribute': 'value',
				'custom.number': 42,
				'custom.boolean': true,
			};

			otelInstrumentation.addAttributes(attributes);

			expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
		});

		it('should handle no active span gracefully', () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			const attributes = { 'custom.attribute': 'value' };

			expect(() => {
				otelInstrumentation.addAttributes(attributes);
			}).not.toThrow();
		});

		it('should handle errors during attribute setting gracefully', () => {
			mockSpan.setAttributes.mockImplementation(() => {
				throw new Error('Attribute setting failed');
			});

			const attributes = { 'custom.attribute': 'value' };

			expect(() => {
				otelInstrumentation.addAttributes(attributes);
			}).not.toThrow();
		});
	});

	describe('recordException', () => {
		it('should record exception in active span', () => {
			const error = new Error('Test error');

			otelInstrumentation.recordException(error);

			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
		});

		it('should handle no active span gracefully', () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			const error = new Error('Test error');

			expect(() => {
				otelInstrumentation.recordException(error);
			}).not.toThrow();
		});

		it('should handle errors during exception recording gracefully', () => {
			mockSpan.recordException.mockImplementation(() => {
				throw new Error('Exception recording failed');
			});

			const error = new Error('Test error');

			expect(() => {
				otelInstrumentation.recordException(error);
			}).not.toThrow();
		});
	});
});
