/**
 * Every ad and reward knob in one place, so they can later come from Remote Config and be A/B
 * tested without touching game code.
 */
export const MONET = {
  /** No interstitials before this level: new players must get hooked first. */
  interstitialFromLevel: 10,
  /** Levels (including retries) between interstitials. */
  interstitialEvery: (level: number): number => (level < 40 ? 3 : 2),
  /** Never two interstitials closer than this. */
  interstitialMinGapMs: 45_000,
  /** Someone who just watched a rewarded ad gets a break from interstitials. */
  quietAfterRewardedMs: 60_000,

  rewardedLives: 1,
  rewardedSeconds: 30,
  rewardedHints: 2,

  /** Free hints for beating a boss; a rewarded ad multiplies it. */
  bossHintReward: 1,
  bossRewardMultiplier: 3,

  /** Offer "skip level for an ad" on hard/boss levels after this many failed attempts. */
  skipAfterFails: 2,
};

class AdPacing {
  private lastInterstitial = 0;
  private lastRewarded = 0;

  rewardedWatched(): void {
    this.lastRewarded = Date.now();
  }

  interstitialShown(): void {
    this.lastInterstitial = Date.now();
  }

  shouldShowInterstitial(level: number, levelsSinceAd: number, noAds: boolean): boolean {
    if (noAds || level < MONET.interstitialFromLevel) return false;
    if (levelsSinceAd < MONET.interstitialEvery(level)) return false;
    const now = Date.now();
    if (now - this.lastInterstitial < MONET.interstitialMinGapMs) return false;
    if (now - this.lastRewarded < MONET.quietAfterRewardedMs) return false;
    return true;
  }
}

export const pacing = new AdPacing();
