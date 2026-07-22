// Server-only: never import this from client components
import { createAdminClient } from '@/lib/supabase/admin';
import { buildResolutionEmail } from './templates';
import type { Database } from '@/lib/database.types';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type ClaimedNotification = Pick<
  NotificationRow,
  'id' | 'user_id' | 'type' | 'market_id' | 'payload'
>;

type ProfileMap = Map<string, Pick<ProfileRow, 'email' | 'email_notifications'>>;

const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
const CHUNK_SIZE = 100;

export async function sendResolutionEmails(marketId: string): Promise<void> {
  const supabase = createAdminClient();

  // Claim pending rows atomically: pending → sending
  const { data: claimed } = await supabase
    .from('notifications')
    .update({ email_status: 'sending' })
    .eq('market_id', marketId)
    .eq('email_status', 'pending')
    .select('id, user_id, type, market_id, payload');

  if (!claimed || claimed.length === 0) {
    return;
  }

  // Fetch email and preference for each unique user
  const userIds = [...new Set((claimed as ClaimedNotification[]).map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, email_notifications')
    .in('id', userIds);

  const profileMap: ProfileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { email: p.email, email_notifications: p.email_notifications }]),
  );

  // Partition: opted-out users → skipped, the rest → to send
  const skipped: ClaimedNotification[] = [];
  const toSend: ClaimedNotification[] = [];

  for (const row of claimed as ClaimedNotification[]) {
    const profile = profileMap.get(row.user_id);
    if (profile?.email_notifications === false) {
      skipped.push(row);
    } else {
      toSend.push(row);
    }
  }

  // Mark skipped rows immediately
  const skippedIds = skipped.map((r) => r.id);
  if (skippedIds.length > 0) {
    await supabase
      .from('notifications')
      .update({ email_status: 'skipped' })
      .in('id', skippedIds);
  }

  // Graceful local-dev degradation: no API key → skip everything
  if (!process.env.RESEND_API_KEY) {
    const remainingIds = toSend.map((r) => r.id);
    if (remainingIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ email_status: 'skipped' })
        .in('id', remainingIds);
    }
    return;
  }

  // Build email objects for the Resend batch endpoint
  const emails = toSend.map((row) => {
    const profile = profileMap.get(row.user_id)!;
    const { subject, html, headers } = buildResolutionEmail(
      {
        type: row.type,
        payload: row.payload as Record<string, unknown>,
        market_id: row.market_id,
      },
      row.user_id,
    );
    return {
      from: 'noreply@huskymarket.lol',
      to: profile.email,
      subject,
      html,
      headers,
    };
  });

  // Send in chunks of up to 100 (Resend batch limit)
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const chunkIds = toSend.slice(i, i + CHUNK_SIZE).map((r) => r.id);

    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        await supabase
          .from('notifications')
          .update({ email_status: 'sent', email_sent_at: new Date().toISOString() })
          .in('id', chunkIds);
      } else {
        await supabase
          .from('notifications')
          .update({ email_status: 'failed' })
          .in('id', chunkIds);
      }
    } catch {
      await supabase
        .from('notifications')
        .update({ email_status: 'failed' })
        .in('id', chunkIds);
    }
  }
}
