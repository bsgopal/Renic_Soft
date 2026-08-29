import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema({
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

const billSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  invoiceNumber: { type: String, required: true },
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cashierName: { type: String, default: '' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  customerGSTIN: { type: String, default: '' },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  items: [billItemSchema],
  subTotal: { type: Number, required: true },
  discountTotal: { type: Number, default: 0 },
  taxTotal: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Split', 'Credit'],
    default: 'Cash'
  },
  splitDetails: {
    cashAmount: { type: Number, default: 0 },
    cardAmount: { type: Number, default: 0 },
    upiAmount: { type: Number, default: 0 }
  },
  notes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Draft', 'Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Cancelled'],
    default: 'Draft'
  }
}, { timestamps: true });

billSchema.index({ clientId: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.models.Bill || mongoose.model('Bill', billSchema);
