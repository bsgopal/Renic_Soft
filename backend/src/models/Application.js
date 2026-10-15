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

const businessTypeSchema = new mongoose.Schema({
  typeKey: { type: String, required: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  icon: { type: String, default: 'Building' },
  badgeColor: { type: String, default: '#3b82f6' },
  description: { type: String, default: '' },
  staffLabel: { type: String, default: 'Staff' },
  staffPluralLabel: { type: String, default: 'Staff Members' },
  serviceLabel: { type: String, default: 'Service' },
  servicePluralLabel: { type: String, default: 'Services' },
  clientLabel: { type: String, default: 'Customer' },
  clientPluralLabel: { type: String, default: 'Customers' },
  bookingActionLabel: { type: String, default: 'Book Appointment' },
  addServiceBtnText: { type: String, default: 'Add Service' },
  addStaffBtnText: { type: String, default: 'Add Staff' },
  defaultSlotDuration: { type: Number, default: 30 },
  defaultBookingBuffer: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const solutionModeSchema = new mongoose.Schema({
  modeKey: { type: String, required: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  icon: { type: String, default: 'Layers' },
  badgeColor: { type: String, default: '#84cc16' },
  description: { type: String, default: '' },
  defaultScreenKeys: [{ type: String, trim: true }],
  defaultFeatures: { type: mongoose.Schema.Types.Mixed, default: {} },
  businessTypes: [businessTypeSchema],
  isDefault: { type: Boolean, default: false }
}, { _id: true });

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
      // `this` is null when Mongoose evaluates defaults while building an
      // upsert (setDefaultsOnInsert), so read defensively instead of throwing.
      const code = (this && this.appCode) || '';
      return code.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  category: { 
    type: String, 
    trim: true,
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
  solutionModes: [solutionModeSchema],
  isSystem: { type: Boolean, default: false },
  // Can a customer instance be licensed to run this application?
  // RENIC_SOFT is the operator's own console (urlSlug `hq`) - the platform,
  // not a product a tenant subscribes to - so it sets this to false. The
  // customer product dropdown filters on this flag instead of hardcoding a
  // list of appCodes, which would break the moment a new app is registered.
  assignable: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.Application || mongoose.model('Application', applicationSchema);
