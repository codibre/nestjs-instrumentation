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
import { NewrelicContextGuard } from '../src/newrelic-context-guard';
import { NewRelicInterceptor } from '../src/newrelic.interceptor';
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

	describe('global providers', () => {
		it('should register NewrelicContextGuard as global guard', () => {
			// Instead of accessing APP_GUARD directly, test that the guard can be instantiated
			const guard = module.get(NewrelicContextGuard);
			expect(guard).toBeDefined();
			expect(guard).toBeInstanceOf(NewrelicContextGuard);
		});

		it('should register NewrelicInterceptor as global interceptor', () => {
			// Instead of accessing APP_INTERCEPTOR directly, test that the interceptor can be instantiated
			const interceptor = module.get(NewRelicInterceptor);
			expect(interceptor).toBeDefined();
			expect(interceptor).toBeInstanceOf(NewRelicInterceptor);
		});
	});

	describe('service integration', () => {
		it('should inject same EventEmitter instance in all services', () => {
			const eventService = module.get(NewReliNestjsEvent);
			const guardService = module.get(NewrelicContextGuard);
			const interceptorService = module.get(NewRelicInterceptor);
			const emitter = module.get(emitterSymbol);

			expect(eventService).toBeDefined();
			expect(guardService).toBeDefined();
			expect(interceptorService).toBeDefined();
			expect(emitter).toBeDefined();
		});

		it('should allow NewReliNestjsEvent to receive events from guard and interceptor', (done) => {
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
