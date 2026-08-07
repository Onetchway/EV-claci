"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ImageRevealProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  /** Fill its parent instead of using intrinsic dimensions. */
  fill?: boolean;
}

/**
 * A navy panel wipes off the image while the photo itself settles from a
 * slight over-scale. Both halves share one easing curve so they read as a
 * single gesture.
 */
export function ImageReveal({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  width,
  height,
  fill = true,
}: ImageRevealProps) {
  return (
    <div className={cn("relative overflow-hidden bg-navy-900", className)}>
      <motion.div
        className="h-full w-full"
        initial={{ scale: 1.14 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {fill ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover", imgClassName)}
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            width={width ?? 1200}
            height={height ?? 800}
            sizes={sizes}
            priority={priority}
            className={cn("h-auto w-full object-cover", imgClassName)}
          />
        )}
      </motion.div>

      <motion.span
        aria-hidden
        className="absolute inset-0 z-10 origin-right bg-navy-800"
        initial={{ scaleX: 1 }}
        whileInView={{ scaleX: 0 }}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
      />
    </div>
  );
}
