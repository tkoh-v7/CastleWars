const API_BASE_CANDIDATES = [
  window.location.origin,
  "https://cwl.r-2007scaper.workers.dev"
].filter((value, index, list) => value && list.indexOf(value) === index);
const DONATE_URL = "https://buymeacoffee.com/tkohv7";
const PUBLIC_PAGE_IDS = new Set(["home", "signup", "login", "season", "lifetime", "leaderboards"]);
const RESULT_LABELS = { win: "Win", draw: "Draw", loss: "Loss" };

let sessionCache = null;
let apiBasePromise = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : "Unknown";
}

function setStatus(targetId, message, type = "info") {
  const el = document.getElementById(targetId);
  if (!el) return;
  const tone = type === "error" ? "error" : type === "success" ? "success" : "info";
  el.innerHTML = message ? `<div class="notice ${tone}">${escapeHtml(message)}</div>` : "";
}

function renderEmpty(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getNextUrl() {
  const next = new URLSearchParams(location.search).get("next");
  if (!next || next.startsWith("http")) return "dashboard.html";
  return next;
}

function goToNextOrDashboard() {
  location.href = getNextUrl();
}

function clearSessionCache() {
  sessionCache = null;
}

async function api(path, options = {}) {
  const base = await resolveApiBase();
  const res = await fetch(base + path, {
    method: options.method || "GET",
    body: options.body,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include"
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function resolveApiBase() {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      for (const base of API_BASE_CANDIDATES) {
        try {
          const res = await fetch(base + "/api/ping", { credentials: "include" });
          if (!res.ok) continue;

          const data = await res.json().catch(() => null);
          if (data?.ok === true && data?.service === "cw-api") {
            return base;
          }
        } catch {}
      }

      return API_BASE_CANDIDATES[API_BASE_CANDIDATES.length - 1];
    })();
  }

  return apiBasePromise;
}

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
  return api("/api/league/logout", { method: "POST" });
}

async function me() {
  return api("/api/league/me");
}

async function createTeamRequest(name, tag) {
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
  return api("/api/league/team/invite", { method: "POST" });
}

async function joinTeamRequest(code) {
  return api("/api/league/team/join", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

async function leaveTeamRequest() {
  return api("/api/league/team/leave", { method: "POST" });
}

async function disbandTeamRequest() {
  return api("/api/league/team/disband", { method: "POST" });
}

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

async function getMyMatches() {
  return api("/api/league/matches/my");
}

async function reportMatch(matchId, result) {
  return api("/api/league/match/report", {
    method: "POST",
    body: JSON.stringify({ matchId, result })
  });
}

async function getGlobalLeaderboard() {
  return api("/api/league/leaderboard/global");
}

async function getSeasonLeaderboard() {
  return api("/api/league/leaderboard/season");
}

async function getPlayerLeaderboard() {
  return api("/api/league/leaderboard/players");
}

async function getSession(force = false) {
  if (force || !sessionCache) {
    sessionCache = (async () => {
      try {
        return await me();
      } catch (err) {
        if (err.status === 401) return null;
        return null;
      }
    })();
  }

  return sessionCache;
}

function getNavLinks(session) {
  if (session) {
    return [
      ["home", "index.html", "Home"],
      ["dashboard", "dashboard.html", "Dashboard"],
      ["teams", "teams.html", "Teams"],
      ["challenges", "challenges.html", "Challenges"],
      ["leaderboards", "leaderboards.html", "Leaderboards"],
      ["matches", "matches.html", "Matches"],
      ["donate", DONATE_URL, "Donate"]
    ];
  }

  return [
    ["home", "index.html", "Home"],
    ["signup", "signup.html", "Sign Up"],
    ["login", "login.html", "Sign In"],
    ["leaderboards", "leaderboards.html", "Leaderboards"],
    ["donate", DONATE_URL, "Donate"]
  ];
}

function isNavActive(id, activePage) {
  if (id === "leaderboards") return ["leaderboards", "season", "lifetime"].includes(activePage);
  if (id === "challenges") return ["challenges", "create-challenge"].includes(activePage);
  if (id === "teams") return ["teams", "join-team", "create-team"].includes(activePage);
  if (id === "donate") return false;
  return id === activePage;
}

function ensureNavbarControls() {
  const topbarInner = document.querySelector(".topbar-inner");
  const mainNav = document.querySelector(".main-nav");
  if (!topbarInner || !mainNav) return;

  let burger = document.getElementById("navToggle");
  if (!burger) {
    burger = document.createElement("button");
    burger.type = "button";
    burger.id = "navToggle";
    burger.className = "nav-toggle";
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Toggle navigation");
    burger.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    topbarInner.insertBefore(burger, mainNav);

    burger.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      document.body.classList.remove("nav-open");
      burger.setAttribute("aria-expanded", "false");
    }
  });
}

