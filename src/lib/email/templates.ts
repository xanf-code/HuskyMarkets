import { buildUnsubscribeToken } from './unsubscribe-token';

// Notification row shape (subset we need for emails)
interface NotificationForEmail {
  type: string;
  payload: Record<string, unknown>;
  market_id: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSubject(notification: NotificationForEmail): string {
  const { type, payload } = notification;
  const result = String(payload.result ?? '');
  const role = String(payload.role ?? '');

  if (type === 'market_approved') return 'Your market was approved and is now live!';
  if (type === 'market_rejected') return 'Your market was not approved';

  if (type === 'market_resolved') {
    if (result === 'won') return 'You won on HuskyMarkets! 🎉';
    if (result === 'lost') return 'Market resolved on HuskyMarkets';
    if (result === 'refunded') return 'Stakes refunded on HuskyMarkets';
    if (role === 'creator') return 'Your market has resolved';
  }

  if (type === 'market_voided') {
    if (role === 'bettor') return 'Your stake was refunded';
    if (role === 'creator') return 'Your market was voided';
  }

  return 'HuskyMarkets notification';
}

function buildBodyCopy(notification: NotificationForEmail): string {
  const { type, payload } = notification;
  const market_title = escapeHtml(String(payload.market_title ?? 'a market'));
  const amount = Number(payload.amount ?? 0);
  const refund = Number(payload.refund ?? 0);
  const result = String(payload.result ?? '');
  const role = String(payload.role ?? '');

  if (type === 'market_approved') {
    return `Your market &#39;${market_title}&#39; has been approved and is now live. Huskies can start betting!`;
  }

  if (type === 'market_rejected') {
    return `Your market &#39;${market_title}&#39; was not approved. It may not meet the community guidelines — you can create a new market that does.`;
  }

  if (type === 'market_resolved') {
    if (result === 'won') {
      return `You won ${amount} HC on ${market_title}. Congratulations!`;
    }
    if (result === 'lost') {
      return `You lost ${amount} HC on ${market_title}.`;
    }
    if (result === 'refunded') {
      return `Your stakes were refunded on ${market_title} -there were no winning bettors.`;
    }
    if (role === 'creator') {
      return `Your market &#39;${market_title}&#39; has resolved.`;
    }
  }

  if (type === 'market_voided') {
    if (role === 'bettor') {
      return `${refund} HC has been refunded to your account. ${market_title} was voided.`;
    }
    if (role === 'creator') {
      return `Your market &#39;${market_title}&#39; was voided by a moderator.`;
    }
  }

  return 'You have a new notification on HuskyMarkets.';
}

export function buildResolutionEmail(
  notification: NotificationForEmail,
  userId: string,
): { subject: string; html: string; headers: Record<string, string> } {
  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huskymarkets.com';
  const token = buildUnsubscribeToken(userId);
  const unsubUrl = `${APP_URL}/api/email/unsubscribe?token=${token}&uid=${encodeURIComponent(userId)}`;

  const subject = buildSubject(notification);
  const bodyCopy = buildBodyCopy(notification);

  const marketLinkHtml =
    notification.market_id !== null
      ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(`${APP_URL}/market/${notification.market_id}`)}" target="_blank" style="display:inline-block;background-color:#d41b2c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:6px;">View Market</a>
                  </td>
                </tr>
              </table>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)} · HuskyMarkets</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f6f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:22px;color:#0a0a0a;font-family:Georgia,'Times New Roman',serif;font-weight:400;">Husky</span><span style="font-size:22px;color:#d41b2c;font-weight:700;font-family:'Helvetica Neue',Arial,sans-serif;">Markets</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 36px;">

              <!-- Icon -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;width:48px;height:48px;background-color:#fdecea;border-radius:50%;text-align:center;line-height:48px;font-size:22px;">📊</div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#0a0a0a;text-align:center;letter-spacing:-0.3px;">${escapeHtml(subject)}</h1>

              <!-- Body -->
              <p style="margin:0 0 28px 0;font-size:15px;color:#5c6370;text-align:center;line-height:1.6;">${bodyCopy}</p>
${marketLinkHtml}
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;">
                <tr><td style="border-top:1px solid #f0f0f0;"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 8px 0 8px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                HuskyMarkets is for Huskies only &mdash; huskymarket.lol<br/>
                <a href="${escapeHtml(unsubUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from market emails</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
