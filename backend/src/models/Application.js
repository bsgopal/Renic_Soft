import mongoose from 'mongoose';

const screenSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  defaultEnabled: { type: Boolean, default: true }
}, { _id: false });

const featureSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  defaultEnabled: { type: Boolean, default: true }
}, { _id: false });

const featureMappingSchema = new mongoose.Schema({
  customDisplayName: { type: String, required: true, trim: true },
  folderCategory: { type: String, default: 'General', trim: true },
  technicalTarget: { type: String, required: true, trim: true },
  screenPath: { type: String, default: '', trim: true },
  description: { type: String, default: '' },
  defaultEnabled: { type: Boolean, default: true }
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  appCode: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  urlSlug: {
    type: String,
    lowercase: true,
    trim: true,
    default: function() {
      return (this.appCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  category: { 
    type: String, 
    enum: ['Retail POS', 'Marketing SaaS', 'Logistics', 'Enterprise ERP', 'Accounting & ERP', 'Healthcare', 'Custom', 'General'],
    default: 'General' 
  },
  defaultPort: { type: Number, required: true, default: 5000 },
  description: { type: String, default: '' },
  icon: { type: String, default: 'Layers' },
  githubUrl: { type: String, default: '', trim: true },
  repoBranch: { type: String, default: 'main', trim: true },
  localRepoPath: { type: String, default: '', trim: true },
  lastCommitHash: { type: String, default: '' },
  lastCommitMessage: { type: String, default: '' },
  lastCommitAuthor: { type: String, default: '' },
  lastSyncedAt: { type: Date },
  screens: [screenSchema],
  features: [featureSchema],
  featureMappings: [featureMappingSchema],
  isSystem: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Application || mongoose.model('Application', applicationSchema);
