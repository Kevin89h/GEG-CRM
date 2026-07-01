import { createCompanyClient } from '@/lib/company';
import TrackingClient from './TrackingClient';

export default async function TrackingPage() {
  const db = await createCompanyClient();

  const { data: shipments } = await (db as any)
    .schema('geg_guinee')
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false });

  return <TrackingClient shipments={shipments ?? []} />;
}
