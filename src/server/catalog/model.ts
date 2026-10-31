export type ProductType = 'beat' | 'drumkit';
export type VariantKind = 'mp3' | 'wav' | 'trackout' | 'exclusive' | 'drumkit';
export type FilePurpose = 'cover' | 'demo' | 'primary';

export const variantLabels: Record<VariantKind, string> = {
  mp3: 'MP3 лизинг', wav: 'WAV лизинг', trackout: 'Trackout stems',
  exclusive: 'Эксклюзивные права', drumkit: 'Драмкит',
};
export const bundleLabels: Record<VariantKind, string> = {
  mp3: 'MP3-файл', wav: 'WAV-файл', trackout: 'ZIP с WAV-дорожками',
  exclusive: 'ZIP проекта', drumkit: 'ZIP с ударными звуками',
};

export function normalizeSearch(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('ru-RU');
}
