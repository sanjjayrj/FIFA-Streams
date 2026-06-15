import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

/**
 * Player profile photo with a graceful fallback: if the photo is missing or
 * fails to load, it shows a neutral avatar instead of a broken image.
 */
export function PlayerAvatar({
  src,
  className = "",
}: {
  src: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]); // reset when the source changes

  if (!src || failed) {
    return (
      <span className={`${className} avatar-fallback`}>
        <UserRound size="58%" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
