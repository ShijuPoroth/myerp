const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// ─── Warehouse Items ───
router.get('/items', (req, res) => {
  db.all('SELECT * FROM warehouse_items ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/items', (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  const trimmedName = (name || '').trim();
  if (!trimmedName) return res.status(400).json({ error: 'Item name is required' });

  db.get('SELECT id FROM warehouse_items WHERE LOWER(name) = LOWER(?)', [trimmedName], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'An item with this name already exists' });

    db.run('INSERT INTO warehouse_items (name, unit, current_stock, min_stock, cost_per_unit) VALUES (?, ?, ?, ?, ?)',
      [trimmedName, unit, current_stock || 0, min_stock || 0, cost_per_unit || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name: trimmedName, unit, current_stock, min_stock, cost_per_unit });
      });
  });
});

router.put('/items/:id', (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  const trimmedName = (name || '').trim();
  if (!trimmedName) return res.status(400).json({ error: 'Item name is required' });

  db.get('SELECT id FROM warehouse_items WHERE LOWER(name) = LOWER(?) AND id != ?', [trimmedName, req.params.id], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'An item with this name already exists' });

    db.run('UPDATE warehouse_items SET name = ?, unit = ?, current_stock = ?, min_stock = ?, cost_per_unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [trimmedName, unit, current_stock, min_stock, cost_per_unit, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item updated' });
      });
  });
});

router.delete('/items/:id', (req, res) => {
  db.run('DELETE FROM warehouse_items WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Item deleted' });
  });
});

// ─── Purchase Requests ───
router.get('/purchase-requests', (req, res) => {
  db.all(`SELECT pr.*, s.name as supplier_name,
          (SELECT COUNT(*) FROM warehouse_purchase_request_items WHERE request_id = pr.id) as item_count
          FROM warehouse_purchase_requests pr
          LEFT JOIN suppliers s ON pr.supplier_id = s.id
          ORDER BY pr.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/purchase-requests/:id', (req, res) => {
  db.get(`SELECT pr.*, s.name as supplier_name
          FROM warehouse_purchase_requests pr
          LEFT JOIN suppliers s ON pr.supplier_id = s.id
          WHERE pr.id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Purchase request not found' });

    db.all(`SELECT pri.*, wi.name as item_name, wi.unit as item_unit
            FROM warehouse_purchase_request_items pri
            LEFT JOIN warehouse_items wi ON pri.warehouse_item_id = wi.id
            WHERE pri.request_id = ?`, [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      row.items = items || [];
      res.json(row);
    });
  });
});

router.post('/purchase-requests', (req, res) => {
  const { request_number, request_date, supplier_id, notes, items } = req.body;
  if (!request_number || !request_date) return res.status(400).json({ error: 'Request number and date are required' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('INSERT INTO warehouse_purchase_requests (request_number, request_date, supplier_id, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [request_number, request_date, supplier_id, notes, 'Pending', req.session.userId || null], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        const requestId = this.lastID;

        if (items && Array.isArray(items) && items.length > 0) {
          let pending = items.length;
          let itemError = null;
          items.forEach(item => {
            db.run('INSERT INTO warehouse_purchase_request_items (request_id, warehouse_item_id, quantity, unit, unit_price) VALUES (?, ?, ?, ?, ?)',
              [requestId, item.warehouse_item_id, item.quantity, item.unit, item.unit_price || 0], (err) => {
                if (err) itemError = err.message;
                pending--;
                if (pending === 0) {
                  if (itemError) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: itemError });
                  }
                  db.run('COMMIT');
                  res.json({ id: requestId, message: 'Purchase request created' });
                }
              });
          });
        } else {
          db.run('COMMIT');
          res.json({ id: requestId, message: 'Purchase request created' });
        }
      });
  });
});

router.put('/purchase-requests/:id', (req, res) => {
  const { request_number, request_date, supplier_id, notes, status, items } = req.body;

  db.run('UPDATE warehouse_purchase_requests SET request_number = ?, request_date = ?, supplier_id = ?, notes = ?, status = ? WHERE id = ?',
    [request_number, request_date, supplier_id, notes, status, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      if (items && Array.isArray(items)) {
        db.run('DELETE FROM warehouse_purchase_request_items WHERE request_id = ?', [req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          let pending = items.length;
          if (pending === 0) return res.json({ message: 'Purchase request updated' });
          items.forEach(item => {
            db.run('INSERT INTO warehouse_purchase_request_items (request_id, warehouse_item_id, quantity, unit, unit_price) VALUES (?, ?, ?, ?, ?)',
              [req.params.id, item.warehouse_item_id, item.quantity, item.unit, item.unit_price || 0], (err) => {
                pending--;
                if (pending === 0) res.json({ message: 'Purchase request updated' });
              });
          });
        });
      } else {
        res.json({ message: 'Purchase request updated' });
      }
    });
});

