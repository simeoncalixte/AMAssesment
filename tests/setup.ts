// Global test setup
import 'jest';
import listenMock from '../mock-server';

beforeAll(() => {
    listenMock();
});

afterEach(() => {
  jest.clearAllMocks();
});