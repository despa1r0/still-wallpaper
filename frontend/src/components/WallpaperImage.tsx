import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { Wallpaper } from "../types";
import { useWallpaperPreview } from "../hooks/useWallpaperPreview";
import PreviewNotice from "./PreviewNotice";
function FullWallpaperImage({ wallpaper }: { wallpaper: Wallpaper }) {
  const preview = useWallpaperPreview(wallpaper);
  return (
    <div className="full-image-content">
      {preview.src && (
        <img
          src={preview.src}
          referrerPolicy="no-referrer"
          alt={`Wallpaper ${wallpaper.id}, ${wallpaper.resolution}`}
        />
      )}
      <PreviewNotice
        status={preview.status}
        hasImage={!!preview.src}
        retry={preview.retry}
      />
    </div>
  );
}
export default function WallpaperImage({
  wallpaper,
  full = false,
}: {
  wallpaper: Wallpaper;
  full?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [alternative, setAlternative] = useState(false);
  useEffect(() => {
    setFailed(false);
    setAlternative(false);
  }, [wallpaper.id]);
  if (full)
    return <FullWallpaperImage key={wallpaper.id} wallpaper={wallpaper} />;
  return failed ? (
    <div className="image-unavailable">
      <ImageOff size={24} />
      <span>Image unavailable</span>
    </div>
  ) : (
    <img
      src={alternative ? wallpaper.thumbs.original : wallpaper.thumbs.large}
      referrerPolicy="no-referrer"
      alt={`Wallpaper ${wallpaper.id}, ${wallpaper.resolution}`}
      loading="lazy"
      onError={() => (alternative ? setFailed(true) : setAlternative(true))}
    />
  );
}
