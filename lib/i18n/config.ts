export const locales = ['en', 'so'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  so: 'Somali',
}

export const localeNamesNative: Record<Locale, string> = {
  en: 'English',
  so: 'Soomaali',
}
