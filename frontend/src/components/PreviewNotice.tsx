import { ImageOff, LoaderCircle, RefreshCw } from "lucide-react";
import type { PreviewStatus } from "../hooks/useWallpaperPreview";
export default function PreviewNotice({
  status,
  hasImage,
  retry,
}: {
  status: PreviewStatus;
  hasImage: boolean;
  retry: () => void;
}) {
  if (status === "ready") return null;
  return (
    <div className="preview-notice" role="status">
      {status === "loading" ? (
        <LoaderCircle size={14} className="spin" />
      ) : (
        <ImageOff size={14} />
      )}
      <span>
        {status === "loading"
          ? hasImage
            ? "Improving preview quality…"
            : "Loading preview…"
          : status === "fallback"
            ? "Original unavailable. Showing a smaller preview."
            : "This image could not be loaded."}
      </span>
      {status !== "loading" && (
        <button className="text-button" onClick={retry}>
          <RefreshCw size={13} /> Retry preview
        </button>
      )}
    </div>
  );
}
