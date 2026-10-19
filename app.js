/* Paste your deployed Cloudflare Worker URL below, then commit the change. */
const API_BASE = "https://rarehandle-checker.lolorhowizi.workers.dev/";

const consonants = "bcdfghjklmnpqrstvwxz";
const vowels = "aeiouy";
const letters = "abcdefghijklmnopqrstuvwxyz";
const lengthSelect = document.getElementById("length");
const styleSelect = document.getElementById("style");
const generateBtn = document.getElementById("generate-btn");
const copyAllBtn = document.getElementById("copy-all-btn");
const checkBtn = document.getElementById("check-btn");
const resultsEl = document.getElementById("results");
const countEl = document.getElementById("count");
const checkerStatus = document.getElementById("checker-status");

let currentNames = [];
let isChecking = false;

function pick(chars) { return chars[Math.floor(Math.random() * chars.length)]; }
function makeBaseName(length) {
  const patterns = {
    3: ["CVC", "CCV", "VCC", "CVV", "VCV"],
    4: ["CVCV", "CVCC", "CCVC", "VCVC", "CVVC", "VCCV"],
    5: ["CVCVC", "CVCCV", "CCVCV", "VCCVC", "CVCVV", "VCVCV"]
  };
  const pattern = pick(patterns[length]);
  return [...pattern].map((letter) => letter === "C" ? pick(consonants) : letter === "V" ? pick(vowels) : pick(letters)).join("");
}
function makeName(length, style) {
  let name = makeBaseName(length);
  if (style === "digits" && Math.random() < 0.8) {
    const position = Math.random() < 0.7 ? length - 1 : Math.floor(Math.random() * length);
    name = name.slice(0, position) + pick("0123456789") + name.slice(position + 1);
  } else if (style === "symbols" && length >= 4 && Math.random() < 0.85) {
    const position = 1 + Math.floor(Math.random() * (length - 2));
    name = name.slice(0, position) + pick("._") + name.slice(position + 1);
  }
  return name;
}
function generateNames() {
  const length = Number(lengthSelect.value);
  const style = styleSelect.value;
  const names = new Set();
  let attempts = 0;
  while (names.size < 10 && attempts < 1200) {
    names.add(makeName(length, style));
    attempts++;
  }
  // A fallback is extremely unlikely, but guarantees ten different outputs.
  while (names.size < 10) names.add(makeName(length, "letters") + names.size);
  currentNames = [...names].slice(0, 10);
  renderNames();
  checkerStatus.textContent = "Shortlist ready. Public-profile checks are only hints.";
}
function statusLabel(status) {
  if (status === "taken") return "PROFILE FOUND";
  if (status === "possible") return "POSSIBLE LEAD";
  if (status === "unknown") return "UNCONFIRMED";
  return "NOT CHECKED";
}
function renderNames(statusMap = {}) {
  countEl.textContent = String(currentNames.length).padStart(2, "0");
  copyAllBtn.disabled = currentNames.length === 0;
  checkBtn.disabled = currentNames.length === 0 || isChecking;
  resultsEl.replaceChildren();
  currentNames.forEach((name, index) => {
    const status = statusMap[name] || "notchecked";
    const card = document.createElement("article");
    card.className = "result-card";
    if (["taken", "possible", "unknown"].includes(status)) card.dataset.status = status;

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const nameWrap = document.createElement("div");
    nameWrap.className = "name-wrap";
    const handle = document.createElement("div");
    handle.className = "handle";
    handle.textContent = "@" + name;
    const badge = document.createElement("span");
    badge.className = "status-badge" + (status === "notchecked" ? "" : " " + status);
    badge.textContent = statusLabel(status);
    nameWrap.append(handle, badge);

    const actions = document.createElement("div");
    actions.className = "result-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-button";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.setAttribute("aria-label", "Copy @" + name);
    copyBtn.addEventListener("click", async () => {
      const ok = await copyText(name);
      copyBtn.textContent = ok ? "Copied" : "Select";
      window.setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "open-button";
    openBtn.type = "button";
    openBtn.textContent = "Open ↗";
    openBtn.setAttribute("aria-label", "Open Instagram profile page for " + name);
    openBtn.addEventListener("click", () => window.open("https://www.instagram.com/" + encodeURIComponent(name) + "/", "_blank", "noopener,noreferrer"));
    actions.append(copyBtn, openBtn);
    card.append(rank, nameWrap, actions);
    resultsEl.append(card);
  });
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  }
}
copyAllBtn.addEventListener("click", async () => {
  const ok = await copyText(currentNames.join("\n"));
  copyAllBtn.textContent = ok ? "Copied ✓" : "Copy failed";
  window.setTimeout(() => { copyAllBtn.textContent = "Copy all ↗"; }, 1500);
});
generateBtn.addEventListener("click", generateNames);
checkBtn.addEventListener("click", checkProfiles);

async function checkProfiles() {
  if (isChecking || currentNames.length === 0) return;
  if (!API_BASE.startsWith("https://") || API_BASE.includes("PASTE_CLOUDFLARE")) {
    checkerStatus.textContent = "Backend not connected yet. Add your Cloudflare Worker URL to API_BASE in app.js, then commit.";
    return;
  }
  isChecking = true;
  checkBtn.disabled = true;
  checkBtn.textContent = "Checking public pages…";
  checkerStatus.textContent = "Checking up to 10 public pages slowly. Instagram may block or limit requests.";
  const statusMap = {};
  try {
    const url = new URL(API_BASE);
    url.searchParams.set("names", currentNames.join(","));
    const response = await fetch(url.toString(), { method: "GET", headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Worker responded with HTTP " + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.results)) throw new Error("Unexpected worker response");
    for (const item of payload.results) {
      if (currentNames.includes(item.username)) statusMap[item.username] = ["taken", "possible", "unknown"].includes(item.status) ? item.status : "unknown";
    }
    currentNames.forEach((name) => { if (!statusMap[name]) statusMap[name] = "unknown"; });
    renderNames(statusMap);
    const possible = Object.values(statusMap).filter((s) => s === "possible").length;
    const taken = Object.values(statusMap).filter((s) => s === "taken").length;
    const unknown = currentNames.length - possible - taken;
    checkerStatus.textContent = `Done: ${taken} profile(s) found, ${possible} possible lead(s), ${unknown} unconfirmed. Verify possible leads in Instagram itself.`;
  } catch (error) {
    checkerStatus.textContent = "Could not complete the check. Instagram or the backend may block the request. " + (error?.message || "Try again later.");
  } finally {
    isChecking = false;
    checkBtn.textContent = "Check these 10 profiles";
    checkBtn.disabled = currentNames.length === 0;
  }
}

// Give the user ten ideas as soon as the page opens.
generateNames();
