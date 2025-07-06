/**
 * Event emitter service for monitoring New Relic transaction lifecycle events.
 *
 * This service provides a way to listen to various transaction events that occur
 * during the New Relic instrumentation process. It's particularly useful for:
 * - Debugging transaction issues
 * - Custom logging and monitoring
 * - Integration with other monitoring systems
 * - Performance tracking for custom applications
 *
 * **Available Events:**
 * - `transactionStarted`: Emitted when a New Relic transaction is successfully created
 * - `transactionFinished`: Emitted when a transaction completes (success or error)
 * - `transactionStartFailed`: Emitted when transaction creation fails
 *
 * This is especially valuable for:
 * - SQS and Kafka consumers to track message processing
 * - HTTP/2 applications with complex routing
 * - Cron jobs and background tasks
 * - Custom microservice protocols
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MonitoringService {
 *   constructor(private events: NewReliNestjsEvent) {
 *     // Track successful transactions
 *     this.events.on('transactionStarted', (transactionId) => {
 *       console.log(`New Relic transaction ${transactionId} started`);
 *       this.metrics.increment('newrelic.transactions.started');
 *     });
 *
 *     // Track completed transactions
 *     this.events.on('transactionFinished', (transactionId) => {
 *       console.log(`Transaction ${transactionId} completed`);
 *       this.metrics.increment('newrelic.transactions.finished');
 *     });
 *
 *     // Track failures
 *     this.events.on('transactionStartFailed', (transactionId, error) => {
 *       console.error(`Failed to start transaction ${transactionId}:`, error);
 *       this.metrics.increment('newrelic.transactions.failed');
 *     });
 *   }
 * }
 *
 * // For Kafka consumers
 * @Injectable()
 * export class KafkaMonitorService {
 *   constructor(private events: NewReliNestjsEvent) {
 *     this.events.on('transactionStarted', (id) => {
 *       this.kafkaMetrics.trackMessageProcessingStart(id);
 *     });
 *
 *     this.events.on('transactionFinished', (id) => {
 *       this.kafkaMetrics.trackMessageProcessingEnd(id);
 *     });
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { emitterSymbol } from './internal';

@Injectable()
export class NewReliNestjsEvent {
	constructor(
		@Inject(emitterSymbol) private readonly eventEmitter: EventEmitter,
	) {}

	/**
	 * Registers a listener for transaction start failure events.
	 *
	 * This event is emitted when the New Relic transaction creation process fails.
	 * This is particularly useful for debugging instrumentation issues in complex
	 * scenarios like SQS/Kafka consumers or HTTP/2 applications where transaction
	 * creation might encounter issues.
	 *
	 * **When this fires:**
	 * - New Relic agent is not properly configured
	 * - Transaction creation throws an exception
	 * - Distributed tracing header processing fails
	 * - Custom transaction naming encounters errors
	 *
	 * @param event - Must be 'transactionStartFailed'
	 * @param listener - Callback function that receives the transaction ID and error details
	 *
	 * @example
	 * ```typescript
	 * // Monitor transaction start failures for debugging
	 * this.events.on('transactionStartFailed', (transactionId, error) => {
	 *   this.logger.error('New Relic transaction failed to start', {
	 *     transactionId,
	 *     error: error.message,
	 *     stack: error.stack
	 *   });
	 *
	 *   // Report to external monitoring
	 *   this.errorTracker.captureException(error, { transactionId });
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(
		event: 'transactionStartFailed',
		listener: (transactionId: string, error: unknown) => void,
	): void;

	/**
	 * Registers a listener for transaction completion events.
	 *
	 * This event is emitted when a New Relic transaction completes, regardless of
	 * whether it ended successfully or with an error. This is ideal for cleanup
	 * operations, metrics collection, and performance monitoring.
	 *
	 * **When this fires:**
	 * - HTTP request/response cycle completes
	 * - SQS message processing finishes
	 * - Kafka consumer message handling ends
	 * - Background job or cron task completes
	 * - Any controller method execution finishes
	 *
	 * @param event - Must be 'transactionFinished'
	 * @param listener - Callback function that receives the completed transaction ID
	 *
	 * @example
	 * ```typescript
	 * // Track transaction completion for performance metrics
	 * private transactionStartTimes = new Map<string, number>();
	 *
	 * this.events.on('transactionStarted', (id) => {
	 *   this.transactionStartTimes.set(id, Date.now());
	 * });
	 *
	 * this.events.on('transactionFinished', (transactionId) => {
	 *   const startTime = this.transactionStartTimes.get(transactionId);
	 *   if (startTime) {
	 *     const duration = Date.now() - startTime;
	 *     this.metrics.histogram('transaction.duration', duration);
	 *     this.transactionStartTimes.delete(transactionId);
	 *   }
	 *
	 *   // Cleanup any transaction-specific resources
	 *   this.cleanupTransactionResources(transactionId);
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(
		event: 'transactionFinished',
		listener: (transactionId: string) => void,
	): void;

	public on(
		event: 'transactionFinishFailed',
		listener: (transactionId: string, error: unknown) => void,
	): void;

	/**
	 * Registers a listener for successful transaction start events.
	 *
	 * This event is emitted when a New Relic transaction is successfully created
	 * and ready to track operations. This is perfect for initializing transaction-specific
	 * monitoring, logging, or custom metrics collection.
	 *
	 * **When this fires:**
	 * - New Relic transaction successfully created
	 * - Transaction ID has been generated
	 * - Distributed tracing context is established
	 * - Transaction is ready to track operations
	 *
	 * @param event - Must be 'transactionStarted'
	 * @param listener - Callback function that receives the new transaction ID
	 *
	 * @example
	 * ```typescript
	 * // Initialize transaction-specific monitoring
	 * this.events.on('transactionStarted', (transactionId) => {
	 *   // Start performance tracking
	 *   this.performanceMonitor.startTransaction(transactionId);
	 *
	 *   // Initialize custom attributes
	 *   newrelic.addCustomAttributes({
	 *     'custom.transaction.id': transactionId,
	 *     'custom.service.version': this.configService.get('VERSION'),
	 *     'custom.environment': this.configService.get('NODE_ENV')
	 *   });
	 *
	 *   // For Kafka/SQS: track message processing start
	 *   this.messageTracker.startProcessing(transactionId);
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(
		event: 'transactionStarted',
		listener: (transactionId: string) => void,
	): void;
	public on(event: string, listener: Parameters<EventEmitter['on']>[1]): void {
		this.eventEmitter.on(event, listener);
	}
}
