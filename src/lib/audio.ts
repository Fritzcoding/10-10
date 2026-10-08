import { isSupportedBackgroundMusic } from './musicPreferences'

type SavedTrack = { file: Blob; name: string }

let backgroundMusic: HTMLAudioElement | null = null
let fallbackContext: AudioContext | null = null
let fallbackOscillators: OscillatorNode[] = []
let fallbackGain: GainNode | null = null
let chordTimer: number | undefined
let backgroundMusicVolume = 0.28
let customTrackUrl: string | null = null

function getBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio()
    backgroundMusic.loop = true
    backgroundMusic.preload = 'auto'
    backgroundMusic.volume = backgroundMusicVolume
  }
  return backgroundMusic
}

function openMusicDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('couple-app-music', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('tracks')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readSavedTrack(): Promise<SavedTrack | null> {
  if (!('indexedDB' in window)) return null
  const database = await openMusicDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction('tracks').objectStore('tracks').get('background:v1')
    request.onsuccess = () => { database.close(); resolve((request.result as SavedTrack | undefined) ?? null) }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}

async function writeSavedTrack(track: SavedTrack | null) {
  const database = await openMusicDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('tracks', 'readwrite')
    const store = transaction.objectStore('tracks')
    if (track) store.put(track, 'background:v1')
    else store.delete('background:v1')
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
  })
}

function applyCustomTrack(file: Blob) {
  const audio = getBackgroundMusic()
  const wasPlaying = !audio.paused || fallbackOscillators.length > 0
  if (customTrackUrl) URL.revokeObjectURL(customTrackUrl)
  customTrackUrl = URL.createObjectURL(file)
  audio.src = customTrackUrl
  if (wasPlaying) {
    stopAmbientLoop()
    void audio.play().catch(() => startAmbientLoop())
  }
}

export async function getBackgroundMusicName() {
  return (await readSavedTrack())?.name ?? 'Soft ambient loop'
}

export async function setCustomBackgroundMusic(file: File) {
  if (!isSupportedBackgroundMusic(file)) throw new Error('Choose an audio file smaller than 25 MB.')
  await writeSavedTrack({ file, name: file.name })
  applyCustomTrack(file)
}

export async function resetBackgroundMusic() {
  await writeSavedTrack(null)
  const audio = getBackgroundMusic()
  const wasPlaying = !audio.paused || fallbackOscillators.length > 0
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  if (customTrackUrl) URL.revokeObjectURL(customTrackUrl)
  customTrackUrl = null
  if (wasPlaying) startAmbientLoop()
}

export function getBackgroundMusicVolume() {
  return backgroundMusicVolume
}

export function setBackgroundMusicVolume(volume: number) {
  backgroundMusicVolume = Math.min(1, Math.max(0, volume))
  if (backgroundMusic) backgroundMusic.volume = backgroundMusicVolume
  if (fallbackGain) fallbackGain.gain.value = backgroundMusicVolume * 0.045
}

const ambientChords = [
  [130.81, 164.81, 196, 246.94],
  [110, 130.81, 164.81, 196],
  [87.31, 110, 130.81, 164.81],
  [98, 123.47, 146.83, 185],
]

async function startAmbientLoop() {
  try {
    fallbackContext ??= new AudioContext()
    await fallbackContext.resume()
    if (fallbackOscillators.length) return
    const filter = fallbackContext.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    fallbackGain = fallbackContext.createGain()
    fallbackGain.gain.value = backgroundMusicVolume * 0.045
    filter.connect(fallbackGain)
    fallbackGain.connect(fallbackContext.destination)
    const now = fallbackContext.currentTime
    fallbackOscillators = ambientChords[0].map((frequency, index) => {
      const oscillator = fallbackContext!.createOscillator()
      oscillator.type = index === 0 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = index === 3 ? -4 : 0
      oscillator.connect(filter)
      oscillator.start(now)
      return oscillator
    })
    let chord = 0
    chordTimer = window.setInterval(() => {
      chord = (chord + 1) % ambientChords.length
      const at = fallbackContext?.currentTime ?? 0
      ambientChords[chord].forEach((frequency, index) => fallbackOscillators[index]?.frequency.setTargetAtTime(frequency, at, 2.2))
    }, 8000)
  } catch {
    // Music is optional; the app remains usable when audio is unavailable.
  }
}

function stopAmbientLoop() {
  if (chordTimer !== undefined) window.clearInterval(chordTimer)
  chordTimer = undefined
  fallbackOscillators.forEach((oscillator) => oscillator.stop())
  fallbackOscillators = []
  fallbackGain = null
}

export async function startBackgroundMusic() {
  const audio = getBackgroundMusic()
  try {
    const saved = await readSavedTrack()
    if (saved) applyCustomTrack(saved.file)
    if (audio.src) {
      try { await audio.play(); stopAmbientLoop(); return }
      catch { /* Fall back to the soft ambient loop when a chosen file cannot play. */ }
    }
  } catch {
    // Device storage can be unavailable; use the built-in loop instead.
  }
  await startAmbientLoop()
}

export function stopBackgroundMusic() {
  backgroundMusic?.pause()
  stopAmbientLoop()
}
