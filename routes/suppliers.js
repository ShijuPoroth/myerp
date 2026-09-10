const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// SUPPLIERS
router.get('/', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  db.run('INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)', 
    [name, contact_person, email, phone, address], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, contact_person, email, phone, address });
  });
});

router.put('/:id', (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  db.run('UPDATE suppliers SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE id = ?', 
    [name, contact_person, email, phone, address, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Supplier updated' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Supplier deleted' });
  });
});

// SUPPLIER ASSIGNMENTS
router.get('/assignments', (req, res) => {
  db.all(`SELECT sa.*, s.name as supplier_name, 
          c.name as country_name, lt.name as location_name, slt.name as sub_location_name, 
          bt.name as business_type_name, bta.business_unit_code
          FROM supplier_assignments sa 
          JOIN suppliers s ON sa.supplier_id = s.id
          LEFT JOIN business_type_assignments bta ON sa.business_type_assignment_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          ORDER BY sa.created_at DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/assignments', (req, res) => {
  const { supplier_id, business_type_assignment_id, notes } = req.body;
  // Check for duplicate (same supplier + same business location)
  db.get('SELECT id FROM supplier_assignments WHERE supplier_id = ? AND business_type_assignment_id = ?', 
    [supplier_id, business_type_assignment_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.status(409).json({ error: 'This supplier is already assigned to this business location' });
      return;
    }
    db.run('INSERT INTO supplier_assignments (supplier_id, business_type_assignment_id, notes) VALUES (?, ?, ?)', 
      [supplier_id, business_type_assignment_id, notes], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, supplier_id, business_type_assignment_id, notes });
    });
  });
});

router.delete('/assignments/:id', (req, res) => {
  db.run('DELETE FROM supplier_assignments WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Supplier assignment deleted' });
  });
});

// Get suppliers by business_type_assignment_id
router.get('/by-location', (req, res) => {
  const btaId = req.query.business_type_assignment_id;
  if (!btaId) {
    return res.json([]);
  }
  db.all(`SELECT DISTINCT s.id, s.name, s.contact_person, s.email, s.phone
          FROM suppliers s
          JOIN supplier_assignments sa ON sa.supplier_id = s.id
          WHERE sa.business_type_assignment_id = ?
          ORDER BY s.name`, [btaId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
