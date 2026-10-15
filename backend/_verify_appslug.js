// _verify_appslug.js
// Proves that customer URL slugs are resolved from the Applications registry
// (dynamic) rather than a hardcoded product list: it registers an application
// whose appCode appears in NO built-in map and checks that its URL slug is
// picked up automatically.
import { connectDB } from './src/config/db.js';
import {
  refreshAppSlugRegistry,
  appSlugForProduct,
  buildCustomerUrlForProduct
} from './src/utils/customerUrl.js';
import Application from './src/models/Application.js';

const TEST_CODE = 'ZZ_TEST_APP';
let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}\n         got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
};

await connectDB();

console.log('\n[1] A product that exists in no built-in map');
check('slug before registry has it', appSlugForProduct(TEST_CODE), '');

console.log('\n[2] Register it in the Applications registry (as Renic Soft does)');
await Application.findOneAndUpdate(
  { appCode: TEST_CODE },
  { appCode: TEST_CODE, name: 'Zeta Test App', urlSlug: 'zeta', defaultPort: 5999, category: 'Other', icon: 'Layers' },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const refreshed = await refreshAppSlugRegistry();
console.log(`  registry refreshed from DB = ${refreshed}`);
check('slug now resolves from registry', appSlugForProduct(TEST_CODE), 'zeta');
check(
  'canonical customer URL built for it',
  buildCustomerUrlForProduct({ customerCode: 'RENIC-TX', softwareProduct: TEST_CODE }),
  'https://zeta.renic-tx.renictech.com'
);

console.log('\n[3] Existing products still resolve correctly (no regression)');
check('TEXTILE_POS', appSlugForProduct('TEXTILE_POS'), 'pos');
check('DELIVERY_CHALLAN', appSlugForProduct('DELIVERY_CHALLAN'), 'challan');
check('WA_INSTA_AUTOMATION', appSlugForProduct('WA_INSTA_AUTOMATION'), 'wa');
check(
  'RENIC-TX URL unchanged',
  buildCustomerUrlForProduct({ customerCode: 'RENIC-TX', softwareProduct: 'TEXTILE_POS' }),
  'https://pos.renic-tx.renictech.com'
);
check(
  'DC10 URL unchanged',
  buildCustomerUrlForProduct({ customerCode: 'DC10', softwareProduct: 'DELIVERY_CHALLAN' }),
  'https://challan.dc10.renictech.com'
);

console.log('\n[4] Cleanup');
await Application.deleteOne({ appCode: TEST_CODE });
await refreshAppSlugRegistry();
check('slug gone after deleting the app', appSlugForProduct(TEST_CODE), '');

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
