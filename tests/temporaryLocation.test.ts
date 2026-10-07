import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocationFresh, LOCATION_DURATIONS, locationErrorMessage, validateLocation, validateShareDuration } from '../src/lib/temporaryLocation.ts'

test('duration allows only the bounded share presets', () => {
  assert.deepEqual(LOCATION_DURATIONS, [15, 30, 60])
  assert.equal(validateShareDuration(30), 30)
  assert.throws(() => validateShareDuration(90))
})

test('coordinates and accuracy must be finite and geographically valid', () => {
  assert.deepEqual(validateLocation(25.03, 121.56, 30), { latitude: 25.03, longitude: 121.56, accuracy: 30 })
  for (const values of [[91, 0, 10], [0, 181, 10], [0, 0, -1], [NaN, 0, 10], [0, Infinity, 10], [0, 0, 100001]]) {
    assert.throws(() => validateLocation(...values as [number, number, number]))
  }
})

test('a position is stale after two minutes or when expired', () => {
  const now = new Date('2026-10-07T12:00:00.000Z')
  assert.equal(isLocationFresh('2026-10-07T11:59:00.000Z', '2026-10-07T12:30:00.000Z', now), true)
  assert.equal(isLocationFresh('2026-10-07T11:57:59.000Z', '2026-10-07T12:30:00.000Z', now), false)
  assert.equal(isLocationFresh('2026-10-07T11:59:00.000Z', '2026-10-07T11:59:59.000Z', now), false)
})

test('geolocation errors explain denial, unavailable signal and timeout', () => {
  assert.match(locationErrorMessage(1), /permission/i)
  assert.match(locationErrorMessage(2), /unavailable/i)
  assert.match(locationErrorMessage(3), /timed out/i)
})
