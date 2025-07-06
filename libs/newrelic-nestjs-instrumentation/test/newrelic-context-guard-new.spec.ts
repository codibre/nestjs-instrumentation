const mockNewRelic = {
	getTraceMetadata: jest.fn(),
	startWebTransaction: jest.fn(),
	getTransaction: jest.fn(),
	endTransaction: jest.fn(),
};

jest.mock('newrelic', () => mockNewRelic);

import { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { NewrelicContextGuard } from '../src/newrelic-context-guard';
import { InternalContext } from '../src/internal';
import {
	createMockExecutionContext,
	createMockNewRelicTransaction,
} from './test-utils-new';

describe('NewrelicContextGuard', () => {
	let guard: NewrelicContextGuard;
	let mockEmitter: EventEmitter;
	let mockInternalContext: InternalContext;
	let mockExecutionContext: ExecutionContext;

	beforeEach(() => {
		mockEmitter = new EventEmitter();
		mockInternalContext = new InternalContext();
		mockExecutionContext = createMockExecutionContext();

		jest.spyOn(mockEmitter, 'emit');

		guard = new NewrelicContextGuard(mockInternalContext, mockEmitter);

		jest.clearAllMocks();
	});

	afterEach(() => {
		mockEmitter.removeAllListeners();
	});

	describe('canActivate', () => {
		it('should return true when transaction metadata exists', () => {
			mockNewRelic.getTraceMetadata.mockReturnValue({
				traceId: 'existing-trace-id',
			});

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockNewRelic.getTraceMetadata).toHaveBeenCalled();
		});

		it('should create new transaction when no trace metadata exists', () => {
			const mockTransaction = createMockNewRelicTransaction('new-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);
			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'new-trace-id',
			});

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'TestController.testHandler',
				expect.any(Function),
			);
		});

		it('should emit transactionStarted event when transaction is created', () => {
			const mockTransaction = createMockNewRelicTransaction('new-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);
			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'new-trace-id',
			});

			guard.canActivate(mockExecutionContext);

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'transactionStarted',
				'new-trace-id',
			);
		});

		it('should emit transactionStartFailed event when transaction creation fails', () => {
			const error = new Error('Transaction creation failed');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockImplementation(() => {
				throw error;
			});

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'transactionStartFailed',
				undefined,
				error,
			);
		});

		it('should handle HTTP context and accept distributed trace headers', () => {
			const mockTransaction = createMockNewRelicTransaction('http-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);
			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'http-trace-id',
			});

			guard.canActivate(mockExecutionContext);

			expect(
				mockTransaction.acceptDistributedTraceHeaders,
			).toHaveBeenCalledWith(
				'HTTP',
				expect.objectContaining({
					'x-trace-id': 'test-trace-id',
					newrelic: 'distributed-trace-data',
				}),
			);
		});

		it('should set custom transaction ID in internal context', () => {
			const mockTransaction = createMockNewRelicTransaction('custom-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);
			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'custom-trace-id',
			});

			guard.canActivate(mockExecutionContext);

			expect(mockInternalContext.customTransactionId).toBe('custom-trace-id');
		});

		it('should handle non-HTTP context types', () => {
			const nonHttpContext = createMockExecutionContext(
				'TestController',
				'testHandler',
				'rpc',
			);
			const mockTransaction = createMockNewRelicTransaction('rpc-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);
			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'rpc-trace-id',
			});

			const result = guard.canActivate(nonHttpContext);

			expect(result).toBe(true);
			expect(
				mockTransaction.acceptDistributedTraceHeaders,
			).not.toHaveBeenCalled();
		});

		it('should generate correct transaction name from execution context', () => {
			const customContext = createMockExecutionContext(
				'UserController',
				'getUsers',
			);
			const mockTransaction = createMockNewRelicTransaction();

			mockNewRelic.getTraceMetadata.mockReturnValue(null);
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);

			guard.canActivate(customContext);

			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'UserController.getUsers',
				expect.any(Function),
			);
		});

		it('should call getTransaction within startWebTransaction callback', () => {
			const mockTransaction =
				createMockNewRelicTransaction('callback-trace-id');

			mockNewRelic.getTraceMetadata.mockReturnValue(null);

			// Mock startWebTransaction to actually call the callback
			mockNewRelic.startWebTransaction.mockImplementation((name, callback) => {
				callback(); // This should call newrelic.getTransaction()
				return mockTransaction;
			});

			mockNewRelic.getTraceMetadata.mockReturnValueOnce(null).mockReturnValue({
				traceId: 'callback-trace-id',
			});

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'TestController.testHandler',
				expect.any(Function),
			);
			// Verify that getTransaction was called within the callback
			expect(mockNewRelic.getTransaction).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should always return true even when errors occur', () => {
			mockNewRelic.getTraceMetadata.mockImplementation(() => {
				throw new Error('NewRelic error');
			});

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});

		it('should emit error event when getTraceMetadata throws', () => {
			const error = new Error('getTraceMetadata error');
			mockNewRelic.getTraceMetadata.mockImplementation(() => {
				throw error;
			});

			guard.canActivate(mockExecutionContext);

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				'transactionStartFailed',
				undefined,
				error,
			);
		});
	});
});
