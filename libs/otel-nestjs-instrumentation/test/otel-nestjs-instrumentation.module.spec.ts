import { Test, TestingModule } from '@nestjs/testing';
import { OtelNestjsInstrumentationModule } from '../src/otel-nestjs-instrumentation.module';
import { OtelNestjsEvent } from '../src/otel-nestjs-event';
import { InternalContext, emitterSymbol } from '../src/internal';
import { EventEmitter } from 'stream';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
	trace: {
		getActiveSpan: jest.fn(),
		getTracer: jest.fn(() => ({
			startSpan: jest.fn(() => ({
				spanContext: jest.fn(() => ({ traceId: 'test-trace-id' })),
				setStatus: jest.fn(),
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
	},
	SpanStatusCode: {
		OK: 1,
		ERROR: 2,
	},
}));

describe('OtelNestjsInstrumentationModule', () => {
	let module: TestingModule;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			imports: [OtelNestjsInstrumentationModule],
		}).compile();
	});

	afterEach(async () => {
		await module.close();
	});

	it('should be defined', () => {
		expect(module).toBeDefined();
	});

	it('should provide OtelNestjsEvent service', () => {
		const eventService = module.get(OtelNestjsEvent);
		expect(eventService).toBeInstanceOf(OtelNestjsEvent);
	});

	it('should provide InternalContext', () => {
		const internalContext = module.get(InternalContext);
		expect(internalContext).toBeInstanceOf(InternalContext);
	});

	it('should provide EventEmitter with emitterSymbol', () => {
		const emitter = module.get(emitterSymbol);
		expect(emitter).toBeInstanceOf(EventEmitter);
	});

	it('should have the same EventEmitter instance across all providers', () => {
		const eventService = module.get(OtelNestjsEvent);
		const emitter = module.get(emitterSymbol);

		// OtelNestjsEvent extends EventEmitter, so it should be an instance
		expect(emitter).toBeInstanceOf(EventEmitter);
		expect(eventService).toBeInstanceOf(OtelNestjsEvent);

		// Verify they're the same instance by checking events
		const testListener = jest.fn();
		eventService.on('test-event', testListener);
		emitter.emit('test-event', 'data');

		expect(testListener).toHaveBeenCalledWith('data');
	});
});
