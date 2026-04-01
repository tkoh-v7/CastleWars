const API_BASE = "https://cwl.r-2007scaper.workers.dev";

const FETCH_TIMEOUT = 10000; // 10 second timeout
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second between retries

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
        credentials: "include",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      return data;
    } catch (err) {
      lastError = err;
      
      // Don't retry on client errors (4xx)
      if (err.name === 'AbortError') {
        lastError = new Error('Request timeout - server not responding');
      }
      
      // Only retry on network errors or timeouts, not on 4xx errors
      if (attempt < MAX_RETRIES - 1 && (err.name === 'AbortError' || err.name === 'TypeError')) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }
      
      break;
    }
  }
  
  throw lastError || new Error("Request failed.");
}

function setStatus(el, text, type = "muted") {
  if (!el) return;
  el.innerHTML = text ? `<div class="${type}">${escapeHtml(text)}</div>` : "";
}

function renderTable(rows) {
  if (!rows.length) return `<p class="muted">Nothing here yet.</p>`;
  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Pts</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${row.rank}</td>
            <td><strong>${escapeHtml(row.teamName)}</strong> <span class="muted">[${escapeHtml(row.teamTag || "")}]</span></td>
            <td>${row.points}</td>
            <td>${row.wins}</td>
            <td>${row.draws}</td>
            <td>${row.losses}</td>
            <td>${row.played}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function loadAuthSummary(targetId = "authSummary") {
  const target = document.getElementById(targetId);
  if (!target) return;
  try {
    const data = await api("/api/league/me");
    target.textContent = `Logged in as ${data.user.username}`;
  } catch {
    target.textContent = "Logged out";
  }
}

async function signupUser(username, password, statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    await api("/api/league/signup", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setStatus(status, "Account created. You are now logged in.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function loginUser(username, password, statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    await api("/api/league/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setStatus(status, "Logged in.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function logoutUser() {
  try {
    await api("/api/league/logout", { method: "POST" });
  } catch {}
}

async function createTeam(name, tag, statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    await api("/api/league/team/create", {
      method: "POST",
      body: JSON.stringify({ name, tag })
    });
    setStatus(status, "Team created.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function joinTeam(code, statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    await api("/api/league/team/join", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    setStatus(status, "Joined team.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function generateInvite(statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    const data = await api("/api/league/team/invite", { method: "POST" });
    setStatus(status, "Invite code: " + data.code, "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function loadMyTeam(targetId = "myTeamBox") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = "<p class='muted'>Loading team...</p>";

  try {
    const data = await api("/api/league/team/my");

    if (!data.team) {
      target.innerHTML = "<p class='muted'>You are not in a team yet.</p>";
      return;
    }

    target.innerHTML = `
      <div class="item">
        <div class="between">
          <div>
            <h3>${escapeHtml(data.team.name)} <span class="muted">[${escapeHtml(data.team.tag)}]</span></h3>
            <p class="muted">Owner: ${escapeHtml(data.team.ownerUsername)}</p>
          </div>
          <div class="small muted">Created ${escapeHtml(fmt(data.team.createdAt))}</div>
        </div>
        <div style="margin-top:10px">
          <strong>Members</strong>
          ${data.members.length ? data.members.map(m => `
            <div class="item">
              <div class="between">
                <span>${escapeHtml(m.username)}</span>
                <span class="muted">${escapeHtml(m.role || "Member")}</span>
              </div>
            </div>
          `).join("") : `<p class="muted">No members.</p>`}
        </div>
      </div>
    `;
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadTeams(targetId = "teamsList") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = "<p class='muted'>Loading teams...</p>";

  try {
    const teams = await api("/api/league/teams");
    if (!teams.length) {
      target.innerHTML = "<p class='muted'>No teams yet.</p>";
      return;
    }

    target.innerHTML = teams.map(team => `
      <div class="item">
        <div class="between">
          <div>
            <strong>${escapeHtml(team.name)}</strong>
            <span class="muted">[${escapeHtml(team.tag)}]</span>
          </div>
          <div class="row">
            <span class="pill">${team.memberCount} members</span>
            <span class="pill">Owner: ${escapeHtml(team.ownerUsername)}</span>
          </div>
        </div>
      </div>
    `).join(""
    );
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function postChallenge(title, notes, statusId) {
  const status = document.getElementById(statusId);
  setStatus(status, "");

  try {
    await api("/api/league/challenge/create", {
      method: "POST",
      body: JSON.stringify({ title, notes })
    });
    setStatus(status, "Challenge posted.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

async function loadChallenges(targetId = "openChallenges") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = "<p class='muted'>Loading challenges...</p>";

  try {
    const items = await api("/api/league/challenges/open");
    if (!items.length) {
      target.innerHTML = "<p class='muted'>No open challenges.</p>";
      return;
    }

    target.innerHTML = items.map(item => `
      <div class="item">
        <div class="between">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div class="muted">${escapeHtml(item.fromTeamName)} [${escapeHtml(item.fromTeamTag)}]</div>
          </div>
          <div class="small muted">${escapeHtml(fmt(item.createdAt))}</div>
        </div>
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
        <div style="margin-top:10px">
          <button onclick="acceptChallenge('${item.id}')">Accept Challenge</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function acceptChallenge(challengeId) {
  try {
    await api("/api/league/challenge/accept", {
      method: "POST",
      body: JSON.stringify({ challengeId })
    });
    alert("Challenge accepted.");
    await loadChallenges();
  } catch (err) {
    alert(err.message);
  }
}

async function loadMatches(targetId = "matchesBox") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = "<p class='muted'>Loading matches...</p>";

  try {
    const items = await api("/api/league/matches/my");

    if (!items.length) {
      target.innerHTML = "<p class='muted'>No matches for your team yet.</p>";
      return;
    }

    target.innerHTML = items.map(match => {
      const myReport = match.myTeamId === match.teamAId ? match.reports.teamA : match.reports.teamB;
      const otherReport = match.myTeamId === match.teamAId ? match.reports.teamB : match.reports.teamA;

      const buttons = match.status === "active" && !myReport ? `
        <div class="row" style="margin-top:10px">
          <button onclick="reportMatch('${match.id}','win')" class="good">Report Win</button>
          <button onclick="reportMatch('${match.id}','draw')">Report Draw</button>
          <button onclick="reportMatch('${match.id}','loss')" class="warn">Report Loss</button>
        </div>
      ` : "";

      return `
        <div class="item">
          <div class="between">
            <div>
              <strong>${escapeHtml(match.teamAName)} [${escapeHtml(match.teamATag)}]</strong>
              <span class="muted">vs</span>
              <strong>${escapeHtml(match.teamBName)} [${escapeHtml(match.teamBTag)}]</strong>
            </div>
            <div class="row">
              <span class="pill">${escapeHtml(match.status)}</span>
              <span class="pill">${escapeHtml(match.seasonId)}</span>
            </div>
          </div>
          <p class="small muted">Created ${escapeHtml(fmt(match.createdAt))}</p>
          <div class="row">
            <span class="pill">Your report: ${escapeHtml(myReport?.result || "pending")}</span>
            <span class="pill">Other team: ${escapeHtml(otherReport?.result || "pending")}</span>
          </div>
          ${buttons}
        </div>
      `;
    }).join("");
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function reportMatch(matchId, result) {
  try {
    const data = await api("/api/league/match/report", {
      method: "POST",
      body: JSON.stringify({ matchId, result })
    });

    if (data.status === "disputed") {
      alert("Reports do not match. Match marked disputed.");
    } else if (data.status === "confirmed") {
      alert("Match confirmed and leaderboard updated.");
    } else {
      alert("Report submitted. Waiting for the other team.");
    }

    await loadMatches();
  } catch (err) {
    alert(err.message);
  }
}

async function loadSeasonBoard(targetId = "seasonBoard", seasonIdTarget = "seasonName") {
  const target = document.getElementById(targetId);
  const seasonTarget = document.getElementById(seasonIdTarget);
  if (!target) return;

  target.innerHTML = "<p class='muted'>Loading board...</p>";

  try {
    const data = await api("/api/league/leaderboard/season");
    if (seasonTarget) seasonTarget.textContent = "Current season: " + data.seasonId;
    target.innerHTML = renderTable(data.rows || []);
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadGlobalBoard(targetId = "globalBoard") {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = "<p class='muted'>Loading board...</p>";

  try {
    const data = await api("/api/league/leaderboard/global");
    target.innerHTML = renderTable(data || []);
  } catch (err) {
    target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

window.acceptChallenge = acceptChallenge;
window.reportMatch = reportMatch;
