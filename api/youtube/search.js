function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanQuery(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 160);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use GET for YouTube search."
    });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set YOUTUBE_API_KEY in your Vercel environment variables."
    });
  }

  const q = cleanQuery(req.query?.q, "music");
  const pageToken = cleanQuery(req.query?.pageToken);
  const duration = cleanQuery(req.query?.duration).toLowerCase();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "25",
    safeSearch: "moderate",
    q,
    key
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  if (["short", "medium", "long"].includes(duration)) {
    params.set("videoDuration", duration);
  }

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.error?.errors?.[0]?.reason || "youtube_error",
        message: data.error?.message || "YouTube search failed."
      });
    }

    return sendJson(res, 200, {
      items: (data.items || []).map((item) => ({
        id: item.id?.videoId,
        title: item.snippet?.title,
        channel: item.snippet?.channelTitle,
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        publishedAt: item.snippet?.publishedAt,
        description: item.snippet?.description || ""
      })).filter((item) => item.id),
      nextPageToken: data.nextPageToken || ""
    });
  } catch (error) {
    return sendJson(res, 502, {
      error: "youtube_fetch_failed",
      message: error.message || "Could not contact YouTube."
    });
  }
};
