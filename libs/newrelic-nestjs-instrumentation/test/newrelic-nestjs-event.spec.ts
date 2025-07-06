import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'stream';
import { NewReliNestjsEvent } from '../src/newrelic-nestjs-event';
import { emitterSymbol } from '../src/internal';

describe('NewReliNestjsEvent', () => {
	let service: NewReliNestjsEvent;
	let mockEmitter: EventEmitter;

	beforeEach(async () => {
		mockEmitter = new EventEmitter();
		jest.spyOn(mockEmitter, 'on');

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NewReliNestjsEvent,
				{
					provide: emitterSymbol,
					useValue: mockEmitter,
				},
			],
		}).compile();

		service = module.get<NewReliNestjsEvent>(NewReliNestjsEvent);
	});

	afterEach(() => {
		mockEmitter.removeAllListeners();
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('on method', () => {
		it('should register transactionStarted event listener', () => {
			const listener = jest.fn();

			service.on('transactionStarted', listener);

			expect(mockEmitter.on).toHaveBeenCalledWith(
				'transactionStarted',
				listener,
			);
		});

		it('should register transactionFinished event listener', () => {
			const listener = jest.fn();

			service.on('transactionFinished', listener);

			expect(mockEmitter.on).toHaveBeenCalledWith(
				'transactionFinished',
				listener,
			);
		});

		it('should register transactionStartFailed event listener', () => {
			const listener = jest.fn();

			service.on('transactionStartFailed', listener);

			expect(mockEmitter.on).toHaveBeenCalledWith(
				'transactionStartFailed',
				listener,
			);
		});

		it('should handle generic event listener registration', () => {
			const listener = jest.fn();

			service.on('customEvent' as any, listener);

			expect(mockEmitter.on).toHaveBeenCalledWith('customEvent', listener);
		});
	});

	describe('event listener functionality', () => {
		it('should receive transactionStarted events', (done) => {
			const testTransactionId = 'test-transaction-123';

			service.on('transactionStarted', (transactionId) => {
				expect(transactionId).toBe(testTransactionId);
				done();
			});

			mockEmitter.emit('transactionStarted', testTransactionId);
		});

		it('should receive transactionFinished events', (done) => {
			const testTransactionId = 'test-transaction-456';

			service.on('transactionFinished', (transactionId) => {
				expect(transactionId).toBe(testTransactionId);
				done();
			});

			mockEmitter.emit('transactionFinished', testTransactionId);
		});

		it('should receive transactionStartFailed events with error', (done) => {
			const testTransactionId = 'test-transaction-789';
			const testError = new Error('Test error');

			service.on('transactionStartFailed', (transactionId, error) => {
				expect(transactionId).toBe(testTransactionId);
				expect(error).toBe(testError);
				done();
			});

			mockEmitter.emit('transactionStartFailed', testTransactionId, testError);
		});
	});

	describe('multiple listeners', () => {
		it('should support multiple listeners for the same event', () => {
			const listener1 = jest.fn();
			const listener2 = jest.fn();
			const testTransactionId = 'test-transaction-multi';

			service.on('transactionStarted', listener1);
			service.on('transactionStarted', listener2);

			mockEmitter.emit('transactionStarted', testTransactionId);

			expect(listener1).toHaveBeenCalledWith(testTransactionId);
			expect(listener2).toHaveBeenCalledWith(testTransactionId);
		});
	});

	describe('error handling', () => {
		it('should not throw when emitter throws', () => {
			const badEmitter = new EventEmitter();
			jest.spyOn(badEmitter, 'on').mockImplementation(() => {
				throw new Error('Emitter error');
			});

			const badService = new NewReliNestjsEvent(badEmitter);

			expect(() => badService.on('transactionStarted', jest.fn())).toThrow(
				'Emitter error',
			);
		});
	});
});
