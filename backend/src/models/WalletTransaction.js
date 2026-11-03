import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  customerCode: {
    type: String,
    trim: true,
    index: true
  },
  transactionType: {
    type: String,
    enum: [
      'RECHARGE',
      'USAGE_DEDUCTION',
      'POSTPAID_DISPATCH',
      'ADJUSTMENT_CREDIT',
      'ADJUSTMENT_DEBIT',
      'REFUND_DISPATCH_FAILURE',
      'PROMOTIONAL_BONUS'
    ],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  ratePerMessage: {
    type: Number,
    default: 0.90
  },
  messagesCount: {
    type: Number,
    default: 0
  },
  balanceBefore: {
    type: Number,
    default: 0
  },
  balanceAfter: {
    type: Number,
    default: 0
  },
  messagesBefore: {
    type: Number,
    default: 0
  },
  messagesAfter: {
    type: Number,
    default: 0
  },
  paymentMode: {
    type: String,
    enum: [
      'UPI',
      'BANK_TRANSFER',
      'CASH',
      'CHEQUE',
      'RAZORPAY',
      'SYSTEM_ADJUSTMENT',
      'POSTPAID_BYPASS',
      'PROMOTIONAL'
    ],
    default: 'UPI'
  },
  referenceId: {
    type: String,
    default: '',
    trim: true
  },
  taxInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  taxInvoiceNumber: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  performedBy: {
    userId: { type: String, default: '' },
    name: { type: String, default: 'System' },
    mobile: { type: String, default: '' },
    role: { type: String, default: 'SUPER_ADMIN' }
  },
  formattedTimestamp: {
    type: String,
    default: () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }
}, { timestamps: true });

export default mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);
