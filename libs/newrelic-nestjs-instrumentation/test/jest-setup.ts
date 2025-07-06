import 'jest-callslike';
import 'jest-extended';

const matchers = require('jest-extended');
expect.extend(matchers);
jest.spyOn(console, 'error').mockImplementation(() => undefined);
afterEach(() => {
	jest.restoreAllMocks();
	jest.clearAllMocks();
});
