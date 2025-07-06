import { getTransactionName } from '../../src/internal/get-transaction-name';
import { InternalContext } from '../../src/internal/internal-context';
import { emitterSymbol } from '../../src/internal/emitter-symbol';
import { createMockExecutionContext } from '../test-utils-new';

describe('Internal Utilities', () => {
	describe('getTransactionName', () => {
		it('should create transaction name from controller and handler', () => {
			const context = createMockExecutionContext('UserController', 'getUsers');

			const result = getTransactionName(context);

			expect(result).toBe('UserController.getUsers');
		});

		it('should handle different controller and handler names', () => {
			const context = createMockExecutionContext(
				'OrderController',
				'createOrder',
			);

			const result = getTransactionName(context);

			expect(result).toBe('OrderController.createOrder');
		});

		it('should call getHandler and getClass on context', () => {
			const context = createMockExecutionContext();

			getTransactionName(context);

			expect(context.getHandler).toHaveBeenCalled();
			expect(context.getClass).toHaveBeenCalled();
		});
	});

	describe('InternalContext', () => {
		let internalContext: InternalContext;

		beforeEach(() => {
			internalContext = new InternalContext();
			// Clear any existing context from previous tests by creating a fresh store
			const store = (internalContext as any).store;
			if (store) {
				delete store.customTransactionId;
			}
		});

		it('should be defined', () => {
			expect(internalContext).toBeDefined();
		});

		it('should get and set customTransactionId', () => {
			const testId = 'test-transaction-id-123';

			internalContext.customTransactionId = testId;

			expect(internalContext.customTransactionId).toBe(testId);
		});

		it('should return undefined for unset customTransactionId', () => {
			expect(internalContext.customTransactionId).toBeUndefined();
		});

		it('should share context between instances (by design)', () => {
			const context1 = new InternalContext();
			const context2 = new InternalContext();

			context1.customTransactionId = 'shared-id';

			// Both instances share the same async context
			expect(context1.customTransactionId).toBe('shared-id');
			expect(context2.customTransactionId).toBe('shared-id');

			context2.customTransactionId = 'updated-id';
			expect(context1.customTransactionId).toBe('updated-id');
			expect(context2.customTransactionId).toBe('updated-id');
		});

		it('should handle transaction ID updates', () => {
			const firstId = 'first-id';
			const secondId = 'second-id';

			internalContext.customTransactionId = firstId;
			expect(internalContext.customTransactionId).toBe(firstId);

			internalContext.customTransactionId = secondId;
			expect(internalContext.customTransactionId).toBe(secondId);
		});
	});

	describe('emitterSymbol', () => {
		it('should be defined', () => {
			expect(emitterSymbol).toBeDefined();
		});

		it('should be a symbol', () => {
			expect(typeof emitterSymbol).toBe('symbol');
		});

		it('should be a unique symbol that can be used as a DI token', () => {
			// Test that the symbol is unique and suitable for dependency injection
			expect(typeof emitterSymbol).toBe('symbol');
			expect(emitterSymbol.toString()).toContain('GBLoggerEmitter');

			// Should be truthy and usable as a Map key (important for DI systems)
			const testMap = new Map();
			testMap.set(emitterSymbol, 'test-value');
			expect(testMap.get(emitterSymbol)).toBe('test-value');
		});
	});
});
