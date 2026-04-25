import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type YouTubeAppProps = {
  apiKey: string;
  initialQuery?: string;
  chromeSelector?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
};

type YouTubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  description: string;
};

type YouTubePlaylist = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
};

const YOUTUBE_HOME = "https://www.youtube.com";
const API_BASE = "https://www.googleapis.com/youtube/v3";

function buildWatchUrl(videoId: string) {
  return `${YOUTUBE_HOME}/watch?v=${encodeURIComponent(videoId)}`;
}

function buildEmbedUrl(videoId: string, playlistId = "") {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });
  if (playlistId) {
    params.set("list", playlistId);
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function dateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function mapVideo(item: any): YouTubeVideo | null {
  const videoId = item?.id?.videoId || item?.id;
  const snippet = item?.snippet;
  if (!videoId || !snippet) return null;

  return {
    id: videoId,
    title: snippet.title || "Untitled video",
    channelTitle: snippet.channelTitle || "YouTube",
    thumbnail:
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.default?.url ||
      "",
    publishedAt: snippet.publishedAt || "",
    description: snippet.description || ""
  };
}

function mapPlaylist(item: any): YouTubePlaylist | null {
  const playlistId = item?.id?.playlistId || item?.id;
  const snippet = item?.snippet;
  if (!playlistId || !snippet) return null;

  return {
    id: playlistId,
    title: snippet.title || "Playlist",
    channelTitle: snippet.channelTitle || "YouTube",
    thumbnail:
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.default?.url ||
      ""
  };
}

export default function YouTubeApp({
  apiKey,
  initialQuery = "trending music",
  chromeSelector = "[data-window-chrome]",
  onFullscreenChange
}: YouTubeAppProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [address, setAddress] = useState("youtube.com");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState("");
  const [nextPageToken, setNextPageToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentUrl = selectedVideo ? buildWatchUrl(selectedVideo.id) : YOUTUBE_HOME;
  const embedUrl = useMemo(
    () => selectedVideo ? buildEmbedUrl(selectedVideo.id, activePlaylistId) : "",
    [selectedVideo, activePlaylistId]
  );

  async function fetchJson(path: string, params: Record<string, string>) {
    if (!apiKey) {
      throw new Error("Missing YouTube API key.");
    }

    const url = new URL(`${API_BASE}/${path}`);
    Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "YouTube request failed.");
    }
    return data;
  }

  async function searchYouTube(nextToken = "") {
    setLoading(true);
    setError("");
    setAddress(`youtube.com/results?search_query=${query}`);

    try {
      const [videoData, playlistData] = await Promise.all([
        fetchJson("search", {
          part: "snippet",
          type: "video",
          maxResults: "18",
          q: query.trim() || "youtube",
          pageToken: nextToken
        }),
        nextToken
          ? Promise.resolve({ items: [] })
          : fetchJson("search", {
            part: "snippet",
            type: "playlist",
            maxResults: "8",
            q: query.trim() || "youtube"
          })
      ]);

      const nextVideos = (videoData.items || []).map(mapVideo).filter(Boolean) as YouTubeVideo[];
      setVideos((current) => nextToken ? [...current, ...nextVideos] : nextVideos);
      setNextPageToken(videoData.nextPageToken || "");

      if (!nextToken) {
        setPlaylists((playlistData.items || []).map(mapPlaylist).filter(Boolean) as YouTubePlaylist[]);
        setSelectedVideo(nextVideos[0] || null);
        setActivePlaylistId("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "YouTube could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylist(playlist: YouTubePlaylist) {
    setLoading(true);
    setError("");
    setAddress(`youtube.com/playlist?list=${playlist.id}`);

    try {
      const data = await fetchJson("playlistItems", {
        part: "snippet",
        maxResults: "18",
        playlistId: playlist.id
      });

      const playlistVideos = (data.items || [])
        .map((item: any) => mapVideo({
          id: item?.snippet?.resourceId?.videoId,
          snippet: item?.snippet
        }))
        .filter(Boolean) as YouTubeVideo[];

      setVideos(playlistVideos);
      setSelectedVideo(playlistVideos[0] || null);
      setActivePlaylistId(playlist.id);
      setNextPageToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Playlist could not load.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event?: FormEvent) {
    event?.preventDefault();
    searchYouTube();
  }

  function handleAddressSubmit(event: FormEvent) {
    event.preventDefault();
    const value = address.trim();
    const watchMatch = value.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || value.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    const searchMatch = value.match(/[?&]search_query=([^&]+)/);

    if (watchMatch?.[1]) {
      const video: YouTubeVideo = {
        id: watchMatch[1],
        title: "YouTube video",
        channelTitle: "YouTube",
        thumbnail: "",
        publishedAt: "",
        description: ""
      };
      setSelectedVideo(video);
      setActivePlaylistId("");
      setAddress(buildWatchUrl(video.id));
      return;
    }

    if (searchMatch?.[1]) {
      setQuery(decodeURIComponent(searchMatch[1].replace(/\+/g, " ")));
      window.setTimeout(() => searchYouTube(), 0);
      return;
    }

    if (value && !value.includes("youtube.com")) {
      window.open(value.startsWith("http") ? value : `https://${value}`, "_blank", "noopener,noreferrer");
      return;
    }

    setAddress(YOUTUBE_HOME);
  }

  function chooseVideo(video: YouTubeVideo) {
    setSelectedVideo(video);
    setAddress(buildWatchUrl(video.id));
  }

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;

    if (!document.fullscreenElement) {
      await root.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }

  function openCurrentInNewTab() {
    window.open(currentUrl, "_blank", "noopener,noreferrer");
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLElement>, video: YouTubeVideo) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    chooseVideo(video);
  }

  useEffect(() => {
    searchYouTube();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === rootRef.current;
      setIsFullscreen(active);
      onFullscreenChange?.(active);

      const chrome = rootRef.current?.closest(chromeSelector) as HTMLElement | null;
      chrome?.classList.toggle("velo-youtube-fullscreen-host", active);
    };

    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      const chrome = rootRef.current?.closest(chromeSelector) as HTMLElement | null;
      chrome?.classList.remove("velo-youtube-fullscreen-host");
    };
  }, [chromeSelector, onFullscreenChange]);

  return (
    <div ref={rootRef} className={`velo-youtube-app${isFullscreen ? " is-fullscreen" : ""}`}>
      <style>{`
        .velo-youtube-app {
          --yt-bg: #101010;
          --yt-panel: #d7d0bc;
          --yt-panel-dark: #202020;
          --yt-border-dark: #111;
          --yt-border-light: #f5efd8;
          --yt-red: #ff0033;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          min-height: 100%;
          height: 100%;
          color: #f4f4f4;
          background: #080808;
          font-family: "Tahoma", "MS Sans Serif", "Segoe UI", sans-serif;
          overflow: hidden;
        }
        .velo-youtube-app.is-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          height: 100dvh;
          width: 100dvw;
        }
        .velo-youtube-app.is-fullscreen .yt-topbar {
          display: none;
        }
        .velo-youtube-app.is-fullscreen .yt-shell {
          grid-template-columns: 1fr;
        }
        .velo-youtube-app.is-fullscreen .yt-sidebar,
        .velo-youtube-app.is-fullscreen .yt-results {
          display: none;
        }
        .velo-youtube-app.is-fullscreen .yt-player-card {
          border-radius: 0;
          border: 0;
        }
        .yt-topbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          padding: 8px;
          border: 2px solid;
          border-color: var(--yt-border-light) var(--yt-border-dark) var(--yt-border-dark) var(--yt-border-light);
          background: linear-gradient(180deg, #3b3b3b, #171717);
        }
        .yt-address-form {
          display: flex;
          min-width: 0;
          gap: 6px;
        }
        .yt-address,
        .yt-search {
          width: 100%;
          min-height: 32px;
          padding: 6px 9px;
          border: 2px solid;
          border-color: #111 #eee #eee #111;
          background: #fff;
          color: #050505;
          font: inherit;
          outline: none;
        }
        .yt-actions {
          display: flex;
          gap: 6px;
        }
        .yt-button {
          min-height: 32px;
          padding: 5px 10px;
          border: 2px solid;
          border-color: #eee #111 #111 #eee;
          background: var(--yt-panel);
          color: #111;
          font-weight: 700;
          box-shadow: inset 1px 1px 0 rgba(255,255,255,0.7), inset -1px -1px 0 rgba(0,0,0,0.28);
          cursor: pointer;
        }
        .yt-button:active {
          border-color: #111 #eee #eee #111;
          transform: translateY(1px);
        }
        .yt-shell {
          display: grid;
          grid-template-columns: 186px minmax(0, 1fr) 360px;
          min-height: 0;
          background: #0b0b0b;
        }
        .yt-sidebar {
          padding: 10px;
          border-right: 2px solid #060606;
          background: linear-gradient(180deg, #1f1f1f, #121212);
        }
        .yt-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
        .yt-logo span {
          display: grid;
          place-items: center;
          width: 38px;
          height: 28px;
          border-radius: 7px;
          background: var(--yt-red);
          color: #fff;
        }
        .yt-nav-item {
          display: block;
          width: 100%;
          margin: 0 0 6px;
          padding: 9px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #fff;
          text-align: left;
          cursor: pointer;
        }
        .yt-player-zone {
          min-width: 0;
          min-height: 0;
          padding: 10px;
          overflow: auto;
        }
        .yt-player-card {
          overflow: hidden;
          border: 2px solid;
          border-color: #333 #050505 #050505 #333;
          border-radius: 6px;
          background: #000;
        }
        .yt-frame-wrap {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
        }
        .yt-frame-wrap iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .yt-empty-player {
          display: grid;
          place-items: center;
          min-height: 320px;
          color: #bbb;
          text-align: center;
        }
        .yt-player-meta {
          padding: 12px;
          background: #151515;
        }
        .yt-player-meta h2 {
          margin: 0 0 6px;
          font-size: clamp(18px, 2vw, 26px);
        }
        .yt-player-meta p {
          margin: 0;
          color: #aaa;
          line-height: 1.5;
        }
        .yt-search-row {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .yt-results {
          min-width: 0;
          min-height: 0;
          padding: 10px;
          border-left: 2px solid #050505;
          background: #111;
          overflow: auto;
        }
        .yt-section-title {
          margin: 0 0 8px;
          color: #ddd;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .yt-video-card,
        .yt-playlist-card {
          display: grid;
          grid-template-columns: 118px minmax(0, 1fr);
          gap: 9px;
          width: 100%;
          margin-bottom: 8px;
          padding: 7px;
          border: 1px solid rgba(255,255,255,0.1);
          background: #181818;
          color: #fff;
          text-align: left;
          cursor: pointer;
        }
        .yt-video-card:hover,
        .yt-video-card:focus-visible,
        .yt-playlist-card:hover,
        .yt-playlist-card:focus-visible {
          outline: 2px solid #d7d0bc;
          background: #222;
        }
        .yt-thumb {
          width: 118px;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          background: #050505;
        }
        .yt-card-title {
          margin: 0 0 5px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.25;
        }
        .yt-card-meta {
          margin: 0;
          color: #aaa;
          font-size: 12px;
          line-height: 1.35;
        }
        .yt-error {
          margin: 0 0 10px;
          padding: 10px;
          border: 1px solid #6d1f1f;
          background: #2a0909;
          color: #ffd8d8;
        }
        .yt-loading {
          padding: 12px;
          color: #ccc;
        }
        .velo-youtube-fullscreen-host > :not(.velo-youtube-app) {
          display: none !important;
        }
        @media (max-width: 980px) {
          .yt-shell {
            grid-template-columns: 1fr;
          }
          .yt-sidebar {
            display: none;
          }
          .yt-results {
            border-left: 0;
            border-top: 2px solid #050505;
            max-height: 42dvh;
          }
        }
        @media (max-width: 640px) {
          .yt-topbar,
          .yt-address-form,
          .yt-actions,
          .yt-search-row {
            grid-template-columns: 1fr;
            flex-direction: column;
          }
          .yt-video-card,
          .yt-playlist-card {
            grid-template-columns: 96px minmax(0, 1fr);
          }
          .yt-thumb {
            width: 96px;
          }
        }
      `}</style>

      <header className="yt-topbar">
        <form className="yt-address-form" onSubmit={handleAddressSubmit}>
          <input
            className="yt-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="YouTube address"
          />
          <button className="yt-button" type="submit">Go</button>
        </form>
        <div className="yt-actions">
          <button className="yt-button" type="button" onClick={openCurrentInNewTab}>Open in New Tab</button>
          <button className="yt-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </header>

      <main className="yt-shell">
        <aside className="yt-sidebar">
          <div className="yt-logo"><span>YT</span><strong>YouTube</strong></div>
          {["Trending", "Music", "Gaming", "Sports", "News", "Learning"].map((item) => (
            <button
              className="yt-nav-item"
              key={item}
              type="button"
              onClick={() => {
                setQuery(item);
                window.setTimeout(() => searchYouTube(), 0);
              }}
            >
              {item}
            </button>
          ))}
        </aside>

        <section className="yt-player-zone">
          <form className="yt-search-row" onSubmit={handleSearch}>
            <input
              className="yt-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search YouTube"
              aria-label="Search YouTube"
            />
            <button className="yt-button" type="submit">Search</button>
          </form>

          {error && <p className="yt-error">{error}</p>}

          <article className="yt-player-card">
            {selectedVideo && embedUrl ? (
              <>
                <div className="yt-frame-wrap">
                  <iframe
                    title={selectedVideo.title}
                    src={embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="yt-player-meta">
                  <h2>{selectedVideo.title}</h2>
                  <p>{selectedVideo.channelTitle} {selectedVideo.publishedAt ? `· ${dateLabel(selectedVideo.publishedAt)}` : ""}</p>
                  <p>{selectedVideo.description}</p>
                </div>
              </>
            ) : (
              <div className="yt-empty-player">
                <div>
                  <h2>YouTube Player</h2>
                  <p>Search for videos to start playback with the official YouTube embed player.</p>
                </div>
              </div>
            )}
          </article>
        </section>

        <aside className="yt-results" aria-label="YouTube results">
          <p className="yt-section-title">Videos</p>
          {loading && <div className="yt-loading">Loading YouTube results...</div>}
          {videos.map((video) => (
            <article
              className="yt-video-card"
              key={video.id}
              role="button"
              tabIndex={0}
              onClick={() => chooseVideo(video)}
              onKeyDown={(event) => onCardKeyDown(event, video)}
            >
              {video.thumbnail ? <img className="yt-thumb" src={video.thumbnail} alt="" /> : <div className="yt-thumb" />}
              <div>
                <h3 className="yt-card-title">{video.title}</h3>
                <p className="yt-card-meta">{video.channelTitle}</p>
                <p className="yt-card-meta">{dateLabel(video.publishedAt)}</p>
              </div>
            </article>
          ))}

          {nextPageToken && (
            <button className="yt-button" type="button" onClick={() => searchYouTube(nextPageToken)} disabled={loading}>
              Load More
            </button>
          )}

          {playlists.length > 0 && <p className="yt-section-title" style={{ marginTop: 16 }}>Playlists</p>}
          {playlists.map((playlist) => (
            <button className="yt-playlist-card" key={playlist.id} type="button" onClick={() => loadPlaylist(playlist)}>
              {playlist.thumbnail ? <img className="yt-thumb" src={playlist.thumbnail} alt="" /> : <div className="yt-thumb" />}
              <span>
                <strong className="yt-card-title">{playlist.title}</strong>
                <p className="yt-card-meta">{playlist.channelTitle}</p>
              </span>
            </button>
          ))}
        </aside>
      </main>
    </div>
  );
}
