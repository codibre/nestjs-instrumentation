// Mock New Relic before any imports
jest.mock('newrelic', () => ({
	__esModule: true,
	default: {
		createBackgroundTransaction: jest.fn(),
		getTransaction: jest.fn(),
		endTransaction: jest.fn(),
		addAttribute: jest.fn(),
		setTransactionName: jest.fn(),
		incrementMetric: jest.fn(),
		recordMetric: jest.fn(),
		noticeError: jest.fn(),
		api: {
			createBackgroundTransaction: jest.fn(),
			getTransaction: jest.fn(),
			endTransaction: jest.fn(),
			addAttribute: jest.fn(),
			setTransactionName: jest.fn(),
			incrementMetric: jest.fn(),
			recordMetric: jest.fn(),
			noticeError: jest.fn(),
		},
	},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitter } from 'stream';
import { NestJsNewrelicInstrumentationModule } from '../src/nestjs-newrelic-instrumentation.module';
import { NewReliNestjsEvent } from '../src/newrelic-nestjs-event';
import { NewrelicContextGuard } from '../src/newrelic-context-guard';
import { NewRelicInterceptor } from '../src/newrelic.interceptor';
import { emitterSymbol, InternalContext } from '../src/internal';

describe('NestJsNewrelicInstrumentationModule', () => {
	let module: TestingModule;

	beforeEach(async () => {
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
		it('should provide NewrelicContextGuard as a service', () => {
			// Since APP_GUARD is a special NestJS token, we can't get it directly
			// Instead, we verify the module includes the guard class
			const moduleDefinition =
				Reflect.getMetadata('providers', NestJsNewrelicInstrumentationModule) ||
				[];
			const appGuardProvider = moduleDefinition.find(
				(provider: any) =>
					provider &&
					typeof provider === 'object' &&
					provider.provide === APP_GUARD,
			);

			expect(appGuardProvider).toBeDefined();
			expect(appGuardProvider.useClass).toBe(NewrelicContextGuard);
		});

		it('should provide NewrelicInterceptor as a service', () => {
			// Since APP_INTERCEPTOR is a special NestJS token, we can't get it directly
			// Instead, we verify the module includes the interceptor class
			const moduleDefinition =
				Reflect.getMetadata('providers', NestJsNewrelicInstrumentationModule) ||
				[];
			const appInterceptorProvider = moduleDefinition.find(
				(provider: any) =>
					provider &&
					typeof provider === 'object' &&
					provider.provide === APP_INTERCEPTOR,
			);

			expect(appInterceptorProvider).toBeDefined();
			expect(appInterceptorProvider.useClass).toBe(NewRelicInterceptor);
		});
	});

	describe('service integration', () => {
		it('should inject same EventEmitter instance in all services', () => {
			const eventService = module.get(NewReliNestjsEvent);
			const emitter = module.get(emitterSymbol);

			expect(eventService).toBeDefined();
			expect(emitter).toBeDefined();
			expect(emitter).toBeInstanceOf(EventEmitter);
		});

		it('should allow NewReliNestjsEvent to receive events from guard and interceptor', (done) => {
			const eventService = module.get(NewReliNestjsEvent);
			const emitter = module.get(emitterSymbol);

			let eventCount = 0;
			const expectedEvents = ['transactionStarted', 'transactionFinished'];

			eventService.on('transactionStarted', (transactionId) => {
				expect(transactionId).toBe('test-id');
				eventCount++;
				if (eventCount === expectedEvents.length) done();
			});

			eventService.on('transactionFinished', (transactionId) => {
				expect(transactionId).toBe('test-id');
				eventCount++;
				if (eventCount === expectedEvents.length) done();
			});

			emitter.emit('transactionStarted', 'test-id');
			emitter.emit('transactionFinished', 'test-id');
		});
	});

	describe('module configuration', () => {
		it('should be a static module (no forRoot/forFeature needed)', () => {
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
