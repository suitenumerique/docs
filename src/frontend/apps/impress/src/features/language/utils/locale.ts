/**
 * @param {string} locale - The locale string, which can be in formats like de-DE, de-CH, de_DE, de-de, de_de, or de.
 * @returns {string} The regionless ISO 639-1 code. => de
 */
export function convertLocaleToISO639_1(locale: string): string {
  // Split the locale string by either a hyphen (-) or an underscore (_)
  return locale.split(/[-_]/)[0].toLowerCase();
}

/**
 * Filters the available locales to find those that match the search criteria.
 *
 * @param {readonly string[]} localesAvailable - The list of available locale strings to match against.
 * @param {readonly string[]} localesToSearch - The list of locale strings to search for.
 * @returns {string[]} Filtered list of localesAvailable that match localesToSearch, ordered by closest match.
 */
export function getMatchingLocales(
  localesAvailable: readonly string[],
  localesToSearch: readonly string[],
): string[] {
  const matchingLocales: string[] = [];
  for (const localeToSearch of localesToSearch) {
    // Exact match (case-insensitive)
    const exactMatches = localesAvailable.filter(
      (localeAvailable) =>
        localeAvailable.toLowerCase() === localeToSearch.toLowerCase(),
    );
    if (exactMatches.length > 0) {
      for (const matchingLocale of exactMatches) {
        if (!matchingLocales.includes(matchingLocale)) {
          matchingLocales.push(matchingLocale);
        }
      }
      continue;
    }
    // Soft match (ISO639-1 code)
    const softMatches = localesAvailable.filter(
      (localeAvailable) =>
        convertLocaleToISO639_1(localeAvailable) ===
        convertLocaleToISO639_1(localeToSearch),
    );
    for (const matchingLocale of softMatches) {
      if (!matchingLocales.includes(matchingLocale)) {
        matchingLocales.push(matchingLocale);
      }
    }
  }
  return matchingLocales;
}
