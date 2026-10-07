export const LOCATION_DURATIONS = [15, 30, 60] as const
export const LOCATION_STALE_AFTER_MS = 2 * 60 * 1000

export function validateShareDuration(value: number): typeof LOCATION_DURATIONS[number] {
  if (!LOCATION_DURATIONS.some((duration) => duration === value)) throw new Error('Choose a 15, 30, or 60 minute share.')
  return value as typeof LOCATION_DURATIONS[number]
}

export function validateLocation(latitude: number, longitude: number, accuracy: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude must be between -90 and 90.')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude must be between -180 and 180.')
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000) throw new Error('Location accuracy is invalid.')
  return { latitude, longitude, accuracy }
}

export function isLocationFresh(updatedAt: string, expiresAt: string, now = new Date()): boolean {
  const update = Date.parse(updatedAt)
  return Number.isFinite(update) && update <= now.getTime() && now.getTime() - update <= LOCATION_STALE_AFTER_MS && Date.parse(expiresAt) > now.getTime()
}

export function locationErrorMessage(code: number): string {
  if (code === 1) return 'Location permission was denied. No location was shared.'
  if (code === 2) return 'Your location is unavailable. No new location was shared.'
  if (code === 3) return 'Getting your location timed out. No new location was shared.'
  return 'Location sharing is unavailable in this browser.'
}
