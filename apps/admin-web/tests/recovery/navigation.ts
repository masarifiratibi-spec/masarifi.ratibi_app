export function usePathname() {
  return window.location.pathname;
}
export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
    prefetch: () => undefined,
  };
}
export function notFound(): never {
  throw new Error("Recovery route not found");
}
export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error("Recovery redirect");
}
