/**
 * Plural-form support for i18n files.
 *
 * Two conventions are recognised:
 *  - i18next style keys: `cart.items_one`, `cart.items_other`, `cart.items_few`
 *  - ICU message syntax inside the value: `{count, plural, one {…} other {…}}`
 *
 * The category lists follow CLDR. Sources: unicode.org/cldr plural rules.
 */

export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

const SUFFIX_RE = /^(.*)_(zero|one|two|few|many|other)$/;

/**
 * Splits an i18next plural key into its base key and category.
 * Returns null when the key is not a plural form.
 */
export function splitPluralKey(key: string): { base: string; category: PluralCategory } | null {
  const match = SUFFIX_RE.exec(key);
  if (!match) return null;
  return { base: match[1] as string, category: match[2] as PluralCategory };
}

/**
 * Groups keys by their plural base, keeping only bases that have at least two
 * categories. A lone `items_one` with no siblings is not treated as plural.
 */
export function groupPluralKeys(keys: string[]): Map<string, Map<PluralCategory, string>> {
  const found = new Map<string, Map<PluralCategory, string>>();

  for (const key of keys) {
    const split = splitPluralKey(key);
    if (!split) continue;
    const entry = found.get(split.base) ?? new Map<PluralCategory, string>();
    entry.set(split.category, key);
    found.set(split.base, entry);
  }

  for (const [base, entry] of found) {
    if (entry.size < 2) found.delete(base);
  }

  return found;
}

/** True when a value carries an ICU plural block. */
export function hasIcuPlural(value: string): boolean {
  return /\{\s*\w+\s*,\s*plural\s*,/i.test(value);
}

/** Plural categories CLDR defines for a language. */
const LANGUAGE_CATEGORIES: Record<string, PluralCategory[]> = {
  en: ["one", "other"],
  de: ["one", "other"],
  nl: ["one", "other"],
  es: ["one", "other"],
  it: ["one", "other"],
  pt: ["one", "other"],
  sv: ["one", "other"],
  da: ["one", "other"],
  nb: ["one", "other"],
  fi: ["one", "other"],
  et: ["one", "other"],
  el: ["one", "other"],
  he: ["one", "two", "other"],
  fr: ["one", "many", "other"],
  tr: ["one", "other"],
  ja: ["other"],
  ko: ["other"],
  zh: ["other"],
  th: ["other"],
  vi: ["other"],
  id: ["other"],
  ru: ["one", "few", "many", "other"],
  uk: ["one", "few", "many", "other"],
  be: ["one", "few", "many", "other"],
  pl: ["one", "few", "many", "other"],
  cs: ["one", "few", "many", "other"],
  sk: ["one", "few", "many", "other"],
  hr: ["one", "few", "other"],
  sr: ["one", "few", "other"],
  bs: ["one", "few", "other"],
  lt: ["one", "few", "many", "other"],
  lv: ["zero", "one", "other"],
  ro: ["one", "few", "other"],
  ar: ["zero", "one", "two", "few", "many", "other"],
  cy: ["zero", "one", "two", "few", "many", "other"],
  ga: ["one", "two", "few", "many", "other"],
  mt: ["one", "two", "few", "many", "other"],
  sl: ["one", "two", "few", "other"],
  hi: ["one", "other"],
  fa: ["one", "other"],
  ka: ["one", "other"],
  hy: ["one", "other"],
  az: ["one", "other"],
  kk: ["one", "other"],
  uz: ["one", "other"],
  ky: ["one", "other"],
};

/** Normalises `ru-RU`, `ru_RU`, `RU` to `ru`. */
export function normaliseLanguage(lang: string): string {
  return lang.trim().toLowerCase().split(/[-_]/)[0] ?? lang;
}

/**
 * Display names the CLI passes into prompts ("Russian"), mapped back to codes.
 * Without this, `pluralCategoriesFor("Russian")` silently degrades to ["other"].
 */
const NAME_TO_CODE: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  ukrainian: "uk",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  arabic: "ar",
  hindi: "hi",
  dutch: "nl",
  swedish: "sv",
  norwegian: "nb",
  danish: "da",
  finnish: "fi",
  polish: "pl",
  czech: "cs",
  slovak: "sk",
  hungarian: "hu",
  turkish: "tr",
  romanian: "ro",
  greek: "el",
  hebrew: "he",
  lithuanian: "lt",
  latvian: "lv",
  estonian: "et",
  croatian: "hr",
  serbian: "sr",
  slovenian: "sl",
  georgian: "ka",
  armenian: "hy",
  azerbaijani: "az",
  kazakh: "kk",
  uzbek: "uz",
  kyrgyz: "ky",
  persian: "fa",
  farsi: "fa",
  indonesian: "id",
  vietnamese: "vi",
  thai: "th",
  welsh: "cy",
  irish: "ga",
  maltese: "mt",
};

/**
 * Resolves a language code or an English display name to a CLDR code.
 * Returns null when the language is unknown.
 */
export function resolveLanguage(lang: string): string | null {
  const key = normaliseLanguage(lang.replace(/\s+/g, " "));
  if (key === "") return null;
  if (LANGUAGE_CATEGORIES[key]) return key;
  const byName = NAME_TO_CODE[key];
  if (byName) return byName;
  return null;
}

/** Plural categories a language actually uses, or `["other"]` when unknown. */
export function pluralCategoriesFor(lang: string): PluralCategory[] {
  const code = resolveLanguage(lang);
  if (!code) return ["other"];
  return LANGUAGE_CATEGORIES[code] ?? ["other"];
}

/**
 * Instruction block for the model, telling it how many plural forms the target
 * language needs and that categories carry grammatical meaning, not synonyms.
 */
export function buildPluralInstruction(targetLang: string, hasIcu: boolean): string {
  const categories = pluralCategoriesFor(targetLang);
  const lines = [
    `PLURAL FORMS: ${targetLang} uses these plural categories: ${categories.join(", ")}.`,
    "Keys ending in _zero/_one/_two/_few/_many/_other are forms of ONE phrase for different counts.",
    "Translate each form so it is grammatically correct for that category in the target language.",
    "Do not translate a category as a synonym of another; follow the target language's plural rules.",
  ];

  if (hasIcu) {
    lines.push(
      "Values containing {count, plural, ...} use ICU syntax. Keep the ICU structure, the variable names,",
      "and the category keywords EXACTLY. Translate only the text inside the braces.",
    );
  }

  return lines.join("\n");
}

/**
 * Categories the target language needs but the source does not provide.
 * Used to warn the user that new forms have to be authored, not just translated.
 */
export function missingCategories(targetLang: string, present: PluralCategory[]): PluralCategory[] {
  const needed = pluralCategoriesFor(targetLang);
  const have = new Set(present);
  return needed.filter((category) => !have.has(category));
}

/** Sorted present categories for a plural group, in CLDR order. */
export function sortCategories(categories: PluralCategory[]): PluralCategory[] {
  return [...categories].sort(
    (a, b) => PLURAL_CATEGORIES.indexOf(a) - PLURAL_CATEGORIES.indexOf(b),
  );
}
