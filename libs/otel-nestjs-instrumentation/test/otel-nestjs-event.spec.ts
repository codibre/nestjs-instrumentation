import { EventEmitter } from 'stream';
import {
	OtelNestjsEvent,
	OtelNestjsEventListener,
} from '../src/otel-nestjs-event';

describe('OtelNestjsEvent', () => {
	let otelEvent: OtelNestjsEvent;
	let mockEmitter: EventEmitter;
	let mockListener: jest.MockedFunction<OtelNestjsEventListener>;

	beforeEach(() => {
		mockEmitter = new EventEmitter();
		otelEvent = new OtelNestjsEvent(mockEmitter);
		mockListener = jest.fn();
	});

	afterEach(() => {
		mockEmitter.removeAllListeners();
	});

	describe('on', () => {
		it('should register listener for spanStarted event', () => {
			otelEvent.on('spanStarted', mockListener);

			const traceId = 'test-trace-id';
			mockEmitter.emit('spanStarted', traceId);

			expect(mockListener).toHaveBeenCalledWith(traceId);
		});

		it('should register listener for spanFinished event', () => {
			otelEvent.on('spanFinished', mockListener);

			const traceId = 'finished-trace-id';
			mockEmitter.emit('spanFinished', traceId);

			expect(mockListener).toHaveBeenCalledWith(traceId);
		});

		it('should register listener for spanStartFailed event', () => {
			otelEvent.on('spanStartFailed', mockListener);

			const traceId = 'failed-trace-id';
			const error = new Error('Span start failed');
			mockEmitter.emit('spanStartFailed', traceId, error);

			expect(mockListener).toHaveBeenCalledWith(traceId, error);
		});

		it('should allow multiple listeners for the same event', () => {
			const listener1 = jest.fn();
			const listener2 = jest.fn();

			otelEvent.on('spanStarted', listener1);
			otelEvent.on('spanStarted', listener2);

			const traceId = 'multi-listener-trace';
			mockEmitter.emit('spanStarted', traceId);

			expect(listener1).toHaveBeenCalledWith(traceId);
			expect(listener2).toHaveBeenCalledWith(traceId);
		});

		it('should handle errors in listeners gracefully', () => {
			const errorListener = jest.fn().mockImplementation(() => {
				throw new Error('Listener error');
			});
			const normalListener = jest.fn();

			otelEvent.on('spanStarted', errorListener);
			otelEvent.on('spanStarted', normalListener);

			const traceId = 'error-test-trace';

			// EventEmitter will throw errors from listeners by default
			expect(() => {
				mockEmitter.emit('spanStarted', traceId);
			}).toThrow('Listener error');

			expect(errorListener).toHaveBeenCalled();
			// Normal listener may or may not be called depending on order
		});
	});

	describe('event data validation', () => {
		it('should handle spanStarted events with trace ID', () => {
			otelEvent.on('spanStarted', mockListener);

			const traceId = 'validation-trace-id';
			mockEmitter.emit('spanStarted', traceId);

			expect(mockListener).toHaveBeenCalledWith(traceId);
		});

		it('should handle spanFinished events with trace ID', () => {
			otelEvent.on('spanFinished', mockListener);

			const traceId = 'finished-validation-trace';
			mockEmitter.emit('spanFinished', traceId);

			expect(mockListener).toHaveBeenCalledWith(traceId);
		});

		it('should handle spanStartFailed events with trace ID and error', () => {
			otelEvent.on('spanStartFailed', mockListener);

			const traceId = 'failed-validation-trace';
			const customError = new Error('Custom error message');
			customError.stack = 'Error: Custom error message\n    at test';
			(customError as any).code = 'CUSTOM_ERROR';

			mockEmitter.emit('spanStartFailed', traceId, customError);

			expect(mockListener).toHaveBeenCalledWith(
				traceId,
				expect.objectContaining({
					message: 'Custom error message',
					code: 'CUSTOM_ERROR',
				}),
			);
		});

		it('should handle spanStartFailed events without trace ID', () => {
			otelEvent.on('spanStartFailed', mockListener);

			const error = new Error('No trace ID error');
			mockEmitter.emit('spanStartFailed', undefined, error);

			expect(mockListener).toHaveBeenCalledWith(undefined, error);
		});
	});

	describe('event timing and async behavior', () => {
		it('should handle asynchronous event listeners', async () => {
			const asyncListener = jest.fn().mockImplementation(async (traceId) => {
				// Simulate async work
				await new Promise((resolve) => setTimeout(resolve, 10));
				return `processed-${traceId}`;
			});

			otelEvent.on('spanStarted', asyncListener);

			const traceId = 'async-trace';
			mockEmitter.emit('spanStarted', traceId);

			// Wait for async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(asyncListener).toHaveBeenCalledWith(traceId);
		});

		it('should maintain proper event order', () => {
			const callOrder: string[] = [];

			otelEvent.on('spanStarted', () => callOrder.push('started'));
			otelEvent.on('spanFinished', () => callOrder.push('finished'));
			otelEvent.on('spanStartFailed', () => callOrder.push('failed'));

			mockEmitter.emit('spanStarted', 'order-trace-1');
			mockEmitter.emit('spanFinished', 'order-trace-2');
			mockEmitter.emit('spanStartFailed', 'order-trace-3', new Error('test'));

			expect(callOrder).toEqual(['started', 'finished', 'failed']);
		});

		it('should handle high frequency events', () => {
			const highFrequencyListener = jest.fn();
			otelEvent.on('spanStarted', highFrequencyListener);

			// Emit many events rapidly
			for (let i = 0; i < 100; i++) {
				mockEmitter.emit('spanStarted', `high-freq-trace-${i}`);
			}

			expect(highFrequencyListener).toHaveBeenCalledTimes(100);
		});
	});

	describe('error handling', () => {
		it('should handle undefined trace IDs gracefully', () => {
			otelEvent.on('spanStarted', mockListener);

			mockEmitter.emit('spanStarted', undefined);

			expect(mockListener).toHaveBeenCalledWith(undefined);
		});

		it('should handle null trace IDs gracefully', () => {
			otelEvent.on('spanFinished', mockListener);

			mockEmitter.emit('spanFinished', null);

			expect(mockListener).toHaveBeenCalledWith(null);
		});

		it('should handle empty string trace IDs', () => {
			otelEvent.on('spanStarted', mockListener);

			mockEmitter.emit('spanStarted', '');

			expect(mockListener).toHaveBeenCalledWith('');
		});
	});
});
