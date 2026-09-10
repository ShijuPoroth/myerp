const { db } = require('../config/database');
const bcrypt = require('bcrypt');

// In-memory failed login tracker (per login_id)
const failedAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLockedOut(login_id) {
  const record = failedAttempts[login_id];
  if (!record) return false;
  if (record.count >= MAX_ATTEMPTS) {
    if (Date.now() - record.lastAttempt < LOCKOUT_MS) return true;
    delete failedAttempts[login_id]; // lockout expired
  }
  return false;
}

function recordFailedAttempt(login_id) {
  if (!failedAttempts[login_id]) failedAttempts[login_id] = { count: 0, lastAttempt: 0 };
  failedAttempts[login_id].count++;
  failedAttempts[login_id].lastAttempt = Date.now();
}

function clearFailedAttempts(login_id) {
  delete failedAttempts[login_id];
}

function requireAuth(req, res, next) {
  // Public routes
  const publicPaths = ['/api/login', '/api/logout', '/api/check-session'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  if (req.session && req.session.managerId) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated. Please log in.' });
}

function login(req, res) {
  const { login_id, password } = req.body;
  if (!login_id || !password) {
    res.status(400).json({ error: 'Login ID and password are required.' });
    return;
  }

  // Check account lockout
  if (isLockedOut(login_id)) {
    const record = failedAttempts[login_id];
    const remaining = Math.ceil((LOCKOUT_MS - (Date.now() - record.lastAttempt)) / 60000);
    res.status(429).json({ error: `Account locked. Too many failed attempts. Try again in ${remaining} minute(s).` });
    return;
  }

  db.get('SELECT * FROM module_managers WHERE login_id = ?', [login_id], (err, manager) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!manager || !manager.password_hash) {
      recordFailedAttempt(login_id);
      // Audit: failed login — unknown user
      db.run('INSERT INTO audit_logs (user, manager_module, action, module, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [login_id, 'Unknown', 'LOGIN_FAILED', 'auth', 'Login', null, `Login ID: ${login_id} | Reason: User not found | IP: ${req.ip}`],
        (e) => { if (e) console.error('Audit log error (login failed - unknown):', e.message); });
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    bcrypt.compare(password, manager.password_hash, (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!result) {
        recordFailedAttempt(login_id);
        const record = failedAttempts[login_id];
        const attemptsLeft = MAX_ATTEMPTS - record.count;
        // Audit: failed login — wrong password
        db.run('INSERT INTO audit_logs (user, manager_module, action, module, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [manager.name, manager.module_name, 'LOGIN_FAILED', 'auth', 'Login', manager.id, `Login ID: ${login_id} | Reason: Wrong password | Attempts left: ${Math.max(attemptsLeft, 0)} | IP: ${req.ip}`],
          (e) => { if (e) console.error('Audit log error (login failed - password):', e.message); });
        if (attemptsLeft <= 0) {
          res.status(401).json({ error: 'Invalid credentials. Account locked for 15 minutes.' });
        } else {
          res.status(401).json({ error: `Invalid credentials. ${attemptsLeft} attempt(s) remaining.` });
        }
        return;
      }
      clearFailedAttempts(login_id);
      req.session.managerId = manager.id;
      req.session.moduleName = manager.module_name;
      req.session.managerName = manager.name;
      // Audit: successful login
      db.run('INSERT INTO audit_logs (user, manager_module, action, module, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [manager.name, manager.module_name, 'LOGIN', 'auth', 'Login', manager.id, `Login ID: ${login_id} | IP: ${req.ip}`],
        (e) => { if (e) console.error('Audit log error (login success):', e.message); });
      res.json({ id: manager.id, name: manager.name, module_name: manager.module_name });
    });
  });
}

function logout(req, res) {
  const mgrName = req.session && req.session.managerName ? req.session.managerName : 'Unknown';
  const mgrModule = req.session && req.session.moduleName ? req.session.moduleName : 'Unknown';
  const mgrId = req.session && req.session.managerId ? req.session.managerId : null;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Audit: logout
    db.run('INSERT INTO audit_logs (user, manager_module, action, module, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mgrName, mgrModule, 'LOGOUT', 'auth', 'Logout', mgrId, `User: ${mgrName} | IP: ${req.ip}`],
      (e) => { if (e) console.error('Audit log error (logout):', e.message); });
    res.json({ message: 'Logged out successfully.' });
  });
}

function checkSession(req, res) {
  if (req.session && req.session.managerId) {
    res.json({
      id: req.session.managerId,
      name: req.session.managerName,
      module_name: req.session.moduleName
    });
  } else {
    res.status(401).json({ error: 'Not authenticated.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.moduleName === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required.' });
}

module.exports = { requireAuth, login, logout, checkSession, requireAdmin };
