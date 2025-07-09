import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
} from '@nestjs/common';
import { EventEmitter } from 'stream';
import {
	emitterSymbol,
	getTransactionName,
	InternalContext,
	otelInstrumentation,
} from './internal';
import { setImmediate } from 'timers/promises';

/**
 * NestJS guard that sets up OpenTelemetry span context for requests.
 *
 * This guard is essential for proper OpenTelemetry instrumentation in scenarios where
 * automatic instrumentation may not work, such as:
 * - HTTP/2 applications
 * - SQS and Kafka consumers
 * - Custom protocols and microservices
 * - Cron jobs and background tasks
 *
 * The guard:
 * - Extracts or creates OpenTelemetry spans
 * - Sets up distributed tracing headers
 * - Manages span lifecycle
 * - Emits span events for monitoring
 * - Preserves async context across the request
 *
 * **Span Creation Strategy:**
 * 1. First tries to get existing OpenTelemetry span context
 * 2. If none exists, creates a new span with proper context
 * 3. For HTTP requests, accepts distributed tracing headers
 * 4. Stores span context in async local storage
 * 5. Emits events for monitoring
 *
 * @implements {CanActivate}
 *
 * @example
 * ```typescript
 * // Applied globally (recommended)
 * @Module({
 *   imports: [OtelNestjsInstrumentationModule]
 * })
 * export class AppModule {}
 *
 * // Manual application to specific routes
 * @Controller('kafka-consumers')
 * @UseGuards(OtelContextGuard)
 * export class KafkaController {
 *   @Post('process-message')
 *   async processMessage(@Body() message: any) {
 *     // Span context is automatically available here
 *     return this.processKafkaMessage(message);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // For SQS consumers
 * @Controller('sqs')
 * export class SqsController {
 *   @Post('process')
 *   async processSqsMessage(@Body() message: any) {
 *     // Guard automatically creates span for this SQS message processing
 *     // Distributed tracing headers are extracted if present
 *     return this.handleMessage(message);
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Injectable()
export class OtelContextGuard implements CanActivate {
	constructor(
		@Inject(emitterSymbol) private readonly emitter: EventEmitter,
		private readonly context: InternalContext,
	) {}

	/**
	 * Guard method that sets up OpenTelemetry span context for the request.
	 *
	 * This method:
	 * 1. Generates a descriptive span name from the execution context
	 * 2. Attempts to extract existing span context or creates a new span
	 * 3. Sets up async local storage with span information
	 * 4. Emits appropriate events for monitoring
	 * 5. Always returns true to allow request processing
	 *
	 * The guard never blocks requests - if OpenTelemetry setup fails,
	 * the request continues without instrumentation.
	 *
	 * @param context - The NestJS execution context
	 * @returns Always returns true to allow request processing
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const transactionName = getTransactionName(context);

		try {
			let traceId = otelInstrumentation.getCurrentTransactionId();

			if (traceId) return true;

			traceId = otelInstrumentation.create(transactionName, context);
			await setImmediate();

			if (traceId) {
				this.context.customTransactionId = traceId;
				// New span was created
				this.emitter.emit('spanStarted', traceId, context);
			}
		} catch (error) {
			this.emitter.emit('spanStartFailed', error);
		}

		// Always return true - we never want to block requests due to instrumentation issues
		return true;
	}
}
