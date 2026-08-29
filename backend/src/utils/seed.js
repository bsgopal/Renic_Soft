import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { dbHelper } from '../models/dbHelper.js';

dotenv.config();

export const runSeed = async () => {
  const hash = await bcrypt.hash(process.env.OWNER_PASSWORD || '123456', 10);
  const mobile = process.env.OWNER_MOBILE || '9345578103';
  const email = process.env.OWNER_EMAIL || 'bsgopal0@gmail.com';
  const name = process.env.OWNER_NAME || 'Renic Soft Admin';

  // 1. Create/migrate the platform owner with the required credentials.
  //    Upserts by role so the documented login (9345578103 / 123456) always works.
  let owner = await dbHelper.findOne('User', { role: 'platform_owner' });

  if (owner) {
    await dbHelper.findByIdAndUpdate('User', owner._id, {
      mobile,
      email,
      name,
      password: hash,
      isActive: true
    });
    console.log('[Seed] Platform owner credentials synced:', mobile);
  } else {
    owner = await dbHelper.findOne('User', { mobile });
    if (!owner) {
      await dbHelper.create('User', {
        name,
        mobile,
        email,
        password: hash,
        role: 'platform_owner',
        permissions: { create_product: true, edit_prices: true, view_reports: true, approve_returns: true, access_suppliers: true },
        isActive: true
      });
      console.log('[Seed] Platform owner created:', mobile);
    }
  }

  // 2. Clean up legacy default admin account so it cannot shadow the owner login
  const legacy = await dbHelper.findOne('User', { mobile: '9876543210' });
  if (legacy && legacy.role !== 'platform_owner') {
    await dbHelper.deleteById('User', legacy._id);
    console.log('[Seed] Removed legacy default account');
  }

  // 3. Seed company profile once from .env so PDFs are never hardcoded
  const existingCompany = await dbHelper.findOne('Setting', { key: 'company' });
  if (!existingCompany) {
    await dbHelper.create('Setting', {
      key: 'company',
      value: {
        name: process.env.COMPANY_NAME || process.env.OWNER_NAME || '',
        address: process.env.COMPANY_ADDRESS || '',
        phone: process.env.COMPANY_PHONE || process.env.OWNER_MOBILE || '',
        email: process.env.COMPANY_EMAIL || process.env.OWNER_EMAIL || '',
        gst: process.env.COMPANY_GSTIN || ''
      }
    });
    console.log('[Seed] Company profile seeded from .env');
  }

  return true;
};

// Allow direct execution: npm run seed
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    await connectDB();
    await runSeed();
    process.exit(0);
  })();
}