// ─────────────────────────────────────────
//  HISONLY App — Core JS (app.js)
// ─────────────────────────────────────────

const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getUsers: async () => { const res = await fetch('/api/data/hisonly_users'); const data = await res.json(); return data || []; },
  saveUsers: async (u) => { await fetch('/api/data/hisonly_users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) }); },
  getCurrentUser: () => DB.get('hisonly_current'),
  setCurrentUser: (u) => DB.set('hisonly_current', u),
  getAvailability: async () => { const res = await fetch('/api/data/hisonly_avail'); const data = await res.json(); return data || {}; },
  saveAvailability: async (a) => { await fetch('/api/data/hisonly_avail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }); },
  getSchedules: async () => { const res = await fetch('/api/data/hisonly_schedules'); const data = await res.json(); return data || {}; },
  saveSchedules: async (s) => { await fetch('/api/data/hisonly_schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }); },
  getLineups: async () => { const res = await fetch('/api/data/hisonly_lineups'); const data = await res.json(); return data || {}; },
  saveLineups: async (l) => { await fetch('/api/data/hisonly_lineups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(l) }); },
};

const ADMIN_CODE = 'HISONLY2025';
const LEADER_CODE = 'WORSHIP2025';

const ROLES = {
  singer: { label: 'Singer', emoji: '🎤' },
  musician: { label: 'Musician', emoji: '🎸' },
  multimedia: { label: 'Multimedia', emoji: '🎬' },
  'worship-leader': { label: 'Worship Leader', emoji: '🎙️' },
};

const INSTRUMENTS = ['Guitar', 'Bass Guitar', 'Drums', 'Keyboard/Piano', 'Violin', 'Cajon', 'Trumpet', 'Flute', 'Other'];
const MULTIMEDIA_ROLES = ['Video Camera', 'Photography', 'Screener (Lyrics/Slides)', 'OBS Operator', 'Lights'];

// ── Auth Guards ──
function requireAuth() {
  const user = DB.getCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  return user;
}
function requireAdmin() {
  const user = requireAuth();
  if (user && !user.isAdmin) { window.location.href = 'home.html'; return null; }
  return user;
}
function requireLeaderOrAdmin() {
  const user = requireAuth();
  if (user && !user.isAdmin && !user.isLeader) { window.location.href = 'home.html'; return null; }
  return user;
}

// ── Toast ──
function showToast(msg, type = 'info', duration = 3000) {
  let t = document.getElementById('global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Active Nav ──
function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-nav') === id);
  });
}

// ── Date Helpers ──
function isSunday(d) { return d.getDay() === 0; }
function isWednesday(d) { return d.getDay() === 3; }
function isServiceDay(d) { return isSunday(d) || isWednesday(d); }
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(dk) {
  const [y,m,d] = dk.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}
function formatShortDate(dk) {
  const [y,m,d] = dk.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

// ── Avatar initials ──
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Get user's scheduled assignments ──
async function getUserAssignments(userId) {
  const schedules = await DB.getSchedules();
  const results = [];
  for (const [dateKey, dayData] of Object.entries(schedules)) {
    for (const [slot, members] of Object.entries(dayData)) {
      if (members.includes(userId)) {
        results.push({ dateKey, slot });
      }
    }
  }
  return results.sort((a,b) => a.dateKey.localeCompare(b.dateKey));
}

// ── Get upcoming service dates ──
function getUpcomingServiceDates(months = 2) {
  const dates = [];
  const today = new Date();
  const end = new Date(today);
  end.setMonth(end.getMonth() + months);
  let cur = new Date(today);
  while (cur <= end) {
    if (isServiceDay(cur)) dates.push(dateKey(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── Get lineup for a service ──
async function getLineup(dk, slot) {
  const lineups = await DB.getLineups();
  return (lineups[dk] && lineups[dk][slot]) || null;
}

// ── Role display helper ──
function getRoleDisplay(user) {
  if (!user) return '';
  const role = ROLES[user.role] || { label: user.role, emoji: '👤' };
  let sub = '';
  if (user.role === 'musician' && user.instrument) sub = user.instrument;
  if (user.role === 'multimedia' && user.specialty) sub = user.specialty;
  if (user.role === 'worship-leader') sub = 'Worship Leader';
  return { emoji: role.emoji, label: role.label, sub };
}

// ── Register ──
async function registerUser(data) {
  const users = await DB.getUsers();
  const uname = data.username.trim().toLowerCase();
  if (users.find(u => u.username === uname)) {
    return { ok: false, error: 'Username already taken. Please choose another.' };
  }
  const isAdmin = data.adminCode === ADMIN_CODE;
  const isLeader = isAdmin || data.adminCode === LEADER_CODE || data.role === 'worship-leader';
  const user = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    name: data.name.trim(),
    username: uname,
    email: data.email ? data.email.toLowerCase().trim() : '',
    password: data.password,
    role: data.role,
    instrument: data.instrument || null,
    specialty: data.specialty || null,
    isAdmin,
    isLeader,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await DB.saveUsers(users);
  return { ok: true, user };
}

// ── Login ──
async function loginUser(username, password) {
  const users = await DB.getUsers();
  // Support login by username OR email (for flexibility)
  const uname = username.trim().toLowerCase();
  const user = users.find(u =>
    (u.username === uname || (u.email && u.email === uname)) && u.password === password
  );
  if (!user) return { ok: false, error: 'Invalid username or password.' };
  DB.setCurrentUser(user);
  return { ok: true, user };
}

// ── Logout ──
function logoutUser() {
  localStorage.removeItem('hisonly_current');
  window.location.href = 'index.html';
}

// ── Update current user in users array ──
async function updateCurrentUser(updates) {
  const current = DB.getCurrentUser();
  if (!current) return;
  const users = await DB.getUsers();
  const idx = users.findIndex(u => u.id === current.id);
  if (idx !== -1) {
    Object.assign(users[idx], updates);
    await DB.saveUsers(users);
    DB.setCurrentUser(users[idx]);
    return users[idx];
  }
}

// ── Get user by ID ──
async function getUserById(id) {
  const users = await DB.getUsers();
  return users.find(u => u.id === id) || null;
}
