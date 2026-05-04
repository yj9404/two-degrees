import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { authenticateUser } from '../lib/api.ts';

describe('authenticateUser API', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('should make a POST request with correct payload and return data', async () => {
        const mockResponse = { user: { id: 1 }, token: 'abc' };
        let fetchCalled = false;

        global.fetch = async (input, init) => {
            fetchCalled = true;
            assert.strictEqual(input, 'http://localhost:8000/api/users/auth');
            assert.strictEqual(init?.method, 'POST');
            assert.strictEqual(init?.body, JSON.stringify({ name: '홍길동', contact: '01012345678' }));
            assert.strictEqual((init?.headers as Record<string, string>)['Content-Type'], 'application/json');

            return {
                ok: true,
                status: 200,
                json: async () => mockResponse,
            } as Response;
        };

        const result = await authenticateUser({ name: '홍길동', contact: '01012345678' });
        assert.ok(fetchCalled);
        assert.deepStrictEqual(result, mockResponse);
    });

    test('should throw an error on non-ok response with string detail', async () => {
        global.fetch = async () => {
            return {
                ok: false,
                status: 400,
                json: async () => ({ detail: 'Invalid contact format' }),
            } as Response;
        };

        try {
            await authenticateUser({ name: '홍길동', contact: 'invalid' });
            assert.fail('Should have thrown an error');
        } catch (err: any) {
            assert.strictEqual(err.message, 'Invalid contact format');
        }
    });
});
