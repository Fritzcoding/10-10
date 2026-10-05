export type ConversationPlayer = 'requester' | 'recipient'
export type LieDetectorRound = { statements: [string, string, string]; lieIndex: number }

export function validateConversationAnswer(value: string): string {
  const answer = value.trim()
  if (!answer || answer.length > 1000) throw new Error('Answer must be between 1 and 1000 characters.')
  return answer
}

export function validateWhoIsMoreLikelyAnswer(value: string): 'me' | 'partner' {
  if (value !== 'me' && value !== 'partner') throw new Error('Choose you or your partner.')
  return value
}

export function validateLieDetectorRound(values: readonly string[], lieIndex: number): LieDetectorRound {
  if (values.length !== 3) throw new Error('Add exactly three statements.')
  const statements = values.map((value) => value.trim())
  if (statements.some((value) => !value || value.length > 280)) throw new Error('Each statement must be between 1 and 280 characters.')
  if (new Set(statements.map((value) => value.toLocaleLowerCase())).size !== 3) throw new Error('Statements must be different.')
  if (!Number.isInteger(lieIndex) || lieIndex < 0 || lieIndex > 2) throw new Error('Choose which statement is the lie.')
  return { statements: statements as [string, string, string], lieIndex }
}

export function getLieDetectorReveal(statements: readonly string[], lieIndex: number, guessIndex: number) {
  const round = validateLieDetectorRound(statements, lieIndex)
  if (!Number.isInteger(guessIndex) || guessIndex < 0 || guessIndex > 2) throw new Error('Choose one of the three statements as your guess.')
  return {
    statements: round.statements.map((text, index) => ({ text, isLie: index === round.lieIndex })),
    guessWasCorrect: round.lieIndex === guessIndex,
  }
}

export function validateDescribeWord(word: string, forbidden: readonly string[]): { word: string; forbidden: string[] } {
  const cleanWord = word.trim()
  if (!cleanWord || cleanWord.length > 80) throw new Error('Choose a word between 1 and 80 characters.')
  const cleanForbidden = forbidden.map((value) => value.trim()).filter(Boolean)
  if (cleanForbidden.length > 5 || cleanForbidden.some((value) => value.length > 40)) throw new Error('Use up to five forbidden words, each no longer than 40 characters.')
  if (new Set(cleanForbidden.map((value) => value.toLocaleLowerCase())).size !== cleanForbidden.length) throw new Error('Forbidden words must be different.')
  return { word: cleanWord, forbidden: cleanForbidden }
}

export function getConversationRoundCreator<T>(requester: T, recipient: T, roundNumber: number): T {
  if (roundNumber !== 1 && roundNumber !== 2) throw new Error('Round must be 1 or 2.')
  return roundNumber === 1 ? requester : recipient
}

export function canRevealConversationRound(submissionCount: number, deadlineAt: string | null, now = new Date()): boolean {
  return submissionCount >= 2 || Boolean(deadlineAt && new Date(deadlineAt).getTime() <= now.getTime())
}

export function describeGuessMatches(guess: string, answer: string): boolean {
  return Boolean(guess.trim()) && guess.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase()
}
