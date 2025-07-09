import { ExecutionContext } from '@nestjs/common';
import * as otel from '@opentelemetry/api';
import { tracerName } from './tracer-name';

/**
 * OpenTelemetry instrumentation provider for NestJS applications.
 *
 * This module provides OpenTelemetry instrumentation for scenarios not automatically
 * covered by standard OTEL auto-instrumentation, including:
 * - SQS and Kafka consumers
 * - Background jobs and cron tasks
 * - Custom protocols and microservices
 * - HTTP/2 applications
 *
 * The provider handles:
 * - Automatic span creation and management
 * - Distributed tracing context propagation
 * - Proper span lifecycle management
 * - Graceful fallback when OpenTelemetry is not available
 *
 * @internal
 */
export const otelInstrumentation = {
	getCurrentTransactionId(): string | undefined {
		return otel.trace.getActiveSpan()?.spanContext()?.traceId;
	},

	/**
	 * Capture existing span context or create a new span.
	 * This method is called when setting up instrumentation for a request.
	 *
	 * @param transactionName - The name for the span
	 * @param context - The NestJS execution context
	 * @returns Object containing trace ID, span ID, and optional finalizer function
	 */
	create(transactionName: string, context: ExecutionContext) {
		// Create a new span since none exists
		const tracer = otel.trace.getTracer(tracerName);
		if (!tracer) return undefined;

		// Extract distributed tracing context from headers (for any context type)
		let spanContext = otel.context.active();
		try {
			if (context.getType() === 'http') {
				const request = context.switchToHttp().getRequest<{
					headers?: Record<string, unknown>;
				}>();
				if (request.headers) {
					spanContext = otel.propagation.extract(spanContext, request.headers);
				}
			}
			// Note: RPC contexts might have their own headers/metadata extraction logic
		} catch {
			// Use default context if extraction fails
		}

		// Determine span kind and attributes based on context type
		let spanKind = otel.SpanKind.INTERNAL; // default for unknown contexts
		const attributes: Record<string, string> = {};

		if (context.getType() === 'http') {
			spanKind = otel.SpanKind.SERVER;
			try {
				const request = context.switchToHttp().getRequest<{
					method?: string;
					url?: string;
					route?: { path?: string };
				}>();
				attributes['http.method'] = request.method || '';
				attributes['http.url'] = request.url || '';
				if (request.route?.path) {
					attributes['http.route'] = request.route.path;
				}
			} catch {
				// Ignore request extraction errors
			}
		} else if (context.getType() === 'rpc') {
			spanKind = otel.SpanKind.SERVER;
			try {
				attributes['rpc.method'] = context.getHandler()?.name || 'Call';
			} catch {
				// Ignore RPC context extraction errors
			}
		}

		// Add NestJS-specific attributes
		try {
			const controllerClass = context.getClass();
			const handlerMethod = context.getHandler();
			attributes['nestjs.controller'] = controllerClass?.name || 'Unknown';
			attributes['nestjs.handler'] = handlerMethod?.name || 'unknown';
		} catch {
			// Ignore NestJS context extraction errors
		}

		const span = tracer.startSpan(
			transactionName,
			{
				kind: spanKind,
				attributes,
			},
			spanContext,
		);

		const spanContextData = span.spanContext();
		const traceId = spanContextData?.traceId;

		return traceId;
	},

	/**
	 * Add attributes to the current active span.
	 *
	 * @param attributes - Key-value pairs to add as span attributes
	 */
	addAttributes(attributes: Record<string, string | number | boolean>): void {
		try {
			const span = otel.trace.getActiveSpan();
			if (span) {
				span.setAttributes(attributes);
			}
		} catch {
			// Ignore errors during attribute setting
		}
	},

	/**
	 * Record an exception in the current active span.
	 *
	 * @param error - The error to record
	 */
	recordException(error: Error): void {
		try {
			const span = otel.trace.getActiveSpan();
			if (span) {
				span.recordException(error);
			}
		} catch {
			// Ignore errors during exception recording
		}
	},
};