router.delete('/purchase-requests/:id', (req, res) => {
  db.run('DELETE FROM warehouse_purchase_requests WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Purchase request deleted' });
  });
});

// ─── Deliveries (confirm delivery against purchase requests) ───
router.get('/deliveries', (req, res) => {
  db.all(`SELECT d.*, s.name as supplier_name, pr.request_number
          FROM warehouse_deliveries d
          LEFT JOIN suppliers s ON d.supplier_id = s.id
          LEFT JOIN warehouse_purchase_requests pr ON d.purchase_request_id = pr.id
          ORDER BY d.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/deliveries/:id', (req, res) => {
  db.get(`SELECT d.*, s.name as supplier_name, pr.request_number
          FROM warehouse_deliveries d
          LEFT JOIN suppliers s ON d.supplier_id = s.id
          LEFT JOIN warehouse_purchase_requests pr ON d.purchase_request_id = pr.id
          WHERE d.id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Delivery not found' });

    db.all(`SELECT di.*, wi.name as item_name, wi.unit as item_unit
            FROM warehouse_delivery_items di
            LEFT JOIN warehouse_items wi ON di.warehouse_item_id = wi.id
            WHERE di.delivery_id = ?`, [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      row.items = items || [];
      res.json(row);
    });
  });
});

router.post('/deliveries', (req, res) => {
  const { delivery_number, delivery_date, purchase_request_id, supplier_id, received_by, notes, items } = req.body;
  if (!delivery_number || !delivery_date) return res.status(400).json({ error: 'Delivery number and date are required' });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('INSERT INTO warehouse_deliveries (delivery_number, delivery_date, purchase_request_id, supplier_id, received_by, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [delivery_number, delivery_date, purchase_request_id, supplier_id, received_by, notes, 'Received'], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        const deliveryId = this.lastID;

        if (!items || !Array.isArray(items) || items.length === 0) {
          db.run('COMMIT');
          return res.json({ id: deliveryId, message: 'Delivery created' });
        }

        let pending = items.length;
        let itemError = null;

        items.forEach(item => {
          // Insert delivery item
          db.run('INSERT INTO warehouse_delivery_items (delivery_id, warehouse_item_id, ordered_quantity, received_quantity, unit, unit_price) VALUES (?, ?, ?, ?, ?, ?)',
            [deliveryId, item.warehouse_item_id, item.ordered_quantity, item.received_quantity, item.unit, item.unit_price || 0], (err) => {
              if (err) { itemError = err.message; pending--; if (pending === 0) finishDelivery(); return; }

              // Add received quantity to warehouse stock
              db.run('UPDATE warehouse_items SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [item.received_quantity, item.warehouse_item_id], (err) => {
                  if (err) itemError = err.message;
                  pending--;
                  if (pending === 0) finishDelivery();
                });
            });
        });

        function finishDelivery() {
          if (itemError) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: itemError });
          }
          // Update purchase request status if linked
          if (purchase_request_id) {
            db.run('UPDATE warehouse_purchase_requests SET status = ? WHERE id = ?',
              ['Delivered', purchase_request_id], (err) => {
                db.run('COMMIT');
                res.json({ id: deliveryId, message: 'Delivery created, stock updated' });
              });
          } else {
            db.run('COMMIT');
            res.json({ id: deliveryId, message: 'Delivery created, stock updated' });
          }
        }
      });
  });
});

router.delete('/deliveries/:id', (req, res) => {
  // Get delivery items to reverse stock
  db.all('SELECT warehouse_item_id, received_quantity FROM warehouse_delivery_items WHERE delivery_id = ?', [req.params.id], (err, items) => {
    if (err) return res.status(500).json({ error: err.message });

    let pending = (items || []).length;
    if (pending === 0) {
      db.run('DELETE FROM warehouse_deliveries WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Delivery deleted' });
      });
      return;
    }

    items.forEach(item => {
      db.run('UPDATE warehouse_items SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.received_quantity, item.warehouse_item_id], (err) => {
          pending--;
          if (pending === 0) {
            db.run('DELETE FROM warehouse_deliveries WHERE id = ?', [req.params.id], function(err) {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: 'Delivery deleted, stock reversed' });
            });
          }
        });
    });
  });
});

