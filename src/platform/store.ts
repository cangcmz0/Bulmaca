import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { LANG } from '../i18n';
import { CATALOG, ProductId, item } from './catalog';

export type BuyResult = 'ok' | 'cancelled' | 'error';

/** Google Play purchases on Android; an instant test purchase in the browser build. */
export interface Store {
  init(): Promise<void>;
  /** Localised price from Google Play, or the catalog's display price. */
  price(id: ProductId): string;
  buy(id: ProductId): Promise<BuyResult>;
  /** Non-consumable products this Google account owns (restores Remove Ads after reinstall). */
  owned(): Promise<ProductId[]>;
  available(): boolean;
}

class TestStore implements Store {
  async init(): Promise<void> {}
  price(id: ProductId): string {
    return item(id).shownPrice[LANG];
  }
  async buy(): Promise<BuyResult> {
    return 'ok';
  }
  async owned(): Promise<ProductId[]> {
    return [];
  }
  available(): boolean {
    return true;
  }
}

class PlayStore implements Store {
  private prices = new Map<string, string>();
  private ready = false;

  async init(): Promise<void> {
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) return;
      const { products } = await NativePurchases.getProducts({
        productIdentifiers: CATALOG.map((c) => c.id),
        productType: PURCHASE_TYPE.INAPP,
      });
      for (const p of products) this.prices.set(p.identifier, p.priceString);
      this.ready = products.length > 0;
    } catch {
      this.ready = false; // offline or Play unavailable: the shop says so instead of failing
    }
  }

  price(id: ProductId): string {
    return this.prices.get(id) ?? '';
  }

  available(): boolean {
    return this.ready;
  }

  async buy(id: ProductId): Promise<BuyResult> {
    try {
      const tx = await NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: item(id).consumable,
      });
      // Android: "1" = purchased. Pending purchases (e.g. cash payments) arrive later via owned().
      return tx.purchaseState === undefined || tx.purchaseState === '1' ? 'ok' : 'cancelled';
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      return msg.includes('cancel') ? 'cancelled' : 'error';
    }
  }

  async owned(): Promise<ProductId[]> {
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      return purchases
        .filter((p) => p.purchaseState === undefined || p.purchaseState === '1')
        .map((p) => p.productIdentifier as ProductId)
        .filter((id) => CATALOG.some((c) => c.id === id && !c.consumable));
    } catch {
      return [];
    }
  }
}

export const store: Store = Capacitor.isNativePlatform() ? new PlayStore() : new TestStore();
