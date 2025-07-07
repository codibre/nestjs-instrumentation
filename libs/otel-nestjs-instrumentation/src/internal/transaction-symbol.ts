/**
 * Symbol used to uniquely identify the transaction in async local storage.
 * This symbol ensures there are no naming conflicts with other libraries.
 *
 * @internal
 */
export const transactionSymbol = Symbol(
	'otel-nestjs-instrumentation:transaction',
);
