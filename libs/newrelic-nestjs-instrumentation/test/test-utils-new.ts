import { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'stream';

export function createMockExecutionContext(
	controllerName = 'TestController',
	handlerName = 'testHandler',
	type = 'http',
): ExecutionContext {
	const mockController = { name: controllerName };
	const mockHandler = { name: handlerName };
	const mockRequest = {
		headers: {
			'x-trace-id': 'test-trace-id',
			newrelic: 'distributed-trace-data',
		},
	};

	return {
		getClass: jest.fn().mockReturnValue(mockController),
		getHandler: jest.fn().mockReturnValue(mockHandler),
		getType: jest.fn().mockReturnValue(type),
		switchToHttp: jest.fn().mockReturnValue({
			getRequest: jest.fn().mockReturnValue(mockRequest),
			getResponse: jest.fn().mockReturnValue({}),
		}),
		switchToRpc: jest.fn(),
		switchToWs: jest.fn(),
		getArgs: jest.fn(),
		getArgByIndex: jest.fn(),
	} as any;
}

export function createMockNewRelicTransaction(traceId = 'test-trace-id') {
	return {
		acceptDistributedTraceHeaders: jest.fn(),
		end: jest.fn(),
		ignore: jest.fn(),
		setAttribute: jest.fn(),
		addAttribute: jest.fn(),
		noticeError: jest.fn(),
		getTraceMetadata: jest.fn().mockReturnValue({ traceId }),
	};
}

export function createMockEventEmitter(): EventEmitter {
	const emitter = new EventEmitter();
	jest.spyOn(emitter, 'emit');
	jest.spyOn(emitter, 'on');
	return emitter;
}

export const delay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));
