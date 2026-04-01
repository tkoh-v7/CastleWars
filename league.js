const API_BASE = "https://cwl.r-2007scaper.workers.dev";

const FETCH_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// =========================
// UTIL
// =========================

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmt(ts) {
  return new Date(ts).toLocaleString();
}

// =========================
// FETCH CORE (FIXED)
// =========================

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function api(path, options = {}) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(API_BASE + path, {
        method: options.method || "GET",
        body: options.body,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        credentials: "include" // 🔥 REQUIRED
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      return data;

    } catch (err) {
      lastError = err;

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  throw lastError;
}

// =========================
// AUTH
// =========================

async function signup(username, password) {
  return api("/api/league/signup", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

async function login(username, password) {
  return api("/api/league/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

async function logout() {
  return api("/api/league/logout", {
    method: "POST"
  });
}

async function me() {
  return api("/api/league/me");
}

// =========================
// TEAMS
// =========================

async function createTeam(name, tag) {
  return api("/api/league/team/create", {
    method: "POST",
    body: JSON.stringify({ name, tag })
  });
}

async function getMyTeam() {
  return api("/api/league/team/my");
}

async function listTeams() {
  return api("/api/league/teams");
}

async function createInvite() {
  return api("/api/league/team/invite", {
    method: "POST"
  });
}

async function joinTeam(code) {
  return api("/api/league/team/join", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

// =========================
// CHALLENGES
// =========================

async function createChallenge(title, notes) {
  return api("/api/league/challenge/create", {
    method: "POST",
    body: JSON.stringify({ title, notes })
  });
}

async function listOpenChallenges() {
  return api("/api/league/challenges/open");
}

async function acceptChallenge(challengeId) {
  return api("/api/league/challenge/accept", {
    method: "POST",
    body: JSON.stringify({ challengeId })
  });
}

// =========================
// MATCHES
// =========================

async function getMyMatches() {
  return api("/api/league/matches/my");
}

async function reportMatch(matchId, result) {
  return api("/api/league/match/report", {
    method: "POST",
    body: JSON.stringify({ matchId, result })
  });
}

// =========================
// LEADERBOARDS
// =========================

async function getGlobalLeaderboard() {
  return api("/api/league/leaderboard/global");
}

async function getSeasonLeaderboard() {
  return api("/api/league/leaderboard/season");
}
