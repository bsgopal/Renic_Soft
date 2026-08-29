import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gstNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  contact: { type: String, default: '' },
  licenseKey: { type: String, unique: true },
  licenseStatus: {
    type: String,
    enum: ['trial', 'active', 'grace_period', 'locked', 'cancelled', 'pending_activation'],
    default: 'pending_activation'
  },
  licenseStart: { type: Date, default: Date.now },
  licenseEnd: { type: Date, required: true },
  planTier: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  maxFloors: { type: Number, default: 1 },
  maxUsers: { type: Number, default: 3 },
  maxProducts: { type: Number, default: 2000 },
  pendingOwnerName: { type: String, default: '' },
  pendingOwnerEmail: { type: String, default: '' },
  pendingOwnerMobile: { type: String, default: '' },
  pendingOwnerPassword: { type: String, default: '' },
  pendingOwnerRole: { type: String, default: 'admin' },
  activationOtp: { type: String, default: '' },
  activationOtpExpires: { type: Date },
  defaultRolesSeeded: { type: Boolean, default: false },
  telegramBotToken: { type: String, default: '' },
  telegramChatId: { type: String, default: '' },
  telegramReportTime: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model('Client', clientSchema);
