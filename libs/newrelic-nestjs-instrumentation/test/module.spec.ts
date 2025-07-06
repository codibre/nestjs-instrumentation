const mockNewRelic = {
	getTraceMetadata: jest.fn(),
	startWebTransaction: jest.fn(),
	getTransaction: jest.fn(),
	endTransaction: jest.fn(),
};

jest.mock('newrelic', () => mockNewRelic);

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'stream';
import { NestJsNewrelicInstrumentationModule } from '../src/nestjs-newrelic-instrumentation.module';
import { NewReliNestjsEvent } from '../src/newrelic-nestjs-event';
import { emitterSymbol, InternalContext } from '../src/internal';

describe('NestJsNewrelicInstrumentationModule', () => {
	let module: TestingModule;

	beforeEach(async () => {
		jest.clearAllMocks();
		module = await Test.createTestingModule({
			imports: [NestJsNewrelicInstrumentationModule],
		}).compile();
	});

	afterEach(async () => {
		await module.close();
	});

	it('should be defined', () => {
		expect(module).toBeDefined();
	});

	describe('exported services', () => {
		it('should export NewReliNestjsEvent service', () => {
			const service = module.get(NewReliNestjsEvent);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(NewReliNestjsEvent);
		});
	});

	describe('internal services', () => {
		it('should provide InternalContext service', () => {
			const service = module.get(InternalContext);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(InternalContext);
		});

		it('should provide EventEmitter via emitterSymbol', () => {
			const emitter = module.get(emitterSymbol);
			expect(emitter).toBeDefined();
			expect(emitter).toBeInstanceOf(EventEmitter);
		});
	});

	describe('module functionality', () => {
		it('should provide all internal services', () => {
			const internalContext = module.get(InternalContext);
			const emitter = module.get(emitterSymbol);

			expect(internalContext).toBeDefined();
			expect(internalContext).toBeInstanceOf(InternalContext);
			expect(emitter).toBeDefined();
			expect(emitter).toBeInstanceOf(EventEmitter);
		});

		it('should have proper provider configuration', () => {
			// Test that we can get the event service and it works
			const eventService = module.get(NewReliNestjsEvent);
			const emitter = module.get(emitterSymbol);

			expect(eventService).toBeDefined();
			expect(emitter).toBeDefined();

			// Test event emission works with real event types
			let eventReceived = false;
			eventService.on('transactionStarted', () => {
				eventReceived = true;
			});

			emitter.emit('transactionStarted', 'test-id');
			expect(eventReceived).toBe(true);
		});

		it('should allow NewReliNestjsEvent to receive events from emitter', (done) => {
			const eventService = module.get(NewReliNestjsEvent);
			const emitter = module.get(emitterSymbol);

			let eventCount = 0;
			const expectedEvents = 2;

			eventService.on('transactionStarted', (transactionId) => {
				expect(transactionId).toBe('test-id');
				eventCount++;
				if (eventCount === expectedEvents) done();
			});

			eventService.on('transactionFinished', (transactionId) => {
				expect(transactionId).toBe('test-id');
				eventCount++;
				if (eventCount === expectedEvents) done();
			});

			emitter.emit('transactionStarted', 'test-id');
			emitter.emit('transactionFinished', 'test-id');
		});
	});

	describe('module configuration', () => {
		it('should be a static module', () => {
			expect(NestJsNewrelicInstrumentationModule).toBeDefined();
			expect(typeof NestJsNewrelicInstrumentationModule).toBe('function');
		});

		it('should not require any configuration parameters', async () => {
			const testModule = await Test.createTestingModule({
				imports: [NestJsNewrelicInstrumentationModule],
			}).compile();

			expect(testModule).toBeDefined();
			await testModule.close();
		});
	});
});
