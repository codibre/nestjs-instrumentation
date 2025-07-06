import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Inject,
} from '@nestjs/common';
import { tap } from 'rxjs';
import { emitterSymbol, InternalContext } from './internal';
import EventEmitter from 'events';
import newrelic from 'newrelic';

/**
 * NestJS interceptor that manages New Relic transaction lifecycle.
 *
 * This interceptor works in conjunction with `NewrelicContextGuard` to provide
 * complete transaction management for New Relic instrumentation. It handles:
 * - Transaction completion (both success and error cases)
 * - Event emission for monitoring
 * - Proper cleanup of custom transactions
 * - Transaction finalization timing
 *
 * **Key Responsibilities:**
 * - Emits `transactionFinished` events when requests complete
 * - Ends New Relic transactions at the appropriate time
 * - Handles both successful responses and errors
 * - Prevents duplicate transaction ending for custom transactions
 *
 * This is particularly important for:
 * - SQS and Kafka consumers where transaction timing matters
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
 *   imports: [NestJsNewrelicInstrumentationModule]
 * })
 * export class AppModule {}
 *
 * // Manual application (not recommended, use the module instead)
 * @Controller('background-jobs')
 * @UseInterceptors(NewrelicInterceptor)
 * export class JobController {
 *   @Post('process')
 *   async processJob() {
 *     // Transaction will be properly ended when this completes
 *     return this.jobService.process();
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Injectable()
export class NewRelicInterceptor implements NestInterceptor {
	constructor(
		private readonly internalContext: InternalContext,
		@Inject(emitterSymbol) private readonly emitter: EventEmitter,
	) {}
	/**
	 * Intercepts requests to manage New Relic transaction lifecycle.
	 *
	 * This method sets up a pipeline that will execute the `finishTransaction`
	 * method when the request completes, regardless of whether it succeeds or fails.
	 * This ensures proper transaction cleanup and event emission.
	 *
	 * **Transaction Lifecycle:**
	 * 1. Request starts (handled by `NewrelicContextGuard`)
	 * 2. Request processes (your application logic)
	 * 3. Request completes (handled by this interceptor)
	 * 4. Transaction finished event is emitted
	 * 5. New Relic transaction is ended (if appropriate)
	 *
	 * @param context - The NestJS execution context (not used but required by interface)
	 * @param next - The call handler for the next interceptor/handler in the chain
	 * @returns Observable that emits transaction completion events
	 *
	 * @public
	 */ intercept(_context: ExecutionContext, next: CallHandler) {
		return next.handle().pipe(
			tap({
				next: this.finishTransaction,
				error: this.finishTransaction,
			}),
		);
	}

	private readonly finishTransaction = () => {
		try {
			const customTransactionId = this.internalContext.customTransactionId;
			const transactionId = newrelic.getTraceMetadata()?.traceId;
			this.emitter.emit('transactionFinished', transactionId);
			if (customTransactionId && transactionId !== customTransactionId) return;
			newrelic.endTransaction();
		} catch {
			// Gracefully handle NewRelic errors to prevent application crashes
			// Log the error if needed, but don't rethrow to maintain application stability
		}
	};
}
