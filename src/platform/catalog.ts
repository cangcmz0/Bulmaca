/**
 * In-app products. The IDs must match the one-time products created in Play Console
 * (see docs/PLAY-STORE.md → "Uygulama içi ürünler"). Real prices always come from Google Play
 * in the player's own currency; `shownPrice` is only for the browser build and docs.
 *
 * Price design (Nov 2026, USD ≈ 50 TRY):
 *  - Remove Ads sits at the genre norm ($2.99); Türkiye gets a regional price at roughly half the
 *    exchange-rate value (₺79.99), in line with what Turkish players actually pay for games.
 *  - Hint packs form a ladder where each step is clearly better value (≈ 0.066 → 0.050 → 0.035 $
 *    per hint), so the middle pack is the natural pick.
 *  - The starter pack bundles Remove Ads + the middle pack at a third off, shown to engaged
 *    players only.
 */
export type ProductId = 'starter_pack' | 'remove_ads' | 'hints_15' | 'hints_60' | 'hints_200';

export interface CatalogItem {
  id: ProductId;
  /** Consumables can be bought again; the rest are owned forever and restored on reinstall. */
  consumable: boolean;
  hints: number;
  removesAds: boolean;
  badge?: 'popular' | 'bestValue' | 'deal';
  shownPrice: { tr: string; en: string };
}

export const CATALOG: CatalogItem[] = [
  { id: 'starter_pack', consumable: false, hints: 60, removesAds: true, badge: 'deal', shownPrice: { tr: '₺99,99', en: '$3.99' } },
  { id: 'remove_ads', consumable: false, hints: 10, removesAds: true, shownPrice: { tr: '₺79,99', en: '$2.99' } },
  { id: 'hints_15', consumable: true, hints: 15, removesAds: false, shownPrice: { tr: '₺24,99', en: '$0.99' } },
  { id: 'hints_60', consumable: true, hints: 60, removesAds: false, badge: 'popular', shownPrice: { tr: '₺69,99', en: '$2.99' } },
  { id: 'hints_200', consumable: true, hints: 200, removesAds: false, badge: 'bestValue', shownPrice: { tr: '₺159,99', en: '$6.99' } },
];

export const item = (id: ProductId): CatalogItem => CATALOG.find((c) => c.id === id)!;

/** What hints buy in a pinch, so hint packs have a real use beyond the hint button. */
export const HINT_COST = { hint: 1, undo: 1, life: 1, time: 1, wake: 1, skip: 3 };
