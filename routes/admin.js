const express = require('express');
const bcrypt = require('bcrypt');
const { db, syncCateringIngredientsFromItems } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// CONTACT CATEGORIES
router.get('/contact-categories', (req, res) => {
  db.all('SELECT * FROM contact_categories ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/contact-categories', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO contact_categories (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/contact-categories/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE contact_categories SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Contact category updated' });
  });
});

router.delete('/contact-categories/:id', (req, res) => {
  db.run('DELETE FROM contact_categories WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Contact category deleted' });
  });
});

// CONTACT STATUSES
router.get('/contact-statuses', (req, res) => {
  db.all('SELECT * FROM contact_statuses ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/contact-statuses', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO contact_statuses (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/contact-statuses/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE contact_statuses SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Contact status updated' });
  });
});

router.delete('/contact-statuses/:id', (req, res) => {
  db.run('DELETE FROM contact_statuses WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Contact status deleted' });
  });
});

// CONTACT STATUS ASSIGNMENTS
router.get('/contact-status-assignments', (req, res) => {
  db.all(`SELECT csa.*, cc.name as category_name, cs.name as status_name 
         FROM contact_status_assignments csa 
         LEFT JOIN contact_categories cc ON csa.category_id = cc.id 
         LEFT JOIN contact_statuses cs ON csa.status_id = cs.id 
         ORDER BY csa.id`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/contact-status-assignments', (req, res) => {
  const { category_id, status_id } = req.body;
  
  // Check for duplicate assignment
  db.get('SELECT id FROM contact_status_assignments WHERE category_id = ? AND status_id = ?', 
    [category_id, status_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.status(400).json({ error: 'Duplicate status assignment already exists' });
      return;
    }
    
    db.run('INSERT INTO contact_status_assignments (category_id, status_id) VALUES (?, ?)', 
      [category_id, status_id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, category_id, status_id });
    });
  });
});

router.delete('/contact-status-assignments/:id', (req, res) => {
  db.run('DELETE FROM contact_status_assignments WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Contact status assignment deleted' });
  });
});

