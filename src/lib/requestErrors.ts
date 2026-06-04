export function isIgnorableRequestError(error: unknown): boolean {
  if (!error) return false;

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';

  const normalized = message.toLowerCase();

  return (
    normalized.includes('aborterror') ||
    normalized.includes('aborted') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('load failed')
  );
}
