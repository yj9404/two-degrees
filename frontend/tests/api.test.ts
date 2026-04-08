import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setAdminToken, getAdminToken } from '../lib/api.ts';

describe('setAdminToken', () => {
    // Reset global state if possible or ensure tests are isolated
    beforeEach(() => {
        // Since adminToken is a module-level variable, we might need a way to reset it
        // if we want truly isolated tests, but for these simple tests, it should be fine.
        setAdminToken(null as any);

        // Reset global mocks
        (global as any).window = undefined;
        (global as any).document = undefined;
    });

    test('should set the in-memory token', () => {
        const token = 'test-jwt-token';
        setAdminToken(token);
        assert.strictEqual(getAdminToken(), token);
    });

    test('should set a cookie when window is defined', () => {
        const token = 'cookie-token';

        // Mock window and document
        const mockDocument = {
            cookie: ''
        };
        (global as any).window = {};
        (global as any).document = mockDocument;

        setAdminToken(token);

        assert.strictEqual(getAdminToken(), token);
        assert.ok(mockDocument.cookie.includes(`admin_token=${token}`));
        assert.ok(mockDocument.cookie.includes('expires='));
        assert.ok(mockDocument.cookie.includes('path=/'));
    });

    test('should NOT set a cookie when window is undefined', () => {
        const token = 'no-cookie-token';

        // Ensure window is undefined
        (global as any).window = undefined;
        (global as any).document = undefined;

        setAdminToken(token);

        assert.strictEqual(getAdminToken(), token);
        // If it tried to access document.cookie, it would throw an error and fail the test
    });

    test('cookie should have correct expiration (approx 24h)', () => {
        const token = 'expiry-token';

        const mockDocument = {
            cookie: ''
        };
        (global as any).window = {};
        (global as any).document = mockDocument;

        const now = new Date();
        setAdminToken(token);

        // Extract expires from cookie
        const match = mockDocument.cookie.match(/expires=([^;]+)/);
        assert.ok(match, 'Cookie should have an expires attribute');

        const expiryStr = match[1];
        const expiryDate = new Date(expiryStr);

        const diffMs = expiryDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Should be approximately 24 hours (allowing some small delay in execution)
        assert.ok(diffHours > 23.9 && diffHours < 24.1, `Expiry should be ~24h, got ${diffHours}h`);
    });
});
