import mongoose from 'mongoose';

const applicationSyncLogSchema = new mongoose.Schema({
  applicationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Application' 
  },
  appCode: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  appName: { 
    type: String, 
    default: '' 
  },
  commitHash: { 
    type: String, 
    default: '' 
  },
  commitMessage: { 
    type: String, 
    default: '' 
  },
  commitAuthor: { 
    type: String, 
    default: 'Platform Admin' 
  },
  commitDate: { 
    type: Date, 
    default: Date.now 
  },
  triggerType: { 
    type: String, 
    enum: ['MANUAL', 'WEBHOOK', 'AUTO_DISCOVERY'],
    default: 'MANUAL' 
  },
  status: { 
    type: String, 
    enum: ['SUCCESS', 'FAILED', 'DRIFT_DETECTED'],
    default: 'SUCCESS' 
  },
  durationMs: { 
    type: Number, 
    default: 0 
  },
  newRoutesFound: [{ 
    type: String 
  }],
  rawDiffSummary: { 
    type: String, 
    default: '' 
  }
}, { timestamps: true });

applicationSyncLogSchema.index({ appCode: 1, createdAt: -1 });

export default mongoose.models.ApplicationSyncLog || mongoose.model('ApplicationSyncLog', applicationSyncLogSchema);
