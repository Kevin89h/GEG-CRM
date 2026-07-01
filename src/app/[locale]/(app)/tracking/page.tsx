import { createCompanyClient } from '@/lib/company'
import TrackingClient from './TrackingClient'

export default async function TrackingPage() {
  const { db, schema } = await createCompanyClient()

  const { data: shipments, error } = await db
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error('Tracking fetch error:', error.message)

  return <TrackingClient shipments={shipments ?? []} schema={schema} />
}
