export type ChatMessage = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

export function isConversationMessage(message: Pick<ChatMessage, 'sender_id' | 'recipient_id'>, userId: string, otherUserId: string): boolean {
  return (message.sender_id === userId && message.recipient_id === otherUserId)
    || (message.sender_id === otherUserId && message.recipient_id === userId)
}

export function appendUniqueMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message]
}
