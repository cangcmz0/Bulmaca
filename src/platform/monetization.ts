/**
 * Every ad and reward knob in one place, so they can later come from Remote Config and be A/B
 * tested without touching game code.
 */
export const MONET = {
  /**
   * Forced ads are kept rare: they only follow a win (never a loss, never mid-level), start once
   * players are hooked, and back off for anyone who chose to watch a rewarded ad. Most revenue is
   * meant to come from opt-in rewarded ads, which players don't resent.
   */
  interstitialFromLevel: 15,
  /** Won levels between interstitials. */
  interstitialEvery: (level: number): number => (level < 60 ? 4 : 3),
  /** Never two interstitials closer than this. */
  interstitialMinGapMs: 120_000,
  /** Someone who just watched a rewarded ad gets a long break from interstitials. */
  quietAfterRewardedMs: 180_000,

  rewardedLives: 1,
  rewardedSeconds: 30,
  rewardedHints: 2,

  /** Free hints for beating a boss; a rewarded ad multiplies it. */
  bossHintReward: 1,
  bossRewardMultiplier: 3,

  /** Offer "skip level for an ad" on hard/boss levels after this many failed attempts. */
  skipAfterFails: 2,

  /** Daily gift on the home screen: free hints once a day, a rewarded ad multiplies it. */
  dailyGiftHints: 1,
  dailyGiftMultiplier: 3,

  /** Every Nth won level the win card offers a bonus hint for an optional ad. */
  bonusOfferEvery: 3,
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
