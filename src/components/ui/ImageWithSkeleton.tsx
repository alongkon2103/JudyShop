"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = ImageProps & {
  /** Extra classes for the shimmer overlay (e.g. rounded corners). */
  skeletonClassName?: string;
};

/**
 * Drop-in next/image replacement that shows a shimmer skeleton until the
 * image loads, then cross-fades it in. Must be placed inside a
 * `position: relative` parent when used with `fill`.
 */
export function ImageWithSkeleton({
  className,
  skeletonClassName,
  onLoad,
  ...props
}: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "skeleton-shimmer pointer-events-none absolute inset-0 z-[1] transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100",
          skeletonClassName,
        )}
      />
      <Image
        {...props}
        className={cn(
          "transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
    </>
  );
}
