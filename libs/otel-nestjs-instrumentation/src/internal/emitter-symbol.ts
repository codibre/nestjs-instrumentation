/**
 * Injection token symbol for the EventEmitter instance.
 * Used for dependency injection in the OpenTelemetry NestJS instrumentation module.
 *
 * @internal
 */
export const emitterSymbol = Symbol('otel-nestjs-instrumentation:emitter');
