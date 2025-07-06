import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { NewrelicContextGuard } from './newrelic-context-guard';
import { NewRelicInterceptor } from './newrelic.interceptor';
import { emitterSymbol, InternalContext } from './internal';
import { EventEmitter } from 'stream';
import { NewReliNestjsEvent } from './newrelic-nestjs-event';

/**
 * NestJS module for New Relic instrumentation in controller-based applications.
 *
 * This module provides comprehensive New Relic instrumentation for NestJS applications,
 * particularly useful for scenarios not automatically instrumented by New Relic such as:
 * - SQS and Kafka consumers
 * - HTTP/2 applications
 * - Custom applications like cron jobs
 * - Microservices with custom protocols
 *
 * The module automatically registers:
 * - A global guard (`NewrelicContextGuard`) for transaction context management
 * - A global interceptor (`NewrelicInterceptor`) for transaction lifecycle
 * - An event emitter (`NewReliNestjsEvent`) for monitoring transaction events
 *
 * **Key Features:**
 * - Automatic transaction creation and management
 * - Distributed tracing support
 * - HTTP/2 compatibility
 * - Custom transaction naming based on controller and handler
 * - Event-driven transaction monitoring
 * - Async context preservation
 *
 * @example
 * ```typescript
 * // Basic setup
 * @Module({
 *   imports: [
 *     NestJsNewrelicInstrumentationModule
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use with event monitoring
 * @Injectable()
 * export class SomeService {
 *   constructor(private events: NewReliNestjsEvent) {
 *     this.events.on('transactionStarted', (id) => {
 *       console.log(`Transaction ${id} started`);
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
			useClass: NewrelicContextGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: NewRelicInterceptor,
		},
		InternalContext,
		NewReliNestjsEvent,
	],
	exports: [NewReliNestjsEvent],
})
export class NestJsNewrelicInstrumentationModule {}
