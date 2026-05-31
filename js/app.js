// ─────────────────────────────────────────
//  HISONLY App — Core JS (app.js)
// ─────────────────────────────────────────

const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getUsers: async () => { 
    if (DB._usersCache && Date.now() - DB._usersTime < 2000) return DB._usersCache;
    const res = await fetch('/api/data/hisonly_users'); 
    const data = await res.json(); 
    DB._usersCache = data || [];
    DB._usersTime = Date.now();
    return DB._usersCache; 
  },
  saveUsers: async (u) => { 
    DB._usersCache = u;
    DB._usersTime = Date.now();
    await fetch('/api/data/hisonly_users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) }); 
  },
  getCurrentUser: () => DB.get('hisonly_current'),
  setCurrentUser: (u) => DB.set('hisonly_current', u),
  getAvailability: async () => { 
    if (DB._availCache && Date.now() - DB._availTime < 2000) return DB._availCache;
    const res = await fetch('/api/data/hisonly_avail'); 
    const data = await res.json(); 
    DB._availCache = data || {};
    DB._availTime = Date.now();
    return DB._availCache; 
  },
  saveAvailability: async (a) => { 
    DB._availCache = a;
    DB._availTime = Date.now();
    await fetch('/api/data/hisonly_avail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }); 
  },
  getSchedules: async () => { 
    if (DB._schedulesCache && Date.now() - DB._schedulesTime < 2000) return DB._schedulesCache;
    const res = await fetch('/api/data/hisonly_schedules'); 
    let data = await res.json(); 
    data = data || {};
    // Normalize legacy slot-based schedules into an array
    for (const dk in data) {
      if (typeof data[dk] === 'object' && !Array.isArray(data[dk])) {
        const members = [];
        for (const slot in data[dk]) {
          if (Array.isArray(data[dk][slot])) {
            members.push(...data[dk][slot]);
          }
        }
        data[dk] = [...new Set(members)];
      }
    }
    DB._schedulesCache = data;
    DB._schedulesTime = Date.now();
    return DB._schedulesCache; 
  },
  saveSchedules: async (s) => { 
    DB._schedulesCache = s;
    DB._schedulesTime = Date.now();
    await fetch('/api/data/hisonly_schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }); 
  },
  getLineups: async () => { 
    if (DB._lineupsCache && Date.now() - DB._lineupsTime < 2000) return DB._lineupsCache;
    const res = await fetch('/api/data/hisonly_lineups'); 
    const data = await res.json(); 
    DB._lineupsCache = data || {};
    DB._lineupsTime = Date.now();
    return DB._lineupsCache; 
  },
  saveLineups: async (l) => { 
    DB._lineupsCache = l;
    DB._lineupsTime = Date.now();
    await fetch('/api/data/hisonly_lineups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(l) }); 
  },
  getAnnouncements: async () => { 
    // Always fetch fresh — no cache for announcements so they always show
    // correctly after navigating between pages
    const res = await fetch('/api/data/hisonly_announcements?t=' + Date.now()); 
    const data = await res.json(); 
    DB._announcementsCache = data || [];
    DB._announcementsTime = Date.now();
    return DB._announcementsCache; 
  },
  saveAnnouncements: async (a) => { 
    DB._announcementsCache = a;
    DB._announcementsTime = Date.now();
    await fetch('/api/data/hisonly_announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }); 
  },
  deleteUser: async (id) => {
    await fetch(`/api/delete-user/${id}`, { method: 'DELETE' });
    DB._usersCache = null; // Invalidate cache
  }
};

const ADMIN_CODE = 'HISONLY2025';
const LEADER_CODE = 'WORSHIP2025';

const ROLES = {
  singer: { label: 'Singer', emoji: '🎤' },
  musician: { label: 'Musician', emoji: '🎸' },
  multimedia: { label: 'Multimedia', emoji: '🎬' },
  'worship-leader': { label: 'Worship Leader', emoji: '🎙️' },
};

const INSTRUMENTS = ['Guitar', 'Bass Guitar', 'Drums', 'Keyboard/Piano', 'Other'];
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
    // dayData is now an array of user IDs
    if (Array.isArray(dayData) && dayData.includes(userId)) {
      results.push({ dateKey, slot: 'default' });
    } else if (typeof dayData === 'object' && dayData !== null) {
      // Legacy support for slot-based schedules
      for (const [slot, members] of Object.entries(dayData)) {
        if (Array.isArray(members) && members.includes(userId)) {
          results.push({ dateKey, slot });
        }
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
  const isLeader = data.adminCode === LEADER_CODE || data.role === 'worship-leader';
  const user = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    name: data.name.trim(),
    username: uname,
    email: data.email ? data.email.toLowerCase().trim() : '',
    password: data.password,
    role: data.role,
    roles: [data.role],
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

// ── Multi-Role Support ──
function getUserRoles(user) {
  // Support both legacy (single role) and new (multi-role) format
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles;
  }
  return user.role ? [user.role] : [];
}

function hasRole(user, roleToCheck) {
  const roles = getUserRoles(user);
  return roles.includes(roleToCheck);
}

async function addRoleToUser(userId, newRole) {
  const user = await getUserById(userId);
  if (!user) return null;
  const roles = getUserRoles(user);
  if (!roles.includes(newRole)) {
    roles.push(newRole);
  }
  user.roles = roles;
  if (!user.role) user.role = roles[0];
  const users = await DB.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx] = user;
    await DB.saveUsers(users);
  }
  return user;
}

async function removeRoleFromUser(userId, roleToRemove) {
  const user = await getUserById(userId);
  if (!user) return null;
  let roles = getUserRoles(user);
  roles = roles.filter(r => r !== roleToRemove);
  user.roles = roles;
  if (roles.length > 0 && user.role === roleToRemove) {
    user.role = roles[0];
  }
  const users = await DB.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx] = user;
    await DB.saveUsers(users);
  }
  return user;
}

// ── Announcements ──
async function createAnnouncement(data) {
  const announcements = await DB.getAnnouncements();
  const announcement = {
    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    title: data.title,
    content: data.content,
    author: data.author,
    authorId: data.authorId,
    type: data.type || 'general', // 'general', 'lineup', 'song-submission'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  announcements.push(announcement);
  await DB.saveAnnouncements(announcements);
  return announcement;
}

async function getAnnouncements() {
  const announcements = await DB.getAnnouncements();
  // Sort by newest first
  return announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function deleteAnnouncement(id) {
  const announcements = await DB.getAnnouncements();
  const idx = announcements.findIndex(a => a.id === id);
  if (idx !== -1) {
    announcements.splice(idx, 1);
    await DB.saveAnnouncements(announcements);
    return true;
  }
  return false;
}

async function updateAnnouncement(id, updates) {
  const announcements = await DB.getAnnouncements();
  const idx = announcements.findIndex(a => a.id === id);
  if (idx !== -1) {
    announcements[idx] = { ...announcements[idx], ...updates, updatedAt: new Date().toISOString() };
    await DB.saveAnnouncements(announcements);
    return announcements[idx];
  }
  return null;
}
