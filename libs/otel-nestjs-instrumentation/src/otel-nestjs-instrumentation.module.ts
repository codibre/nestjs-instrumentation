import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { OtelContextGuard } from './otel-context-guard';
import { OtelInterceptor } from './otel.interceptor';
import { emitterSymbol, InternalContext } from './internal';
import { EventEmitter } from 'stream';
import { OtelNestjsEvent } from './otel-nestjs-event';

/**
 * NestJS module for OpenTelemetry instrumentation in controller-based applications.
 *
 * This module provides comprehensive OpenTelemetry instrumentation for NestJS applications,
 * particularly useful for scenarios not automatically instrumented by OpenTelemetry such as:
 * - SQS and Kafka consumers
 * - HTTP/2 applications
 * - Custom applications like cron jobs
 * - Microservices with custom protocols
 *
 * The module automatically registers:
 * - A global guard (`OtelContextGuard`) for span context management
 * - A global interceptor (`OtelInterceptor`) for span lifecycle
 * - An event emitter (`OtelNestjsEvent`) for monitoring span events
 *
 * **Key Features:**
 * - Automatic span creation and management
 * - Distributed tracing support
 * - HTTP/2 compatibility
 * - Custom span naming based on controller and handler
 * - Event-driven span monitoring
 * - Async context preservation
 *
 * @example
 * ```typescript
 * // Basic setup
 * @Module({
 *   imports: [
 *     OtelNestjsInstrumentationModule
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use with event monitoring
 * @Injectable()
 * export class SomeService {
 *   constructor(private events: OtelNestjsEvent) {
 *     this.events.on('spanStarted', (traceId) => {
 *       console.log(`Span ${traceId} started`);
 *     });
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage with custom attributes
 * @Injectable()
 * export class MetricsService {
 *   constructor(private events: OtelNestjsEvent) {
 *     this.events.on('spanStarted', (traceId) => {
 *       // Add custom attributes to spans
 *       // Note: You would typically access the span through OpenTelemetry APIs
 *     });
 *
 *     this.events.on('spanFinished', (traceId) => {
 *       // Custom metrics collection
 *       this.collectCustomMetrics(traceId);
 *     });
 *   }
 * }
 * ```
 *
 * @public
 * @since 1.0.0
 */
@Module({
	providers: [
		{
			provide: emitterSymbol,
			useValue: new EventEmitter(),
		},
		{
			provide: APP_GUARD,
			useClass: OtelContextGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: OtelInterceptor,
		},
		InternalContext,
		OtelNestjsEvent,
	],
	exports: [OtelNestjsEvent],
})
export class OtelNestjsInstrumentationModule {}
