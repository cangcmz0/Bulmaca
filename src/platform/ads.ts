import { t } from '../i18n';

/**
 * Ad abstraction. The web build uses a test overlay so the flow can be played end to end.
 * The Android build will swap in an AdMob implementation (see docs/ROADMAP.md) behind the same interface.
 */
export interface Ads {
  /** Resolves true when the player watched to the end and earned the reward. */
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
}

class TestAds implements Ads {
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
}

export const ads: Ads = new TestAds();
