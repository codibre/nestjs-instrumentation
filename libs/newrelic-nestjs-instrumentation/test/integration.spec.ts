// Mock New Relic before any imports
const mockNewRelic = {
	getTraceMetadata: jest.fn(),
	startWebTransaction: jest.fn(),
	getTransaction: jest.fn(),
	endTransaction: jest.fn(),
	createBackgroundTransaction: jest.fn(),
	addAttribute: jest.fn(),
	setTransactionName: jest.fn(),
	incrementMetric: jest.fn(),
	recordMetric: jest.fn(),
	noticeError: jest.fn(),
};

jest.mock('newrelic', () => ({
	__esModule: true,
	default: mockNewRelic,
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
	Controller,
	Get,
	Post,
	Body,
	Module,
	INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import {
	NestJsNewrelicInstrumentationModule,
	NewReliNestjsEvent,
	NewrelicContextGuard,
	NewRelicInterceptor,
} from '../src';

@Controller('test')
class TestController {
	@Get('users')
	getUsers() {
		return { users: [] };
	}

	@Post('sqs-message')
	processSqsMessage(@Body() message: any) {
		return { processed: true, messageId: message.id };
	}

	@Post('kafka-message')
	processKafkaMessage(@Body() message: any) {
		return { processed: true, topic: message.topic };
	}
}

@Module({
	imports: [NestJsNewrelicInstrumentationModule],
	controllers: [TestController],
})
class TestModule {}

describe('New Relic NestJS Instrumentation Integration', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let eventService: NewReliNestjsEvent;
	let guardSpy: jest.SpyInstance;
	let interceptorSpy: jest.SpyInstance;

	beforeEach(async () => {
		// Spy on the prototypes before module creation since they're registered as APP_GUARD/APP_INTERCEPTOR
		guardSpy = jest.spyOn(NewrelicContextGuard.prototype, 'canActivate');
		interceptorSpy = jest.spyOn(NewRelicInterceptor.prototype, 'intercept');

		moduleRef = await Test.createTestingModule({
			imports: [TestModule],
		}).compile();

		app = moduleRef.createNestApplication();
		eventService = moduleRef.get(NewReliNestjsEvent);

		await app.init();
		jest.clearAllMocks();
	});

	afterEach(async () => {
		// Restore spies
		guardSpy?.mockRestore();
		interceptorSpy?.mockRestore();
		await app.close();
	});

	describe('HTTP request integration', () => {
		it('should trigger guard and interceptor on GET request', async () => {
			// Setup New Relic mock to create a transaction
			const testTraceId = 'test-trace-id-get';
			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: testTraceId });
			mockNewRelic.startWebTransaction.mockReturnValue({
				acceptDistributedTraceHeaders: jest.fn(),
			});

			const response = await request(app.getHttpServer())
				.get('/test/users')
				.expect(200);

			expect(response.body).toEqual({ users: [] });

			// Verify guard was called
			expect(guardSpy).toHaveBeenCalledTimes(1);

			// Verify interceptor was called
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Verify New Relic methods were called
			expect(mockNewRelic.getTraceMetadata).toHaveBeenCalled();
			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'TestController.getUsers',
				expect.any(Function),
			);
		});

		it('should trigger guard and interceptor on POST request for SQS message', async () => {
			const testTraceId = 'test-trace-id-sqs';
			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: testTraceId });
			mockNewRelic.startWebTransaction.mockReturnValue({
				acceptDistributedTraceHeaders: jest.fn(),
			});

			const sqsMessage = { id: 'msg-123', body: 'test message' };

			const response = await request(app.getHttpServer())
				.post('/test/sqs-message')
				.send(sqsMessage)
				.expect(201);

			expect(response.body).toEqual({
				processed: true,
				messageId: sqsMessage.id,
			});

			// Verify guard was called
			expect(guardSpy).toHaveBeenCalledTimes(1);

			// Verify interceptor was called
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Verify New Relic methods were called with correct transaction name
			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'TestController.processSqsMessage',
				expect.any(Function),
			);
		});

		it('should trigger guard and interceptor on POST request for Kafka message', async () => {
			const testTraceId = 'test-trace-id-kafka';
			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: testTraceId });
			mockNewRelic.startWebTransaction.mockReturnValue({
				acceptDistributedTraceHeaders: jest.fn(),
			});

			const kafkaMessage = { topic: 'user-events', partition: 0, offset: 123 };

			const response = await request(app.getHttpServer())
				.post('/test/kafka-message')
				.send(kafkaMessage)
				.expect(201);

			expect(response.body).toEqual({
				processed: true,
				topic: kafkaMessage.topic,
			});

			// Verify guard and interceptor were called
			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);

			// Verify New Relic methods were called with correct transaction name
			expect(mockNewRelic.startWebTransaction).toHaveBeenCalledWith(
				'TestController.processKafkaMessage',
				expect.any(Function),
			);
		});
	});

	describe('event emission integration', () => {
		it('should emit transaction events during request processing', async () => {
			const startedEvents: string[] = [];
			const finishedEvents: string[] = [];

			// Listen for events
			eventService.on('transactionStarted', (id) => {
				startedEvents.push(id);
			});
			eventService.on('transactionFinished', (id) => {
				finishedEvents.push(id);
			});

			const testTraceId = 'event-test-trace';
			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: testTraceId });
			mockNewRelic.startWebTransaction.mockReturnValue({
				acceptDistributedTraceHeaders: jest.fn(),
			});

			await request(app.getHttpServer()).get('/test/users').expect(200);

			// Give events time to be emitted
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify events were emitted
			expect(startedEvents).toContain(testTraceId);
			expect(finishedEvents).toContain(testTraceId);
		});
	});

	describe('error handling integration', () => {
		it('should handle New Relic errors gracefully and still process requests', async () => {
			// Make New Relic throw an error
			mockNewRelic.getTraceMetadata.mockImplementation(() => {
				throw new Error('New Relic connection failed');
			});

			const response = await request(app.getHttpServer())
				.get('/test/users')
				.expect(200);

			expect(response.body).toEqual({ users: [] });

			// Verify guard and interceptor still worked
			expect(guardSpy).toHaveBeenCalledTimes(1);
			expect(interceptorSpy).toHaveBeenCalledTimes(1);
		});

		it('should emit error events when transaction creation fails', async () => {
			const errorEvents: any[] = [];

			eventService.on('transactionStartFailed', (id, error) => {
				errorEvents.push({ id, error });
			});

			mockNewRelic.getTraceMetadata.mockImplementation(() => {
				throw new Error('New Relic error');
			});

			await request(app.getHttpServer()).get('/test/users').expect(200);

			// Give events time to be emitted
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify error event was emitted
			expect(errorEvents).toHaveLength(1);
			expect(errorEvents[0].error).toBeInstanceOf(Error);
			expect(errorEvents[0].error.message).toBe('New Relic error');
		});
	});

	describe('transaction lifecycle integration', () => {
		it('should call startWebTransaction callback with getTransaction', async () => {
			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: 'callback-test' });
			mockNewRelic.startWebTransaction.mockImplementation((name, callback) => {
				callback(); // This should call newrelic.getTransaction()
				return { acceptDistributedTraceHeaders: jest.fn() };
			});

			await request(app.getHttpServer()).get('/test/users').expect(200);

			// Verify that getTransaction was called (from the callback)
			expect(mockNewRelic.getTransaction).toHaveBeenCalled();
		});

		it('should handle distributed tracing headers for HTTP requests', async () => {
			const mockTransaction = {
				acceptDistributedTraceHeaders: jest.fn(),
			};

			mockNewRelic.getTraceMetadata
				.mockReturnValueOnce(null)
				.mockReturnValue({ traceId: 'distributed-trace' });
			mockNewRelic.startWebTransaction.mockReturnValue(mockTransaction);

			await request(app.getHttpServer())
				.get('/test/users')
				.set('newrelic', 'distributed-trace-data')
				.set('x-trace-id', 'external-trace-123')
				.expect(200);

			// Verify that acceptDistributedTraceHeaders was called
			expect(
				mockTransaction.acceptDistributedTraceHeaders,
			).toHaveBeenCalledWith(
				'HTTP',
				expect.objectContaining({
					newrelic: 'distributed-trace-data',
					'x-trace-id': 'external-trace-123',
				}),
			);
		});
	});
});
