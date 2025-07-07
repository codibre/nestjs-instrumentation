/**
 * Tests for InternalContext
 */

import { InternalContext } from '../../src/internal/internal-context';

describe('InternalContext', () => {
	let context: InternalContext;

	beforeEach(() => {
		context = new InternalContext();
	});

	describe('customTransactionId', () => {
		it('should return undefined when no transaction ID is set', () => {
			expect(context.customTransactionId).toBeUndefined();
		});

		it('should store and retrieve custom transaction ID', () => {
			const transactionId = 'test-transaction-123';

			context.customTransactionId = transactionId;

			expect(context.customTransactionId).toBe(transactionId);
		});

		it('should allow overwriting transaction ID', () => {
			context.customTransactionId = 'first-id';
			context.customTransactionId = 'second-id';

			expect(context.customTransactionId).toBe('second-id');
		});
	});

	describe('store isolation', () => {
		it('should maintain shared stores for different instances', () => {
			const context1 = new InternalContext();
			const context2 = new InternalContext();

			context1.customTransactionId = 'context1-id';
			context2.customTransactionId = 'context2-id';

			expect(context1.customTransactionId).toBe('context2-id');
			expect(context2.customTransactionId).toBe('context2-id');
		});
	});
});
