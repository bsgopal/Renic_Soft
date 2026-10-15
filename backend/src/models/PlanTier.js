import mongoose from 'mongoose';

const planTierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true, unique: true },
  appCode: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  price: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  billingCycle: {
    type: String,
    enum: ['1_MONTH', '3_MONTHS', '6_MONTHS', '1_YEAR', 'LIFETIME'],
    default: '1_MONTH'
  },
  description: { type: String, default: '' },
  allowedScreens: [{ type: String, trim: true }],
  allowedFeatures: [{ type: String, trim: true }],
  screenPermissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  maxUsers: { type: Number, default: 5 },
  maxContacts: { type: Number, default: 10000 },
  maxMonthlyMessages: { type: Number, default: 50000 },
  maxProducts: { type: Number, default: 5000 },
  maxFloors: { type: Number, default: 2 },
  isActive: { type: Boolean, default: true },
  isPopular: { type: Boolean, default: false },
  badgeText: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.PlanTier || mongoose.model('PlanTier', planTierSchema);
