import { AsyncLocalStorage } from 'async_hooks';

const internalContext = new AsyncLocalStorage<{
	customTransactionId?: string;
}>();

export class InternalContext {
	/**
	 * Gets the current async local storage store, creating one if it doesn't exist.
	 * @returns The current store object
	 * @private
	 */
	private get store() {
		let store = internalContext.getStore();
		if (!store) internalContext.enterWith((store = {}));
		return store;
	}

	/**
	 * Gets the custom transaction ID from the current context.
	 * @returns The transaction ID if available, undefined otherwise
	 * @public
	 */
	public get customTransactionId(): string | undefined {
		return this.store.customTransactionId;
	}

	/**
	 * Sets the custom tr ansaction ID in the current context.
	 * @param value - The transaction ID to store
	 * @public
	 */
	public set customTransactionId(value: string) {
		this.store.customTransactionId = value;
	}
}
