// Renic_Soft/backend/src/utils/subscriptionGuard.js
import { notifySubscriptionExpired } from './whatsappNotifier.js';

export function isClientDisabled(client) {
  if (!client) return true;
  if (client.securitySettings?.emergencyLock) return true;
  const disabledStatuses = ['locked', 'disabled', 'suspended', 'cancelled', 'inactive', 'revoked'];
  if (disabledStatuses.includes((client.licenseStatus || '').toLowerCase())) return true;
  return false;
}

export function isClientSubscriptionExpired(client) {
  if (!client) return false;
  if (client.licenseStatus === 'expired') return true;
  if (client.licenseEnd && new Date() > new Date(client.licenseEnd)) return true;
  return false;
}

export async function handleDisabledCustomer(req, res, client) {
  const lockReason = client.securitySettings?.lockReason || 'Tenant instance has been locked or suspended by the platform administrator.';
  const acceptsJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.path.startsWith('/api/');

  if (acceptsJson) {
    return res.status(403).json({
      success: false,
      error: 'CUSTOMER_DISABLED',
      message: `Access to customer instance '${client.name}' is currently disabled.`,
      customerCode: client.customerCode,
      reason: lockReason
    });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Showroom Deactivated · ${client.name || 'Renic Soft'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      color: #0f172a;
      border-radius: 20px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.6);
      position: relative;
      overflow: hidden;
    }
    .top-accent {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #dc2626, #ef4444);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      background: #fef2f2;
      color: #b91c1c;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .badge-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #dc2626;
    }
    h1 {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      color: #475569;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .store-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .store-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .store-row:last-child { border-bottom: none; }
    .store-label { color: #64748b; font-weight: 600; }
    .store-val { color: #0f172a; font-weight: 800; font-family: monospace; }
    .footer-note {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-accent"></div>
    <div class="badge">
      <div class="badge-dot"></div>
      403 Forbidden · Portal Deactivated
    </div>
    <h1>Showroom Access Deactivated</h1>
    <p>
      This showroom instance has been <strong>temporarily locked or disabled</strong> by the platform administrator. All routing and terminal access have been suspended.
    </p>

    <div class="store-box">
      <div class="store-row">
        <span class="store-label">Showroom:</span>
        <span class="store-val">${client.name}</span>
      </div>
      <div class="store-row">
        <span class="store-label">Customer Code:</span>
        <span class="store-val">${client.customerCode || 'N/A'}</span>
      </div>
      <div class="store-row">
        <span class="store-label">Status:</span>
        <span class="store-val" style="color: #dc2626;">LOCKED / DISABLED</span>
      </div>
      <div class="store-row">
        <span class="store-label">Admin Reason:</span>
        <span class="store-val" style="color: #475569;">${lockReason}</span>
      </div>
    </div>

    <div class="footer-note">
      🔒 If you are the showroom owner and require reactivation, please contact Renic Platform Administration at <strong>contact@renic.store</strong>.
    </div>
  </div>
</body>
</html>`);
}

export function renderDeletedCustomerPage(rawHost, sub) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 · Showroom URL Inactive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      color: #0f172a;
      border-radius: 20px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.7);
      position: relative;
      overflow: hidden;
    }
    .top-accent {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #64748b, #94a3b8);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      color: #475569;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .url-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      font-family: monospace;
      font-size: 13px;
      color: #dc2626;
      font-weight: bold;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .footer-note {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-accent"></div>
    <div class="badge">
      404 Not Found · Instance Terminated
    </div>
    <h1>This Showroom URL is Inactive</h1>
    <p>
      The showroom instance or tenant associated with this address has been <strong>deleted or removed</strong> from Renic Soft infrastructure.
    </p>

    <div class="url-box">
      ${rawHost || sub}
    </div>

    <div class="footer-note">
      This URL is no longer routing to any active server. If you believe this is an error, please contact the platform administrator.
    </div>
  </div>
</body>
</html>`;
}

export async function handleExpiredSubscription(req, res, client) {
  const isTrial = !!client.isTrial;
  const expiryDate = client.licenseEnd ? new Date(client.licenseEnd).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : 'Recently';

  const ownerPhone = client.adminMobile || client.contact || client.pendingOwnerMobile || '9047647093';
  const cleanPhone = ownerPhone.replace(/[^0-9]/g, '');
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello Renic Support, I would like to renew / reactivate the subscription for ${client.name} (${client.customerCode || 'MYSHOP'}). Please assist with payment.`
  )}`;

  // Automatically trigger WhatsApp notification to client if not sent yet
  if (!client.expiryAlertSent) {
    client.expiryAlertSent = true;
    client.licenseStatus = 'expired';
    try {
      await client.save();
      await notifySubscriptionExpired(client);
    } catch (e) {
      console.warn('[Subscription Guard] Auto alert dispatch error:', e.message);
    }
  }

  // If JSON API request, return 402 Payment Required
  const acceptsJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.path.startsWith('/api/');
  if (acceptsJson) {
    return res.status(402).json({
      success: false,
      error: 'SUBSCRIPTION_EXPIRED',
      isTrial,
      message: isTrial
        ? `Your free trial for ${client.name} ended on ${expiryDate}. Please upgrade to production to restore access.`
        : `Subscription for ${client.name} expired on ${expiryDate}. Please contact the platform owner to renew.`,
      expiryDate,
      customerCode: client.customerCode,
      renewUrl: waLink
    });
  }

  // Render branded enterprise HTML lockout page
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(402).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTrial ? 'Trial Ended' : 'Subscription Expired'} · ${client.name || 'Renic Soft'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      color: #0f172a;
      border-radius: 20px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.5);
      position: relative;
      overflow: hidden;
    }
    .top-accent {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #ef4444, #f59e0b);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      background: #fef2f2;
      color: #b91c1c;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 20px;
      border: 1px solid #fecaca;
    }
    .badge-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      color: #64748b;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .store-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .store-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 4px 0;
    }
    .store-label { color: #64748b; font-weight: 600; }
    .store-val { color: #0f172a; font-weight: 800; font-family: monospace; }
    .btn-wa {
      display: block;
      background: #10b981;
      color: #ffffff;
      text-decoration: none;
      font-weight: 800;
      font-size: 15px;
      padding: 14px 24px;
      border-radius: 12px;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .btn-wa:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .footer-note {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 20px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-accent"></div>
    <div class="badge">
      <div class="badge-dot"></div>
      ${isTrial ? 'Free Trial Period Ended' : 'Subscription Period Ended'}
    </div>
    <h1>${isTrial ? 'Trial Ended for this Showroom' : 'Subscription Has Expired'}</h1>
    <p>
      Your access to this portal has been automatically paused because the validity period finished on <strong>${expiryDate}</strong>.
    </p>

    <div class="store-box">
      <div class="store-row">
        <span class="store-label">Showroom / Client:</span>
        <span class="store-val">${client.name}</span>
      </div>
      <div class="store-row">
        <span class="store-label">Customer Code:</span>
        <span class="store-val">${client.customerCode || 'N/A'}</span>
      </div>
      <div class="store-row">
        <span class="store-label">Validity Ended:</span>
        <span class="store-val" style="color: #ef4444;">${expiryDate}</span>
      </div>
      <div class="store-row">
        <span class="store-label">Data Status:</span>
        <span class="store-val" style="color: #10b981;">100% Preserved & Safe 🔒</span>
      </div>
    </div>

    <a href="${waLink}" target="_blank" class="btn-wa">
      💬 Contact Owner via WhatsApp to Renew
    </a>

    <div class="footer-note">
      🔒 All your products, sales history, and invoices remain safely stored.<br/>
      Your access will be restored immediately once payment is recorded.
    </div>
  </div>
</body>
</html>`);
}
