import mongoose from 'mongoose';

const quoteItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  qty: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'pcs' },
  rate: { type: Number, required: true, default: 0 },
  gstPercent: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
});

const quotationSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  quoteNumber: { type: String, required: true, unique: true },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  customerGSTIN: { type: String, default: '' },
  quoteDate: { type: Date, default: Date.now },
  validUntil: { type: Date },
  items: [quoteItemSchema],
  subTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'converted', 'expired'],
    default: 'draft'
  },
  convertedToBill: { type: Boolean, default: false },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' }
}, { timestamps: true });

quotationSchema.index({ clientId: 1, quoteNumber: 1 }, { unique: true });

export default mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
