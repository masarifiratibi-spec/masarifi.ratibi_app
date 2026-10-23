import type { AnchorHTMLAttributes } from "react";
export default function FixtureLink({
  href,
  prefetch,
  scroll,
  replace,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
}) {
  void prefetch;
  void scroll;
  void replace;
  return <a href={href} {...props} />;
}
