/**
 * Test utilities for OTEL NestJS Instrumentation
 */

import { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { InternalContext } from '../src/internal';

/**
 * Creates a mock NestJS ExecutionContext for testing
 */
export function createMockExecutionContext(
	type: 'http' | 'rpc' | 'ws' = 'http',
	options: {
		method?: string;
		url?: string;
		path?: string;
		handler?: string;
		controller?: string;
		headers?: Record<string, string>;
	} = {},
): ExecutionContext {
	const {
		method = 'GET',
		url = '/test',
		path = '/test',
		handler = 'testMethod',
		controller = 'TestController',
		headers = {},
	} = options;

	const mockRequest = {
		method,
		url,
		route: { path },
		headers,
	};

	const mockContext: Partial<ExecutionContext> = {
		getType: jest.fn().mockReturnValue(type),
		getClass: jest.fn().mockReturnValue({ name: controller }),
		getHandler: jest.fn().mockReturnValue({ name: handler }),
		switchToHttp: jest.fn().mockReturnValue({
			getRequest: jest.fn().mockReturnValue(mockRequest),
			getResponse: jest.fn().mockReturnValue({}),
		}),
		switchToRpc: jest.fn().mockReturnValue({
			getContext: jest.fn().mockReturnValue({}),
			getData: jest.fn().mockReturnValue({}),
		}),
		switchToWs: jest.fn().mockReturnValue({
			getClient: jest.fn().mockReturnValue({}),
			getData: jest.fn().mockReturnValue({}),
		}),
	};

	return mockContext as ExecutionContext;
}

/**
 * Creates a mock EventEmitter for testing
 */
export function createMockEventEmitter(): EventEmitter {
	const emitter = new EventEmitter();
	jest.spyOn(emitter, 'emit');
	return emitter;
}

/**
 * Creates a mock InternalContext for testing
 */
export function createMockInternalContext() {
	return {
		run: jest.fn((data, fn) => {
			return fn();
		}),
		get: jest.fn(),
		getTraceId: jest.fn(),
		getSpanId: jest.fn(),
		getFinalizer: jest.fn(),
		hasActiveContext: jest.fn().mockReturnValue(false),
	} as any as InternalContext;
}

/**
 * Waits for the next tick (useful for async operations in tests)
 */
export function nextTick(): Promise<void> {
	return new Promise((resolve) => process.nextTick(resolve));
}

/**
 * Creates a mock Observable for testing interceptors
 */
export function createMockObservable<T = any>(value?: T) {
	const observable = {
		pipe: jest.fn().mockReturnThis(),
		subscribe: jest.fn(),
		tap: jest.fn().mockReturnThis(),
		catchError: jest.fn().mockReturnThis(),
		finalize: jest.fn().mockReturnThis(),
	};

	// If a value is provided, make the observable emit it
	if (value !== undefined) {
		observable.subscribe.mockImplementation((next) => {
			if (typeof next === 'function') {
				next(value);
			} else if (next && typeof next.next === 'function') {
				next.next(value);
			}
		});
	}

	return observable;
}

/**
 * Mock OpenTelemetry span for testing
 */
export function createMockOtelSpan(
	traceId = 'test-trace-id-123',
	spanId = 'test-span-id-123',
) {
	return {
		spanContext: jest.fn().mockReturnValue({ traceId, spanId }),
		setStatus: jest.fn(),
		setAttributes: jest.fn(),
		setAttribute: jest.fn(),
		addEvent: jest.fn(),
		recordException: jest.fn(),
		updateName: jest.fn(),
		end: jest.fn(),
		isRecording: jest.fn().mockReturnValue(true),
	};
}

/**
 * Mock OpenTelemetry tracer for testing
 */
export function createMockOtelTracer() {
	return {
		startSpan: jest.fn().mockReturnValue(createMockOtelSpan()),
		startActiveSpan: jest.fn(),
	};
}
