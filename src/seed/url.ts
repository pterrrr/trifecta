/**
 * Read the 'seed' query parameter from the current page URL.
 * Returns null if the parameter is absent or empty.
 */
export function readSeedFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  return seed !== null && seed.length > 0 ? seed : null;
}