function showAuthAwareNav(session, activePage) {
  document.body.classList.toggle("is-authenticated", Boolean(session));
  document.body.classList.add("nav-ready");
  ensureNavbarControls();

  const mainNav = document.querySelector(".main-nav");
  if (mainNav) {
    mainNav.innerHTML = getNavLinks(session)
      .map(([id, href, label]) => `<a href="${href}" data-nav="${id}" class="${isNavActive(id, activePage) ? "active" : ""}" ${href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`)
      .join("");
  }

  const authSummary = document.getElementById("authSummary");
  if (authSummary) {
    if (session) {
      authSummary.textContent = `${session.user.username} - ${session.team ? session.team.name : "No Team"}`;
      authSummary.style.display = "";
    } else {
      authSummary.textContent = "";
      authSummary.style.display = "none";
    }
  }

  const authActions = document.getElementById("authActions");
  if (authActions) {
    authActions.innerHTML = session
      ? `
          <button class="button ghost" type="button" id="logoutAction">Log Out</button>
        `
      : "";

    const logoutBtn = document.getElementById("logoutAction");
    if (logoutBtn) logoutBtn.addEventListener("click", async () => logoutUser());
  }

  const userGreeting = document.getElementById("userGreeting");
  if (userGreeting) {
    userGreeting.textContent = session
      ? `Signed in as ${session.user.username}`
      : "Sign in to manage teams, challenges, and match reports.";
  }
}

async function initLeaguePage(activePage) {
  const session = await getSession();
  showAuthAwareNav(session, activePage);

  if (!session && !PUBLIC_PAGE_IDS.has(activePage)) {
    const next = encodeURIComponent(location.pathname.split("/").pop() || "dashboard.html");
    location.href = `login.html?next=${next}`;
    return null;
  }

  return session;
}

function renderShortcutGrid(session) {
  const target = document.getElementById("dashboardShortcuts");
  if (!target) return;

  target.innerHTML = `
    <a class="action-tile" href="teams.html">
      <span class="action-label">Teams</span>
      <span class="action-copy">Browse the league roster and scout opponents.</span>
    </a>
    <a class="action-tile" href="${session?.team ? "join-team.html" : "create-team.html"}">
      <span class="action-label">${session?.team ? "Invite Flow" : "Create Team"}</span>
      <span class="action-copy">${session?.team ? "Owners can generate invite codes from the dashboard." : "Create your roster and enter the season."}</span>
    </a>
    <a class="action-tile" href="challenges.html">
      <span class="action-label">Challenges</span>
      <span class="action-copy">Accept open fixtures and keep the board moving.</span>
    </a>
    <a class="action-tile" href="leaderboards.html">
      <span class="action-label">Leaderboards</span>
      <span class="action-copy">Open the seasonal ladder and the lifetime table in one place.</span>
    </a>
    <a class="action-tile" href="matches.html">
      <span class="action-label">Matches</span>
      <span class="action-copy">Report results once both teams have played.</span>
    </a>
  `;
}

function renderMemberList(members) {
  return members.map((member) => `
    <div class="list-row">
      <div>
        <div class="row-title">${escapeHtml(member.username)}</div>
        <div class="row-meta">Joined ${escapeHtml(fmt(member.joinedAt))}</div>
      </div>
      <span class="status-chip subtle">${escapeHtml(member.role)}</span>
    </div>
  `).join("");
}

