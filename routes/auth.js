const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { login, logout, checkSession, requireAuth } = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', logout);
router.get('/check-session', checkSession);

// Managers list — requires login now (used by dropdowns inside the app)
router.get('/public/managers', requireAuth, (req, res) => {
  db.all('SELECT id, name, module_name FROM module_managers ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