// ITEMS
router.get('/items', (req, res) => {
  db.all(`SELECT i.*, ic.name as category_name, isc.name as subcategory_name, it.name as type_name, iu.name as unit_name
         FROM items i
         LEFT JOIN item_categories ic ON i.category_id = ic.id
         LEFT JOIN item_subcategories isc ON i.subcategory_id = isc.id
         LEFT JOIN item_types it ON i.type_id = it.id
         LEFT JOIN item_units iu ON i.unit_id = iu.id
         ORDER BY i.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/items', (req, res) => {
  const { product_code, name, category_id, subcategory_id, type_id, unit_id, description } = req.body;
  console.log('POST /items request body:', req.body);

  db.run('INSERT INTO items (product_code, name, category_id, subcategory_id, type_id, unit_id, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product_code, name, category_id, subcategory_id, type_id, unit_id, description], function(err) {
    if (err) {
      console.error('Error inserting item:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Item inserted successfully with ID:', this.lastID);
    syncCateringIngredientsFromItems();
    res.json({ id: this.lastID, product_code, name, category_id, subcategory_id, type_id, unit_id, description });
  });
});

router.put('/items/:id', (req, res) => {
  const { name, category_id, subcategory_id, type_id, unit_id, description } = req.body;
  db.run('UPDATE items SET name = ?, category_id = ?, subcategory_id = ?, type_id = ?, unit_id = ?, description = ? WHERE id = ?',
    [name, category_id, subcategory_id, type_id, unit_id, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    syncCateringIngredientsFromItems();
    // Sync name to all equipment referencing this item via catalog_id
    db.run('UPDATE equipment SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE catalog_id = ?',
      [name, req.params.id], function(err2) {
        if (err2) {
          console.error('Error syncing equipment names from items:', err2);
        }
        res.json({ message: 'Item updated' });
      });
  });
});

router.get('/items/next-product-code', (req, res) => {
  db.get('SELECT product_code FROM items WHERE product_code IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextCode = 'PC-001';
    if (row && row.product_code) {
      const match = row.product_code.match(/PC-(\d+)/);
      if (match) {
        const nextNumber = parseInt(match[1]) + 1;
        nextCode = `PC-${nextNumber.toString().padStart(3, '0')}`;
      }
    }
    res.json({ nextCode: nextCode });
  });
});

router.delete('/items/:id', (req, res) => {
  db.run('DELETE FROM items WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Remove linked catering ingredient
    db.run('DELETE FROM ingredients WHERE warehouse_item_id = ?', [req.params.id]);
    syncCateringIngredientsFromItems();
    res.json({ message: 'Item deleted' });
  });
});

// COUNTRIES
router.get('/countries', (req, res) => {
  db.all('SELECT * FROM countries ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/countries', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO countries (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

router.delete('/countries/:id', (req, res) => {
  // Check if country has dependent locations
  db.get('SELECT COUNT(*) as count FROM location_types WHERE country_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete country with dependent locations' });
      return;
    }
    
    // Check if country has dependent sublocations
    db.get('SELECT COUNT(*) as count FROM sub_location_types WHERE country_id = ?', [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row.count > 0) {
        res.status(400).json({ error: 'Cannot delete country with dependent sublocations' });
        return;
      }
      
      // Check if country has dependent business type assignments
      db.get('SELECT COUNT(*) as count FROM business_type_assignments WHERE country_id = ?', [req.params.id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (row.count > 0) {
          res.status(400).json({ error: 'Cannot delete country with dependent business type assignments' });
          return;
        }
        
        // Safe to delete
        db.run('DELETE FROM countries WHERE id = ?', [req.params.id], function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ message: 'Country deleted' });
        });
      });
    });
  });
});

// LOCATION TYPES
router.get('/location-types', (req, res) => {
  db.all('SELECT lt.*, c.name as country_name FROM location_types lt LEFT JOIN countries c ON lt.country_id = c.id ORDER BY lt.name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/location-types', (req, res) => {
  const { country_id, name } = req.body;
  console.log('Saving location:', { country_id, name });
  db.run('INSERT INTO location_types (country_id, name) VALUES (?, ?)', [country_id, name], function(err) {
    if (err) {
      console.error('Error saving location:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Location saved successfully with ID:', this.lastID);
    res.json({ id: this.lastID, country_id, name });
  });
});

router.put('/location-types/:id', (req, res) => {
  const { country_id, name } = req.body;
  db.run('UPDATE location_types SET country_id = ?, name = ? WHERE id = ?', [country_id, name, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Location type updated' });
  });
});

router.delete('/location-types/:id', (req, res) => {
  // Check if location has dependent sublocations
  db.get('SELECT COUNT(*) as count FROM sub_location_types WHERE location_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete location with dependent sublocations' });
      return;
    }
    
    // Check if location has dependent business type assignments
    db.get('SELECT COUNT(*) as count FROM business_type_assignments WHERE location_id = ?', [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row.count > 0) {
        res.status(400).json({ error: 'Cannot delete location with dependent business type assignments' });
        return;
      }
      
      // Safe to delete
      db.run('DELETE FROM location_types WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Location type deleted' });
      });
    });
  });
});

// SUB LOCATION TYPES
router.get('/sub-location-types', (req, res) => {
  db.all('SELECT slt.*, c.name as country_name, lt.name as location_name FROM sub_location_types slt LEFT JOIN countries c ON slt.country_id = c.id LEFT JOIN location_types lt ON slt.location_id = lt.id ORDER BY slt.name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/sub-location-types', (req, res) => {
  const { country_id, location_id, name } = req.body;
  db.run('INSERT INTO sub_location_types (country_id, location_id, name) VALUES (?, ?, ?)', [country_id, location_id, name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, country_id, location_id, name });
  });
});

router.put('/sub-location-types/:id', (req, res) => {
  const { country_id, location_id, name } = req.body;
  db.run('UPDATE sub_location_types SET country_id = ?, location_id = ?, name = ? WHERE id = ?', [country_id, location_id, name, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Sub location type updated' });
  });
});

router.delete('/sub-location-types/:id', (req, res) => {
  // Check if sublocation has dependent business type assignments
  db.get('SELECT COUNT(*) as count FROM business_type_assignments WHERE sub_location_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete sublocation with dependent business type assignments' });
      return;
    }
    
    // Safe to delete
    db.run('DELETE FROM sub_location_types WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Sub location type deleted' });
    });
  });
});

// BUSINESS TYPES
router.get('/business-types', (req, res) => {
  db.all('SELECT * FROM business_types ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/business-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO business_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/business-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE business_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Business type updated' });
  });
});

router.delete('/business-types/:id', (req, res) => {
  // Check if business type has dependent assignments
  db.get('SELECT COUNT(*) as count FROM business_type_assignments WHERE business_type_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete business type with dependent assignments' });
      return;
    }
    
    // Safe to delete
    db.run('DELETE FROM business_types WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Business type deleted' });
    });
  });
});

// BUSINESS TYPE ASSIGNMENTS
router.get('/business-type-assignments', (req, res) => {
  db.all(`SELECT bta.*, c.name as country_name, lt.name as location_name, slt.name as sub_location_name, bt.name as business_type_name 
         FROM business_type_assignments bta 
         LEFT JOIN countries c ON bta.country_id = c.id 
         LEFT JOIN location_types lt ON bta.location_id = lt.id 
         LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id 
         LEFT JOIN business_types bt ON bta.business_type_id = bt.id 
         ORDER BY bta.id`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/business-type-assignments', (req, res) => {
  const { country_id, location_id, sub_location_id, business_type_id } = req.body;
  
  // Check for duplicate assignment
  db.get('SELECT id FROM business_type_assignments WHERE country_id = ? AND location_id = ? AND sub_location_id = ? AND business_type_id = ?', 
    [country_id, location_id, sub_location_id, business_type_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.status(400).json({ error: 'Duplicate business type assignment already exists' });
      return;
    }
    
    // Generate auto-incrementing business unit code
    db.get('SELECT MAX(id) as max_id FROM business_type_assignments', [], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const nextId = (row.max_id || 0) + 1;
      const business_unit_code = String(1000 + nextId);
      
      db.run('INSERT INTO business_type_assignments (country_id, location_id, sub_location_id, business_type_id, business_unit_code) VALUES (?, ?, ?, ?, ?)', 
        [country_id, location_id, sub_location_id, business_type_id, business_unit_code], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, country_id, location_id, sub_location_id, business_type_id, business_unit_code });
      });
    });
  });
});

router.put('/business-type-assignments/:id', (req, res) => {
  const { country_id, location_id, sub_location_id, business_type_id } = req.body;
  
  // Keep the existing business_unit_code, don't regenerate it
  db.run('UPDATE business_type_assignments SET country_id = ?, location_id = ?, sub_location_id = ?, business_type_id = ? WHERE id = ?', 
    [country_id, location_id, sub_location_id, business_type_id, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Business type assignment updated' });
  });
});

router.delete('/business-type-assignments/:id', (req, res) => {
  // Check if business type assignment has dependent equipment
  db.get('SELECT COUNT(*) as count FROM equipment WHERE location_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete business type assignment with linked equipment' });
      return;
    }
    
    // Check if business type assignment has dependent employees
    db.get('SELECT COUNT(*) as count FROM employees WHERE location_id = ?', [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row.count > 0) {
        res.status(400).json({ error: 'Cannot delete business type assignment with linked employees' });
        return;
      }
      
      // Safe to delete
      db.run('DELETE FROM business_type_assignments WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Business type assignment deleted' });
      });
    });
  });
});

// AUDIT LOGS
router.get('/audit-logs', (req, res) => {
  const { module, action, limit = 100 } = req.query;
  let query = 'SELECT * FROM audit_logs';
  const params = [];
  
  if (module || action) {
    query += ' WHERE';
    const conditions = [];
    if (module) {
      conditions.push(' module = ?');
      params.push(module);
    }
    if (action) {
      conditions.push(' action = ?');
      params.push(action);
    }
    query += conditions.join(' AND');
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/audit-logs', (req, res) => {
  const { action, module, entity, entity_id, details } = req.body;
  const user = req.session && req.session.managerId ? req.session.managerName : (req.body.user || 'System');
  const managerModule = req.session && req.session.moduleName ? req.session.moduleName : 'Unknown';
  db.run('INSERT INTO audit_logs (user, manager_module, action, module, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user, managerModule, action, module, entity, entity_id, details], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, user, manager_module: managerModule, action, module, entity, entity_id, details });
  });
});

router.delete('/audit-logs', (req, res) => {
  db.run('DELETE FROM audit_logs', function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'All audit logs cleared' });
  });
});

router.delete('/audit-logs/:id', (req, res) => {
  db.run('DELETE FROM audit_logs WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Audit log deleted' });
  });
});

// ITEM CATEGORIES
router.get('/item-categories', (req, res) => {
  db.all('SELECT * FROM item_categories ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/item-categories/next-serial', (req, res) => {
  db.get('SELECT serial_number FROM item_categories WHERE serial_number IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'IC-001';
    if (row && row.serial_number) {
      const lastNum = parseInt(row.serial_number.split('-')[1]);
      nextSerial = `IC-${String(lastNum + 1).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.post('/item-categories', (req, res) => {
  const { name, description, serial_number } = req.body;
  db.run('INSERT INTO item_categories (name, description, serial_number) VALUES (?, ?, ?)', [name, description, serial_number], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description, serial_number });
  });
});

router.put('/item-categories/:id', (req, res) => {
  const { name, description, serial_number } = req.body;
  db.run('UPDATE item_categories SET name = ?, description = ?, serial_number = ? WHERE id = ?', [name, description, serial_number, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item category updated' });
  });
});

router.delete('/item-categories/:id', (req, res) => {
  // Check if any item types are linked to this category
  db.all('SELECT * FROM item_types WHERE item_category_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (rows.length > 0) {
      res.status(400).json({ error: 'Cannot delete category: item types are linked to this category' });
      return;
    }
    db.run('DELETE FROM item_categories WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Item category deleted' });
    });
  });
});

