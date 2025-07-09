import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
} from '@nestjs/common';
import newrelic from 'newrelic';
import { emitterSymbol, getTransactionName, InternalContext } from './internal';
import { FastifyRequest } from 'fastify';
import { EventEmitter } from 'stream';

/**
 * NestJS guard that sets up New Relic transaction context for requests.
 *
 * This guard is essential for proper New Relic instrumentation in scenarios where
 * automatic instrumentation may not work, such as:
 * - HTTP/2 applications
 * - SQS and Kafka consumers
 * - Custom protocols and microservices
 * - Cron jobs and background tasks
 *
 * The guard:
 * - Extracts or creates New Relic transaction IDs
 * - Sets up distributed tracing headers
 * - Manages transaction lifecycle
 * - Emits transaction events for monitoring
 * - Preserves async context across the request
 *
 * **Transaction Creation Strategy:**
 * 1. First tries to get existing New Relic trace metadata
 * 2. If none exists, creates a new web transaction
 * 3. For HTTP requests, accepts distributed tracing headers
 * 4. Stores transaction ID in async local storage
 * 5. Emits events for monitoring
 *
 * @implements {CanActivate}
 *
 * @example
 * ```typescript
 * // Applied globally (recommended)
 * @Module({
 *   imports: [NestJsNewrelicInstrumentationModule]
 * })
 * export class AppModule {}
 *
 * // Manual application to specific routes
 * @Controller('kafka-consumers')
 * @UseGuards(NewrelicContextGuard)
 * export class KafkaController {
 *   @Post('process-message')
 *   async processMessage(@Body() message: any) {
 *     // New Relic context is automatically set up
 *     return this.messageService.process(message);
 *   }
 * }
 *
 * // For SQS consumers
 * @Controller('sqs')
 * export class SqsController {
 *   @UseGuards(NewrelicContextGuard)
 *   @Post('handle')
 *   async handleSqsMessage(@Body() sqsEvent: any) {
 *     // Transaction context preserved for async operations
 *     return this.sqsService.process(sqsEvent);
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Injectable()
export class NewrelicContextGuard implements CanActivate {
	constructor(
		private readonly internalContext: InternalContext,
		@Inject(emitterSymbol) private readonly emitter: EventEmitter,
	) {}

	/**
	 * Sets up New Relic transaction context and allows the request to proceed.
	 *
	 * This method is the core of the New Relic instrumentation process:
	 * 1. Generates transaction name from NestJS controller and handler
	 * 2. Attempts to get existing New Relic trace metadata
	 * 3. If no trace exists, creates a new web transaction
	 * 4. For HTTP requests, processes distributed tracing headers
	 * 5. Stores transaction ID in async local storage
	 * 6. Emits monitoring events
	 *
	 * **Transaction Naming Convention:**
	 * Transaction names follow the pattern: `ControllerName.handlerName`
	 * (e.g., "UserController.getUsers", "KafkaController.processMessage")
	 *
	 * **Error Handling:**
	 * If transaction creation fails, an error event is emitted but the
	 * request is allowed to proceed to prevent breaking the application.
	 *
	 * @param context - The NestJS execution context containing route and handler information
	 * @returns Always returns `true` to allow the request to proceed
	 *
	 * @example
	 * ```typescript
	 * // For a controller method like:
	 * @Controller('users')
	 * export class UserController {
	 *   @Get(':id')
	 *   async getUser(@Param('id') id: string) {
	 *     // Transaction name will be: "UserController.getUser"
	 *     // Transaction ID will be available in New Relic and async context
	 *   }
	 * }
	 * ```
	 *
	 * @public
	 */
	canActivate(context: ExecutionContext) {
		let transactionId: string | undefined;
		let newTransaction: newrelic.TransactionHandle | undefined;

		// Get routine name from NestJS execution context first
		const transactionName = getTransactionName(context);

		// Try to get transaction ID from New Relic if available
		try {
			const transaction = newrelic.getTraceMetadata();
			transactionId = transaction?.traceId;
			if (transactionId) return true;
			// If no trace ID, create a new transaction
			newTransaction = newrelic.startWebTransaction(transactionName, () =>
				newrelic.getTransaction(),
			);
			if (context.getType() === 'http') {
				newTransaction.acceptDistributedTraceHeaders(
					'HTTP',
					context.switchToHttp().getRequest<FastifyRequest>().headers,
				);
				transactionId = newrelic.getTraceMetadata()?.traceId;
			}
			if (transactionId) {
				this.internalContext.customTransactionId = transactionId;
			}
			this.emitter.emit('transactionStarted', transactionId);
		} catch (error) {
			this.emitter.emit('transactionStartFailed', transactionId, error);
		}
		return true;
	}
}
