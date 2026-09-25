// Renic_Soft/backend/src/utils/whatsappNotifier.js
import axios from 'axios';

const WA_NOTIFICATION_API = process.env.WA_NOTIFICATION_API || 'http://localhost:5000/api/notifications';

/**
 * Send automated WhatsApp alert when a new enterprise client is created
 */
export async function notifyClientOnboarded(client, credentials = {}) {
  try {
    const phone = client.adminMobile || client.contact || client.pendingOwnerMobile;
    if (!phone) {
      console.log('ℹ️ [Renic WhatsApp Notifier] No mobile phone attached to client. Skipping alert.');
      return { success: false };
    }

    const clientName = client.name || 'Valued Client';
    const customerCode = client.customerCode || client.clientCode || 'RENIC';
    const loginUrl = client.subdomain
      ? `https://${client.subdomain}.renic.store`
      : `http://localhost:5174/${customerCode.toLowerCase()}`;
    const username = credentials.mobile || phone;
    const password = credentials.password || '123456';
    const expiry = client.licenseEnd ? new Date(client.licenseEnd).toLocaleDateString('en-IN') : '1 Year Active';

    const message = `Welcome to *Renic Soft Enterprise Platform*, ${clientName}! 🚀\n\nYour software workspace has been provisioned and is ready for use.\n\n🌐 *Showroom Web Link:* ${loginUrl}\n🏢 *Customer Code:* ${customerCode}\n📱 *Username / Mobile:* ${username}\n🔑 *Initial Password:* ${password}\n📅 *License Valid Till:* ${expiry}\n\nFor support or billing inquiries, reply directly to this message. Welcome aboard! ✨`;

    const res = await axios.post(`${WA_NOTIFICATION_API}/send-alert`, {
      phone,
      title: '🎉 Enterprise Platform Provisioned',
      message
    }, { timeout: 8000 });

    console.log(`✅ [Renic WhatsApp Alert] Client onboarding sent to ${phone}`);
    return { success: true, result: res.data };
  } catch (error) {
    console.warn('⚠️ [Renic WhatsApp Alert] Warning:', error.response?.data?.error || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send automated WhatsApp alert when a client license is activated or renewed
 */
export async function notifyLicenseStatus(client, type = 'ACTIVATED') {
  try {
    const phone = client.adminMobile || client.contact || client.pendingOwnerMobile;
    if (!phone) return { success: false };

    const clientName = client.name || 'Valued Client';
    const expiry = client.licenseEnd ? new Date(client.licenseEnd).toLocaleDateString('en-IN') : 'Active';
    const planTier = (client.planTier || 'Enterprise').toUpperCase();

    const title = type === 'RENEWED' ? '🔄 License Successfully Renewed' : '⚡ License Successfully Activated';
    const message = `Hello *${clientName}*,\n\nYour *Renic Soft (${planTier})* license has been successfully ${type.toLowerCase()}! 🎉\n\n🏢 *Customer Code:* ${client.customerCode || 'RENIC'}\n📅 *Valid Until:* ${expiry}\n🟢 *Status:* ACTIVE\n\nThank you for choosing Renic Technology for your business automation.`;

    const res = await axios.post(`${WA_NOTIFICATION_API}/send-alert`, {
      phone,
      title,
      message
    }, { timeout: 8000 });

    console.log(`✅ [Renic WhatsApp Alert] License ${type} sent to ${phone}`);
    return { success: true, result: res.data };
  } catch (error) {
    console.warn('⚠️ [Renic WhatsApp Alert] Warning:', error.response?.data?.error || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send automated WhatsApp alert when a client subscription or trial expires
 */
export async function notifySubscriptionExpired(client) {
  try {
    const phone = client.adminMobile || client.contact || client.pendingOwnerMobile;
    if (!phone) return { success: false };

    const clientName = client.name || 'Valued Client';
    const expiry = client.licenseEnd ? new Date(client.licenseEnd).toLocaleDateString('en-IN') : 'Today';
    const isTrial = client.isTrial;

    const title = isTrial ? '⏳ Free Trial Period Ended' : '⚠️ Subscription Period Ended';
    const message = isTrial
      ? `Hello *${clientName}*,\n\nYour free trial of *Renic Soft Enterprise* for *${client.name}* (${client.customerCode}) has ended on *${expiry}*.\n\n🔒 Your trial showroom portal has been temporarily paused.\n\n✨ *To upgrade to full production & keep all your entered data:*\nPlease reply to this message or contact Renic Technology.\n\nThank you for trying our platform!`
      : `Hello *${clientName}*,\n\nYour *Renic Soft* subscription for *${client.name}* (${client.customerCode}) expired on *${expiry}*.\n\n🔒 Your application URL access has been temporarily paused.\n\n💳 *To renew and immediately restore access:*\nPlease contact the platform owner or reply directly to this message.\n\nRenic Technology Support Team`;

    const res = await axios.post(`${WA_NOTIFICATION_API}/send-alert`, {
      phone,
      title,
      message
    }, { timeout: 8000 });

    console.log(`✅ [Renic WhatsApp Alert] Expiry notification sent to ${phone}`);
    return { success: true, result: res.data };
  } catch (error) {
    console.warn('⚠️ [Renic WhatsApp Alert] Warning:', error.response?.data?.error || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send automated WhatsApp alert when a trial is converted to permanent production
 */
export async function notifyProductionActivated(client, newExpiry) {
  try {
    const phone = client.adminMobile || client.contact || client.pendingOwnerMobile;
    if (!phone) return { success: false };

    const clientName = client.name || 'Valued Client';
    const expiry = newExpiry ? new Date(newExpiry).toLocaleDateString('en-IN') : 'Active';

    const title = '🚀 Welcome to Full Enterprise Production!';
    const message = `Congratulations *${clientName}*! 🎉\n\nYour store *${client.name}* (${client.customerCode}) has been upgraded to *Permanent Production*!\n\n✅ Dedicated Database Provisioned\n✅ 100% of your trial products & bills preserved\n📅 *Subscription Active Till:* ${expiry}\n\nYour web portal is active. Thank you for partnering with Renic Technology! 🚀`;

    const res = await axios.post(`${WA_NOTIFICATION_API}/send-alert`, {
      phone,
      title,
      message
    }, { timeout: 8000 });

    console.log(`✅ [Renic WhatsApp Alert] Production activation sent to ${phone}`);
    return { success: true, result: res.data };
  } catch (error) {
    console.warn('⚠️ [Renic WhatsApp Alert] Warning:', error.response?.data?.error || error.message);
    return { success: false, error: error.message };
  }
}

