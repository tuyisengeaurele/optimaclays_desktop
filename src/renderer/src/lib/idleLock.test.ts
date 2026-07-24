import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasBeenIdleTooLong, IDLE_LIMIT_MS } from './idleLock'

test('not idle when the limit has not been reached', () => {
  const now = 1_000_000
  assert.equal(hasBeenIdleTooLong(now - (IDLE_LIMIT_MS - 1), now), false)
})

test('idle exactly at the limit', () => {
  const now = 1_000_000
  assert.equal(hasBeenIdleTooLong(now - IDLE_LIMIT_MS, now), true)
})

test('idle well past the limit', () => {
  const now = 1_000_000
  assert.equal(hasBeenIdleTooLong(now - IDLE_LIMIT_MS * 2, now), true)
})

test('respects a custom limit', () => {
  const now = 1_000_000
  assert.equal(hasBeenIdleTooLong(now - 5000, now, 10_000), false)
  assert.equal(hasBeenIdleTooLong(now - 10_000, now, 10_000), true)
})
