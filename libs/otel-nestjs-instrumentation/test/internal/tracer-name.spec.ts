/**
 * Tests for tracer-name utility
 */

import fs from 'fs';
import path from 'path';

// Mock fs and path before importing the module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('tracer-name', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should use fallback name when JSON is invalid', () => {
		mockPath.resolve.mockReturnValue('/mock/path/package.json');
		mockFs.readFileSync.mockReturnValue('invalid json');

		jest.resetModules();
		const { tracerName } = require('../../src/internal/tracer-name');

		expect(tracerName).toBe('test-otel-app');
	});
});
