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
    assert.strictEqual(cn('p-2', 'p-4'), 'p-4');
    assert.strictEqual(cn('px-2', 'p-4'), 'p-4');
  });

  test('should handle null and undefined values', () => {
    assert.strictEqual(cn('foo', null, undefined, 'bar'), 'foo bar');
  });
});
