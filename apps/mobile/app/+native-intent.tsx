export function redirectSystemPath({
  path
}: {
  path: string;
  initial: boolean;
}): string {
  // Router owns navigation only; WebBrowser/Clerk still receive the original event.
  try {
    const url = new URL(path, 'masarifi://app');
    if (
      url.protocol === 'masarifi:' &&
      ((url.hostname === 'sso-callback' &&
        (url.pathname === '' || url.pathname === '/')) ||
        ((url.hostname === '' || url.hostname === 'app') &&
          url.pathname === '/sso-callback'))
    )
      return '/';
  } catch {
    // Never render a malformed callback or report its potentially sensitive text.
    if (
      path.startsWith('masarifi:') &&
      path.split(/[?#]/u)[0].includes('sso-callback')
    )
      return '/';
  }
  return path;
}
