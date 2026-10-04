import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';

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
  // Reject malformed encodings before navigation; preserve Router's decoding depth.
  try {
    decodeURI(path);
    extractExpoPathFromURL([], path);
  } catch (error) {
    if (error instanceof URIError || error instanceof TypeError) return '/';
    throw error;
  }
  return path;
}
