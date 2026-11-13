// Shared Mintlify meeting players, based on the former Docusaurus DriveVideo and AudioPlayer.
// Keep video URLs and playback behavior centralized for the meeting archive.
const VideoFrame = ({ children }) => (
  <div
    className="relative mx-auto my-4 aspect-video w-full overflow-hidden rounded-2xl"
    style={{
      maxWidth: 960,
      background: "rgba(0, 0, 0, 0.04)",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
    }}
  >
    {children}
  </div>
);

export const DriveVideo = ({ id, title = "Meeting Playback Video" }) => (
  <VideoFrame>
    <iframe
      className="absolute inset-0 h-full w-full border-0"
      src={`https://drive.google.com/file/d/${id}/preview`}
      title={title}
      allow="autoplay; fullscreen"
      allowFullScreen
      loading="lazy"
    />
  </VideoFrame>
);

export const YouTubeVideo = ({ id, title = "YouTube video player" }) => (
  <VideoFrame>
    <iframe
      className="absolute inset-0 h-full w-full border-0"
      src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  </VideoFrame>
);

export const AudioPlayer = ({ src }) => (
  <div
    className="mx-auto my-5 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
    style={{ maxWidth: 640 }}
  >
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
      🎧 Audio Recording
    </div>
    <audio controls preload="metadata" className="w-full" aria-label="Audio recording">
      <source src={src} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  </div>
);
