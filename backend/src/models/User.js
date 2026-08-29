import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['platform_owner', 'admin', 'floor_manager', 'cashier', 'staff'],
    default: 'staff'
  },
  permissions: {
    create_product: { type: Boolean, default: false },
    edit_prices: { type: Boolean, default: false },
    view_reports: { type: Boolean, default: false },
    approve_returns: { type: Boolean, default: false },
    access_suppliers: { type: Boolean, default: false }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
