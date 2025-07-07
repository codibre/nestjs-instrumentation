import { Inject, Injectable } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'stream';
import { emitterSymbol } from './internal';

/**
 * Event listener function signature for OpenTelemetry NestJS events.
 *
 * @param traceId - The OpenTelemetry trace ID
 * @param error - Optional error object (only for error events)
 * @param result - Optional result data (only for success events)
 * @param context - Optional execution context
 *
 * @public
 */
export type OtelNestjsEventListener = (
	traceId?: string,
	error?: Error,
	result?: unknown,
	context?: ExecutionContext,
) => void;

/**
 * Service for emitting and listening to OpenTelemetry span lifecycle events.
 *
 * This service provides a way to monitor and react to span creation and
 * completion events in your NestJS application. It's particularly useful for:
 *
 * - **Monitoring**: Track span creation and completion
 * - **Debugging**: Listen for span start failures
 * - **Custom Logic**: Execute code when spans begin or end
 * - **Integration**: Connect with other monitoring systems
 * - **Performance Tracking**: Monitor request/response cycles
 * - **Error Handling**: React to span errors and failures
 *
 * **Event Types:**
 * - `spanStarted`: Emitted when a new span is successfully created
 * - `spanFinished`: Emitted when a span completes (success or error)
 * - `spanStartFailed`: Emitted when span creation fails
 * - `spanSuccess`: Emitted when a span completes successfully with result data
 * - `spanError`: Emitted when a span encounters an error during execution
 * - `spanComplete`: Emitted when span execution completes (regardless of outcome)
 *
 * **Thread Safety:**
 * This service is thread-safe and can be used across multiple concurrent requests.
 * Each event includes the trace ID to correlate events with specific requests.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MonitoringService {
 *   constructor(private events: OtelNestjsEvent) {
 *     // Track successful span creation
 *     this.events.on('spanStarted', (traceId) => {
 *       console.log(`OpenTelemetry span ${traceId} started`);
 *       this.metrics.increment('otel.spans.started');
 *     });
 *
 *     // Track span completion
 *     this.events.on('spanFinished', (traceId) => {
 *       console.log(`Span ${traceId} completed`);
 *       this.metrics.increment('otel.spans.finished');
 *     });
 *
 *     // Track span failures
 *     this.events.on('spanStartFailed', (traceId, error) => {
 *       console.error(`Failed to start span ${traceId}:`, error);
 *       this.metrics.increment('otel.spans.failed');
 *     });
 *
 *     // Track successful operations with results
 *     this.events.on('spanSuccess', (traceId, error, result, context) => {
 *       console.log(`Span ${traceId} succeeded with result:`, result);
 *       this.processSuccessfulOperation(result, context);
 *     });
 *   }
 * }
 *
 * // For Kafka consumers
 * @Injectable()
 * export class KafkaMonitorService {
 *   constructor(private events: OtelNestjsEvent) {
 *     this.events.on('spanStarted', (traceId) => {
 *       this.kafkaMetrics.trackMessageProcessingStart(traceId);
 *     });
 *
 *     this.events.on('spanFinished', (traceId) => {
 *       this.kafkaMetrics.trackMessageProcessingEnd(traceId);
 *     });
 *
 *     this.events.on('spanError', (traceId, error, result, context) => {
 *       this.kafkaMetrics.trackMessageProcessingError(traceId, error);
 *     });
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Injectable()
export class OtelNestjsEvent {
	constructor(
		@Inject(emitterSymbol) private readonly eventEmitter: EventEmitter,
	) {}

	/**
	 * Registers a listener for span start failure events.
	 *
	 * This event is emitted when the OpenTelemetry span creation process fails.
	 * This is particularly useful for debugging instrumentation issues in complex
	 * scenarios like SQS/Kafka consumers or HTTP/2 applications where span
	 * creation might encounter issues.
	 *
	 * **When this fires:**
	 * - OpenTelemetry SDK is not properly configured
	 * - Span creation throws an exception
	 * - Distributed tracing header processing fails
	 * - Custom span naming encounters errors
	 * - Tracer initialization failures
	 *
	 * @param event - Must be 'spanStartFailed'
	 * @param listener - Callback function that receives the trace ID and error details
	 *
	 * @example
	 * ```typescript
	 * // Monitor span start failures for debugging
	 * this.events.on('spanStartFailed', (traceId, error) => {
	 *   this.logger.error('OpenTelemetry span failed to start', {
	 *     traceId,
	 *     error: error.message,
	 *     stack: error.stack
	 *   });
	 *
	 *   // Report to external monitoring
	 *   this.errorTracker.captureException(error, { traceId });
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(event: 'spanStartFailed', listener: (error: unknown) => void): void;

	/**
	 * Registers a listener for span completion events.
	 *
	 * This event is emitted when an OpenTelemetry span completes, regardless of
	 * whether it ended successfully or with an error. This is ideal for cleanup
	 * operations, metrics collection, and performance monitoring.
	 *
	 * **When this fires:**
	 * - HTTP request/response cycle completes
	 * - SQS message processing finishes
	 * - Kafka consumer message handling ends
	 * - Background job or cron task completes
	 * - Any controller method execution finishes
	 * - RPC calls complete
	 *
	 * @param event - Must be 'spanFinished'
	 * @param listener - Callback function that receives the completed trace ID
	 *
	 * @example
	 * ```typescript
	 * // Track span completion for performance metrics
	 * private spanStartTimes = new Map<string, number>();
	 *
	 * this.events.on('spanStarted', (traceId) => {
	 *   this.spanStartTimes.set(traceId, Date.now());
	 * });
	 *
	 * this.events.on('spanFinished', (traceId) => {
	 *   const startTime = this.spanStartTimes.get(traceId);
	 *   if (startTime) {
	 *     const duration = Date.now() - startTime;
	 *     this.metrics.histogram('span.duration', duration);
	 *     this.spanStartTimes.delete(traceId);
	 *   }
	 *
	 *   // Cleanup any span-specific resources
	 *   this.cleanupSpanResources(traceId);
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(event: 'spanFinished', listener: (traceId: string) => void): void;

	/**
	 * Registers a listener for successful span start events.
	 *
	 * This event is emitted when an OpenTelemetry span is successfully created
	 * and ready to track operations. This is perfect for initializing span-specific
	 * monitoring, logging, or custom metrics collection.
	 *
	 * **When this fires:**
	 * - OpenTelemetry span successfully created
	 * - Trace ID has been generated
	 * - Distributed tracing context is established
	 * - Span is ready to track operations
	 * - Span context is stored in async local storage
	 *
	 * @param event - Must be 'spanStarted'
	 * @param listener - Callback function that receives the new trace ID
	 *
	 * @example
	 * ```typescript
	 * // Initialize span-specific monitoring
	 * this.events.on('spanStarted', (traceId) => {
	 *   // Start performance tracking
	 *   this.performanceMonitor.startSpan(traceId);
	 *
	 *   // Initialize custom attributes
	 *   this.otelService.addSpanAttributes({
	 *     'custom.trace.id': traceId,
	 *     'custom.service.version': this.configService.get('VERSION'),
	 *     'custom.environment': this.configService.get('NODE_ENV')
	 *   });
	 *
	 *   // For Kafka/SQS: track message processing start
	 *   this.messageTracker.startProcessing(traceId);
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(event: 'spanStarted', listener: (traceId: string) => void): void;

	/**
	 * Registers a listener for span completion events (regardless of outcome).
	 *
	 * This event is emitted when any span execution completes, whether successful
	 * or failed. This is useful for cleanup operations, final metrics collection,
	 * and operations that need to run regardless of span outcome.
	 *
	 * **When this fires:**
	 * - After spanSuccess or spanError events
	 * - When span execution fully completes
	 * - Before span context is cleaned up
	 * - At the end of request/operation lifecycle
	 *
	 * @param event - Must be 'spanComplete'
	 * @param listener - Callback function that receives trace ID and context
	 *
	 * @example
	 * ```typescript
	 * // Cleanup and final metrics
	 * this.events.on('spanComplete', (traceId, context) => {
	 *   // Cleanup span-specific resources
	 *   this.cleanupSpanResources(traceId);
	 *
	 *   // Final metrics collection
	 *   this.metrics.increment('span.completed', {
	 *     contextType: context?.getType(),
	 *     controller: context?.getClass()?.name
	 *   });
	 *
	 *   // Flush any pending span data
	 *   this.spanDataBuffer.flush(traceId);
	 * });
	 * ```
	 *
	 * @public
	 */
	public on(
		event: 'spanFinishError',
		listener: (traceId: string, error: unknown) => void,
	): void;

	/**
	 * Generic event listener registration for custom events or advanced use cases.
	 *
	 * @param event - The event name
	 * @param listener - The event listener function
	 *
	 * @internal
	 */
	public on(event: string, listener: Parameters<EventEmitter['on']>[1]): void;

	public on(event: string, listener: Parameters<EventEmitter['on']>[1]): void {
		this.eventEmitter.on(event, listener);
	}
}
