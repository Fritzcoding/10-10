export const MAX_BACKGROUND_MUSIC_BYTES = 25 * 1024 * 1024

export function isSupportedBackgroundMusic(file: Pick<File, 'type' | 'size'>) {
  return file.type.startsWith('audio/') && file.size > 0 && file.size <= MAX_BACKGROUND_MUSIC_BYTES
}
