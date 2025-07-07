const mockOtelApi = {
	trace: {
		getActiveSpan: jest.fn(),
		getTracer: jest.fn(() => ({
			startSpan: jest.fn(() => ({
				spanContext: jest.fn(() => ({ traceId: 'test-trace-id-123' })),
				setStatus: jest.fn(),
				setAttribute: jest.fn(),
				addEvent: jest.fn(),
				recordException: jest.fn(),
				end: jest.fn(),
			})),
		})),
	},
	SpanStatusCode: {
		UNSET: 0,
		OK: 1,
		ERROR: 2,
	},
};

jest.mock('@opentelemetry/api', () => mockOtelApi);

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { EventEmitter } from 'stream';
import { OtelInterceptor } from '../src/otel.interceptor';
import { InternalContext } from '../src/internal';
import {
	createMockExecutionContext,
	createMockEventEmitter,
	createMockInternalContext,
	createMockOtelSpan,
	createMockObservable,
} from './test-utils';

describe('OtelInterceptor', () => {
	let interceptor: OtelInterceptor;
	let mockEmitter: EventEmitter;
	let mockInternalContext: InternalContext;
	let mockExecutionContext: ExecutionContext;
	let mockCallHandler: jest.Mocked<CallHandler>;

	beforeEach(() => {
		mockEmitter = createMockEventEmitter();
		mockInternalContext = createMockInternalContext();
		mockExecutionContext = createMockExecutionContext();
		mockCallHandler = {
			handle: jest.fn(),
		};

		interceptor = new OtelInterceptor(mockEmitter, mockInternalContext);
	});

	afterEach(() => {
		mockEmitter.removeAllListeners();
	});

	describe('intercept', () => {
		it('should call next handle and return observable when no active span', () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);
			const mockObservable = createMockObservable('test-result');
			(mockCallHandler.handle as jest.Mock).mockReturnValue(mockObservable);

			const result = interceptor.intercept(
				mockExecutionContext,
				mockCallHandler,
			);

			expect(mockCallHandler.handle).toHaveBeenCalled();
			expect(result).toBe(mockObservable);
			expect(mockEmitter.emit).not.toHaveBeenCalled();
		});

		it('should add span tracking when active span exists', () => {
			const mockSpan = createMockOtelSpan('active-span-id');
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
			const mockObservable = of('test-result');
			mockCallHandler.handle.mockReturnValue(mockObservable);

			const result = interceptor.intercept(
				mockExecutionContext,
				mockCallHandler,
			);

			expect(mockCallHandler.handle).toHaveBeenCalled();
			expect(result).toBeDefined();
			// The observable should be wrapped with span tracking
			expect(result).not.toBe(mockObservable);
		});

		it('should finish span successfully on successful request', async () => {
			const mockSpan = createMockOtelSpan('test-trace-id');
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
			mockCallHandler.handle.mockReturnValue(of('success'));
			mockInternalContext.customTransactionId = 'test-trace-id';

			const result = interceptor.intercept(
				mockExecutionContext,
				mockCallHandler,
			);

			// Execute the observable to trigger the tap operators
			await new Promise((resolve) => {
				result.subscribe({
					next: () => resolve(undefined),
					error: () => resolve(undefined),
					complete: () => resolve(undefined),
				});
			});

			expect(mockSpan.end).toHaveBeenCalled();
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanFinished',
				'test-trace-id',
			);
		});

		it('should emit spanFinishFailed when finishSpan throws', async () => {
			const mockSpan = createMockOtelSpan('test-trace-id');
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
			mockCallHandler.handle.mockReturnValue(of('success'));
			mockInternalContext.customTransactionId = 'test-trace-id';

			// Make span.end throw an error
			const spanError = new Error('Span end failed');
			mockSpan.end.mockImplementation(() => {
				throw spanError;
			});

			const result = interceptor.intercept(
				mockExecutionContext,
				mockCallHandler,
			);

			// Execute the observable to trigger the error
			await new Promise((resolve) => {
				result.subscribe({
					next: () => resolve(undefined),
					error: () => resolve(undefined),
					complete: () => resolve(undefined),
				});
			});

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanFinishFailed',
				spanError,
			);
		});

		it('should not end span if trace ID does not match custom transaction ID', async () => {
			const mockSpan = createMockOtelSpan('different-trace-id');
			mockOtelApi.trace.getActiveSpan.mockReturnValue(mockSpan);
			mockCallHandler.handle.mockReturnValue(of('success'));
			mockInternalContext.customTransactionId = 'custom-trace-id';

			const result = interceptor.intercept(
				mockExecutionContext,
				mockCallHandler,
			);

			// Execute the observable
			await new Promise((resolve) => {
				result.subscribe({
					next: () => resolve(undefined),
					error: () => resolve(undefined),
					complete: () => resolve(undefined),
				});
			});

			expect(mockSpan.end).not.toHaveBeenCalled();
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'spanFinished',
				'different-trace-id',
			);
		});
	});
});
