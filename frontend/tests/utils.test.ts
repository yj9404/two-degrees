import { test, describe } from 'node:test';
import assert from 'node:assert';
import { cn } from '../lib/utils.ts';

describe('cn utility', () => {
  test('should concatenate basic class names', () => {
    assert.strictEqual(cn('foo', 'bar'), 'foo bar');
  });

  test('should handle conditional classes', () => {
    assert.strictEqual(cn('foo', true && 'bar', false && 'baz'), 'foo bar');
  });

  test('should handle object inputs', () => {
    assert.strictEqual(cn({ foo: true, bar: false, baz: true }), 'foo baz');
  });

  test('should handle array inputs', () => {
    assert.strictEqual(cn(['foo', 'bar'], 'baz'), 'foo bar baz');
  });

  test('should merge tailwind classes correctly', () => {
    // p-2 and p-4 conflict, p-4 should win
    assert.strictEqual(cn('p-2', 'p-4'), 'p-4');

    // px-2 and p-4 conflict (partially), but twMerge handles it
    // Actually, p-4 overrides px-2 if p-4 comes later.
    assert.strictEqual(cn('px-2', 'p-4'), 'p-4');
  });

  test('should handle complex combinations', () => {
    const isActive = true;
    const isDisabled = false;
    assert.strictEqual(
      cn(
        'base-style',
        isActive && 'active-style',
        isDisabled && 'disabled-style',
        { 'extra-class': true },
        ['nested-1', ['nested-2']]
      ),
      'base-style active-style extra-class nested-1 nested-2'
    );
  });

  test('should handle null and undefined values', () => {
    assert.strictEqual(cn('foo', null, undefined, 'bar'), 'foo bar');
  });
});
