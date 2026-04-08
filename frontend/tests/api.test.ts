import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setAdminToken, getAdminToken } from '../lib/api.ts';

describe('setAdminToken', () => {
    beforeEach(() => {
        // Reset state
        setAdminToken(null);

        // Reset global mocks
        (global as any).window = undefined;
        (global as any).document = undefined;
    });

    test('should set the in-memory token', () => {
        const token = 'test-jwt-token';
        setAdminToken(token);
        assert.strictEqual(getAdminToken(), token);
    });

    test('should set a secure cookie when window is defined', () => {
        const token = 'cookie-token';

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
        assert.ok(mockDocument.cookie.includes('SameSite=Lax'));
        assert.ok(mockDocument.cookie.includes('Secure'));
    });

    test('should clear the token and cookie when called with null', () => {
        // First set a token
        const mockDocument = {
            cookie: 'admin_token=old-token'
        };
        (global as any).window = {};
        (global as any).document = mockDocument;
        setAdminToken('initial-token');

        // Now clear it
        setAdminToken(null);

        assert.strictEqual(getAdminToken(), null);
        assert.ok(mockDocument.cookie.includes('Max-Age=0'));
        assert.ok(mockDocument.cookie.includes('admin_token=;'));
    });

    test('should NOT set a cookie when window is undefined', () => {
        const token = 'no-cookie-token';

        (global as any).window = undefined;
        (global as any).document = undefined;

        setAdminToken(token);

        assert.strictEqual(getAdminToken(), token);
        // Test passes if no error is thrown by accessing document
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

        const match = mockDocument.cookie.match(/expires=([^;]+)/);
        assert.ok(match, 'Cookie should have an expires attribute');

        const expiryStr = match[1];
        const expiryDate = new Date(expiryStr);

        const diffMs = expiryDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        assert.ok(diffHours > 23.9 && diffHours < 24.1, `Expiry should be ~24h, got ${diffHours}h`);
    });
});