// ─── Transfers to Catering ───
router.get('/transfers', (req, res) => {
  db.all(`SELECT t.*,
          (SELECT COUNT(*) FROM warehouse_catering_transfer_items WHERE transfer_id = t.id) as item_count
          FROM warehouse_catering_transfers t
          ORDER BY t.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/transfers/:id', (req, res) => {
  db.get('SELECT * FROM warehouse_catering_transfers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Transfer not found' });

    db.all(`SELECT ti.*, wi.name as item_name, wi.unit as item_unit,
            ing.name as ingredient_name
            FROM warehouse_catering_transfer_items ti
            LEFT JOIN warehouse_items wi ON ti.warehouse_item_id = wi.id
            LEFT JOIN ingredients ing ON ti.ingredient_id = ing.id
            WHERE ti.transfer_id = ?`, [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      row.items = items || [];
      res.json(row);
    });
  });
});

router.post('/transfers', (req, res) => {
  const { transfer_number, transfer_date, notes, items } = req.body;
  if (!transfer_number || !transfer_date) return res.status(400).json({ error: 'Transfer number and date are required' });
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  // Validate stock availability
  const itemIds = items.map(i => i.warehouse_item_id);
  const placeholders = itemIds.map(() => '?').join(',');
  db.all(`SELECT id, current_stock, name FROM warehouse_items WHERE id IN (${placeholders})`, itemIds, (err, stockRows) => {
    if (err) return res.status(500).json({ error: err.message });

    for (const item of items) {
      const stockRow = stockRows.find(r => r.id === item.warehouse_item_id);
      if (!stockRow) return res.status(400).json({ error: `Item ID ${item.warehouse_item_id} not found` });
      if ((stockRow.current_stock || 0) < item.sent_quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${stockRow.name}. Available: ${stockRow.current_stock}, Requested: ${item.sent_quantity}` });
      }
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('INSERT INTO warehouse_catering_transfers (transfer_number, transfer_date, notes, status, created_by) VALUES (?, ?, ?, ?, ?)',
        [transfer_number, transfer_date, notes, 'Pending', req.session.userId || null], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          const transferId = this.lastID;

          let pending = items.length;
          let itemError = null;

          items.forEach(item => {
            // Resolve or create ingredient linked to warehouse item
            db.get('SELECT id FROM ingredients WHERE warehouse_item_id = ?', [item.warehouse_item_id], (err, ing) => {
              if (err) { itemError = err.message; pending--; if (pending === 0) finishTransfer(); return; }

              let ingredientId = ing ? ing.id : null;

              if (!ingredientId) {
                // Get warehouse item details to create ingredient
                db.get('SELECT name, unit FROM warehouse_items WHERE id = ?', [item.warehouse_item_id], (err, wi) => {
                  if (err) { itemError = err.message; pending--; if (pending === 0) finishTransfer(); return; }
                  db.run('INSERT INTO ingredients (warehouse_item_id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (?, ?, ?, 0, 0, 0)',
                    [item.warehouse_item_id, wi.name, wi.unit], function(err) {
                      if (err) { itemError = err.message; pending--; if (pending === 0) finishTransfer(); return; }
                      ingredientId = this.lastID;
                      insertTransferItem(transferId, item, ingredientId);
                    });
                });
              } else {
                insertTransferItem(transferId, item, ingredientId);
              }

              function insertTransferItem(tid, itm, ingId) {
                db.run('INSERT INTO warehouse_catering_transfer_items (transfer_id, warehouse_item_id, ingredient_id, sent_quantity, unit, status) VALUES (?, ?, ?, ?, ?, ?)',
                  [tid, itm.warehouse_item_id, ingId, itm.sent_quantity, itm.unit, 'Pending'], (err) => {
                    if (err) { itemError = err.message; pending--; if (pending === 0) finishTransfer(); return; }

                    // Deduct stock from warehouse
                    db.run('UPDATE warehouse_items SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      [itm.sent_quantity, itm.warehouse_item_id], (err) => {
                        if (err) itemError = err.message;
                        pending--;
                        if (pending === 0) finishTransfer();
                      });
                  });
              }
            });
          });

          function finishTransfer() {
            if (itemError) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: itemError });
            }
            db.run('COMMIT');
            res.json({ id: transferId, message: 'Transfer created, stock deducted from warehouse' });
          }
        });
    });
  });
});

// ─── Suppliers (for dropdowns) ───
router.get('/suppliers', (req, res) => {
  db.all('SELECT id, name FROM suppliers ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─── Business Type Assignments (for catering dropdowns) ───
router.get('/business-units', (req, res) => {
  db.all(`SELECT bta.*, c.name as country_name, lt.name as location_name,
          slt.name as sub_location_name, bt.name as business_type_name
          FROM business_type_assignments bta
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          ORDER BY c.name, lt.name, slt.name, bt.name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