async function signupUser(username, password, statusId = "signupStatus") {
  setStatus(statusId, "Creating account...");
  try {
    await signup(username.trim(), password);
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "Account created. Redirecting to your dashboard.", "success");
    setTimeout(goToNextOrDashboard, 450);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function loginUser(username, password, statusId = "loginStatus") {
  setStatus(statusId, "Signing you in...");
  try {
    await login(username.trim(), password);
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "Login successful. Redirecting.", "success");
    setTimeout(goToNextOrDashboard, 350);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function logoutUser() {
  try {
    await logout();
  } finally {
    clearSessionCache();
    location.href = "index.html";
  }
}

async function loadAuthSummary() {
  const activePage = document.body.dataset.page || "home";
  const session = await getSession();
  showAuthAwareNav(session, activePage);
  return session;
}

async function loadMyTeam(targetId = "myTeamBox", statusId = "myTeamStatus") {
  const target = document.getElementById(targetId);
  if (!target) return;

  const session = await getSession();
  target.innerHTML = renderEmpty("Loading team data...");
  setStatus(statusId, "");

  try {
    const data = await getMyTeam();
    const isOwner = Boolean(data.team && session?.user?.id === data.team.ownerId);
    syncInviteButton(data.team, isOwner);

    if (!data.team) {
      target.innerHTML = `
        <div class="panel-block">
          <h3>No Team Yet</h3>
          <p>Create a new roster or join one with an invite code to start playing league matches.</p>
          <div class="button-row">
            <a class="button" href="create-team.html">Create Team</a>
            <a class="button ghost" href="join-team.html">Join with Code</a>
          </div>
        </div>
      `;
      return;
    }

    const myMember = data.members.find((member) => member.userId === session?.user?.id);
    const myRole = myMember?.role || (isOwner ? "Owner" : "Member");

    target.innerHTML = `
      <div class="split-card">
        <div class="team-banner">
          <div class="tag-badge">${escapeHtml(data.team.tag)}</div>
          <div>
            <h3>${escapeHtml(data.team.name)}</h3>
            <p>Owner: ${escapeHtml(data.team.ownerUsername)} · Your role: ${escapeHtml(myRole)}</p>
          </div>
        </div>
        <div class="info-stack">
          <div class="kpi-mini">
            <span class="kpi-mini-label">Roster Size</span>
            <span class="kpi-mini-value">${data.members.length}</span>
          </div>
          <div class="kpi-mini">
            <span class="kpi-mini-label">Created</span>
            <span class="kpi-mini-value">${escapeHtml(fmt(data.team.createdAt))}</span>
          </div>
        </div>
      </div>
      <div class="button-row">
        ${isOwner
          ? `<button class="button danger-button" type="button" id="disbandTeamBtn">Disband Team</button>`
          : `<button class="button ghost" type="button" id="leaveTeamBtn">Leave Team</button>`}
      </div>
      <div class="section-subtitle">Roster</div>
      <div class="stack-list">${renderMemberList(data.members)}</div>
    `;

    const leaveBtn = document.getElementById("leaveTeamBtn");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", async () => {
        await leaveTeam(statusId);
      });
    }

    const disbandBtn = document.getElementById("disbandTeamBtn");
    if (disbandBtn) {
      disbandBtn.addEventListener("click", async () => {
        if (!confirm("Disband this team? This will remove every member and cancel open league activity.")) return;
        await disbandTeam(statusId);
      });
    }
  } catch (err) {
    syncInviteButton(null, false);
    target.innerHTML = renderEmpty("Unable to load your team right now.");
    setStatus(statusId, err.message, "error");
  }
}

function syncInviteButton(team, isOwner) {
  const inviteBtn = document.getElementById("inviteBtn");
  if (!inviteBtn) return;

  inviteBtn.disabled = !team || !isOwner;
  if (!team) {
    inviteBtn.textContent = "Create or Join a Team First";
    return;
  }

  inviteBtn.textContent = isOwner ? "Generate Invite Code" : "Owner Invite Only";
}

