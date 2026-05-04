import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setAdminToken, getAdminToken, initAdminTokenFromCookie, getUserStats } from '../lib/api.ts';

describe('Admin Token Management', () => {
    beforeEach(() => {
        // Reset state
        setAdminToken(null);

        // Reset global mocks
        (global as any).window = undefined;
        (global as any).document = undefined;
    });

    describe('setAdminToken', () => {
        test('should set the in-memory token', () => {
            const token = 'test-jwt-token';
            setAdminToken(token);
            assert.strictEqual(getAdminToken(), token);
        });

        test('should set a secure cookie when window is defined and protocol is https', () => {
            const token = 'cookie-token';

            const mockDocument = {
                cookie: ''
            };
            (global as any).window = {
                location: { protocol: 'https:' }
            };
            (global as any).document = mockDocument;

            setAdminToken(token);

            assert.strictEqual(getAdminToken(), token);
            assert.ok(mockDocument.cookie.includes(`admin_token=${token}`));
            assert.ok(mockDocument.cookie.includes('expires='));
            assert.ok(mockDocument.cookie.includes('path=/'));
            assert.ok(mockDocument.cookie.includes('SameSite=Lax'));
            assert.ok(mockDocument.cookie.includes('Secure'));
        });

        test('should NOT set Secure flag when protocol is http', () => {
            const token = 'http-token';

            const mockDocument = {
                cookie: ''
            };
            (global as any).window = {
                location: { protocol: 'http:' }
            };
            (global as any).document = mockDocument;

            setAdminToken(token);

            assert.ok(mockDocument.cookie.includes(`admin_token=${token}`));
            assert.ok(!mockDocument.cookie.includes('Secure'));
        });

        test('should clear the token and cookie when called with null', () => {
            // First set a token
            const mockDocument = {
                cookie: 'admin_token=old-token'
            };
            (global as any).window = {
                location: { protocol: 'https:' }
            };
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
        });
    });

    describe('initAdminTokenFromCookie', () => {
        test('should restore the token from document.cookie', () => {
            const token = 'restored-token';
            (global as any).document = {
                cookie: `other_cookie=123; admin_token=${token}; another=456`
            };

            initAdminTokenFromCookie();

            assert.strictEqual(getAdminToken(), token);
        });

        test('should handle missing cookie gracefully', () => {
            (global as any).document = {
                cookie: 'other_cookie=123'
            };

            initAdminTokenFromCookie();

            assert.strictEqual(getAdminToken(), null);
        });

        test('should do nothing when document is undefined', () => {
            (global as any).document = undefined;

            // This should not throw
            initAdminTokenFromCookie();

            assert.strictEqual(getAdminToken(), null);
        });
    });

    test('cookie should have correct expiration (approx 24h)', () => {
        const token = 'expiry-token';

        const mockDocument = {
            cookie: ''
        };
        (global as any).window = {
            location: { protocol: 'https:' }
        };
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

describe('API Functions', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('getUserStats', () => {
        test('should return user stats on success', async () => {
            const mockStats = {
                total_active: 100,
                total_users: 150,
                total_matchings: 50,
                male_active: 60,
                female_active: 40
            };
            global.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockStats
            } as Response);

            const result = await getUserStats();
            assert.deepStrictEqual(result, mockStats);
        });

        test('should throw an error when the API call fails', async () => {
            global.fetch = async () => ({
                ok: false,
                status: 500,
                json: async () => ({ detail: 'Internal Server Error' })
            } as Response);

            await assert.rejects(
                async () => { await getUserStats(); },
                (err: Error) => {
                    assert.strictEqual(err.message, 'Internal Server Error');
                    return true;
                }
            );
        });
    });
});
