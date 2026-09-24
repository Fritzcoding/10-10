let backgroundMusic: HTMLAudioElement | null = null
let fallbackContext: AudioContext | null = null
let fallbackOscillators: OscillatorNode[] = []

function getBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio('/background_music.mp3')
    backgroundMusic.loop = true
    backgroundMusic.preload = 'auto'
    backgroundMusic.volume = 0.35
  }

  return backgroundMusic
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
        const gain = fallbackContext.createGain()
        gain.gain.value = 0.025
        gain.connect(fallbackContext.destination)

        fallbackOscillators = [261.63, 329.63].map((frequency) => {
          const oscillator = fallbackContext!.createOscillator()
          oscillator.frequency.value = frequency
          oscillator.type = 'sine'
          oscillator.connect(gain)
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