async function generateInvite(statusId = "myTeamStatus") {
  setStatus(statusId, "Generating invite code...");
  try {
    const result = await createInvite();
    setStatus(statusId, `Invite code created: ${result.code}`, "success");
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function leaveTeam(statusId = "myTeamStatus") {
  setStatus(statusId, "Leaving team...");
  try {
    await leaveTeamRequest();
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "You left the team.", "success");
    setTimeout(() => {
      location.reload();
    }, 350);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function disbandTeam(statusId = "myTeamStatus") {
  setStatus(statusId, "Disbanding team...");
  try {
    await disbandTeamRequest();
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "Team disbanded.", "success");
    setTimeout(() => {
      location.reload();
    }, 350);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function createTeam(name, tag, statusId = "teamCreateStatus") {
  setStatus(statusId, "Creating team...");
  try {
    await createTeamRequest(name.trim(), tag.trim().toUpperCase());
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "Team created. Redirecting to dashboard.", "success");
    setTimeout(() => {
      location.href = "dashboard.html";
    }, 450);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

async function joinTeam(code, statusId = "joinTeamStatus") {
  setStatus(statusId, "Joining team...");
  try {
    await joinTeamRequest(code.trim());
    clearSessionCache();
    await getSession(true);
    setStatus(statusId, "Team joined. Redirecting to dashboard.", "success");
    setTimeout(() => {
      location.href = "dashboard.html";
    }, 450);
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

function renderTeamCards(teams) {
  if (!teams.length) return renderEmpty("No teams have registered yet.");

  return teams.map((team) => `
    <article class="league-card">
      <div class="league-card-top">
        <div>
          <div class="tag-badge">${escapeHtml(team.tag)}</div>
          <h3>${escapeHtml(team.name)}</h3>
        </div>
        <span class="status-chip">${team.memberCount} members</span>
      </div>
      <p>Owner: ${escapeHtml(team.ownerUsername)}</p>
      <div class="row-meta">Created ${escapeHtml(fmt(team.createdAt))}</div>
    </article>
  `).join("");
}

async function loadTeams(targetId = "teamsList") {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = renderEmpty("Loading league teams...");

  try {
    const teams = await listTeams();
    target.innerHTML = `<div class="card-grid">${renderTeamCards(teams)}</div>`;
  } catch (err) {
    target.innerHTML = renderEmpty("Teams could not be loaded.");
    setStatus("teamsStatus", err.message, "error");
  }
}

function renderChallengeCards(challenges, session) {
  if (!challenges.length) return renderEmpty("No open challenges are waiting right now.");

  return challenges.map((challenge) => {
    const mine = session?.team?.id === challenge.fromTeamId;
    const action = mine
      ? `<span class="status-chip subtle">Your Challenge</span>`
      : session
        ? `<button class="button small" type="button" onclick="acceptOpenChallenge('${escapeHtml(challenge.id)}')">Accept</button>`
        : `<a class="button small ghost" href="login.html?next=challenges.html">Sign In to Accept</a>`;
    const guidance = mine
      ? `<div class="row-meta">You can only accept another team's challenge.</div>`
      : ``;

    return `
      <article class="league-card">
        <div class="league-card-top">
          <div>
            <div class="tag-badge">${escapeHtml(challenge.fromTeamTag)}</div>
            <h3>${escapeHtml(challenge.title)}</h3>
          </div>
          ${action}
        </div>
        <p>Posted by ${escapeHtml(challenge.fromTeamName)}</p>
        <div class="row-meta">${escapeHtml(challenge.notes || "No extra notes provided.")}</div>
        <div class="row-meta">Opened ${escapeHtml(fmt(challenge.createdAt))}</div>
        ${guidance}
      </article>
    `;
  }).join("");
}

async function loadChallenges(targetId = "openChallenges") {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = renderEmpty("Loading open challenges...");

  try {
    const [challenges, session] = await Promise.all([listOpenChallenges(), getSession()]);
    target.innerHTML = `<div class="card-grid">${renderChallengeCards(challenges, session)}</div>`;
  } catch (err) {
    target.innerHTML = renderEmpty("Challenges could not be loaded.");
    setStatus("challengesStatus", err.message, "error");
  }
}

async function acceptOpenChallenge(challengeId) {
  try {
    await acceptChallenge(challengeId);
    await loadChallenges();
    setStatus("challengesStatus", "Challenge accepted. Match created.", "success");
  } catch (err) {
    setStatus("challengesStatus", err.message, "error");
  }
}

async function postChallenge(title, notes, statusId = "challengePostStatus") {
  setStatus(statusId, "Posting challenge...");
  try {
    await createChallenge(title.trim(), notes.trim());
    setStatus(statusId, "Challenge posted. Head to the challenge board to watch for takers.", "success");
    document.getElementById("challengeTitle").value = "";
    document.getElementById("challengeNotes").value = "";
  } catch (err) {
    setStatus(statusId, err.message, "error");
  }
}

function renderMatchReports(match) {
  const reports = [];
  if (match.reports.teamA) reports.push(`${match.teamAName}: ${RESULT_LABELS[match.reports.teamA.result]}`);
  if (match.reports.teamB) reports.push(`${match.teamBName}: ${RESULT_LABELS[match.reports.teamB.result]}`);
  return reports.length ? reports.join(" · ") : "No reports submitted yet.";
}

function renderMatchCards(matches) {
  if (!matches.length) return renderEmpty("No matches yet. Accept a challenge to generate your first fixture.");

  return matches.map((match) => {
    const alreadyReported = match.myTeamId === match.teamAId ? match.reports.teamA : match.reports.teamB;
    const actionBlock = match.status === "active" && !alreadyReported
      ? `
          <div class="button-row tight">
            <button class="button small" type="button" onclick="submitMatchReport('${escapeHtml(match.id)}','win')">Report Win</button>
            <button class="button small ghost" type="button" onclick="submitMatchReport('${escapeHtml(match.id)}','draw')">Report Draw</button>
            <button class="button small ghost" type="button" onclick="submitMatchReport('${escapeHtml(match.id)}','loss')">Report Loss</button>
          </div>
        `
      : `<span class="status-chip subtle">${alreadyReported ? `You reported ${RESULT_LABELS[alreadyReported.result]}` : match.status}</span>`;

    return `
      <article class="league-card">
        <div class="league-card-top">
          <div>
            <h3>${escapeHtml(match.teamAName)} vs ${escapeHtml(match.teamBName)}</h3>
            <div class="row-meta">Season ${escapeHtml(match.seasonId)}</div>
          </div>
          <span class="status-chip ${match.status === "confirmed" ? "success" : match.status === "disputed" ? "danger" : ""}">${escapeHtml(match.status)}</span>
        </div>
        <p>Reports: ${escapeHtml(renderMatchReports(match))}</p>
        <div class="row-meta">Created ${escapeHtml(fmt(match.createdAt))}</div>
        ${match.confirmedOutcome ? `<div class="row-meta">Confirmed result recorded.</div>` : ""}
        ${actionBlock}
      </article>
    `;
  }).join("");
}

async function loadMatches(targetId = "matchesBox") {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = renderEmpty("Loading matches...");

  try {
    const matches = await getMyMatches();
    target.innerHTML = `<div class="stack-list">${renderMatchCards(matches)}</div>`;
  } catch (err) {
    target.innerHTML = renderEmpty("Matches could not be loaded.");
    setStatus("matchesStatus", err.message, "error");
  }
}

async function submitMatchReport(matchId, result) {
  try {
    const outcome = await reportMatch(matchId, result);
    await loadMatches();
    const statusMessage = outcome.status === "confirmed"
      ? "Both teams agreed. League points applied."
      : outcome.status === "disputed"
        ? "Reports conflict. Match marked as disputed."
        : "Report submitted. Waiting for the other team.";
    setStatus("matchesStatus", statusMessage, "success");
  } catch (err) {
    setStatus("matchesStatus", err.message, "error");
  }
}

function renderLeaderboardTable(rows) {
  if (!rows.length) return renderEmpty("No leaderboard entries yet.");

  return `
    <div class="table-wrap">
      <table class="board-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Points</th>
            <th>Played</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>#${row.rank}</td>
              <td>
                <div class="row-title">${escapeHtml(row.teamName)}</div>
                <div class="row-meta">${escapeHtml(row.teamTag)}</div>
              </td>
              <td>${row.points}</td>
              <td>${row.played}</td>
              <td>${row.wins}</td>
              <td>${row.draws}</td>
              <td>${row.losses}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayerLeaderboardTable(rows) {
  if (!rows.length) return renderEmpty("No player stats yet.");

  return `
    <div class="table-wrap">
      <table class="board-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Points</th>
            <th>Played</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>#${row.rank}</td>
              <td>
                <div class="row-title">${escapeHtml(row.username)}</div>
                <div class="row-meta">Lifetime member record</div>
              </td>
              <td>${row.points}</td>
              <td>${row.played}</td>
              <td>${row.wins}</td>
              <td>${row.draws}</td>
              <td>${row.losses}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadSeasonBoard(boardId = "seasonBoard", seasonNameId = "seasonName") {
  const board = document.getElementById(boardId);
  const seasonName = document.getElementById(seasonNameId);
  if (!board) return;

  board.innerHTML = renderEmpty("Loading season standings...");

  try {
    const data = await getSeasonLeaderboard();
    if (seasonName) seasonName.textContent = `Current season: ${data.seasonId}`;
    board.innerHTML = renderLeaderboardTable(data.rows);
  } catch (err) {
    board.innerHTML = renderEmpty("Season leaderboard unavailable.");
    setStatus("seasonStatus", err.message, "error");
  }
}

async function loadGlobalBoard(boardId = "globalBoard") {
  const board = document.getElementById(boardId);
  if (!board) return;

  board.innerHTML = renderEmpty("Loading lifetime standings...");

  try {
    const rows = await getGlobalLeaderboard();
    board.innerHTML = renderLeaderboardTable(rows);
  } catch (err) {
    board.innerHTML = renderEmpty("Lifetime leaderboard unavailable.");
    setStatus("globalStatus", err.message, "error");
  }
}

async function loadPlayerBoard(boardId = "playerBoard", statusId = "playerStatus") {
  const board = document.getElementById(boardId);
  if (!board) return;

  board.innerHTML = renderEmpty("Loading player standings...");

  try {
    const rows = await getPlayerLeaderboard();
    board.innerHTML = renderPlayerLeaderboardTable(rows);
  } catch (err) {
    board.innerHTML = renderEmpty("Player leaderboard unavailable.");
    setStatus(statusId, err.message, "error");
  }
}

async function loadHomeHighlights() {
  const seasonPreview = document.getElementById("seasonPreview");
  const globalPreview = document.getElementById("globalPreview");
  const challengePreview = document.getElementById("challengePreview");
  if (!seasonPreview || !globalPreview || !challengePreview) return;

  seasonPreview.innerHTML = renderEmpty("Loading season board...");
  globalPreview.innerHTML = renderEmpty("Loading lifetime board...");
  challengePreview.innerHTML = renderEmpty("Loading open challenge feed...");

  try {
    const [season, globalRows, challenges, session] = await Promise.all([
      getSeasonLeaderboard(),
      getGlobalLeaderboard(),
      listOpenChallenges(),
      getSession()
    ]);

    showAuthAwareNav(session, "home");
    seasonPreview.innerHTML = renderLeaderboardTable(season.rows.slice(0, 5));
    globalPreview.innerHTML = renderLeaderboardTable(globalRows.slice(0, 5));
    challengePreview.innerHTML = challenges.length
      ? challenges.slice(0, 3).map((challenge) => `
          <div class="list-row">
            <div>
              <div class="row-title">${escapeHtml(challenge.title)}</div>
              <div class="row-meta">${escapeHtml(challenge.fromTeamName)} · ${escapeHtml(fmt(challenge.createdAt))}</div>
            </div>
            <span class="tag-badge">${escapeHtml(challenge.fromTeamTag)}</span>
          </div>
        `).join("")
      : renderEmpty("No open challenges at the moment.");
  } catch {
    seasonPreview.innerHTML = renderEmpty("Season board unavailable.");
    globalPreview.innerHTML = renderEmpty("Lifetime board unavailable.");
    challengePreview.innerHTML = renderEmpty("Challenge feed unavailable.");
  }
}

async function loadDashboardExtras() {
  const challengeTarget = document.getElementById("dashboardChallenges");
  if (!challengeTarget) return;

  challengeTarget.innerHTML = renderEmpty("Loading challenge feed...");

  try {
    const challenges = await listOpenChallenges();
    challengeTarget.innerHTML = challenges.length
      ? challenges.slice(0, 4).map((challenge) => `
          <div class="list-row">
            <div>
              <div class="row-title">${escapeHtml(challenge.title)}</div>
              <div class="row-meta">${escapeHtml(challenge.fromTeamName)} · ${escapeHtml(challenge.notes || "No extra notes")}</div>
            </div>
            <a class="utility-link" href="challenges.html">Open Board</a>
          </div>
        `).join("")
      : renderEmpty("No open challenges right now.");
  } catch {
    challengeTarget.innerHTML = renderEmpty("Open challenges unavailable.");
  }
}

async function loadDashboardBoards() {
  const seasonTarget = document.getElementById("dashboardSeasonBoard");
  const globalTarget = document.getElementById("dashboardGlobalBoard");
  if (!seasonTarget && !globalTarget) return;

  if (seasonTarget) seasonTarget.innerHTML = renderEmpty("Loading season standings...");
  if (globalTarget) globalTarget.innerHTML = renderEmpty("Loading lifetime standings...");

  try {
    const [season, globalRows] = await Promise.all([
      getSeasonLeaderboard(),
      getGlobalLeaderboard()
    ]);

    if (seasonTarget) seasonTarget.innerHTML = renderLeaderboardTable(season.rows.slice(0, 5));
    if (globalTarget) globalTarget.innerHTML = renderLeaderboardTable(globalRows.slice(0, 5));
  } catch {
    if (seasonTarget) seasonTarget.innerHTML = renderEmpty("Season standings unavailable.");
    if (globalTarget) globalTarget.innerHTML = renderEmpty("Lifetime standings unavailable.");
  }
}

async function initHomePage() { await initLeaguePage("home"); await loadHomeHighlights(); }
async function initSignupPage() { await initLeaguePage("signup"); }
async function initLoginPage() { await initLeaguePage("login"); }
async function initDashboardPage() {
  const session = await initLeaguePage("dashboard");
  if (!session) return;
  renderShortcutGrid(session);
  await Promise.all([loadMyTeam(), loadDashboardExtras(), loadDashboardBoards()]);
}
async function initTeamsPage() { await initLeaguePage("teams"); await loadTeams(); }
async function initJoinTeamPage() { await initLeaguePage("join-team"); }
async function initCreateTeamPage() { await initLeaguePage("create-team"); }
async function initChallengesPage() { await initLeaguePage("challenges"); await loadChallenges(); }
async function initCreateChallengePage() { await initLeaguePage("create-challenge"); }
async function initMatchesPage() { await initLeaguePage("matches"); await loadMatches(); }
async function initSeasonPage() { await initLeaguePage("season"); await loadSeasonBoard(); }
async function initLifetimePage() {
  await initLeaguePage("lifetime");
  await Promise.all([loadGlobalBoard(), loadPlayerBoard("playerLifetimeBoard", "playerLifetimeStatus")]);
}
async function initLeaderboardsHubPage() {
  await initLeaguePage("leaderboards");
  await Promise.all([
    loadSeasonBoard("seasonHubBoard", "seasonHubName"),
    loadGlobalBoard("globalHubBoard"),
    loadPlayerBoard("playerHubBoard", "playerHubStatus")
  ]);
}
