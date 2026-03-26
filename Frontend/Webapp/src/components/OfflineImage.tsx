import { ImgHTMLAttributes, useEffect, useState } from "react";

import { getOfflineImageUrl } from "@/lib/offlineOrderStore";

type OfflineImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
};

export default function OfflineImage({ src, alt = "", ...props }: OfflineImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let active = true;

    const resolveImage = async () => {
      const cached = await getOfflineImageUrl(src);
      if (active) {
        setResolvedSrc(cached || src);
      }
    };

    resolveImage();

    return () => {
      active = false;
    };
  }, [src]);

  return <img {...props} src={resolvedSrc} alt={alt} />;
}
