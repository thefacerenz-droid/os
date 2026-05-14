let spotifyToken = null;

function cleanQuery(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function imageOf(item) {
  return item.images?.[0]?.url || item.album?.images?.[0]?.url || "";
}

function normalizeSpotifySearch(data) {
  const mapItems = (collection, type) =>
    (collection?.items || []).filter(Boolean).map((item) => ({
      id: item.id,
      type,
      title: item.name,
      subtitle:
        type === "track"
          ? item.artists?.map((artist) => artist.name).join(", ")
          : type === "artist"
            ? `${item.followers?.total?.toLocaleString?.() || 0} followers`
            : item.artists?.map((artist) => artist.name).join(", ") || item.owner?.display_name || "Spotify",
      image: imageOf(item),
      uri: item.uri,
      externalUrl: item.external_urls?.spotify || "",
      playable: type !== "artist"
    }));

  return {
    tracks: mapItems(data.tracks, "track"),
    artists: mapItems(data.artists, "artist"),
    albums: mapItems(data.albums, "album"),
    playlists: mapItems(data.playlists, "playlist")
  };
}

async function getSpotifyToken() {
  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 30000) {
    return spotifyToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your environment variables.");
    error.code = "missing_config";
    throw error;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || "Spotify token request failed.");
    error.code = data.error || "spotify_auth_error";
    throw error;
  }

  spotifyToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  return spotifyToken.accessToken;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed", message: "Use GET." });
  }

  try {
    const q = cleanQuery(req.query.q, "music");
    const type = cleanQuery(req.query.type, "track")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => ["track", "artist", "album", "playlist"].includes(item))
      .join(",") || "track";
    const token = await getSpotifyToken();
    const params = new URLSearchParams({ q, type, limit: "20", market: "US" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = {};
    }
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.status || "spotify_error",
        message: data.error?.message || data.error_description || raw || "Spotify search failed."
      });
    }
    return res.status(200).json(normalizeSpotifySearch(data));
  } catch (error) {
    return res.status(error.code === "missing_config" ? 503 : 500).json({
      error: error.code || "spotify_error",
      message: error.message || "Spotify search could not load."
    });
  }
};
