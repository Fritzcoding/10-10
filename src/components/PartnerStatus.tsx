import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pairedLabel } from '../lib/profileSocial'

type PartnerStatusProps = { userId?: string }
type PartnerDetails = { partnerId: string | null; partnerName: string | null }

async function loadPartnerDetails(userId?: string): Promise<PartnerDetails> {
  if (!supabase || !userId) return { partnerId: null, partnerName: null }
  const { data } = await supabase.rpc('get_couple_partner')
  const profile = Array.isArray(data) ? data[0] as { id?: string; display_name?: string | null; email?: string | null } | undefined : undefined
  return { partnerId: profile?.id ?? null, partnerName: profile?.display_name ?? profile?.email ?? null }
}

function PartnerStatus({ userId }: PartnerStatusProps) {
  const [partner, setPartner] = useState<PartnerDetails>({ partnerId: null, partnerName: null })

  useEffect(() => {
    let isMounted = true
    loadPartnerDetails(userId).then((details) => {
      if (isMounted) setPartner(details)
    })
    if (!supabase || !userId) return () => { isMounted = false }
    const channel = supabase.channel(`partner-status-${userId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
      void loadPartnerDetails(userId).then((details) => { if (isMounted) setPartner(details) })
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') void loadPartnerDetails(userId).then((details) => { if (isMounted) setPartner(details) })
    })
    return () => {
      isMounted = false
      void supabase?.removeChannel(channel)
    }
  }, [userId])

  const label = pairedLabel(partner.partnerId, partner.partnerName)

  return (
    <div className="partner-status" aria-live="polite">
      <span className="partner-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export default PartnerStatus