// ITEM UNITS
router.get('/item-units', (req, res) => {
  db.all('SELECT * FROM item_units ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/item-units/next-serial', (req, res) => {
  db.get('SELECT serial_number FROM item_units WHERE serial_number IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'IU-001';
    if (row && row.serial_number) {
      const lastNum = parseInt(row.serial_number.split('-')[1]);
      nextSerial = `IU-${String(lastNum + 1).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.post('/item-units', (req, res) => {
  const { name, description, serial_number } = req.body;
  db.run('INSERT INTO item_units (name, description, serial_number) VALUES (?, ?, ?)', [name, description, serial_number], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description, serial_number });
  });
});

router.put('/item-units/:id', (req, res) => {
  const { name, description, serial_number } = req.body;
  db.run('UPDATE item_units SET name = ?, description = ?, serial_number = ? WHERE id = ?', [name, description, serial_number, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item unit updated' });
  });
});

router.delete('/item-units/:id', (req, res) => {
  db.run('DELETE FROM item_units WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item unit deleted' });
  });
});

// ITEM SUBCATEGORIES
router.get('/item-subcategories', (req, res) => {
  db.all(`SELECT isc.*, ic.name as item_category_name FROM item_subcategories isc
          LEFT JOIN item_categories ic ON isc.item_category_id = ic.id
          ORDER BY isc.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/item-subcategories/next-serial', (req, res) => {
  db.get('SELECT serial_number FROM item_subcategories WHERE serial_number IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'ISC-001';
    if (row && row.serial_number) {
      const lastNum = parseInt(row.serial_number.split('-')[1]);
      nextSerial = `ISC-${String(lastNum + 1).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.post('/item-subcategories', (req, res) => {
  const { name, description, item_category_id, serial_number } = req.body;
  db.run('INSERT INTO item_subcategories (name, description, item_category_id, serial_number) VALUES (?, ?, ?, ?)', [name, description, item_category_id, serial_number], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description, item_category_id, serial_number });
  });
});

router.put('/item-subcategories/:id', (req, res) => {
  const { name, description, item_category_id, serial_number } = req.body;
  db.run('UPDATE item_subcategories SET name = ?, description = ?, item_category_id = ?, serial_number = ? WHERE id = ?', [name, description, item_category_id, serial_number, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item subcategory updated' });
  });
});

router.delete('/item-subcategories/:id', (req, res) => {
  // Check if any item types are linked to this subcategory
  db.all('SELECT * FROM item_types WHERE item_subcategory_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (rows.length > 0) {
      res.status(400).json({ error: 'Cannot delete subcategory: item types are linked to this subcategory' });
      return;
    }
    db.run('DELETE FROM item_subcategories WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Item subcategory deleted' });
    });
  });
});

// ITEM TYPES
router.get('/item-types', (req, res) => {
  db.all(`SELECT it.*, ic.name as item_category_name, isc.name as item_subcategory_name, iu.name as item_unit_name FROM item_types it
          LEFT JOIN item_categories ic ON it.item_category_id = ic.id
          LEFT JOIN item_subcategories isc ON it.item_subcategory_id = isc.id
          LEFT JOIN item_units iu ON it.item_unit_id = iu.id
          ORDER BY it.id DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/item-types/next-serial', (req, res) => {
  db.get('SELECT serial_number FROM item_types WHERE serial_number IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'IT-001';
    if (row && row.serial_number) {
      const lastNum = parseInt(row.serial_number.split('-')[1]);
      nextSerial = `IT-${String(lastNum + 1).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.post('/item-types', (req, res) => {
  const { name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number } = req.body;
  console.log('Creating item type:', { name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number });

  // Check if item type already exists with same name and category
  db.all('SELECT * FROM item_types WHERE name = ? AND item_category_id = ?', [name, item_category_id], (err, rows) => {
    if (err) {
      console.error('Error checking existing item type:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    if (rows.length > 0) {
      console.log('Item type already exists:', rows[0]);
      res.status(400).json({ error: 'Item type with this name already exists in this category' });
      return;
    }

    db.run('INSERT INTO item_types (name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number) VALUES (?, ?, ?, ?, ?, ?)', [name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number], function(err) {
      if (err) {
        console.error('Error creating item type:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('Item type created successfully:', { id: this.lastID, name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number });
      res.json({ id: this.lastID, name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number });
    });
  });
});

router.put('/item-types/:id', (req, res) => {
  const { name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number } = req.body;
  db.run('UPDATE item_types SET name = ?, description = ?, item_category_id = ?, item_subcategory_id = ?, item_unit_id = ?, serial_number = ? WHERE id = ?', [name, description, item_category_id, item_subcategory_id, item_unit_id, serial_number, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item type updated' });
  });
});

router.delete('/item-types/:id', (req, res) => {
  db.run('DELETE FROM item_types WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item type deleted' });
  });
});

// MODULE MANAGERS & TABLE PERMISSIONS

function getOrCreateTablePermission(managerId, tableName, callback) {
  db.get('SELECT * FROM module_table_permissions WHERE module_manager_id = ? AND table_name = ?', [managerId, tableName], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    if (row) {
      callback(null, row);
      return;
    }
    db.run('INSERT INTO module_table_permissions (module_manager_id, table_name) VALUES (?, ?)', [managerId, tableName], function(err) {
      if (err) {
        callback(err);
        return;
      }
      db.get('SELECT * FROM module_table_permissions WHERE id = ?', [this.lastID], callback);
    });
  });
}

router.get('/module-managers', requireAdmin, (req, res) => {
  db.all('SELECT id, name, module_name, login_id, created_at FROM module_managers ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create a new module manager
router.post('/module-managers', requireAdmin, (req, res) => {
  const { name, module_name, login_id, password } = req.body;
  if (!name || !module_name) {
    res.status(400).json({ error: 'Name and module_name are required.' });
    return;
  }
  if (!login_id || login_id.trim().length < 3) {
    res.status(400).json({ error: 'Login ID must be at least 3 characters.' });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters.' });
    return;
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run('INSERT INTO module_managers (name, module_name, login_id, password_hash) VALUES (?, ?, ?, ?)',
      [name.trim(), module_name, login_id.trim(), hash], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'That Login ID is already taken.' });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }
        res.json({ id: this.lastID, name: name.trim(), module_name, login_id: login_id.trim() });
      });
  });
});

// Delete a module manager (cannot delete admin or the last admin)
router.delete('/module-managers/:id', requireAdmin, (req, res) => {
  const managerId = req.params.id;
  db.get('SELECT module_name FROM module_managers WHERE id = ?', [managerId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Manager not found.' });
      return;
    }
    if (row.module_name === 'admin') {
      res.status(400).json({ error: 'Cannot delete admin manager.' });
      return;
    }
    db.run('DELETE FROM module_managers WHERE id = ?', [managerId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Manager deleted.' });
    });
  });
});

router.get('/module-managers/:id', requireAdmin, (req, res) => {
  db.get('SELECT id, name, module_name, login_id, created_at FROM module_managers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || null);
  });
});

router.post('/module-managers/:id/login-id', requireAdmin, (req, res) => {
  const { login_id } = req.body;
  const managerId = req.params.id;
  if (!login_id || login_id.trim().length < 3) {
    res.status(400).json({ error: 'Login ID must be at least 3 characters.' });
    return;
  }
  db.run('UPDATE module_managers SET login_id = ? WHERE id = ?', [login_id.trim(), managerId], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        res.status(400).json({ error: 'That Login ID is already taken.' });
      } else {
        res.status(500).json({ error: err.message });
      }
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Manager not found.' });
      return;
    }
    res.json({ message: 'Login ID updated successfully.' });
  });
});

router.post('/module-managers/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  const managerId = req.params.id;
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run('UPDATE module_managers SET password_hash = ? WHERE id = ?', [hash, managerId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Manager not found.' });
        return;
      }
      res.json({ message: 'Password updated successfully.' });
    });
  });
});

router.get('/module-table-permissions/:managerId', (req, res) => {
  const managerId = req.params.managerId;
  db.all('SELECT * FROM module_table_permissions WHERE module_manager_id = ? ORDER BY table_name', [managerId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/module-table-permissions/:managerId', requireAdmin, (req, res) => {
  const { table_name, can_add, can_edit, can_delete } = req.body;
  const managerId = req.params.managerId;
  if (!table_name) {
    res.status(400).json({ error: 'table_name is required' });
    return;
  }
  getOrCreateTablePermission(managerId, table_name, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const addVal = can_add !== undefined ? (can_add ? 1 : 0) : (row.can_add !== undefined ? row.can_add : 1);
    const editVal = can_edit !== undefined ? (can_edit ? 1 : 0) : row.can_edit;
    const deleteVal = can_delete !== undefined ? (can_delete ? 1 : 0) : row.can_delete;
    db.run('UPDATE module_table_permissions SET can_add = ?, can_edit = ?, can_delete = ? WHERE id = ?',
      [addVal, editVal, deleteVal, row.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.get('SELECT * FROM module_table_permissions WHERE id = ?', [row.id], (err, updated) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(updated);
        });
      }
    );
  });
});

// MODULE TAB/SUBTAB PERMISSIONS
function getOrCreateTabPermission(managerId, moduleName, tabKey, subtabKey, callback) {
  db.get('SELECT * FROM module_tab_permissions WHERE module_manager_id = ? AND module_name = ? AND tab_key = ? AND subtab_key = ?',
    [managerId, moduleName, tabKey, subtabKey || ''], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    if (row) {
      callback(null, row);
      return;
    }
    db.run('INSERT INTO module_tab_permissions (module_manager_id, module_name, tab_key, subtab_key) VALUES (?, ?, ?, ?)',
      [managerId, moduleName, tabKey, subtabKey || ''], function(err) {
        if (err) {
          callback(err);
          return;
        }
        db.get('SELECT * FROM module_tab_permissions WHERE id = ?', [this.lastID], callback);
      });
  });
}

router.get('/module-tab-permissions/:managerId', (req, res) => {
  const managerId = req.params.managerId;
  db.all('SELECT * FROM module_tab_permissions WHERE module_manager_id = ? ORDER BY module_name, tab_key, subtab_key', [managerId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/module-tab-permissions/:managerId', requireAdmin, (req, res) => {
  const { module_name, tab_key, subtab_key, can_view, can_add, can_edit, can_delete, can_export } = req.body;
  const managerId = req.params.managerId;
  if (!module_name || !tab_key) {
    res.status(400).json({ error: 'module_name and tab_key are required' });
    return;
  }
  getOrCreateTabPermission(managerId, module_name, tab_key, subtab_key || '', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const viewVal = can_view !== undefined ? (can_view ? 1 : 0) : (row.can_view !== undefined ? row.can_view : 1);
    const addVal = can_add !== undefined ? (can_add ? 1 : 0) : (row.can_add !== undefined ? row.can_add : 1);
    const editVal = can_edit !== undefined ? (can_edit ? 1 : 0) : (row.can_edit !== undefined ? row.can_edit : 0);
    const deleteVal = can_delete !== undefined ? (can_delete ? 1 : 0) : (row.can_delete !== undefined ? row.can_delete : 0);
    const exportVal = can_export !== undefined ? (can_export ? 1 : 0) : (row.can_export !== undefined ? row.can_export : 1);
    db.run('UPDATE module_tab_permissions SET can_view = ?, can_add = ?, can_edit = ?, can_delete = ?, can_export = ? WHERE id = ?',
      [viewVal, addVal, editVal, deleteVal, exportVal, row.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.get('SELECT * FROM module_tab_permissions WHERE id = ?', [row.id], (err, updated) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(updated);
        });
      }
    );
  });
});

// MANAGER LOCATION FILTERS (for equipment managers)
// Get allowed location IDs for a manager
router.get('/module-managers/:id/location-filters', requireAdmin, (req, res) => {
  db.all('SELECT location_id FROM module_manager_location_filters WHERE module_manager_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => r.location_id));
  });
});

// Set allowed location IDs for a manager (replaces all)
router.put('/module-managers/:id/location-filters', requireAdmin, (req, res) => {
  const { location_ids } = req.body;
  if (!Array.isArray(location_ids)) {
    res.status(400).json({ error: 'location_ids must be an array.' });
    return;
  }
  const managerId = req.params.id;
  db.run('DELETE FROM module_manager_location_filters WHERE module_manager_id = ?', [managerId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (location_ids.length === 0) {
      res.json({ message: 'Location filters cleared.' });
      return;
    }
    const placeholders = location_ids.map(() => '(?, ?)').join(',');
    const values = location_ids.flatMap(id => [managerId, id]);
    db.run(`INSERT INTO module_manager_location_filters (module_manager_id, location_id) VALUES ${placeholders}`, values, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Location filters updated.' });
    });
  });
});

// MANAGER OWNER FILTERS (for equipment managers)
// Get allowed owner IDs for a manager
router.get('/module-managers/:id/owner-filters', requireAdmin, (req, res) => {
  db.all('SELECT owner_id FROM module_manager_owner_filters WHERE module_manager_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => r.owner_id));
  });
});

// Set allowed owner IDs for a manager (replaces all)
router.put('/module-managers/:id/owner-filters', requireAdmin, (req, res) => {
  const { owner_ids } = req.body;
  if (!Array.isArray(owner_ids)) {
    res.status(400).json({ error: 'owner_ids must be an array.' });
    return;
  }
  const managerId = req.params.id;
  db.run('DELETE FROM module_manager_owner_filters WHERE module_manager_id = ?', [managerId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (owner_ids.length === 0) {
      res.json({ message: 'Owner filters cleared.' });
      return;
    }
    const placeholders = owner_ids.map(() => '(?, ?)').join(',');
    const values = owner_ids.flatMap(id => [managerId, id]);
    db.run(`INSERT INTO module_manager_owner_filters (module_manager_id, owner_id) VALUES ${placeholders}`, values, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Owner filters updated.' });
    });
  });
});

// PREVENTIVE MAINTENANCE TASKS

// COLUMN VISIBILITY PERMISSIONS
// Get column visibility settings for a manager (optionally filtered by tab_key)
router.get('/column-visibility/:managerId', (req, res) => {
  const managerId = req.params.managerId;
  const tabKey = req.query.tab_key;
  let sql = 'SELECT * FROM module_manager_column_visibility WHERE module_manager_id = ?';
  let params = [managerId];
  if (tabKey) {
    sql += ' AND tab_key = ?';
    params.push(tabKey);
  }
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Save column visibility settings for a manager (bulk replace per tab_key)
router.put('/column-visibility/:managerId', requireAdmin, (req, res) => {
  const managerId = req.params.managerId;
  const { module_name, tab_key, columns } = req.body;
  if (!module_name || !tab_key || !Array.isArray(columns)) {
    res.status(400).json({ error: 'module_name, tab_key, and columns array are required' });
    return;
  }
  db.run('DELETE FROM module_manager_column_visibility WHERE module_manager_id = ? AND tab_key = ?', [managerId, tab_key], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (columns.length === 0) {
      res.json({ message: 'Column visibility cleared.' });
      return;
    }
    const placeholders = columns.map(() => '(?, ?, ?, ?, ?)').join(',');
    const values = columns.flatMap(c => [managerId, module_name, tab_key, c.column_key, c.is_visible ? 1 : 0]);
    db.run(`INSERT INTO module_manager_column_visibility (module_manager_id, module_name, tab_key, column_key, is_visible) VALUES ${placeholders}`, values, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Column visibility saved.' });
    });
  });
});

// Get items filtered as equipment (items that have equipment records via catalog_id)
router.get('/equipment-items', (req, res) => {
  db.all(`SELECT DISTINCT i.*, ic.name as category_name, isc.name as subcategory_name, it.name as type_name, iu.name as unit_name
         FROM items i
         LEFT JOIN item_categories ic ON i.category_id = ic.id
         LEFT JOIN item_subcategories isc ON i.subcategory_id = isc.id
         LEFT JOIN item_types it ON i.type_id = it.id
         LEFT JOIN item_units iu ON i.unit_id = iu.id
         INNER JOIN equipment e ON e.catalog_id = i.id
         ORDER BY i.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get all PM tasks with item info
router.get('/pm-tasks', (req, res) => {
  const { item_id, pm_type } = req.query;
  let query = `SELECT pmt.*, i.name as item_name, i.product_code, ic.name as category_name
         FROM preventive_maintenance_tasks pmt
         LEFT JOIN items i ON pmt.item_id = i.id
         LEFT JOIN item_categories ic ON i.category_id = ic.id`;
  const params = [];
  const conditions = [];
  if (item_id) {
    conditions.push('pmt.item_id = ?');
    params.push(item_id);
  }
  if (pm_type) {
    conditions.push('pmt.pm_type = ?');
    params.push(pm_type);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY i.name, pmt.pm_type, pmt.id';
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add PM task
router.post('/pm-tasks', (req, res) => {
  const { item_id, task_text, pm_type } = req.body;
  if (!item_id || !task_text) {
    res.status(400).json({ error: 'Item and task text are required' });
    return;
  }
  db.run('INSERT INTO preventive_maintenance_tasks (item_id, task_text, pm_type) VALUES (?, ?, ?)',
    [item_id, task_text, pm_type || 'monthly'], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, item_id, task_text, pm_type: pm_type || 'monthly' });
    });
});

// Update PM task
router.put('/pm-tasks/:id', (req, res) => {
  const { item_id, task_text, pm_type } = req.body;
  if (!item_id || !task_text) {
    res.status(400).json({ error: 'Item and task text are required' });
    return;
  }
  db.run('UPDATE preventive_maintenance_tasks SET item_id = ?, task_text = ?, pm_type = ? WHERE id = ?',
    [item_id, task_text, pm_type || 'monthly', req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'PM task updated' });
    });
});

// Delete PM task
router.delete('/pm-tasks/:id', (req, res) => {
  db.run('DELETE FROM preventive_maintenance_tasks WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'PM task deleted' });
  });
});

module.exports = router;
