/**
 * Symbol used for dependency injection of the EventEmitter instance.
 *
 * This symbol ensures type-safe dependency injection of the EventEmitter
 * used for transaction lifecycle events.
 *
 * @internal
 */
export const emitterSymbol = Symbol('GBLoggerEmitter');
