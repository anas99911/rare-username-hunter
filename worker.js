/**
 * RareHandle profile-hint API for Cloudflare Workers.
 * Best-effort reads of public Instagram profile pages only.
 * It does not log in, bypass challenges, rotate identities, or claim registration availability.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function decodeEntities(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function getMetaContent(html, property) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const prop = tag.match(/\bproperty=["']([^"']+)["']/i)?.[1];
    if (prop?.toLowerCase() === property.toLowerCase()) {
      const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
      if (content) return decodeEntities(content);
    }
  }
  return "";
}
async function readLimited(response, maxChars = 80000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (text.length < maxChars) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  return text.slice(0, maxChars);
}
async function inspectProfile(username) {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "Accept": "text/html,application/xhtml+xml" }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 404) {
      return { username, status: "possible", note: "Public profile returned 404; registration is not confirmed." };
    }
    if (response.status === 429 || response.status === 403 || response.status >= 500) {
      return { username, status: "unknown", note: `Instagram returned HTTP ${response.status}; no conclusion.` };
    }
    const html = await readLimited(response);
    const title = getMetaContent(html, "og:title");
    const description = getMetaContent(html, "og:description");
    const haystack = `${title}\n${description}`.toLowerCase();
    const target = username.toLowerCase();
    if (haystack.includes(`@${target}`)) {
      return { username, status: "taken", note: "A public profile matching this handle was detected." };
    }
    const lower = html.toLowerCase();
    const gated = lower.includes("login to instagram") || lower.includes("challenge") || lower.includes("consent_required") || lower.includes("please wait a few minutes") || lower.includes("rate limit");
    if (gated || !title) {
      return { username, status: "unknown", note: "Instagram did not return enough public profile information." };
    }
    const notFound = lower.includes("sorry, this page isn't available") || lower.includes("the link you followed may be broken") || lower.includes("page not found");
    if (notFound) {
      return { username, status: "possible", note: "Instagram returned a not-found style page; registration is not confirmed." };
    }
    return { username, status: "unknown", note: "The public page was inconclusive." };
  } catch (error) {
    return { username, status: "unknown", note: error?.name === "AbortError" ? "Timed out; try later." : "Request failed; no conclusion." };
  }
}
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "GET") return json({ error: "Use GET." }, 405);

    const requestUrl = new URL(request.url);
    const rawNames = requestUrl.searchParams.get("names") || "";
    const names = [...new Set(rawNames.split(",").map((n) => n.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
    if (names.length === 0) return json({ error: "Provide a names query parameter." }, 400);
    if (names.length > 10) return json({ error: "Maximum 10 usernames per request." }, 400);
    if (names.some((name) => !/^[a-z0-9._]{3,30}$/.test(name))) {
      return json({ error: "Each username must be 3–30 characters using letters, numbers, periods, or underscores." }, 400);
    }

    const results = [];
    for (let i = 0; i < names.length; i++) {
      if (i > 0) await sleep(1200); // deliberately low-volume; never tries to bypass limits
      results.push(await inspectProfile(names[i]));
    }
    return json({ results, checkedAt: new Date().toISOString(), warning: "Hints only. Confirm registration inside Instagram." });
  }
};
