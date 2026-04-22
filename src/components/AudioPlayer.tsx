import React from "react";

type AudioPlayerProps = {
  src: string;
};

export default function AudioPlayer({ src }: AudioPlayerProps) {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "20px auto",
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(59, 130, 246, 0.12)",
        border: "1px solid rgba(59, 130, 246, 0.35)",
      }}
    >
      <audio controls preload="metadata" style={{ width: "100%" }}>
        <source src={src} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
