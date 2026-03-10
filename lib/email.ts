import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@fundreporting.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function emailLayout(title: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #152521; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #152521; padding: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
          <tr>
            <td align="center" style="font-size: 26px; font-weight: bold; color: #22302c; padding-bottom: 16px;">
              ${title}
            </td>
          </tr>
          ${bodyRows}
          <tr>
            <td style="font-size: 14px; color: #274139; text-align: center; padding-top: 30px; border-top: 1px solid #e5e7e6; margin-top: 20px;">
              &copy; ${new Date().getFullYear()} Fundreporting.com &nbsp;|&nbsp; Questions? <a href="mailto:support@fundreporting.com" style="color: #6a7f79; text-decoration: underline;">Contact Support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<tr>
    <td align="center" style="padding: 30px 0;">
      <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:#274139;color:#ffffff;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold;">
        ${label}
      </a>
    </td>
  </tr>`;
}

export async function sendCapitalCallEmail({
  toEmail,
  toName,
  entityName,
  amount,
  dueDate,
}: {
  toEmail: string;
  toName: string | null;
  entityName: string;
  amount: number | null;
  dueDate: number | null;
}) {
  const greeting = toName ? `Hello ${toName},` : "Hello,";
  const formattedAmount = amount != null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount)
    : "an amount";
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "a date to be confirmed";

  return getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `Capital call issued — ${entityName}`,
    html: emailLayout(
      `Capital call issued`,
      `<tr>
        <td style="font-size: 16px; color: #274139; line-height: 1.6;">
          <p>${greeting}</p>
          <p>A capital call of <strong>${formattedAmount}</strong> has been issued against your position in <strong>${entityName}</strong>.</p>
          <p>Payment is due by <strong>${formattedDue}</strong>. Please log in to acknowledge this call and arrange payment.</p>
        </td>
      </tr>
      ${ctaButton(`${APP_URL}/my-capital-calls`, "View capital call")}
      <tr>
        <td style="font-size: 14px; color: #6a7f79; line-height: 1.6; text-align: center;">
          <p>If you have any questions, please contact the fund administrator.</p>
        </td>
      </tr>`,
    ),
  });
}

export async function sendShareholderInvite({
  toEmail,
  toName,
  entityName,
  isExistingUser,
}: {
  toEmail: string;
  toName: string | null;
  entityName: string;
  isExistingUser: boolean;
}) {
  const greeting = toName ? `Hello ${toName},` : "Hello,";

  if (isExistingUser) {
    return getResend().emails.send({
      from: FROM,
      to: toEmail,
      subject: `You've been added as a shareholder — ${entityName}`,
      html: emailLayout(
        `You've been added as a shareholder`,
        `<tr>
          <td style="font-size: 16px; color: #274139; line-height: 1.6;">
            <p>${greeting}</p>
            <p>You have been added as a shareholder to <strong>${entityName}</strong>.</p>
            <p>Log in to the platform to view your cap table position and stay updated on any capital calls when they are issued.</p>
          </td>
        </tr>
        ${ctaButton(`${APP_URL}/login?email=${encodeURIComponent(toEmail)}`, "Log in")}
        <tr>
          <td style="font-size: 14px; color: #6a7f79; line-height: 1.6; text-align: center;">
            <p>If you have any questions, please contact the fund administrator.</p>
          </td>
        </tr>`,
      ),
    });
  } else {
    const signupUrl = `${APP_URL}/signup?email=${encodeURIComponent(toEmail)}`;
    return getResend().emails.send({
      from: FROM,
      to: toEmail,
      subject: `You've been invited as a shareholder — ${entityName}`,
      html: emailLayout(
        `You've been invited as a shareholder`,
        `<tr>
          <td style="font-size: 16px; color: #274139; line-height: 1.6;">
            <p>${greeting}</p>
            <p>You have been invited as a shareholder to <strong>${entityName}</strong>.</p>
            <p>Please create your account to access the platform, view your cap table position, and stay updated on capital calls when they are issued.</p>
          </td>
        </tr>
        ${ctaButton(signupUrl, "Create account")}
        <tr>
          <td style="font-size: 14px; color: #6a7f79; line-height: 1.6; text-align: center;">
            <p>If you were not expecting this invitation, you can safely ignore this email.</p>
          </td>
        </tr>`,
      ),
    });
  }
}
