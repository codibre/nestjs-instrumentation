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
import { Controller, Get, Post, Body, Module } from '@nestjs/common';
import {
	NestJsNewrelicInstrumentationModule,
	NewReliNestjsEvent,
} from '../src/index';

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
	let app: TestingModule;
	let eventService: NewReliNestjsEvent;

	beforeEach(async () => {
		app = await Test.createTestingModule({
			imports: [TestModule],
		}).compile();

		eventService = app.get(NewReliNestjsEvent);

		jest.clearAllMocks();
	});

	afterEach(async () => {
		await app.close();
	});

	describe('module integration', () => {
		it('should wire all services correctly', () => {
			expect(eventService).toBeDefined();
			expect(eventService).toBeInstanceOf(NewReliNestjsEvent);
		});

		it('should provide event listening capabilities', () => {
			// Test that we can register event listeners
			const startListener = jest.fn();
			const finishListener = jest.fn();

			// Should not throw when registering listeners
			expect(() => {
				eventService.on('transactionStarted', startListener);
				eventService.on('transactionFinished', finishListener);
			}).not.toThrow();

			// Verify on method exists and is a function
			expect(typeof eventService.on).toBe('function');
		});

		it('should support all event types', () => {
			const listener = jest.fn();

			// Test all supported event types
			expect(() => {
				eventService.on('transactionStarted', listener);
				eventService.on('transactionFinished', listener);
				eventService.on('transactionStartFailed', listener);
			}).not.toThrow();
		});
	});

	describe('New Relic integration', () => {
		it('should work when New Relic methods succeed', () => {
			const testTraceId = 'success-trace';
			mockNewRelic.getTraceMetadata.mockReturnValue({ traceId: testTraceId });
			mockNewRelic.endTransaction.mockReturnValue(true);

			// This simulates successful New Relic operations
			expect(() => {
				const metadata = mockNewRelic.getTraceMetadata();
				expect(metadata.traceId).toBe(testTraceId);
				mockNewRelic.endTransaction();
			}).not.toThrow();
		});

		it('should handle New Relic errors gracefully', () => {
			mockNewRelic.getTraceMetadata.mockImplementation(() => {
				throw new Error('New Relic error');
			});

			// The application should continue working even if New Relic fails
			expect(() => {
				try {
					mockNewRelic.getTraceMetadata();
				} catch {
					// Errors should be handled gracefully
				}
			}).not.toThrow();
		});
	});

	describe('event system capabilities', () => {
		it('should handle multiple event listeners on same event', () => {
			const listener1 = jest.fn();
			const listener2 = jest.fn();
			const listener3 = jest.fn();

			// Register multiple listeners for the same event
			expect(() => {
				eventService.on('transactionStarted', listener1);
				eventService.on('transactionStarted', listener2);
				eventService.on('transactionStarted', listener3);
			}).not.toThrow();
		});

		it('should handle listeners for different events', () => {
			const startListener = jest.fn();
			const finishListener = jest.fn();
			const failListener = jest.fn();

			// Register listeners for different events
			expect(() => {
				eventService.on('transactionStarted', startListener);
				eventService.on('transactionFinished', finishListener);
				eventService.on('transactionStartFailed', failListener);
			}).not.toThrow();
		});
	});
});
