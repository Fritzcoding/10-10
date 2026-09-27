type SupabaseErrorLike = { message?: string | null }

export function formatSupabaseDataError(error: SupabaseErrorLike): string {
  const message = error.message ?? 'Something went wrong while contacting the database.'

  if (message.includes("public.friend_requests") || message.includes("friend_requests'")) {
    return 'Your database is missing the friend request table. Apply the Supabase migrations, then reload the app.'
  }

  if (message.includes("public.direct_messages") || message.includes("direct_messages'")) {
    return 'Your database is missing the chat table. Apply the Supabase migrations, then reload the app.'
  }

  if (message.includes('profiles.partner_id') || message.includes('profiles.partner_name')) {
    return 'Your database is missing partner profile columns. Apply the latest Supabase migrations, then reload the app.'
  }

  return message
}
