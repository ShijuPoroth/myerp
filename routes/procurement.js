const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// PURCHASE ORDERS
router.get('/purchase-orders', (req, res) => {
  db.all(`SELECT po.*, s.name as supplier_name 
         FROM purchase_orders po 
         LEFT JOIN suppliers s ON po.supplier_id = s.id 
         ORDER BY po.created_at DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/purchase-orders', (req, res) => {
  const { order_number, order_date, supplier_id, status, notes } = req.body;
  db.run('INSERT INTO purchase_orders (order_number, order_date, supplier_id, status, notes) VALUES (?, ?, ?, ?, ?)', 
    [order_number, order_date, supplier_id, status, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, order_number, order_date, supplier_id, status, notes });
  });
});

router.put('/purchase-orders/:id', (req, res) => {
  const { order_number, order_date, supplier_id, status, notes } = req.body;
  db.run('UPDATE purchase_orders SET order_number = ?, order_date = ?, supplier_id = ?, status = ?, notes = ? WHERE id = ?', 
    [order_number, order_date, supplier_id, status, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Purchase order updated' });
  });
});

router.delete('/purchase-orders/:id', (req, res) => {
  db.run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Purchase order deleted' });
  });
});

module.exports = router;
