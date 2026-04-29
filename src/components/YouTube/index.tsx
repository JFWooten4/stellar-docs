import React, { type ReactNode, useEffect, useState } from "react";

interface YouTubeProps {
  ID: string;
  title?: string;
  caption?: string;
}

export function YouTube({ ID, title, caption }: YouTubeProps): ReactNode {
  const [youtubeTitle, setYoutubeTitle] = useState<string>();
  const iframeTitle = title ?? youtubeTitle ?? caption ?? "YouTube video";

  useEffect(() => {
    if (title) {
      return;
    }

    const controller = new AbortController();
    const videoUrl = encodeURIComponent(
      `https://www.youtube.com/watch?v=${ID}`,
    );

    fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: { title?: string } | undefined) => {
        if (data?.title) {
          setYoutubeTitle(data.title);
        }
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setYoutubeTitle(undefined);
        }
      });

    return () => controller.abort();
  }, [ID, title]);

  const embed = (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "56.25%", // Make 16 x 9
        height: 0,
        marginBottom: "23px",
      }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${ID}?controls=0&rel=0&modestbranding=1`}
        title={iframeTitle}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" // tilt screen
        allowFullScreen
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "0px",
          borderRadius: "25pt",
        }}
      ></iframe>
    </div>
  );

  if (!caption) {
    return embed;
  }

  return (
    <figure>
      {embed}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export default YouTube;
