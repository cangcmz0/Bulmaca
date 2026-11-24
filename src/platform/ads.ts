import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { t } from '../i18n';
import { AD_CONFIG, USING_TEST_ADS } from './adConfig';

/**
 * Ad abstraction. On Android it runs real AdMob ads (Google test ads until real IDs are set);
 * in the browser it shows a test overlay so every ad flow can be played end to end.
 */
export interface Ads {
  /** Consent + SDK start. Safe to call more than once. */
  init(): Promise<void>;
  /** Resolves true when the player earned the reward. */
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
  /** True when the user must be offered a way to change their ad consent (EU/UK). */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
}

class TestAds implements Ads {
  async init(): Promise<void> {}

  private show(seconds: number, skippable: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.getElementById('ad')!;
      const label = el.querySelector<HTMLElement>('.ad-count')!;
      const close = el.querySelector<HTMLButtonElement>('.ad-close')!;
      el.classList.remove('hidden');
      let left = seconds;
      label.textContent = String(left);
      close.hidden = !skippable;
      const finish = (ok: boolean) => {
        clearInterval(timer);
        el.classList.add('hidden');
        close.onclick = null;
        resolve(ok);
      };
      close.onclick = () => finish(false);
      const timer = window.setInterval(() => {
        left--;
        label.textContent = String(Math.max(left, 0));
        if (left <= 0) finish(true);
      }, 1000);
      el.querySelector<HTMLElement>('.ad-title')!.textContent = t('adTest');
    });
  }

  showRewarded(): Promise<boolean> {
    return this.show(3, true);
  }

  async showInterstitial(): Promise<void> {
    await this.show(2, false);
  }

  privacyOptionsRequired(): boolean {
    return false;
  }

  async showPrivacyOptions(): Promise<void> {}
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

class AdMobAds implements Ads {
  private started: Promise<void> | null = null;
  private canRequest = false;
  private privacyRequired = false;
  private rewardedReady = false;
  private interstitialReady = false;

  init(): Promise<void> {
    if (!this.started) this.started = this.start();
    return this.started;
  }

  private async start(): Promise<void> {
    try {
      // Google's UMP consent form (EU/UK/Switzerland); elsewhere this returns NOT_REQUIRED.
      let info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        info = await AdMob.showConsentForm();
      }
      // The plugin doesn't export its PrivacyOptionsRequirementStatus enum; 'REQUIRED' is its value.
      this.privacyRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
      this.canRequest = info.canRequestAds;
    } catch {
      // Consent service unreachable (offline): try again next launch, keep the game playable.
      this.canRequest = false;
    }
    if (!this.canRequest) return;
    await AdMob.initialize({ maxAdContentRating: MaxAdContentRating.ParentalGuidance });
    void this.loadRewarded();
    void this.loadInterstitial();
  }

  private async loadRewarded(): Promise<boolean> {
    if (this.rewardedReady) return true;
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_CONFIG.rewarded, isTesting: USING_TEST_ADS, immersiveMode: true });
      this.rewardedReady = true;
    } catch {
      this.rewardedReady = false;
    }
    return this.rewardedReady;
  }

  private async loadInterstitial(): Promise<boolean> {
    if (this.interstitialReady) return true;
    try {
      await AdMob.prepareInterstitial({ adId: AD_CONFIG.interstitial, isTesting: USING_TEST_ADS, immersiveMode: true });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    }
    return this.interstitialReady;
  }

  async showRewarded(): Promise<boolean> {
    await this.init();
    // No consent, no connection or no ad available: never punish the player for it.
    if (!this.canRequest) return true;
    const loaded = this.rewardedReady || (await withTimeout(this.loadRewarded(), 8000).catch(() => false));
    if (!loaded) return true;
    this.rewardedReady = false;
    return new Promise<boolean>((resolve) => {
      let earned = false;
      const subs = [
        AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }),
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done(earned)),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done(true)),
      ];
      let finished = false;
      const done = (ok: boolean) => {
        if (finished) return;
        finished = true;
        subs.forEach((s) => void s.then((h) => h.remove()));
        void this.loadRewarded();
        resolve(ok);
      };
      AdMob.showRewardVideoAd().catch(() => done(true));
    });
  }

  async showInterstitial(): Promise<void> {
    await this.init();
    if (!this.canRequest || !this.interstitialReady) {
      void this.loadInterstitial();
      return;
    }
    this.interstitialReady = false;
    await new Promise<void>((resolve) => {
      const subs = [
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => done()),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => done()),
      ];
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        subs.forEach((s) => void s.then((h) => h.remove()));
        void this.loadInterstitial();
        resolve();
      };
      AdMob.showInterstitial().catch(() => done());
    });
  }

  privacyOptionsRequired(): boolean {
    return this.privacyRequired;
  }

  async showPrivacyOptions(): Promise<void> {
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = await AdMob.requestConsentInfo();
      this.canRequest = info.canRequestAds;
    } catch {
      /* form unavailable */
    }
  }
}

export const ads: Ads = Capacitor.isNativePlatform() ? new AdMobAds() : new TestAds();
