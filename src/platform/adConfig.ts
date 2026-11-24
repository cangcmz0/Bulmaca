/**
 * AdMob ad unit IDs. These are Google's official TEST IDs: they show test ads and earn nothing.
 *
 * Before publishing, put your own IDs here and in android/app/src/main/res/values/strings.xml
 * (admob_app_id) in one go with:
 *
 *   npm run set-admob -- <APP_ID> <REWARDED_UNIT_ID> <INTERSTITIAL_UNIT_ID>
 *
 * Never click your own live ads: AdMob can close the account for invalid traffic. Keep testing
 * with these IDs, or register your phone as a test device in AdMob.
 */
export const AD_CONFIG = {
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

export const USING_TEST_ADS = AD_CONFIG.rewarded.startsWith('ca-app-pub-3940256099942544/');
