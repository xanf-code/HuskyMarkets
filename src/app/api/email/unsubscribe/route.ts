import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

function verifyToken(uid: string, token: string): boolean {
  try {
    return verifyUnsubscribeToken(uid, token);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  const token = req.nextUrl.searchParams.get('token');
  if (!uid || !token || !verifyToken(uid, token)) {
    return new NextResponse('Invalid unsubscribe link', { status: 400 });
  }

  return new NextResponse(
    '<html><body style="font-family:sans-serif;max-width:480px;margin:2rem auto"><h2>Unsubscribe from market emails?</h2><p>You will stop receiving HuskyMarkets market resolution emails.</p><form method="post"><button type="submit">Unsubscribe</button></form></body></html>',
    {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    },
  );
}

// RFC 8058 one-click POST unsubscribe
export async function POST(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  const token = req.nextUrl.searchParams.get('token');
  if (!uid || !token || !verifyToken(uid, token)) {
    return new NextResponse('Invalid', { status: 400 });
  }
  const supabase = createAdminClient();
  await supabase.from('profiles').update({ email_notifications: false }).eq('id', uid);
  return new NextResponse('OK');
}
