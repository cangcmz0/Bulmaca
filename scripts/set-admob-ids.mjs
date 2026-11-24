// Sets your real AdMob IDs in both places that need them.
// Usage: npm run set-admob -- <APP_ID> <REWARDED_UNIT_ID> <INTERSTITIAL_UNIT_ID>
// Example: npm run set-admob -- ca-app-pub-1234567890123456~1111111111 ca-app-pub-1234567890123456/2222222222 ca-app-pub-1234567890123456/3333333333
import { readFileSync, writeFileSync } from 'node:fs';

const [appId, rewarded, interstitial] = process.argv.slice(2);
const appRe = /^ca-app-pub-\d{16}~\d{10}$/;
const unitRe = /^ca-app-pub-\d{16}\/\d{10}$/;
if (!appRe.test(appId ?? '') || !unitRe.test(rewarded ?? '') || !unitRe.test(interstitial ?? '')) {
  console.error('Usage: npm run set-admob -- <APP_ID ca-app-pub-...~...> <REWARDED ca-app-pub-.../...> <INTERSTITIAL ca-app-pub-.../...>');
  process.exit(1);
}
const cfg = 'src/platform/adConfig.ts';
let ts = readFileSync(cfg, 'utf8');
ts = ts.replace(/rewarded: '[^']*'/, `rewarded: '${rewarded}'`).replace(/interstitial: '[^']*'/, `interstitial: '${interstitial}'`);
writeFileSync(cfg, ts);
const xml = 'android/app/src/main/res/values/strings.xml';
let s = readFileSync(xml, 'utf8');
s = s.replace(/<string name="admob_app_id">[^<]*<\/string>/, `<string name="admob_app_id">${appId}</string>`);
writeFileSync(xml, s);
console.log('AdMob IDs set. Rebuild with: npm run release');
