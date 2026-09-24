let backgroundMusic: HTMLAudioElement | null = null
let fallbackContext: AudioContext | null = null
let fallbackOscillators: OscillatorNode[] = []
let fallbackGain: GainNode | null = null
let backgroundMusicVolume = 0.35

function getBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio('/background_music.mp3')
    backgroundMusic.loop = true
    backgroundMusic.preload = 'auto'
    backgroundMusic.volume = backgroundMusicVolume
  }

  return backgroundMusic
}

export function getBackgroundMusicVolume() {
  return backgroundMusicVolume
}

export function setBackgroundMusicVolume(volume: number) {
  const normalizedVolume = Math.min(1, Math.max(0, volume))
  backgroundMusicVolume = normalizedVolume

  if (backgroundMusic) backgroundMusic.volume = normalizedVolume
  if (fallbackGain) fallbackGain.gain.value = normalizedVolume * 0.07
}

export async function startBackgroundMusic() {
  const audio = getBackgroundMusic()

  try {
    await audio.play()
  } catch {
    // Keep the interaction useful when the optional MP3 is not bundled.
    try {
      fallbackContext ??= new AudioContext()
      await fallbackContext.resume()

      if (fallbackOscillators.length === 0) {
        fallbackGain = fallbackContext.createGain()
        fallbackGain.gain.value = backgroundMusicVolume * 0.07
        fallbackGain.connect(fallbackContext.destination)

        fallbackOscillators = [261.63, 329.63].map((frequency) => {
          const oscillator = fallbackContext!.createOscillator()
          oscillator.frequency.value = frequency
          oscillator.type = 'sine'
          oscillator.connect(fallbackGain!)
          oscillator.start()
          return oscillator
        })
      }
    } catch {
      // Audio is optional; the birthday flow still continues without it.
    }
  }
}

export function stopBackgroundMusic() {
  backgroundMusic?.pause()
  fallbackOscillators.forEach((oscillator) => oscillator.stop())
  fallbackOscillators = []
}
