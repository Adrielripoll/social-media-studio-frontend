import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { ImageOff } from "lucide-react";

type StudioImageProps = ComponentProps<"img"> & { fallback?: ReactNode };

export default function StudioImage({
  src,
  alt = "Imagem",
  fallback,
  className = "",
  onError,
  ...props
}: StudioImageProps) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  if (!src || failedSource === src)
    return (
      <span
        className={"image-fallback " + className}
        role="img"
        aria-label={alt + ": imagem indisponível"}
      >
        {fallback ?? (
          <>
            <ImageOff size={24} aria-hidden="true" />
            <span>Imagem indisponível</span>
          </>
        )}
      </span>
    );
  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailedSource(src);
        onError?.(event);
      }}
    />
  );
}
