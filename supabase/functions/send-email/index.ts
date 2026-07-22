import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Hook secret set in Supabase Dashboard → Auth → Hooks → Send Email
// Supabase generates secrets as "v1,whsec_<base64>"; standardwebhooks only
// strips "whsec_", so we strip the leading "v1," ourselves first.
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,/, "");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://huskymarket.lol";
const FROM_EMAIL = "noreply@huskymarket.lol";
const FROM_NAME = "Husky Market";

interface AuthHookPayload {
  user: {
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Accepts only relative paths or same-origin URLs; falls back to "/"
function sanitizeRedirect(redirectTo: string): string {
  if (!redirectTo) return "/";
  if (redirectTo.startsWith("/")) return redirectTo;
  try {
    const siteOrigin = new URL(SITE_URL).origin;
    const target = new URL(redirectTo);
    if (target.origin === siteOrigin) return redirectTo;
  } catch {
    // not a valid URL
  }
  return "/";
}

// Always builds from the server-side SITE_URL — never trusts payload.email_data.site_url
function buildConfirmUrl(tokenHash: string, type: string, redirectTo: string): string {
  const safeRedirect = sanitizeRedirect(redirectTo);
  return `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(safeRedirect)}`;
}

function validateHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function buildEmail(payload: AuthHookPayload): { subject: string; html: string } {
  const { email_action_type, token, token_hash, token_hash_new, redirect_to } =
    payload.email_data;
  const email = payload.user.email;

  switch (email_action_type) {
    // OTP code flow — user types the code into the app
    case "magiclink":
    case "signup": {
      return {
        subject: "Your HuskyMarkets sign-in code",
        html: otpTemplate(email, token),
      };
    }
    case "recovery": {
      const url = buildConfirmUrl(token_hash, "recovery", redirect_to);
      return { subject: "Reset your HuskyMarkets password", html: recoveryTemplate(email, url) };
    }
    case "email_change": {
      const hash = token_hash_new ?? token_hash;
      const url = buildConfirmUrl(hash, "email_change", redirect_to);
      return { subject: "Confirm your new email address", html: emailChangeTemplate(email, url) };
    }
    default: {
      return {
        subject: "Your HuskyMarkets sign-in code",
        html: otpTemplate(email, token),
      };
    }
  }
}

function ctaButton(url: string, label: string): string {
  const safeUrl = validateHttpUrl(url) ?? "#";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;background-color:#d41b2c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:6px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function divider(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="border-top:1px solid #f0f0f0;"></td></tr>
    </table>`;
}

function emailWrapper(icon: string, heading: string, body: string, url: string, btnLabel: string): string {
  const safeUrl = validateHttpUrl(url) ?? "#";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)} · HuskyMarkets</title>
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
                    <div style="display:inline-block;width:48px;height:48px;background-color:#fdecea;border-radius:50%;text-align:center;line-height:48px;font-size:22px;">${icon}</div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#0a0a0a;text-align:center;letter-spacing:-0.3px;">${escapeHtml(heading)}</h1>

              <!-- Body -->
              <p style="margin:0 0 28px 0;font-size:15px;color:#5c6370;text-align:center;line-height:1.6;">${body}</p>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;background-color:#d41b2c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:6px;">${escapeHtml(btnLabel)}</a>
                  </td>
                </tr>
              </table>

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
                If you didn't request this, you can safely ignore this email — your account remains secure.<br/>
                HuskyMarkets is for Huskies only &mdash; huskymarket.lol
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function otpTemplate(email: string, token: string): string {
  const safeToken = escapeHtml(token);
  const safeEmail = escapeHtml(email);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your HuskyMarkets sign-in code</title>
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
                    <div style="display:inline-block;width:48px;height:48px;background-color:#fdecea;border-radius:50%;text-align:center;line-height:48px;font-size:22px;">🔑</div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#0a0a0a;text-align:center;letter-spacing:-0.3px;">Your sign-in code</h1>
              <p style="margin:0 0 28px 0;font-size:15px;color:#5c6370;text-align:center;line-height:1.6;">
                Enter this code in HuskyMarkets to sign in as <strong style="color:#0a0a0a;">${safeEmail}</strong>.
              </p>

              <!-- OTP Code -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:#f5f6f8;border:2px solid #e8e9eb;border-radius:8px;padding:16px 40px;">
                      <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">${safeToken}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px 0;font-size:12px;color:#9ca3af;text-align:center;">
                Valid for 10 minutes &middot; one use only
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="border-top:1px solid #f0f0f0;"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 8px 0 8px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                If you didn't request this, you can safely ignore this email — your account remains secure.<br/>
                HuskyMarkets is for Huskies only &mdash; huskymarket.lol
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function recoveryTemplate(email: string, url: string): string {
  return emailWrapper(
    "🔒",
    "Reset your password",
    `A password reset was requested for <strong style="color:#0a0a0a;">${escapeHtml(email)}</strong>. This link expires in <strong style="color:#0a0a0a;">10 minutes</strong> and can only be used once.`,
    url,
    "Reset password",
  );
}

function emailChangeTemplate(email: string, url: string): string {
  return emailWrapper(
    "✉️",
    "Confirm your new email",
    `Confirm that <strong style="color:#0a0a0a;">${escapeHtml(email)}</strong> is your new email address for HuskyMarkets.`,
    url,
    "Confirm new email",
  );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify Supabase Auth Hook signature (standardwebhooks).
  // Pass the full headers object — Supabase's own example uses Object.fromEntries(req.headers).
  const rawBody = await req.text();
  const allHeaders = Object.fromEntries(req.headers);
  let payload: AuthHookPayload;
  try {
    const wh = new Webhook(HOOK_SECRET);
    payload = wh.verify(rawBody, allHeaders) as AuthHookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload?.user?.email || !payload?.email_data?.email_action_type) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { subject, html } = buildEmail(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [payload.user.email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", res.status, err);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
