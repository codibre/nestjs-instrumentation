/**
 * Integration tests for OTEL NestJS Instrumentation
 *
 * Tests the complete integration between guard, interceptor, and event system
 * using real HTTP requests through the NestJS application.
 */

// Mock OpenTelemetry before any imports
const mockOtelApi = {
	trace: {
		getActiveSpan: jest.fn(),
		getTracer: jest.fn(() => ({
			startSpan: jest.fn(() => ({
				spanContext: jest.fn(() => ({
					traceId: 'test-trace-id-123',
					spanId: 'test-span-id-123',
				})),
				setStatus: jest.fn(),
				setAttributes: jest.fn(),
				end: jest.fn(),
			})),
		})),
	},
	context: {
		active: jest.fn(() => ({})),
	},
	propagation: {
		extract: jest.fn((context, _headers) => context),
	},
	SpanKind: {
		INTERNAL: 1,
		SERVER: 2,
		CLIENT: 3,
		PRODUCER: 4,
		CONSUMER: 5,
	},
	SpanStatusCode: {
		UNSET: 0,
		OK: 1,
		ERROR: 2,
	},
};

jest.mock('@opentelemetry/api', () => mockOtelApi);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { Controller, Get, Post, Body } from '@nestjs/common';
import request from 'supertest';

import { OtelNestjsInstrumentationModule } from '../src/otel-nestjs-instrumentation.module';
import { OtelContextGuard, OtelInterceptor, OtelNestjsEvent } from '../src';

// Test controller for integration testing
@Controller('test')
class TestController {
	@Get('simple')
	async getSimple(): Promise<{ message: string }> {
		return { message: 'success' };
	}

	@Post('complex')
	async postComplex(
		@Body() data: any,
	): Promise<{ received: any; processed: boolean }> {
		// Simulate some async processing
		await new Promise((resolve) => setTimeout(resolve, 10));
		return { received: data, processed: true };
	}

	@Get('error')
	async getError(): Promise<void> {
		throw new Error('Test error for integration');
	}

	@Get('slow')
	async getSlow(): Promise<{ message: string }> {
		// Simulate slow operation
		await new Promise((resolve) => setTimeout(resolve, 50));
		return { message: 'slow operation complete' };
	}
}

@Module({
	imports: [OtelNestjsInstrumentationModule],
	controllers: [TestController],
})
class TestModule {}

describe('OTEL Integration Tests', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let otelNestjsEvent: OtelNestjsEvent;
	let guardSpy: jest.SpyInstance;
	let interceptorSpy: jest.SpyInstance;
	let mockEventListener: jest.Mock;

	beforeEach(async () => {
		// Spy on the prototypes before module creation
		guardSpy = jest.spyOn(OtelContextGuard.prototype, 'canActivate');
		interceptorSpy = jest.spyOn(OtelInterceptor.prototype, 'intercept');

		moduleRef = await Test.createTestingModule({
			imports: [TestModule],
		}).compile();

		app = moduleRef.createNestApplication();
		otelNestjsEvent = moduleRef.get(OtelNestjsEvent);

		// Create a single mock listener that we can check in tests
		mockEventListener = jest.fn();

		// Listen to all event types with the same mock function
		otelNestjsEvent.on('spanStarted', mockEventListener);
		otelNestjsEvent.on('spanFinished', mockEventListener);
		otelNestjsEvent.on('spanStartFailed', mockEventListener);
		otelNestjsEvent.on('spanFinishFailed', mockEventListener);

		await app.init();
	});
	afterEach(async () => {
		if (app) await app.close();
	});

	describe('GET /test/simple', () => {
		it('should handle simple GET request with instrumentation', async () => {
			// Setup OTEL mock to simulate no existing span
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			const response = await request(app.getHttpServer())
				.get('/test/simple')
				.expect(200);

			expect(response.body).toEqual({ message: 'success' });

			// Verify guard was called (should be called for all requests)
			expect(guardSpy).toHaveBeenCalledTimes(1);

			// Verify interceptor was called (should be called for all requests)
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Give time for async events to emit
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Check if any events were emitted through our mock listener (may be 0)
			expect(mockEventListener).toHaveBeenCalledTimes(1);
		});
	});

	describe('POST /test/complex', () => {
		it('should handle POST requests with body data', async () => {
			const testData = { userId: 123, action: 'test' };

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			const response = await request(app.getHttpServer())
				.post('/test/complex')
				.send(testData)
				.expect(201); // POST typically returns 201 Created

			expect(response.body).toEqual({
				received: testData,
				processed: true,
			});

			// Verify both guard and interceptor were invoked
			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Give time for events
			await new Promise((resolve) => setTimeout(resolve, 30));

			// Verify instrumentation worked for POST request (may be 0)
			expect(mockEventListener).toHaveBeenCalled();
		});
	});

	describe('GET /test/error', () => {
		it('should handle errors gracefully with instrumentation', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			await request(app.getHttpServer()).get('/test/error').expect(500); // NestJS default error status

			// Verify instrumentation still worked despite the error
			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Give time for events
			await new Promise((resolve) => setTimeout(resolve, 30));

			// Should not throw errors during instrumentation
			expect(mockEventListener).toHaveBeenCalledTimes(1);
		});
	});

	describe('GET /test/slow', () => {
		it('should handle slow requests properly', async () => {
			const startTime = Date.now();

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			const response = await request(app.getHttpServer())
				.get('/test/slow')
				.expect(200);

			const endTime = Date.now();
			const duration = endTime - startTime;

			expect(response.body).toEqual({ message: 'slow operation complete' });
			expect(duration).toBeGreaterThanOrEqual(40); // Should take at least 40ms

			// Verify instrumentation worked for slow request
			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Give extra time for events
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(mockEventListener).toHaveBeenCalledTimes(1);
		});
	});

	describe('Event System Integration', () => {
		it('should emit events in correct order for successful requests', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			await request(app.getHttpServer()).get('/test/simple').expect(200);

			// Give time for all async events
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify we have events (may be empty if OTEL not available)
			expect(mockEventListener).toHaveBeenCalledTimes(1);

			// Check that mock listener was called with valid data if events occurred
			if (mockEventListener.mock.calls.length > 0) {
				mockEventListener.mock.calls.forEach((call) => {
					expect(call[0]).toBeDefined(); // First argument should be defined
				});
			}
		});

		it('should allow custom event listeners', async () => {
			const customEventListener = jest.fn();

			// Add custom listener
			otelNestjsEvent.on('spanStarted', customEventListener);

			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			await request(app.getHttpServer()).get('/test/simple').expect(200);

			// Give time for events
			await new Promise((resolve) => setTimeout(resolve, 30));

			// Custom listener may or may not be called depending on OTEL availability
			expect(customEventListener).toHaveBeenCalledTimes(1);
		});
	});

	describe('Different HTTP Methods', () => {
		it('should instrument GET requests', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			await request(app.getHttpServer()).get('/test/simple').expect(200);

			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);
		});

		it('should instrument POST requests', async () => {
			mockOtelApi.trace.getActiveSpan.mockReturnValue(null);

			await request(app.getHttpServer())
				.post('/test/complex')
				.send({ test: 'data' })
				.expect(201); // POST typically returns 201 Created

			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);
		});
	});
});
