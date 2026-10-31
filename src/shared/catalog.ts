export type ProductType = 'beat' | 'drumkit';
export type VariantKind = 'mp3' | 'wav' | 'trackout' | 'exclusive' | 'drumkit';
export interface Variant {
  kind: VariantKind;
  label: string;
  bundle: string;
  price: string;
  currency: 'RUB';
}
export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ProductType;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  coverUrl: string;
  demoUrl: string;
  variants: Variant[];
}
export interface CatalogResponse { items: Product[]; total: number }
