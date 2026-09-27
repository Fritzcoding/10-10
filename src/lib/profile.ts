import { supabase } from './supabase'

type AuthProfile = {
  id: string
  email?: string
  user_metadata?: { display_name?: unknown }
}

export async function ensureCurrentProfile(user: AuthProfile) {
  if (!supabase) return { profile: null, error: new Error('Supabase is not configured.') }

  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('display_uid')
    .eq('id', user.id)
    .maybeSingle()
  if (lookupError) return { profile: null, error: lookupError }
  if (existing) return { profile: existing, error: null }

  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email ?? '', display_name: displayName }, { onConflict: 'id' })
    .select('display_uid')
    .single()
  return { profile: created, error: createError }
}
