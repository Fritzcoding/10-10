import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PartnerStatusProps = { userId?: string }
type PartnerDetails = { partnerId: string | null; partnerName: string | null }

function getMetadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  const value = keys.map((key) => metadata?.[key]).find((item) => typeof item === 'string')
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function loadPartnerDetails(userId?: string): Promise<PartnerDetails> {
  if (!supabase || !userId) return { partnerId: null, partnerName: null }

  const { data: userData } = await supabase.auth.getUser()
  const metadata = userData.user?.user_metadata as Record<string, unknown> | undefined
  const metadataPartnerId = getMetadataValue(metadata, ['partner_id', 'partnerId'])
  const metadataPartnerName = getMetadataValue(metadata, ['partner_name', 'partnerName'])
  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id, partner_name')
    .eq('id', userId)
    .maybeSingle()
  const profileData = profile as { partner_id?: string | null; partner_name?: string | null } | null

  return {
    partnerId: metadataPartnerId ?? profileData?.partner_id ?? null,
    partnerName: metadataPartnerName ?? profileData?.partner_name ?? null,
  }
}

function PartnerStatus({ userId }: PartnerStatusProps) {
  const [partner, setPartner] = useState<PartnerDetails>({ partnerId: null, partnerName: null })

  useEffect(() => {
    let isMounted = true
    loadPartnerDetails(userId).then((details) => {
      if (isMounted) setPartner(details)
    })
    return () => {
      isMounted = false
    }
  }, [userId])

  const label = partner.partnerId
    ? `Paired with ${partner.partnerName ?? 'your partner'}`
    : 'Not Paired Yet'

  return (
    <div className="partner-status" aria-live="polite">
      <span className="partner-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export default PartnerStatus
