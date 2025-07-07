import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Inject,
} from '@nestjs/common';
import { tap } from 'rxjs';
import {
	emitterSymbol,
	InternalContext,
	otelInstrumentation,
} from './internal';
import EventEmitter from 'events';
import otel, { Span } from '@opentelemetry/api';

/**
 * NestJS interceptor that manages OpenTelemetry span lifecycle.
 *
 * This interceptor works in conjunction with `OtelContextGuard` to provide
 * complete span management for OpenTelemetry instrumentation. It handles:
 * - Span completion (both success and error cases)
 * - Event emission for monitoring
 * - Proper cleanup of custom spans
 * - Span finalization timing
 * - Exception recording in spans
 *
 * **Key Responsibilities:**
 * - Emits `spanFinished` events when requests complete
 * - Ends OpenTelemetry spans at the appropriate time
 * - Handles both successful responses and errors
 * - Records exceptions in spans for error tracking
 * - Prevents duplicate span ending for custom spans
 *
 * This is particularly important for:
 * - SQS and Kafka consumers where span timing matters
 * - HTTP/2 applications with complex async flows
 * - Custom applications like cron jobs
 * - Long-running background processes
 *
 * @implements {NestInterceptor}
 *
 * @example
 * ```typescript
 * // Automatically applied when using the module
 * @Module({
 *   imports: [OtelNestjsInstrumentationModule]
 * })
 * export class AppModule {}
 *
 * // Manual application (not recommended, use the module instead)
 * @Controller('background-jobs')
 * @UseInterceptors(OtelInterceptor)
 * export class JobController {
 *   @Post('process')
 *   async processJob() {
 *     // Span will be automatically completed when this method finishes
 *     return this.handleJob();
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // The interceptor handles both success and error cases
 * @Controller('api')
 * export class ApiController {
 *   @Get('data')
 *   async getData() {
 *     // If this throws an error, the span will be marked as failed
 *     // and the exception will be recorded in the span
 *     throw new Error('Something went wrong');
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Injectable()
export class OtelInterceptor implements NestInterceptor {
	constructor(
		@Inject(emitterSymbol) private readonly emitter: EventEmitter,
		private readonly context: InternalContext,
	) {}

	/**
	 * Intercept method that manages the span lifecycle.
	 *
	 * This method:
	 * 1. Sets up span completion handling for both success and error cases
	 * 2. Records exceptions in spans when errors occur
	 * 3. Calls span finalizers to properly end spans
	 * 4. Emits appropriate events for monitoring
	 * 5. Ensures spans are marked with correct status codes
	 *
	 * The interceptor works with the async context established by the guard
	 * to access span information and manage its lifecycle.
	 *
	 * @param context - The NestJS execution context
	 * @param next - The next handler in the chain
	 * @returns Observable that completes when the request is finished
	 */
	intercept(context: ExecutionContext, next: CallHandler) {
		const span = otel.trace.getActiveSpan();
		if (!span) return next.handle();
		const traceId = span.spanContext().traceId;

		return next.handle().pipe(
			tap({
				next: () => this.finishSpan(traceId, span),
				error: (error) => {
					this.recordError(error);
					this.finishSpan(traceId, span);
				},
			}),
		);
	}

	/**
	 * Complete the span and emit the appropriate events.
	 *
	 * @param traceId - The trace ID for event emission
	 * @param finalizer - Optional span finalizer function
	 * @param success - Whether the request completed successfully
	 * @private
	 */
	private finishSpan(traceId: string | undefined, span: Span) {
		try {
			if (traceId === this.context.customTransactionId) span.end();

			// Emit span finished event
			if (traceId) {
				this.emitter.emit('spanFinished', traceId);
			}
		} catch (error) {
			this.emitter.emit('spanFinishFailed', error);
		}
	}

	/**
	 * Record an error in the current active span.
	 *
	 * @param error - The error to record
	 * @private
	 */
	private recordError(error: unknown): void {
		try {
			// Record the exception in the span if it's an Error object
			if (error instanceof Error) {
				otelInstrumentation.recordException(error);
			} else {
				// Convert non-Error objects to Error for recording
				const errorObj = new Error(String(error));
				otelInstrumentation.recordException(errorObj);
			}

			// Add error-related attributes
			const errorObj =
				error instanceof Error
					? error
					: { name: 'UnknownError', message: String(error), stack: undefined };
			otelInstrumentation.addAttributes({
				'error.name': errorObj.name || 'UnknownError',
				'error.message': errorObj.message || String(error),
				'error.stack': errorObj.stack || 'No stack trace available',
			});
		} catch (finishError) {
			this.emitter.emit('spanFinishFailed', finishError);
		}
	}
}
