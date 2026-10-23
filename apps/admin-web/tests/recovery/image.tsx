import type { ImgHTMLAttributes } from "react";
export default function FixtureImage({
  priority,
  fill,
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  fill?: boolean;
}) {
  void priority;
  void fill;
  // eslint-disable-next-line @next/next/no-img-element -- Next image transport is outside this HTTP data fixture.
  return <img {...props} alt={alt} />;
}
