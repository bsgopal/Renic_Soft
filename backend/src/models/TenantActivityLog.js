// Renic_Soft/backend/src/models/TenantActivityLog.js
import mongoose from 'mongoose';

const tenantActivityLogSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  clientId: {
    type: String,
    default: ''
  },
  softwareProduct: {
    type: String,
    default: 'WA_INSTA_AUTOMATION',
    index: true
  },
  screenName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  screenPath: {
    type: String,
    default: ''
  },
  actionType: {
    type: String,
    enum: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'SEARCH', 'LOGIN', 'LOGOUT', 'ACTION', 'SECURITY_ALERT'],
    default: 'VIEW',
    index: true
  },
  actionDescription: {
    type: String,
    default: ''
  },
  userName: {
    type: String,
    default: 'System / User'
  },
  userRole: {
    type: String,
    default: 'staff'
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

tenantActivityLogSchema.index({ customerCode: 1, timestamp: -1 });
tenantActivityLogSchema.index({ screenName: 1, timestamp: -1 });

export default mongoose.model('TenantActivityLog', tenantActivityLogSchema);
