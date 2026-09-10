const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// Helper: resolve supplier_id from supplier_id or supplier name
function resolveSupplierId(supplierId, supplierName, callback) {
  if (supplierId) { callback(null, supplierId); return; }
  if (!supplierName || !supplierName.trim()) { callback(null, null); return; }
  db.get(`SELECT id FROM suppliers WHERE name = ?`, [supplierName.trim()], (err, row) => {
    if (err) { callback(err, null); return; }
    if (row) { callback(null, row.id); return; }
    db.run(`INSERT INTO suppliers (name) VALUES (?)`, [supplierName.trim()], function(err) {
      callback(err, err ? null : this.lastID);
    });
  });
}

// Helper: resolve employee_id from employee_id or employee name
function resolveEmployeeId(employeeId, employeeName, callback) {
  if (employeeId) { callback(null, employeeId); return; }
  if (!employeeName || !employeeName.trim()) { callback(null, null); return; }
  const clean = employeeName.trim().toLowerCase();
  db.get(`SELECT id FROM employees WHERE LOWER(employee_id) = ? OR LOWER(first_name || ' ' || last_name) = ? OR LOWER(first_name) = ? OR LOWER(last_name) = ? LIMIT 1`,
    [clean, clean, clean, clean], (err, row) => {
      if (err) { callback(err, null); return; }
      callback(null, row ? row.id : null);
    });
}

// LOCATIONS
router.get('/locations', (req, res) => {
  db.all('SELECT * FROM locations ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/locations', (req, res) => {
  const { name, country, location, sub_location, business_type, address } = req.body;
  db.run('INSERT INTO locations (name, country, location, sub_location, business_type, address) VALUES (?, ?, ?, ?, ?, ?)', 
    [name, country, location, sub_location, business_type, address], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, country, location, sub_location, business_type, address });
  });
});

router.put('/locations/:id', (req, res) => {
  const { name, country, location, sub_location, business_type, address } = req.body;
  db.run('UPDATE locations SET name = ?, country = ?, location = ?, sub_location = ?, business_type = ?, address = ? WHERE id = ?', 
    [name, country, location, sub_location, business_type, address, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Location updated' });
  });
});

router.delete('/locations/:id', (req, res) => {
  db.run('DELETE FROM locations WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Location deleted' });
  });
});

// KITCHEN ITEMS
router.get('/kitchen-items', (req, res) => {
  db.all(`SELECT ki.*, l.name as location_name FROM kitchen_items ki 
          LEFT JOIN locations l ON ki.location_id = l.id 
          ORDER BY ki.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/kitchen-items', (req, res) => {
  const { name, category, sku, unit, current_stock, minimum_stock, location_id } = req.body;
  
  db.run(`INSERT INTO kitchen_items (name, category, sku, unit, current_stock, minimum_stock, location_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, category, sku, unit, current_stock, minimum_stock, location_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, category, sku, unit, current_stock, minimum_stock, location_id });
    }
  );
});

router.put('/kitchen-items/:id', (req, res) => {
  const { name, category, sku, unit, current_stock, minimum_stock, location_id } = req.body;
  
  db.run(`UPDATE kitchen_items SET name = ?, category = ?, sku = ?, unit = ?, current_stock = ?, 
          minimum_stock = ?, location_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, category, sku, unit, current_stock, minimum_stock, location_id, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Kitchen item updated' });
    }
  );
});

// KITCHEN PURCHASES
router.get('/kitchen-purchases', (req, res) => {
  db.all(`SELECT kp.*, ki.name as item_name, l.name as location_name, s.name as supplier_name FROM kitchen_purchases kp 
          JOIN kitchen_items ki ON kp.item_id = ki.id
          LEFT JOIN locations l ON kp.location_id = l.id
          LEFT JOIN suppliers s ON kp.supplier_id = s.id
          ORDER BY kp.purchase_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/kitchen-purchases', (req, res) => {
  const { item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id } = req.body;
  
  resolveSupplierId(supplier_id, supplier_name, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO kitchen_purchases (item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run('UPDATE kitchen_items SET current_stock = current_stock + ? WHERE id = ?', [quantity, item_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          db.run('COMMIT');
          res.json({ id: this.lastID, item_id, supplier_id: resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id });
        });
      }
    );
  });
});

// KITCHEN DELIVERIES
router.get('/kitchen-deliveries', (req, res) => {
  db.all(`SELECT kd.*, ki.name as item_name, l.name as location_name,
          e.employee_id as received_by_code, e.first_name || ' ' || e.last_name as received_by_name
          FROM kitchen_deliveries kd 
          JOIN kitchen_items ki ON kd.item_id = ki.id
          LEFT JOIN locations l ON kd.location_id = l.id
          LEFT JOIN employees e ON kd.employee_id = e.id
          ORDER BY kd.delivery_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/kitchen-deliveries', (req, res) => {
  const { item_id, catering_unit_name, quantity, delivery_date, employee_id, received_by, notes, location_id } = req.body;
  
  resolveEmployeeId(employee_id, received_by, (err, resolvedEmployeeId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO kitchen_deliveries (item_id, catering_unit_name, quantity, delivery_date, employee_id, received_by, notes, location_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, catering_unit_name, quantity, delivery_date, resolvedEmployeeId, received_by, notes, location_id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run('UPDATE kitchen_items SET current_stock = current_stock - ? WHERE id = ?', [quantity, item_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          db.run('COMMIT');
          res.json({ id: this.lastID, item_id, catering_unit_name, quantity, delivery_date, employee_id: resolvedEmployeeId, received_by, notes, location_id });
        });
      }
    );
  });
});

module.exports = router;
