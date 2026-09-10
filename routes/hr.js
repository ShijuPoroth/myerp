const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { db } = require('../config/database');

const router = express.Router();

// Configure multer for employee photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

function employeePhotoFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed for employee photos'), false);
}

const upload = multer({
  storage: storage,
  fileFilter: employeePhotoFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Configure multer for signed payslip uploads
const signedPayslipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/signed-payslips');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'signed_payslip_' + uniqueSuffix + path.extname(file.originalname));
  }
});

function signedPayslipFilter(req, file, cb) {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    return cb(null, true);
  }
  cb(new Error('Only images and PDF files are allowed for signed payslips'), false);
}

const uploadSignedPayslip = multer({
  storage: signedPayslipStorage,
  fileFilter: signedPayslipFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper: resolve lookup table id by name (insert if missing)
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

function resolveLookupId(tableName, name, callback) {
  if (name === undefined || name === null || String(name).trim() === '') { callback(null, null); return; }
  const cleanName = String(name).trim();
  db.get(`SELECT id FROM ${tableName} WHERE name = ?`, [cleanName], (err, row) => {
    if (err) { callback(err, null); return; }
    if (row) { callback(null, row.id); return; }
    db.run(`INSERT INTO ${tableName} (name) VALUES (?)`, [cleanName], function(err) {
      callback(err, err ? null : this.lastID);
    });
  });
}

function resolveDepartmentId(departmentId, departmentName, callback) {
  if (departmentId) { callback(null, departmentId); return; }
  resolveLookupId('departments', departmentName, callback);
}

function resolvePositionId(positionId, positionName, callback) {
  if (positionId) { callback(null, positionId); return; }
  resolveLookupId('positions', positionName, callback);
}

function resolveEmployeeStatusId(statusId, statusName, callback) {
  if (statusId) { callback(null, statusId); return; }
  resolveLookupId('employee_statuses', statusName, callback);
}

function resolveNationalityId(nationalityId, nationalityName, callback) {
  if (nationalityId) { callback(null, nationalityId); return; }
  resolveLookupId('nationalities', nationalityName, callback);
}

function resolveRemunerationTypeId(remTypeId, remTypeName, callback) {
  if (remTypeId) { callback(null, remTypeId); return; }
  resolveLookupId('remuneration_types', remTypeName, callback);
}

function resolveLocationId(locationId, countryName, locationName, sublocationName, callback) {
  if (locationId) { callback(null, locationId); return; }
  const country = String(countryName || '').trim();
  const location = String(locationName || '').trim();
  const sublocation = String(sublocationName || '').trim();

  if (!country && !location && !sublocation) { callback(null, null); return; }
  if (!country || !location || !sublocation) { callback(null, null); return; }

  db.get(`SELECT bta.id FROM business_type_assignments bta
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          WHERE LOWER(c.name) = LOWER(?)
            AND LOWER(lt.name) = LOWER(?)
            AND LOWER(COALESCE(slt.name,'') || ' - ' || COALESCE(bt.name,'') || ' - ' || COALESCE(bta.business_unit_code,'')) = LOWER(?)`,
    [country, location, sublocation], (err, row) => {
      if (err) { callback(err, null); return; }
      if (row) { callback(null, row.id); return; }
      callback(new Error(`Location assignment not found: ${country} - ${location} - ${sublocation}`), null);
    });
}

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

// Module table permission helper
function checkModulePermission(managerId, tableName, action, callback) {
  if (!managerId) return callback(null, false);
  db.get('SELECT can_edit, can_delete FROM module_table_permissions WHERE module_manager_id = ? AND table_name = ?', [managerId, tableName], (err, row) => {
    if (err) return callback(err, false);
    if (!row) return callback(null, false);
    callback(null, action === 'delete' ? row.can_delete : row.can_edit);
  });
}

function requireModulePermission(tableName, action) {
  return (req, res, next) => {
    if (req.session && req.session.moduleName === 'admin') return next();
    const managerId = req.query.manager_id || req.body.manager_id;
    checkModulePermission(managerId, tableName, action, (err, allowed) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!allowed) {
        res.status(403).json({ error: `You do not have permission to ${action} this record.` });
        return;
      }
      next();
    });
  };
}

// UNIFORM ITEMS
router.get('/uniform-items', (req, res) => {
  db.all(`SELECT ui.*, l.name as location_name,
          (SELECT COALESCE(SUM(quantity),0) FROM uniform_purchases up WHERE up.item_id = ui.id) as total_purchased,
          (SELECT COALESCE(SUM(quantity),0) FROM uniform_distributions ud WHERE ud.item_id = ui.id) as total_distributed
          FROM uniform_items ui 
          LEFT JOIN locations l ON ui.location_id = l.id 
          ORDER BY ui.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/uniform-items', (req, res) => {
  const { name, category, size, gender, current_stock, minimum_stock, location_id, color, notes } = req.body;
  
  db.run(`INSERT INTO uniform_items (name, category, size, gender, current_stock, minimum_stock, location_id, color, notes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, size, gender, current_stock, minimum_stock, location_id, color || '', notes || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, category, size, gender, current_stock, minimum_stock, location_id, color, notes });
    }
  );
});

router.put('/uniform-items/:id', requireModulePermission('uniforms', 'edit'), (req, res) => {
  const { name, category, size, gender, current_stock, minimum_stock, location_id, color, notes } = req.body;
  
  db.run(`UPDATE uniform_items SET name = ?, category = ?, size = ?, gender = ?, current_stock = ?, 
          minimum_stock = ?, location_id = ?, color = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, category, size, gender, current_stock, minimum_stock, location_id, color || '', notes || '', req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Uniform item updated' });
    }
  );
});

router.delete('/uniform-items/:id', requireModulePermission('uniforms', 'delete'), (req, res) => {
  db.run('DELETE FROM uniform_items WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Uniform item deleted' });
  });
});

// UNIFORM PURCHASES
router.get('/uniform-purchases', (req, res) => {
  db.all(`SELECT up.*, ui.name as item_name, ui.size as item_size, ui.color as item_color, l.name as location_name, s.name as supplier_name,
          c.name as country_name, lt.name as bta_location_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code
          FROM uniform_purchases up 
          JOIN uniform_items ui ON up.item_id = ui.id
          LEFT JOIN locations l ON up.location_id = l.id
          LEFT JOIN suppliers s ON up.supplier_id = s.id
          LEFT JOIN business_type_assignments bta ON up.business_type_assignment_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          ORDER BY up.purchase_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/uniform-purchases', (req, res) => {
  const { item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id, business_type_assignment_id } = req.body;
  
  resolveSupplierId(supplier_id, supplier_name, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO uniform_purchases (item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id, business_type_assignment_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id, business_type_assignment_id || null],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run('UPDATE uniform_items SET current_stock = current_stock + ? WHERE id = ?', [quantity, item_id], (err) => {
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

router.put('/uniform-purchases/:id', requireModulePermission('uniforms', 'edit'), (req, res) => {
  const { item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id, business_type_assignment_id } = req.body;

  db.get('SELECT item_id, quantity FROM uniform_purchases WHERE id = ?', [req.params.id], (err, old) => {
    if (err) { res.status(500).json({ error: err.message }); return; }

    resolveSupplierId(supplier_id, supplier_name, (err2, resolvedSupplierId) => {
      if (err2) { res.status(500).json({ error: err2.message }); return; }

      db.run('BEGIN TRANSACTION');

      db.run(`UPDATE uniform_purchases SET item_id = ?, supplier_id = ?, supplier_name = ?, quantity = ?, unit_price = ?, total_cost = ?, purchase_date = ?, invoice_number = ?, location_id = ?, business_type_assignment_id = ? WHERE id = ?`,
        [item_id, resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number, location_id, business_type_assignment_id || null, req.params.id],
        function(err3) {
          if (err3) { db.run('ROLLBACK'); res.status(500).json({ error: err3.message }); return; }

          if (old && old.item_id && old.quantity != null) {
            const stockDiff = parseInt(quantity) - parseInt(old.quantity);
            const oldItemId = old.item_id;
            const newItemId = item_id;
            if (oldItemId == newItemId) {
              db.run('UPDATE uniform_items SET current_stock = current_stock + ? WHERE id = ?', [stockDiff, newItemId], (err4) => {
                if (err4) { db.run('ROLLBACK'); res.status(500).json({ error: err4.message }); return; }
                db.run('COMMIT');
                res.json({ message: 'Uniform purchase updated' });
              });
            } else {
              db.run('UPDATE uniform_items SET current_stock = current_stock - ? WHERE id = ?', [old.quantity, oldItemId], (err4) => {
                if (err4) { db.run('ROLLBACK'); res.status(500).json({ error: err4.message }); return; }
                db.run('UPDATE uniform_items SET current_stock = current_stock + ? WHERE id = ?', [quantity, newItemId], (err5) => {
                  if (err5) { db.run('ROLLBACK'); res.status(500).json({ error: err5.message }); return; }
                  db.run('COMMIT');
                  res.json({ message: 'Uniform purchase updated' });
                });
              });
            }
          } else {
            db.run('COMMIT');
            res.json({ message: 'Uniform purchase updated' });
          }
        }
      );
    });
  });
});

router.delete('/uniform-purchases/:id', requireModulePermission('uniforms', 'delete'), (req, res) => {
  const managerId = req.query.manager_id;
  if (!managerId) {
    res.status(400).json({ error: 'manager_id is required' });
    return;
  }

  db.get('SELECT item_id, quantity FROM uniform_purchases WHERE id = ?', [req.params.id], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }

    db.run('BEGIN TRANSACTION');

    db.run('DELETE FROM uniform_purchases WHERE id = ?', [req.params.id], function(err2) {
      if (err2) { db.run('ROLLBACK'); res.status(500).json({ error: err2.message }); return; }

      if (row && row.item_id && row.quantity) {
        db.run('UPDATE uniform_items SET current_stock = current_stock - ? WHERE id = ?', [row.quantity, row.item_id], (err3) => {
          if (err3) { db.run('ROLLBACK'); res.status(500).json({ error: err3.message }); return; }
          db.run('COMMIT');
          res.json({ message: 'Uniform purchase deleted' });
        });
      } else {
        db.run('COMMIT');
        res.json({ message: 'Uniform purchase deleted' });
      }
    });
  });
});

// UNIFORM DISTRIBUTIONS
router.get('/uniform-distributions', (req, res) => {
  db.all(`SELECT ud.*, ui.name as item_name, ui.size as item_size, ui.color as item_color,
          e.employee_id as employee_code, e.first_name || ' ' || e.last_name as employee_name,
          e.department as emp_department, e.photo_path,
          c.name as country_name, lt.name as location_type_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code
          FROM uniform_distributions ud 
          JOIN uniform_items ui ON ud.item_id = ui.id
          LEFT JOIN employees e ON ud.employee_id = e.id
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          ORDER BY e.first_name, e.last_name, ud.distribution_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/uniform-distributions', (req, res) => {
  const { item_id, staff_name, employee_id, staff_id, department, quantity, distribution_date, notes, location_id } = req.body;
  
  resolveEmployeeId(employee_id || staff_id, staff_name, (err, resolvedEmployeeId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO uniform_distributions (item_id, employee_id, staff_name, staff_id, department, quantity, distribution_date, notes, location_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, resolvedEmployeeId, staff_name, staff_id, department, quantity, distribution_date, notes, location_id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run('UPDATE uniform_items SET current_stock = current_stock - ? WHERE id = ?', [quantity, item_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          db.run('COMMIT');
          res.json({ id: this.lastID, item_id, employee_id: resolvedEmployeeId, staff_name, staff_id, department, quantity, distribution_date, notes, location_id });
        });
      }
    );
  });
});

router.delete('/uniform-distributions/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM uniform_distributions WHERE id = ?', [id], (err, dist) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (!dist) { res.status(404).json({ error: 'Distribution not found' }); return; }
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM uniform_distributions WHERE id = ?', [id], (err) => {
      if (err) { db.run('ROLLBACK'); res.status(500).json({ error: err.message }); return; }
      db.run('UPDATE uniform_items SET current_stock = current_stock + ? WHERE id = ?', [dist.quantity, dist.item_id], (err) => {
        if (err) { db.run('ROLLBACK'); res.status(500).json({ error: err.message }); return; }
        db.run('COMMIT');
        res.json({ message: 'Uniform distribution deleted' });
      });
    });
  });
});

// EMPLOYEES
router.get('/employees', (req, res) => {
  const activeOnly = req.query.active === 'true';
  const whereClause = activeOnly ? 'WHERE e.is_terminated = 0 OR e.is_terminated IS NULL' : '';
  db.all(`SELECT e.*,
          d.name as department_name,
          p.name as position_name,
          es.name as employee_status_name,
          n.name as nationality_name,
          rt.name as remuneration_type_name,
          c.name as country_name, lt.name as location_type_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code,
          c.name || ' - ' || lt.name || ' - ' || slt.name || ' - ' || bt.name || ' - ' || bta.business_unit_code as location_name,
          (SELECT ea.status FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = date('now') AND ea.status IN ('paid-leave','medical-leave','compassionate-leave','unpaid-leave') LIMIT 1) as on_leave_today,
          (SELECT MAX(ea2.date) FROM employee_attendance ea2 WHERE ea2.employee_id = e.id AND ea2.date >= date('now') AND ea2.status IN ('paid-leave','medical-leave','compassionate-leave','unpaid-leave') AND NOT EXISTS (SELECT 1 FROM employee_attendance ea3 WHERE ea3.employee_id = e.id AND ea3.date > date('now') AND ea3.date < ea2.date AND ea3.status NOT IN ('paid-leave','medical-leave','compassionate-leave','unpaid-leave'))) as leave_until
          FROM employees e
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          LEFT JOIN departments d ON e.department_id = d.id
          LEFT JOIN positions p ON e.position_id = p.id
          LEFT JOIN employee_statuses es ON e.employee_status_id = es.id
          LEFT JOIN nationalities n ON e.nationality_id = n.id
          LEFT JOIN remuneration_types rt ON e.remuneration_type_id = rt.id
          ${whereClause}
          ORDER BY e.first_name, e.last_name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Override status to 'On Leave' for employees with a leave attendance record today
    rows.forEach(row => {
      if (row.on_leave_today && !row.is_terminated) {
        row.status = 'On Leave';
      }
    });
    res.json(rows);
  });
});

router.get('/employees/next-id', (req, res) => {
  db.get("SELECT MAX(CAST(SUBSTR(employee_id, 5) AS INTEGER)) as max_num FROM employees WHERE employee_id LIKE 'EMP-%'", [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const nextNum = (row.max_num || 0) + 1;
    const nextId = 'EMP-' + String(nextNum).padStart(3, '0');
    res.json({ next_id: nextId });
  });
});

router.get('/employees/:id', (req, res) => {
  db.get(`SELECT e.*,
          d.name as department_name,
          p.name as position_name,
          es.name as employee_status_name,
          n.name as nationality_name,
          rt.name as remuneration_type_name,
          c.name as country_name, lt.name as location_type_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code,
          c.name || ' - ' || lt.name || ' - ' || slt.name || ' - ' || bt.name || ' - ' || bta.business_unit_code as location_name
          FROM employees e
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          LEFT JOIN departments d ON e.department_id = d.id
          LEFT JOIN positions p ON e.position_id = p.id
          LEFT JOIN employee_statuses es ON e.employee_status_id = es.id
          LEFT JOIN nationalities n ON e.nationality_id = n.id
          LEFT JOIN remuneration_types rt ON e.remuneration_type_id = rt.id
          WHERE e.id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/employees', upload.single('photo'), (req, res) => {
  const { employee_id, first_name, last_name, email, phone, department_id, department, position_id, position, location_id, hire_date, employee_status_id, status, nationality_id, nationality, address, emergency_contact, emergency_phone, remuneration_type_id, remuneration_type, remuneration, assigned_to, working_hours_per_day, overtime_rate } = req.body;
  const photo_path = req.file ? `/uploads/${req.file.filename}` : null;
  
  resolveDepartmentId(department_id, department, (err, resolvedDepartmentId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolvePositionId(position_id, position, (err, resolvedPositionId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      resolveEmployeeStatusId(employee_status_id, status, (err, resolvedStatusId) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        resolveNationalityId(nationality_id, nationality, (err, resolvedNationalityId) => {
          if (err) { res.status(500).json({ error: err.message }); return; }
          resolveRemunerationTypeId(remuneration_type_id, remuneration_type, (err, resolvedRemTypeId) => {
            if (err) { res.status(500).json({ error: err.message }); return; }
            
            db.run(`INSERT INTO employees (employee_id, first_name, last_name, email, phone, department_id, department, position_id, position, location_id, hire_date, employee_status_id, status, nationality_id, nationality, address, emergency_contact, emergency_phone, photo_path, remuneration_type_id, remuneration_type, remuneration, assigned_to, working_hours_per_day, overtime_rate) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [employee_id, first_name, last_name, email, phone, resolvedDepartmentId, department, resolvedPositionId, position, location_id, hire_date, resolvedStatusId, status, resolvedNationalityId, nationality, address, emergency_contact, emergency_phone, photo_path, resolvedRemTypeId, remuneration_type, remuneration, assigned_to, working_hours_per_day || 8, overtime_rate || 1],
              function(err) {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({ id: this.lastID, employee_id, first_name, last_name, email, phone, department_id: resolvedDepartmentId, position_id: resolvedPositionId, employee_status_id: resolvedStatusId, nationality_id: resolvedNationalityId, remuneration_type_id: resolvedRemTypeId, location_id, hire_date, status, nationality, address, emergency_contact, emergency_phone, photo_path, remuneration_type, remuneration, assigned_to, working_hours_per_day, overtime_rate });
              }
            );
          });
        });
      });
    });
  });
});

router.put('/employees/:id', upload.single('photo'), requireModulePermission('employees', 'edit'), (req, res) => {
  const { first_name, last_name, email, phone, department_id, department, position_id, position, location_id, hire_date, employee_status_id, status, nationality_id, nationality, address, emergency_contact, emergency_phone, remuneration_type_id, remuneration_type, remuneration, assigned_to, working_hours_per_day, overtime_rate } = req.body;
  const photo_path = req.file ? `/uploads/${req.file.filename}` : (req.body.existing_photo || null);
  
  resolveDepartmentId(department_id, department, (err, resolvedDepartmentId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolvePositionId(position_id, position, (err, resolvedPositionId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      resolveEmployeeStatusId(employee_status_id, status, (err, resolvedStatusId) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        resolveNationalityId(nationality_id, nationality, (err, resolvedNationalityId) => {
          if (err) { res.status(500).json({ error: err.message }); return; }
          resolveRemunerationTypeId(remuneration_type_id, remuneration_type, (err, resolvedRemTypeId) => {
            if (err) { res.status(500).json({ error: err.message }); return; }
            
            db.run(`UPDATE employees SET first_name = ?, last_name = ?, email = ?, phone = ?, 
                    department_id = ?, department = ?, position_id = ?, position = ?, location_id = ?, hire_date = ?, employee_status_id = ?, status = ?, nationality_id = ?, nationality = ?, address = ?, 
                    emergency_contact = ?, emergency_phone = ?, photo_path = ?, remuneration_type_id = ?, remuneration_type = ?, remuneration = ?, assigned_to = ?,
                    working_hours_per_day = ?, overtime_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [first_name, last_name, email, phone, resolvedDepartmentId, department, resolvedPositionId, position, location_id, hire_date, resolvedStatusId, status, resolvedNationalityId, nationality, address, emergency_contact, emergency_phone, photo_path, resolvedRemTypeId, remuneration_type, remuneration, assigned_to, working_hours_per_day || 8, overtime_rate || 1, req.params.id],
              function(err) {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({ message: 'Employee updated' });
              }
            );
          });
        });
      });
    });
  });
});

router.delete('/employees/:id', requireModulePermission('employees', 'delete'), (req, res) => {
  db.run('DELETE FROM employees WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Employee deleted' });
  });
});

// Helper: parse simple CSV (handles quoted values and commas)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (cell !== '' || row.length > 0) {
          row.push(cell);
          rows.push(row);
          row = [];
        }
        cell = '';
      } else {
        cell += char;
      }
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const EMPLOYEE_BULK_HEADERS = [
  'first_name', 'last_name', 'email', 'phone',
  'department', 'position', 'country', 'location', 'sublocation_business_type',
  'hire_date', 'status', 'nationality', 'address', 'emergency_contact', 'emergency_phone',
  'remuneration_type', 'remuneration', 'working_hours_per_day', 'overtime_rate'
];

router.get('/employees/bulk-import/template', (req, res) => {
  const sampleRow = [
    'John', 'Doe', 'john.doe@example.com', '+971501234567',
    'Operations', 'Technician', 'UAE', 'Dubai', 'Al Quoz - Warehouse - WH001',
    '2024-01-15', 'Active', 'India', '"123 Main St, Dubai"', 'Jane Doe', '+971509876543',
    'Monthly', '2500', '8', '1.5'
  ];
  const csv = [EMPLOYEE_BULK_HEADERS.join(','), sampleRow.join(',')].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.csv"');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(csv);
});

router.get('/employees/bulk-import/template-xlsx', async (req, res) => {
  try {
    const getAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const [countries, locations, assignments, departments, positions, empStatuses, nationalities, remTypes] = await Promise.all([
      getAll('SELECT name FROM countries ORDER BY name'),
      getAll('SELECT DISTINCT name FROM location_types ORDER BY name'),
      getAll(`SELECT DISTINCT COALESCE(slt.name,'') || ' - ' || COALESCE(bt.name,'') || ' - ' || COALESCE(bta.business_unit_code,'') AS name
              FROM business_type_assignments bta
              LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
              LEFT JOIN business_types bt ON bta.business_type_id = bt.id
              ORDER BY name`),
      getAll('SELECT name FROM departments ORDER BY name'),
      getAll('SELECT name FROM positions ORDER BY name'),
      getAll('SELECT name FROM employee_statuses ORDER BY name'),
      getAll('SELECT name FROM nationalities ORDER BY name'),
      getAll('SELECT name FROM remuneration_types ORDER BY name')
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    const listSheet = workbook.addWorksheet('Lists');
    const headers = EMPLOYEE_BULK_HEADERS;
    const sampleRow = [
      'John', 'Doe', 'john.doe@example.com', '+971501234567',
      '', '', '', '', '',
      '2024-01-15', '', '', '123 Main St, Dubai', 'Jane Doe', '+971509876543',
      '', 2500, 8, 1.5
    ];

    worksheet.addRow(headers);
    worksheet.addRow(sampleRow);
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    worksheet.autoFilter = { from: 'A1', to: 'S1' };
    worksheet.columns = headers.map(header => ({ key: header, width: Math.max(header.length + 3, 16) }));
    worksheet.getColumn('I').width = 38;
    worksheet.getColumn('M').width = 30;

    const listHeaders = ['Countries', 'Locations', 'Sublocations', 'Departments', 'Positions', 'Statuses', 'Nationalities', 'Remuneration Types'];
    listSheet.addRow(listHeaders);
    const listLength = Math.max(countries.length, locations.length, assignments.length, departments.length, positions.length, empStatuses.length, nationalities.length, remTypes.length);
    for (let i = 0; i < listLength; i++) {
      listSheet.addRow([
        countries[i]?.name || '',
        locations[i]?.name || '',
        assignments[i]?.name || '',
        departments[i]?.name || '',
        positions[i]?.name || '',
        empStatuses[i]?.name || '',
        nationalities[i]?.name || '',
        remTypes[i]?.name || ''
      ]);
    }
    listSheet.state = 'hidden';

    const lastRow = (arr) => Math.max(arr.length + 1, 2);
    const lr = {
      countries: lastRow(countries),
      locations: lastRow(locations),
      sublocations: lastRow(assignments),
      departments: lastRow(departments),
      positions: lastRow(positions),
      statuses: lastRow(empStatuses),
      nationalities: lastRow(nationalities),
      remTypes: lastRow(remTypes)
    };

    worksheet.dataValidations.add('E2:E1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$D$2:$D$${lr.departments}`] });
    worksheet.dataValidations.add('F2:F1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$E$2:$E$${lr.positions}`] });
    worksheet.dataValidations.add('G2:G1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$A$2:$A$${lr.countries}`] });
    worksheet.dataValidations.add('H2:H1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$B$2:$B$${lr.locations}`] });
    worksheet.dataValidations.add('I2:I1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$C$2:$C$${lr.sublocations}`] });
    worksheet.dataValidations.add('K2:K1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$F$2:$F$${lr.statuses}`] });
    worksheet.dataValidations.add('L2:L1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$G$2:$G$${lr.nationalities}`] });
    worksheet.dataValidations.add('P2:P1000', { type: 'list', allowBlank: true, formulae: [`'Lists'!$H$2:$H$${lr.remTypes}`] });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/employees/bulk-import', requireModulePermission('employees', 'add'), async (req, res) => {
  const csvText = req.body.csv;
  const xlsxBase64 = req.body.xlsx;
  let rows;

  try {
    if (xlsxBase64) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(xlsxBase64, 'base64'));
      const worksheet = workbook.getWorksheet('Employees') || workbook.worksheets[0];
      const colCount = worksheet.columnCount;
      rows = [];
      worksheet.eachRow({ includeEmpty: false }, row => {
        const vals = row.values;
        const dense = [];
        for (let c = 1; c <= colCount; c++) {
          let value = vals[c];
          if (value instanceof Date) { dense.push(value.toISOString().split('T')[0]); continue; }
          if (value && typeof value === 'object' && value.text !== undefined) { dense.push(String(value.text)); continue; }
          dense.push(value === null || value === undefined ? '' : String(value));
        }
        rows.push(dense);
      });
    } else if (csvText && csvText.trim()) {
      rows = parseCSV(csvText);
    } else {
      res.status(400).json({ error: 'Choose a CSV or Excel (.xlsx) import file' });
      return;
    }
  } catch (err) {
    res.status(400).json({ error: `Unable to read import file: ${err.message}` });
    return;
  }

  if (rows.length < 2) {
    res.status(400).json({ error: 'The import file must contain a header and at least one data row' });
    return;
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim() !== ''));

  const required = ['first_name', 'last_name', 'remuneration_type', 'remuneration'];
  const missingHeaders = required.filter(r => !headers.includes(r));
  if (missingHeaders.length > 0) {
    res.status(400).json({ error: `Missing required columns: ${missingHeaders.join(', ')}` });
    return;
  }

  const getIndex = name => headers.indexOf(name);
  const getCell = (row, name) => {
    const idx = getIndex(name);
    return idx >= 0 ? row[idx].trim() : '';
  };

  const runAsync = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

  const getAsync = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  (async () => {
    const results = { total: dataRows.length, success: 0, errors: [], ids: [] };
    let startingMaxRow;
    try {
      startingMaxRow = await getAsync("SELECT MAX(CAST(SUBSTR(employee_id, 5) AS INTEGER)) as max_num FROM employees WHERE employee_id LIKE 'EMP-%'", []);
    } catch (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let lastEmpNumber = startingMaxRow && startingMaxRow.max_num ? startingMaxRow.max_num : 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const firstName = getCell(row, 'first_name');
      const lastName = getCell(row, 'last_name');
      const remuneration = parseFloat(getCell(row, 'remuneration'));

      if (!firstName || !lastName) {
        results.errors.push({ row: rowNum, message: 'First name and last name are required' });
        continue;
      }
      if (isNaN(remuneration) || remuneration <= 0) {
        results.errors.push({ row: rowNum, message: 'Remuneration must be a positive number' });
        continue;
      }

      try {
        const resolveName = (tableName, name) => new Promise((resolve, reject) => {
          if (!name) { resolve(null); return; }
          resolveLookupId(tableName, name, (err, id) => {
            if (err) reject(err);
            else resolve(id);
          });
        });

        const resolveLoc = (country, location, sublocationBusinessType) => new Promise((resolve, reject) => {
          resolveLocationId(null, country, location, sublocationBusinessType, (err, id) => {
            if (err) reject(err);
            else resolve(id);
          });
        });

        const department = getCell(row, 'department');
        const position = getCell(row, 'position');
        const status = getCell(row, 'status');
        const nationality = getCell(row, 'nationality');
        const remType = getCell(row, 'remuneration_type');
        const country = getCell(row, 'country');
        const location = getCell(row, 'location');
        const sublocationBusinessType = getCell(row, 'sublocation_business_type');

        const [departmentId, positionId, statusId, nationalityId, remTypeId, locationId] = await Promise.all([
          resolveName('departments', department),
          resolveName('positions', position),
          resolveName('employee_statuses', status),
          resolveName('nationalities', nationality),
          resolveName('remuneration_types', remType),
          resolveLoc(country, location, sublocationBusinessType)
        ]);

        lastEmpNumber++;
        const employeeId = 'EMP-' + String(lastEmpNumber).padStart(3, '0');

        const result = await runAsync(
          `INSERT INTO employees (employee_id, first_name, last_name, email, phone, department_id, department, position_id, position, location_id, hire_date, employee_status_id, status, nationality_id, nationality, address, emergency_contact, emergency_phone, photo_path, remuneration_type_id, remuneration_type, remuneration, working_hours_per_day, overtime_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeId, firstName, lastName,
            getCell(row, 'email') || null,
            getCell(row, 'phone') || null,
            departmentId, department || null,
            positionId, position || null,
            locationId,
            getCell(row, 'hire_date') || null,
            statusId, status || 'Active',
            nationalityId, nationality || null,
            getCell(row, 'address') || null,
            getCell(row, 'emergency_contact') || null,
            getCell(row, 'emergency_phone') || null,
            null,
            remTypeId, remType || null,
            remuneration,
            parseFloat(getCell(row, 'working_hours_per_day')) || 8,
            parseFloat(getCell(row, 'overtime_rate')) || 1
          ]
        );
        results.success++;
        results.ids.push(result.id);
      } catch (err) {
        results.errors.push({ row: rowNum, message: err.message });
      }
    }
    res.json(results);
  })().catch(err => {
    res.status(500).json({ error: err.message });
  });
});

router.get('/employees/:id/liabilities', (req, res) => {
  const empId = req.params.id;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const startDate = `${currentMonth}-01`;
  const endDate = `${currentMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const getAll = (sql, params) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );

  Promise.all([
    getAll(`SELECT e.id, e.name, e.auto_serial_number, e.serial_number, e.barcode,
            e.status, e.purchase_cost, e.price,
            bta.business_unit_code as location_name,
            slt.name as sub_location_name, bt.name as business_type_name
            FROM equipment e
            LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
            LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
            LEFT JOIN business_types bt ON bta.business_type_id = bt.id
            WHERE e.assigned_to = ? AND (e.status != 'Written Off')`, [empId]),
    getAll(`SELECT SUM(amount) as total FROM advance_payments WHERE employee_id = ? AND date >= ? AND date <= ?`, [empId, startDate, endDate]),
    getAll(`SELECT amount, date, notes FROM advance_payments WHERE employee_id = ? ORDER BY date DESC`, [empId])
  ]).then(([equipment, advMonth, advAll]) => {
    const monthAdvance = (advMonth[0] && advMonth[0].total) ? parseFloat(advMonth[0].total) : 0;
    const totalAdvance = advAll.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    res.json({ equipment, monthAdvance, totalAdvance, advanceDetails: advAll });
  }).catch(err => res.status(500).json({ error: err.message }));
});

router.post('/employees/:id/terminate-with-deductions', (req, res) => {
  const empId = req.params.id;
  const { termination_date, termination_reason, termination_notes, equipment_charges } = req.body;
  // equipment_charges: [{ equipment_id, charge_amount, equipment_name }]
  const charges = Array.isArray(equipment_charges) ? equipment_charges.filter(c => parseFloat(c.charge_amount) > 0) : [];
  const today = termination_date || new Date().toISOString().split('T')[0];

  const run = (sql, params) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
  );

  const insertCharges = async () => {
    for (const c of charges) {
      await run(
        `INSERT INTO advance_payments (employee_id, amount, date, notes) VALUES (?, ?, ?, ?)`,
        [empId, parseFloat(c.charge_amount), today, `Equipment charge: ${c.equipment_name || 'Equipment #' + c.equipment_id}`]
      );
    }
  };

  insertCharges()
    .then(() => run(
      `UPDATE employees SET status = 'Terminated', is_terminated = 1,
       termination_date = ?, termination_reason = ?, termination_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [termination_date, termination_reason, termination_notes, empId]
    ))
    .then(() => run(`SELECT room_id FROM accommodation_room_assignments WHERE employee_id = ?`, [empId]))
    .then(row => {
      if (row && row.room_id) {
        const today = termination_date || new Date().toISOString().split('T')[0];
        return run(`UPDATE accommodation_room_assignment_history SET vacated_date = ? WHERE room_id = ? AND employee_id = ? AND vacated_date IS NULL`, [today, row.room_id, empId])
          .then(() => run(`DELETE FROM accommodation_room_assignments WHERE employee_id = ?`, [empId]));
      }
      return run(`DELETE FROM accommodation_room_assignments WHERE employee_id = ?`, [empId]);
    })
    .then(() => res.json({ message: 'Employee terminated', charges_added: charges.length }))
    .catch(err => res.status(500).json({ error: err.message }));
});

router.put('/employees/:id/terminate', requireModulePermission('terminated-employees', 'edit'), (req, res) => {
  const { termination_date, termination_reason, termination_notes } = req.body;
  db.run(`UPDATE employees SET status = 'Terminated', is_terminated = 1, 
          termination_date = ?, termination_reason = ?, termination_notes = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`,
    [termination_date, termination_reason, termination_notes, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get(`SELECT room_id FROM accommodation_room_assignments WHERE employee_id = ?`, [req.params.id], (err2, assignRow) => {
        if (err2) { res.status(500).json({ error: err2.message }); return; }
        const today = termination_date || new Date().toISOString().split('T')[0];
        const vacatedHistory = assignRow ? new Promise((resolve, reject) => {
          db.run(`UPDATE accommodation_room_assignment_history SET vacated_date = ? WHERE room_id = ? AND employee_id = ? AND vacated_date IS NULL`, [today, assignRow.room_id, req.params.id], (e) => e ? reject(e) : resolve());
        }) : Promise.resolve();
        vacatedHistory.then(() => {
          db.run(`DELETE FROM accommodation_room_assignments WHERE employee_id = ?`, [req.params.id], function(err3) {
            if (err3) { res.status(500).json({ error: err3.message }); return; }
            res.json({ message: 'Termination details updated' });
          });
        }).catch(err3 => res.status(500).json({ error: err3.message }));
      });
    }
  );
});

// Employee Transfers Routes
router.get('/employee-transfers', (req, res) => {
  db.all(`SELECT et.*, et.employee_id as emp_db_id, e.first_name || ' ' || e.last_name as employee_name, e.employee_id,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name || ' - ' || fbta.business_unit_code as from_location_name,
          fc.name as from_country_name, flt.name as from_location_type_name, fslt.name as from_sub_location_name, fbt.name as from_business_type_name, fbta.business_unit_code as from_business_unit_code,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name || ' - ' || tbta.business_unit_code as to_location_name,
          tc.name as to_country_name, tlt.name as to_location_type_name, tslt.name as to_sub_location_name, tbt.name as to_business_type_name, tbta.business_unit_code as to_business_unit_code
          FROM employee_transfers et
          LEFT JOIN employees e ON et.employee_id = e.id
          LEFT JOIN business_type_assignments fbta ON et.from_location_id = fbta.id
          LEFT JOIN countries fc ON fbta.country_id = fc.id
          LEFT JOIN location_types flt ON fbta.location_id = flt.id
          LEFT JOIN sub_location_types fslt ON fbta.sub_location_id = fslt.id
          LEFT JOIN business_types fbt ON fbta.business_type_id = fbt.id
          LEFT JOIN business_type_assignments tbta ON et.to_location_id = tbta.id
          LEFT JOIN countries tc ON tbta.country_id = tc.id
          LEFT JOIN location_types tlt ON tbta.location_id = tlt.id
          LEFT JOIN sub_location_types tslt ON tbta.sub_location_id = tslt.id
          LEFT JOIN business_types tbt ON tbta.business_type_id = tbt.id
          ORDER BY et.created_at DESC`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

router.get('/employee-transfers/month', (req, res) => {
  const month = req.query.month;
  if (!month) { res.status(400).json({ error: 'month is required' }); return; }
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(new Date(month.split('-')[0], month.split('-')[1], 0).getDate()).padStart(2, '0')}`;
  db.all(`SELECT et.*, et.employee_id as emp_db_id, e.first_name || ' ' || e.last_name as employee_name, e.employee_id,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name || ' - ' || fbta.business_unit_code as from_location_name,
          fc.name as from_country_name, flt.name as from_location_type_name, fslt.name as from_sub_location_name, fbt.name as from_business_type_name, fbta.business_unit_code as from_business_unit_code,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name || ' - ' || tbta.business_unit_code as to_location_name,
          tc.name as to_country_name, tlt.name as to_location_type_name, tslt.name as to_sub_location_name, tbt.name as to_business_type_name, tbta.business_unit_code as to_business_unit_code
          FROM employee_transfers et
          LEFT JOIN employees e ON et.employee_id = e.id
          LEFT JOIN business_type_assignments fbta ON et.from_location_id = fbta.id
          LEFT JOIN countries fc ON fbta.country_id = fc.id
          LEFT JOIN location_types flt ON fbta.location_id = flt.id
          LEFT JOIN sub_location_types fslt ON fbta.sub_location_id = fslt.id
          LEFT JOIN business_types fbt ON fbta.business_type_id = fbt.id
          LEFT JOIN business_type_assignments tbta ON et.to_location_id = tbta.id
          LEFT JOIN countries tc ON tbta.country_id = tc.id
          LEFT JOIN location_types tlt ON tbta.location_id = tlt.id
          LEFT JOIN sub_location_types tslt ON tbta.sub_location_id = tslt.id
          LEFT JOIN business_types tbt ON tbta.business_type_id = tbt.id
          WHERE substr(et.transfer_date, 1, 7) = ?
          ORDER BY et.transfer_date ASC`, [month], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

router.get('/employee-transfers/next-serial', (req, res) => {
  db.get("SELECT MAX(CAST(SUBSTR(transfer_serial_number, 4) AS INTEGER)) as max_num FROM employee_transfers WHERE transfer_serial_number LIKE 'ET-%'", [], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    const nextNum = (row.max_num || 0) + 1;
    res.json({ serial: 'ET-' + String(nextNum).padStart(3, '0') });
  });
});

router.get('/employee-transfers/:id', (req, res) => {
  db.get(`SELECT et.*, et.employee_id as emp_db_id, e.first_name || ' ' || e.last_name as employee_name, e.employee_id,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name || ' - ' || fbta.business_unit_code as from_location_name,
          fc.name as from_country_name, flt.name as from_location_type_name, fslt.name as from_sub_location_name, fbt.name as from_business_type_name, fbta.business_unit_code as from_business_unit_code,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name || ' - ' || tbta.business_unit_code as to_location_name,
          tc.name as to_country_name, tlt.name as to_location_type_name, tslt.name as to_sub_location_name, tbt.name as to_business_type_name, tbta.business_unit_code as to_business_unit_code
          FROM employee_transfers et
          LEFT JOIN employees e ON et.employee_id = e.id
          LEFT JOIN business_type_assignments fbta ON et.from_location_id = fbta.id
          LEFT JOIN countries fc ON fbta.country_id = fc.id
          LEFT JOIN location_types flt ON fbta.location_id = flt.id
          LEFT JOIN sub_location_types fslt ON fbta.sub_location_id = fslt.id
          LEFT JOIN business_types fbt ON fbta.business_type_id = fbt.id
          LEFT JOIN business_type_assignments tbta ON et.to_location_id = tbta.id
          LEFT JOIN countries tc ON tbta.country_id = tc.id
          LEFT JOIN location_types tlt ON tbta.location_id = tlt.id
          LEFT JOIN sub_location_types tslt ON tbta.sub_location_id = tslt.id
          LEFT JOIN business_types tbt ON tbta.business_type_id = tbt.id
          WHERE et.id = ?`, [req.params.id], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (!row) { res.status(404).json({ error: 'Transfer not found' }); return; }
    res.json(row);
  });
});

router.post('/employee-transfers', requireModulePermission('employee-transfers', 'edit'), (req, res) => {
  const { transfer_serial_number, employee_id, from_location_id, to_location_id, transfer_date, reason, notes, created_by,
          prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration,
          prev_leave_entitlements, new_leave_entitlements } = req.body;
  db.run(`INSERT INTO employee_transfers (transfer_serial_number, employee_id, from_location_id, to_location_id, transfer_date, reason, notes, created_by,
          prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration, prev_leave_entitlements, new_leave_entitlements)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [transfer_serial_number, employee_id, from_location_id, to_location_id, transfer_date, reason, notes, created_by,
     prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration,
     prev_leave_entitlements ? JSON.stringify(prev_leave_entitlements) : null,
     new_leave_entitlements ? JSON.stringify(new_leave_entitlements) : null],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      const transferId = this.lastID;
      // Update employee location and remuneration
      db.run('UPDATE employees SET location_id = ?, remuneration_type = ?, remuneration = ? WHERE id = ?',
        [to_location_id, new_remuneration_type || null, new_remuneration || null, employee_id], (err) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        // Update employee leave entitlements if provided
        if (new_leave_entitlements && Array.isArray(new_leave_entitlements) && new_leave_entitlements.length > 0) {
          db.run('DELETE FROM employee_leave_entitlements WHERE employee_id = ?', [employee_id], function(err2) {
            if (err2) { res.status(500).json({ error: err2.message }); return; }
            const stmt = db.prepare('INSERT INTO employee_leave_entitlements (employee_id, leave_type, days_count, condition_type, months_count) VALUES (?, ?, ?, ?, ?)');
            new_leave_entitlements.forEach(ent => {
              stmt.run([employee_id, ent.leave_type, ent.days_count, ent.condition_type, ent.months_count]);
            });
            stmt.finalize((err3) => {
              if (err3) { res.status(500).json({ error: err3.message }); return; }
              res.json({ id: transferId, message: 'Employee transferred' });
            });
          });
        } else {
          res.json({ id: transferId, message: 'Employee transferred' });
        }
      });
    }
  );
});

router.put('/employee-transfers/:id', requireModulePermission('employee-transfers', 'edit'), (req, res) => {
  const { transfer_serial_number, employee_id, from_location_id, to_location_id, transfer_date, reason, notes, created_by,
          prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration,
          prev_leave_entitlements, new_leave_entitlements } = req.body;
  db.run(`UPDATE employee_transfers SET transfer_serial_number = ?, employee_id = ?, from_location_id = ?, to_location_id = ?, transfer_date = ?, reason = ?, notes = ?, created_by = ?,
          prev_remuneration_type = ?, prev_remuneration = ?, new_remuneration_type = ?, new_remuneration = ?, prev_leave_entitlements = ?, new_leave_entitlements = ?
          WHERE id = ?`,
    [transfer_serial_number, employee_id, from_location_id, to_location_id, transfer_date, reason, notes, created_by,
     prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration,
     prev_leave_entitlements ? JSON.stringify(prev_leave_entitlements) : null,
     new_leave_entitlements ? JSON.stringify(new_leave_entitlements) : null,
     req.params.id],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (this.changes === 0) { res.status(404).json({ error: 'Transfer not found' }); return; }
      // Update employee location and remuneration to the new values
      db.run('UPDATE employees SET location_id = ?, remuneration_type = ?, remuneration = ? WHERE id = ?',
        [to_location_id, new_remuneration_type || null, new_remuneration || null, employee_id], (err) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        // Update employee leave entitlements if provided
        if (new_leave_entitlements && Array.isArray(new_leave_entitlements) && new_leave_entitlements.length > 0) {
          db.run('DELETE FROM employee_leave_entitlements WHERE employee_id = ?', [employee_id], function(err2) {
            if (err2) { res.status(500).json({ error: err2.message }); return; }
            const stmt = db.prepare('INSERT INTO employee_leave_entitlements (employee_id, leave_type, days_count, condition_type, months_count) VALUES (?, ?, ?, ?, ?)');
            new_leave_entitlements.forEach(ent => {
              stmt.run([employee_id, ent.leave_type, ent.days_count, ent.condition_type, ent.months_count]);
            });
            stmt.finalize((err3) => {
              if (err3) { res.status(500).json({ error: err3.message }); return; }
              res.json({ id: req.params.id, message: 'Transfer updated' });
            });
          });
        } else {
          res.json({ id: req.params.id, message: 'Transfer updated' });
        }
      });
    }
  );
});

router.delete('/employee-transfers/:id', requireModulePermission('employee-transfers', 'delete'), (req, res) => {
  db.run('DELETE FROM employee_transfers WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (this.changes === 0) { res.status(404).json({ error: 'Transfer not found' }); return; }
    res.json({ message: 'Transfer deleted' });
  });
});

// ROLE-BASED DASHBOARD STATS
router.get('/dashboard/module-stats', async (req, res) => {
  const module = req.session.moduleName || req.query.module;
  const getOne = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
  const getAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
  try {
    if (module === 'equipment') {
      const [total, ownerBreakdown, statusBreakdown, underMaintenance, spareParts, pendingWriteOff, recentMaintenance] = await Promise.all([
        getOne(`SELECT COUNT(*) as count FROM equipment`),
        getAll(`SELECT eo.name as owner, COUNT(*) as count FROM equipment e LEFT JOIN equipment_owners eo ON e.owner_id = eo.id GROUP BY eo.name ORDER BY count DESC`),
        getAll(`SELECT status, COUNT(*) as count FROM equipment GROUP BY status ORDER BY count DESC`),
        getOne(`SELECT COUNT(DISTINCT equipment_id) as count FROM maintenance_logs WHERE LOWER(maintenance_status) != 'completed'`),
        getOne(`SELECT COUNT(*) as totalParts, COALESCE(SUM(quantity),0) as totalStock,
                  (SELECT COALESCE(SUM(t.total_cost),0) FROM spare_part_transactions t INNER JOIN spare_parts sp ON t.spare_part_id = sp.id WHERE t.transaction_type='purchase') as totalSpend,
                  (SELECT COALESCE(SUM(t.total_cost),0) FROM spare_part_transactions t INNER JOIN spare_parts sp ON t.spare_part_id = sp.id WHERE t.transaction_type='consumption') as totalConsumptionCost,
                  (SELECT COALESCE(SUM(t.quantity),0) FROM spare_part_transactions t INNER JOIN spare_parts sp ON t.spare_part_id = sp.id WHERE t.transaction_type='consumption') as totalConsumed
                FROM spare_parts`),
        getAll(`SELECT wo.write_off_date, wo.reason, wo.status,
                  e.name as equip_name, e.auto_serial_number, e.serial_number, e.barcode,
                  c.name as country_name, lt.name as location_name, slt.name as sub_location_name
                FROM equipment_write_offs wo
                LEFT JOIN equipment e ON wo.equipment_id = e.id
                LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
                LEFT JOIN countries c ON bta.country_id = c.id
                LEFT JOIN location_types lt ON bta.location_id = lt.id
                LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
                WHERE LOWER(wo.status) = 'pending'`),
        getAll(`SELECT ml.maintenance_type, ml.maintenance_status, ml.next_maintenance_date as scheduled_date,
                  e.name as equip_name, e.auto_serial_number, e.serial_number, e.barcode,
                  c.name as country_name, lt.name as location_name, slt.name as sub_location_name
                FROM maintenance_logs ml
                LEFT JOIN equipment e ON ml.equipment_id = e.id
                LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
                LEFT JOIN countries c ON bta.country_id = c.id
                LEFT JOIN location_types lt ON bta.location_id = lt.id
                LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
                WHERE LOWER(ml.maintenance_status) != 'completed'
                ORDER BY ml.next_maintenance_date ASC LIMIT 5`)
      ]);
      return res.json({ module, total: total.count, ownerBreakdown, statusBreakdown, underMaintenance: underMaintenance.count,
        spareParts: { count: spareParts.totalParts, stock: spareParts.totalStock, purchaseCost: spareParts.totalSpend, consumptionCost: spareParts.totalConsumptionCost, consumed: spareParts.totalConsumed },
        pendingWriteOff: pendingWriteOff.length, pendingWriteOffList: pendingWriteOff, recentMaintenance });
    }

    if (module === 'hr') {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const [totalEmp, activeEmp, terminatedEmp, docsExpiring, absentToday, newThisMonth, onLeaveToday, accommodationStats] = await Promise.all([
        getOne(`SELECT COUNT(*) as count FROM employees`),
        getOne(`SELECT COUNT(*) as count FROM employees WHERE is_terminated = 0 OR is_terminated IS NULL`),
        getOne(`SELECT COUNT(*) as count FROM employees WHERE is_terminated = 1`),
        getOne(`SELECT COUNT(*) as count FROM employee_documents ed LEFT JOIN document_types dt ON ed.document_type = dt.name WHERE ed.expiry_date IS NOT NULL AND date(ed.expiry_date) <= date('now', '+' || COALESCE(dt.notification_days,30) || ' days')`),
        getOne(`SELECT COUNT(*) as count FROM employee_attendance WHERE date = ? AND status = 'unpaid-leave'`, [today]),
        getOne(`SELECT COUNT(*) as count FROM employees WHERE substr(hire_date,1,7) = ?`, [currentMonth]),
        getOne(`SELECT COUNT(DISTINCT ea.employee_id) as count FROM employee_attendance ea JOIN employees e ON ea.employee_id = e.id WHERE ea.date = ? AND ea.status IN ('paid-leave','medical-leave','compassionate-leave','unpaid-leave') AND (e.is_terminated = 0 OR e.is_terminated IS NULL)`, [today]),
        getAll(`SELECT
                   (SELECT COUNT(*) FROM accommodation_rooms) as total_rooms,
                   (SELECT COUNT(*) FROM accommodation_room_assignments) as occupied_rooms,
                   (SELECT COUNT(*) FROM accommodation_rooms) - (SELECT COUNT(*) FROM accommodation_room_assignments) as empty_rooms,
                   (SELECT COALESCE(SUM(capacity),0) FROM accommodation_rooms) as total_capacity,
                   (SELECT COUNT(*) FROM employees WHERE is_terminated = 0 OR is_terminated IS NULL) - (SELECT COUNT(*) FROM accommodation_room_assignments) as unassigned_employees`)
      ]);
      const payrollSummary = await computePayrollSummary(currentMonth);
      const acc = accommodationStats[0] || {};
      const [uniformItems, uniformLowStock, uniformDistributions, uniformPurchases] = await Promise.all([
        getOne('SELECT COUNT(*) as count FROM uniform_items'),
        getOne('SELECT COUNT(*) as count FROM uniform_items WHERE current_stock <= minimum_stock'),
        getOne('SELECT COUNT(*) as count FROM uniform_distributions'),
        getOne('SELECT COUNT(*) as count FROM uniform_purchases')
      ]);
      return res.json({ module, totalEmp: totalEmp.count, activeEmp: activeEmp.count, terminatedEmp: terminatedEmp.count, docsExpiring: docsExpiring.count, absentToday: absentToday.count, newThisMonth: newThisMonth.count, onLeaveToday: onLeaveToday.count, accommodation: acc, payrollSummary,
        totalUniformItems: uniformItems.count,
        uniformLowStock: uniformLowStock.count,
        uniformDistributions: uniformDistributions.count,
        uniformPurchases: uniformPurchases.count
      });
    }

    // Default for other modules
    res.json({ module });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PAYROLL SUMMARY for dashboard
async function computePayrollSummary(month) {
  const getOne = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
  const getAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

  const [year, mon] = month.split('-');
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [employees, records, advances, transfers] = await Promise.all([
    getAll(`SELECT e.id, e.employee_id, e.first_name, e.last_name, e.remuneration_type, e.remuneration,
            e.hire_date, e.is_terminated, e.termination_date, e.working_hours_per_day, e.overtime_rate
            FROM employees e
            WHERE (e.hire_date IS NULL OR e.hire_date <= ?)
              AND (e.is_terminated = 0 OR e.is_terminated IS NULL OR e.termination_date >= ?)
            ORDER BY e.first_name, e.last_name`, [endDate, startDate]),
    getAll(`SELECT * FROM employee_attendance WHERE date >= ? AND date <= ?`, [startDate, endDate]),
    getAll(`SELECT * FROM advance_payments WHERE substr(date, 1, 7) = ?`, [month]),
    getAll(`SELECT * FROM employee_transfers WHERE substr(transfer_date, 1, 7) = ?`, [month])
  ]);

  const attendanceMap = {};
  records.forEach(r => {
    if (!attendanceMap[r.employee_id]) attendanceMap[r.employee_id] = {};
    attendanceMap[r.employee_id][r.date] = r;
  });

  const advanceMap = {};
  (advances || []).forEach(a => {
    advanceMap[a.employee_id] = (advanceMap[a.employee_id] || 0) + parseFloat(a.amount);
  });

  const transferMap = {};
  (transfers || []).forEach(t => {
    const empDbId = t.employee_id;
    if (!transferMap[empDbId]) transferMap[empDbId] = [];
    transferMap[empDbId].push(t);
  });

  let totGross = 0, totAdvance = 0, totNet = 0, totPresent = 0, totUnpaid = 0, totOvertime = 0;

  employees.forEach(emp => {
    const empAtt = attendanceMap[emp.id] || {};
    let present = 0, unpaidLeave = 0, paidLeave = 0, medicalLeave = 0, dayOff = 0, compassionateLeave = 0, noRecord = 0;
    let totalPresentHours = 0, totalOvertimeHours = 0, totalRegularHours = 0;
    const workingHoursPerDay = emp.working_hours_per_day || 8;
    const overtimeMultiplier = emp.overtime_rate || 1;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if (dateStr > todayStr) continue;
      const record = empAtt[dateStr];
      if (!record) { noRecord++; continue; }
      switch (record.status) {
        case 'present':
          present++;
          const hrs = parseFloat(record.hours) || workingHoursPerDay;
          totalPresentHours += hrs;
          if (hrs > workingHoursPerDay) {
            totalRegularHours += workingHoursPerDay;
            totalOvertimeHours += (hrs - workingHoursPerDay);
          } else {
            totalRegularHours += hrs;
          }
          break;
        case 'unpaid-leave': unpaidLeave++; break;
        case 'medical-leave': medicalLeave++; break;
        case 'paid-leave': paidLeave++; break;
        case 'day-off': dayOff++; break;
        case 'compassionate-leave': compassionateLeave++; break;
      }
    }

    const totalDays = present + unpaidLeave + medicalLeave + paidLeave + dayOff + compassionateLeave + noRecord;
    const effectivePresentDays = workingHoursPerDay > 0 ? totalRegularHours / workingHoursPerDay : present;
    const paidDays = effectivePresentDays + paidLeave + medicalLeave + compassionateLeave + dayOff;
    const remAmount = parseFloat(emp.remuneration) || 0;
    const remType = (emp.remuneration_type || '').toLowerCase();
    const empTransfers = transferMap[emp.id] || [];

    let grossAmount = 0;
    if (empTransfers.length > 0) {
      const dedupMap = {};
      empTransfers.slice().sort((a, b) => a.transfer_date.localeCompare(b.transfer_date)).forEach(t => {
        dedupMap[t.transfer_date] = t;
      });
      const dedupedTransfers = Object.values(dedupMap).sort((a, b) => a.transfer_date.localeCompare(b.transfer_date));
      let currentFrom = startDate;
      let currentRemType = dedupedTransfers[0].prev_remuneration_type || emp.remuneration_type || '';
      let currentRemAmount = parseFloat(dedupedTransfers[0].prev_remuneration) || 0;
      const periods = [];
      dedupedTransfers.forEach(t => {
        const transferDate = t.transfer_date;
        const dayBefore = new Date(new Date(transferDate).getTime() - 86400000).toISOString().split('T')[0];
        const periodEnd = dayBefore < currentFrom ? currentFrom : dayBefore;
        if (currentFrom <= periodEnd) {
          periods.push({ fromDate: currentFrom, toDate: periodEnd, remType: currentRemType, remAmount: currentRemAmount });
        }
        currentFrom = transferDate;
        currentRemType = t.new_remuneration_type || emp.remuneration_type || '';
        currentRemAmount = parseFloat(t.new_remuneration) || remAmount;
      });
      if (currentFrom <= endDate) {
        periods.push({ fromDate: currentFrom, toDate: endDate, remType: currentRemType, remAmount: currentRemAmount });
      }
      const paidStatuses = ['present', 'paid-leave', 'medical-leave', 'compassionate-leave', 'day-off'];
      periods.forEach(p => {
        const rType = (p.remType || '').toLowerCase();
        const pAmount = p.remAmount || 0;
        let periodPaidDays = 0;
        for (let dNum = 1; dNum <= daysInMonth; dNum++) {
          const dateStr = `${month}-${String(dNum).padStart(2, '0')}`;
          if (dateStr >= p.fromDate && dateStr <= p.toDate) {
            const record = empAtt[dateStr];
            if (record && paidStatuses.includes(record.status)) {
              if (record.status === 'present') {
                const hrs = parseFloat(record.hours) || workingHoursPerDay;
                periodPaidDays += workingHoursPerDay > 0 ? Math.min(hrs, workingHoursPerDay) / workingHoursPerDay : 1;
              } else {
                periodPaidDays++;
              }
            }
          }
        }
        let dailyR = 0;
        if (rType === 'daily' || rType === 'daily wage') {
          dailyR = pAmount;
        } else if (rType === 'hourly') {
          dailyR = pAmount * workingHoursPerDay;
        } else {
          dailyR = daysInMonth > 0 ? pAmount / daysInMonth : 0;
        }
        grossAmount += dailyR * periodPaidDays;
      });
    } else {
      if (remType === 'monthly' || remType === 'salary') {
        grossAmount = totalDays > 0 ? (remAmount / daysInMonth) * paidDays : 0;
      } else if (remType === 'daily' || remType === 'daily wage') {
        grossAmount = remAmount * paidDays;
      } else if (remType === 'hourly') {
        grossAmount = remAmount * totalPresentHours;
      } else {
        grossAmount = totalDays > 0 ? (remAmount / daysInMonth) * paidDays : 0;
      }
    }

    let hourlyRate = 0;
    if (remType === 'hourly') {
      hourlyRate = remAmount;
    } else if (remType === 'daily' || remType === 'daily wage') {
      hourlyRate = remAmount / workingHoursPerDay;
    } else {
      hourlyRate = daysInMonth > 0 ? (remAmount / daysInMonth) / workingHoursPerDay : 0;
    }
    const overtimeAmount = totalOvertimeHours * hourlyRate * overtimeMultiplier;
    grossAmount += overtimeAmount;

    const empAdvance = advanceMap[emp.id] || 0;
    const netAmount = grossAmount - empAdvance;

    totGross += grossAmount;
    totAdvance += empAdvance;
    totNet += netAmount;
    totPresent += present;
    totUnpaid += unpaidLeave;
    totOvertime += overtimeAmount;
  });

  return {
    month,
    employeeCount: employees.length,
    totalGross: totGross,
    totalAdvance: totAdvance,
    totalNet: totNet,
    totalPresent: totPresent,
    totalUnpaid: totUnpaid,
    totalOvertime: totOvertime
  };
}

// DASHBOARD STATS
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = {};

    const getOne = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
    const getAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const equipmentRow = await getOne('SELECT COUNT(*) as count FROM equipment');
    stats.totalEquipment = equipmentRow.count;
    stats.equipmentByStatus = await getAll(`SELECT COALESCE(es.name, 'Unknown') as status, COUNT(*) as count FROM (
        SELECT e.status_id,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM maintenance_logs ml WHERE ml.equipment_id = e.id AND LOWER(ml.maintenance_status) != 'completed') THEN NULL
                 ELSE e.status_id
               END as resolved_status_id
        FROM equipment e
      ) LEFT JOIN equipment_statuses es ON resolved_status_id = es.id
      GROUP BY COALESCE(es.name, 'Unknown') ORDER BY count DESC`);

    stats.totalKitchenItems = (await getOne('SELECT COUNT(*) as count FROM kitchen_items')).count;
    stats.totalUniformItems = (await getOne('SELECT COUNT(*) as count FROM uniform_items')).count;
    stats.uniformLowStock = (await getOne('SELECT COUNT(*) as count FROM uniform_items WHERE current_stock <= minimum_stock')).count;
    stats.uniformDistributions = (await getOne('SELECT COUNT(*) as count FROM uniform_distributions')).count;
    stats.uniformPurchases = (await getOne('SELECT COUNT(*) as count FROM uniform_purchases')).count;
    stats.totalLocations = (await getOne('SELECT COUNT(*) as count FROM locations')).count;
    stats.totalEmployees = (await getOne('SELECT COUNT(*) as count FROM employees')).count;
    stats.employeesByStatus = await getAll(`SELECT COALESCE(es.name, e.status) as status, COUNT(*) as count FROM employees e LEFT JOIN employee_statuses es ON e.employee_status_id = es.id GROUP BY COALESCE(es.name, e.status) ORDER BY count DESC`);

    // Payment stats for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const paidStatuses = ['present', 'paid-leave', 'medical-leave', 'compassionate-leave', 'day-off'];

    const allEmployees = await getAll(`SELECT id, remuneration_type, remuneration FROM employees`);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${String(daysInMonth).padStart(2, '0')}`;
    const [attRows, advRows, transferRows] = await Promise.all([
      getAll(`SELECT employee_id, date, status FROM employee_attendance WHERE date >= ? AND date <= ?`, [startDate, endDate]),
      getAll(`SELECT employee_id, amount FROM advance_payments WHERE date >= ? AND date <= ?`, [startDate, endDate]),
      getAll(`SELECT employee_id, transfer_date, prev_remuneration_type, prev_remuneration, new_remuneration_type, new_remuneration FROM employee_transfers WHERE substr(transfer_date, 1, 7) = ? ORDER BY transfer_date ASC`, [currentMonth])
    ]);

    const attendanceMap = {};
    attRows.forEach(r => {
      if (!attendanceMap[r.employee_id]) attendanceMap[r.employee_id] = [];
      attendanceMap[r.employee_id].push(r);
    });
    const advanceMap = {};
    advRows.forEach(r => {
      advanceMap[r.employee_id] = (advanceMap[r.employee_id] || 0) + parseFloat(r.amount || 0);
    });
    const transferMap = {};
    transferRows.forEach(r => {
      if (!transferMap[r.employee_id]) transferMap[r.employee_id] = [];
      transferMap[r.employee_id].push(r);
    });

    let totalGross = 0, totalAdvance = 0, totalNet = 0, employeesWithPay = 0;
    allEmployees.forEach(emp => {
      const empAtt = attendanceMap[emp.id] || [];
      const empTransfers = transferMap[emp.id] || [];
      const remAmount = parseFloat(emp.remuneration) || 0;
      let gross = 0;

      if (empTransfers.length > 0) {
        const dedupMap = {};
        empTransfers.forEach(t => { dedupMap[t.transfer_date] = t; });
        const deduped = Object.values(dedupMap).sort((a, b) => a.transfer_date.localeCompare(b.transfer_date));
        let currentFrom = startDate;
        let currentRemType = empTransfers[0].prev_remuneration_type || emp.remuneration_type || '';
        let currentRemAmount = parseFloat(empTransfers[0].prev_remuneration) || 0;
        const periods = [];
        deduped.forEach(t => {
          const transferDate = t.transfer_date;
          const dayBefore = new Date(new Date(transferDate).getTime() - 86400000).toISOString().split('T')[0];
          const periodEnd = dayBefore < currentFrom ? currentFrom : dayBefore;
          if (currentFrom <= periodEnd) {
            periods.push({ fromDate: currentFrom, toDate: periodEnd, remType: currentRemType, remAmount: currentRemAmount });
          }
          currentFrom = transferDate;
          currentRemType = t.new_remuneration_type || emp.remuneration_type || '';
          currentRemAmount = parseFloat(t.new_remuneration) || remAmount;
        });
        if (currentFrom <= endDate) {
          periods.push({ fromDate: currentFrom, toDate: endDate, remType: currentRemType, remAmount: currentRemAmount });
        }
        periods.forEach(p => {
          const pType = (p.remType || '').toLowerCase();
          const pAmount = p.remAmount || 0;
          const periodPaidDays = empAtt.filter(r => r.date >= p.fromDate && r.date <= p.toDate && paidStatuses.includes(r.status)).length;
          if (pType === 'daily' || pType === 'daily wage') {
            gross += pAmount * periodPaidDays;
          } else if (pType === 'hourly') {
            gross += pAmount * 8 * periodPaidDays;
          } else {
            gross += daysInMonth > 0 ? (pAmount / daysInMonth) * periodPaidDays : 0;
          }
        });
      } else {
        const paidDays = empAtt.filter(r => paidStatuses.includes(r.status)).length;
        const remType = (emp.remuneration_type || '').toLowerCase();
        if (remType === 'daily' || remType === 'daily wage') {
          gross = remAmount * paidDays;
        } else if (remType === 'hourly') {
          gross = remAmount * 8 * paidDays;
        } else {
          gross = daysInMonth > 0 ? (remAmount / daysInMonth) * paidDays : 0;
        }
      }

      const advance = advanceMap[emp.id] || 0;
      const net = gross - advance;
      if (gross > 0 || advance > 0) employeesWithPay++;
      totalGross += gross;
      totalAdvance += advance;
      totalNet += net;
    });

    stats.paymentStats = {
      month: currentMonth,
      employees: employeesWithPay,
      totalEmployees: allEmployees.length,
      gross: totalGross,
      overtime: 0,
      advance: totalAdvance,
      net: totalNet
    };

    // Document expiry stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const docRows = await getAll(`SELECT ed.document_type, dt.notification_days, ed.expiry_date
            FROM employee_documents ed
            LEFT JOIN document_types dt ON ed.document_type = dt.name
            WHERE ed.expiry_date IS NOT NULL AND ed.expiry_date != ''`);
    const expiring = {};
    let totalExpiring = 0;
    docRows.forEach(row => {
      const expiry = new Date(row.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      const notifDays = row.notification_days || 30;
      if (diffDays <= notifDays) {
        const type = row.document_type || 'Unknown';
        expiring[type] = (expiring[type] || 0) + 1;
        totalExpiring++;
      }
    });
    stats.totalDocsExpiring = totalExpiring;
    stats.docsExpiringByType = Object.entries(expiring).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HR Settings - Positions
router.get('/positions', (req, res) => {
  db.all('SELECT * FROM positions ORDER BY name', [], (err, positions) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    db.all('SELECT pd.position_id, pd.department_id, d.name as department_name FROM position_departments pd JOIN departments d ON pd.department_id = d.id', [], (err2, links) => {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      const deptMap = {};
      links.forEach(l => {
        if (!deptMap[l.position_id]) deptMap[l.position_id] = [];
        deptMap[l.position_id].push({ id: l.department_id, name: l.department_name });
      });
      positions.forEach(p => { p.departments = deptMap[p.id] || []; });
      res.json(positions);
    });
  });
});
router.post('/positions', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO positions (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/positions/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE positions SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Position updated' });
  });
});
router.delete('/positions/:id', (req, res) => {
  db.run('DELETE FROM positions WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Position deleted' });
  });
});

// HR Settings - Assign departments to position (many-to-many)
router.put('/positions/:id/departments', (req, res) => {
  const positionId = req.params.id;
  const { department_ids } = req.body;
  const deptIds = Array.isArray(department_ids) ? department_ids : [];

  db.run('DELETE FROM position_departments WHERE position_id = ?', [positionId], (err) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (deptIds.length === 0) { res.json({ message: 'Departments updated' }); return; }
    const placeholders = deptIds.map(() => '(?, ?)').join(', ');
    const values = deptIds.flatMap(did => [positionId, did]);
    db.run(`INSERT INTO position_departments (position_id, department_id) VALUES ${placeholders}`, values, function(e) {
      if (e) { res.status(500).json({ error: e.message }); return; }
      res.json({ message: 'Departments assigned to position' });
    });
  });
});

// HR Settings - Departments
router.get('/departments', (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/departments', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO departments (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/departments/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE departments SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Department updated' });
  });
});
router.delete('/departments/:id', (req, res) => {
  db.run('DELETE FROM departments WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Department deleted' });
  });
});

// HR Settings - Employee Statuses
router.get('/employee-statuses', (req, res) => {
  db.all('SELECT * FROM employee_statuses ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/employee-statuses', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO employee_statuses (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/employee-statuses/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE employee_statuses SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    db.run('UPDATE employees SET status = ? WHERE employee_status_id = ?', [name, req.params.id], function(err2) {
      if (err2) { console.error('Error updating employee status text:', err2); }
      res.json({ message: 'Employee status updated' });
    });
  });
});
router.delete('/employee-statuses/:id', (req, res) => {
  db.run('DELETE FROM employee_statuses WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Employee status deleted' });
  });
});

// HR Settings - Nationalities
router.get('/nationalities', (req, res) => {
  db.all('SELECT * FROM nationalities ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/nationalities', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO nationalities (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/nationalities/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE nationalities SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Nationality updated' });
  });
});
router.delete('/nationalities/:id', (req, res) => {
  db.run('DELETE FROM nationalities WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Nationality deleted' });
  });
});

// Employee Leave Entitlements
router.get('/employee-leave-entitlements/:employeeId', (req, res) => {
  db.all('SELECT * FROM employee_leave_entitlements WHERE employee_id = ? ORDER BY id', [req.params.employeeId], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

// Employee Leave Balance (accumulated earned vs taken)
router.get('/employee-leave-balance/:employeeId', (req, res) => {
  const empId = req.params.employeeId;
  db.get('SELECT hire_date FROM employees WHERE id = ?', [empId], (err0, emp) => {
    if (err0) { res.status(500).json({ error: err0.message }); return; }
    const hireDate = emp && emp.hire_date ? emp.hire_date : null;

    db.all('SELECT * FROM employee_leave_entitlements WHERE employee_id = ? ORDER BY id', [empId], (err, entitlements) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      // Fetch every leave day (date + status) for this employee, ascending
      db.all(`SELECT date, status FROM employee_attendance WHERE employee_id = ? AND status IN ('medical-leave','paid-leave','compassionate-leave','unpaid-leave','day-off') ORDER BY date ASC`, [empId], (err2, rows) => {
        if (err2) { res.status(500).json({ error: err2.message }); return; }

        function mapLeaveTypeToStatus(leaveType) {
          const lt = (leaveType || '').toLowerCase();
          if (lt.includes('medical')) return 'medical-leave';
          if (lt.includes('paid')) return 'paid-leave';
          if (lt.includes('compassionate')) return 'compassionate-leave';
          if (lt.includes('unpaid')) return 'unpaid-leave';
          if (lt.includes('day off') || lt.includes('day-off') || lt.includes('dayoff')) return 'day-off';
          return lt + '-leave';
        }

        function daysBetween(d1, d2) {
          return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
        }

        // Cycle length in days: "X days after Y months" -> cycle = Y months
        function computeCycleDays(hire, months, period) {
          const start = new Date(hire + 'T00:00:00');
          const cycleEnd = new Date(start);
          if (period === 'weeks') cycleEnd.setDate(cycleEnd.getDate() + (months * 7));
          else if (period === 'years') cycleEnd.setFullYear(cycleEnd.getFullYear() + months);
          else cycleEnd.setMonth(cycleEnd.getMonth() + months);
          return daysBetween(start, cycleEnd);
        }

        // Proportionate earning over an elapsed (paid) window
        function earnedInWindow(windowStart, windowEnd, entitled, cycleDays, unpaidDays) {
          if (cycleDays <= 0 || entitled <= 0) return 0;
          const start = new Date(windowStart + 'T00:00:00');
          const end = new Date(windowEnd + 'T00:00:00');
          const windowDays = Math.max(0, daysBetween(start, end) - (unpaidDays || 0));
          return Math.floor((windowDays / cycleDays) * entitled);
        }

        // Returns the ISO date string of the start of the entitlement cycle (aligned to
        // hireDate) that contains `date`. Used for "expires, does not carry forward" types.
        function getCycleStart(hire, cycleDays, date) {
          if (!hire || cycleDays <= 0) return hire;
          const hireD = new Date(hire + 'T00:00:00');
          const d = new Date(date + 'T00:00:00');
          const elapsedDays = daysBetween(hireD, d);
          const cycleIndex = Math.max(0, Math.floor(elapsedDays / cycleDays));
          const cycleStart = new Date(hireD);
          cycleStart.setDate(cycleStart.getDate() + cycleIndex * cycleDays);
          return cycleStart.getFullYear() + '-' + String(cycleStart.getMonth() + 1).padStart(2, '0') + '-' + String(cycleStart.getDate()).padStart(2, '0');
        }

        // Group consecutive same-status dates into leave periods
        function groupPeriods(statusKey) {
          const statusRows = rows.filter(r => r.status === statusKey);
          const periods = [];
          let current = null;
          statusRows.forEach(r => {
            if (current) {
              const d = new Date(current.to + 'T00:00:00');
              d.setDate(d.getDate() + 1);
              const expectedNext = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              if (r.date === expectedNext) {
                current.to = r.date;
                current.days++;
                return;
              }
            }
            if (current) periods.push(current);
            current = { from: r.date, to: r.date, days: 1 };
          });
          if (current) periods.push(current);
          return periods;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        const balance = entitlements.map(ent => {
          const statusKey = mapLeaveTypeToStatus(ent.leave_type);
          const entitled = ent.days_count || 0;
          const months = ent.months_count || 0;
          const period = ent.period_type || 'months';
          const hasCalc = hireDate && entitled > 0 && months > 0;
          const cycleDays = hasCalc ? computeCycleDays(hireDate, months, period) : 0;
          const periods = groupPeriods(statusKey);
          const expireAtCycleEnd = statusKey === 'medical-leave';
          let taken;
          if (expireAtCycleEnd && hasCalc) {
              const currentCycleStart = getCycleStart(hireDate, cycleDays, todayStr);
              taken = periods.filter(p => p.from >= currentCycleStart).reduce((sum, p) => sum + p.days, 0);
          } else {
              taken = periods.reduce((sum, p) => sum + p.days, 0);
          }

          let remaining = 0;
          let grossEarned = 0;
          if (hasCalc) {
            if (expireAtCycleEnd) {
              // Use-it-or-lose-it: full entitlement granted at cycle start, not pro-rated
              const currentCycleStart = getCycleStart(hireDate, cycleDays, todayStr);
              const takenInCurrentCycle = periods
                .filter(p => p.from >= currentCycleStart)
                .reduce((sum, p) => sum + p.days, 0);
              grossEarned = entitled;
              remaining = entitled - takenInCurrentCycle;
            } else {
              let windowStart = hireDate;
              let runningCarryForward = 0;
              periods.forEach(p => {
                const unpaidInWindow = rows.filter(r =>
                  r.status === 'unpaid-leave' && r.date > windowStart && r.date < p.from
                ).length;
                const earned = earnedInWindow(windowStart, p.from, entitled, cycleDays, unpaidInWindow);
                grossEarned += earned;
                const accumulated = earned + runningCarryForward;
                runningCarryForward = accumulated - p.days;
                windowStart = p.to;
              });
              // Earn from the last return date (or hire date) up to today
              const unpaidToToday = rows.filter(r =>
                r.status === 'unpaid-leave' && r.date > windowStart && r.date <= todayStr
              ).length;
              const finalEarned = earnedInWindow(windowStart, todayStr, entitled, cycleDays, unpaidToToday);
              grossEarned += finalEarned;
              remaining = finalEarned + runningCarryForward;
            }
          }

          return {
            leave_type: ent.leave_type,
            days_count: entitled,
            months_count: months,
            period_type: ent.period_type || 'months',
            condition_type: ent.condition_type || 'after',
            taken,
            earned: grossEarned,
            remaining
          };
        });
        res.json(balance);
      });
    });
  });
});

router.post('/employee-leave-entitlements', (req, res) => {
  const { employee_id, entitlements } = req.body;
  // Delete existing entitlements for this employee and re-insert
  db.run('DELETE FROM employee_leave_entitlements WHERE employee_id = ?', [employee_id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (!entitlements || entitlements.length === 0) {
      return res.json({ message: 'Leave entitlements updated' });
    }
    const stmt = db.prepare('INSERT INTO employee_leave_entitlements (employee_id, leave_type, days_count, condition_type, months_count, period_type) VALUES (?, ?, ?, ?, ?, ?)');
    entitlements.forEach(ent => {
      stmt.run([employee_id, ent.leave_type, ent.days_count, ent.condition_type, ent.months_count, ent.period_type || 'months']);
    });
    stmt.finalize((err) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ message: 'Leave entitlements updated' });
    });
  });
});

// HR Settings - Remuneration Types
router.get('/remuneration-types', (req, res) => {
  db.all('SELECT * FROM remuneration_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/remuneration-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO remuneration_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/remuneration-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE remuneration_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Remuneration type updated' });
  });
});
router.delete('/remuneration-types/:id', (req, res) => {
  db.run('DELETE FROM remuneration_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Remuneration type deleted' });
  });
});

// HR Settings - Leave Types
router.get('/leave-types', (req, res) => {
  db.all('SELECT * FROM leave_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/leave-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO leave_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/leave-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE leave_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Leave type updated' });
  });
});
router.delete('/leave-types/:id', (req, res) => {
  db.run('DELETE FROM leave_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Leave type deleted' });
  });
});

// HR Settings - Overtime Types
router.get('/overtime-types', (req, res) => {
  db.all('SELECT * FROM overtime_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/overtime-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO overtime_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/overtime-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE overtime_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Overtime type updated' });
  });
});
router.delete('/overtime-types/:id', (req, res) => {
  db.run('DELETE FROM overtime_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Overtime type deleted' });
  });
});

// Employee Documents - Expiry Warnings
router.get('/employee-documents/expiry-warnings', (req, res) => {
  db.all(`SELECT ed.*, e.first_name, e.last_name, e.employee_id as emp_id, dt.notification_days
          FROM employee_documents ed
          LEFT JOIN employees e ON ed.employee_id = e.id
          LEFT JOIN document_types dt ON ed.document_type = dt.name
          WHERE ed.expiry_date IS NOT NULL AND ed.expiry_date != ''
          ORDER BY ed.expiry_date ASC`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warnings = rows.filter(row => {
      const expiry = new Date(row.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      const notifDays = row.notification_days || 30;
      return diffDays <= notifDays;
    });
    res.json(warnings);
  });
});

// Employee Documents
router.get('/employee-documents', (req, res) => {
  db.all(`SELECT ed.*, e.first_name, e.last_name, e.employee_id as emp_id, e.photo_path as employee_photo
          FROM employee_documents ed
          LEFT JOIN employees e ON ed.employee_id = e.id
          ORDER BY ed.created_at DESC`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

router.post('/employee-documents', upload.array('documents', 20), (req, res) => {
  const { employee_id, document_type, issued_date, expiry_date, document_number } = req.body;
  const newPaths = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
  const document_path = newPaths.length ? newPaths.join(',') : null;
  db.run(`INSERT INTO employee_documents (employee_id, document_type, document_number, issued_date, expiry_date, document_path) VALUES (?, ?, ?, ?, ?, ?)`,
    [employee_id, document_type, document_number || null, issued_date, expiry_date, document_path],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ id: this.lastID });
    }
  );
});

router.put('/employee-documents/:id', upload.array('documents', 20), (req, res) => {
  const { employee_id, document_type, issued_date, expiry_date, document_number } = req.body;
  const newPaths = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
  let existingPaths = req.body.existing_documents ? (Array.isArray(req.body.existing_documents) ? req.body.existing_documents : [req.body.existing_documents]) : [];
  existingPaths = existingPaths.filter(p => p);
  const allPaths = [...existingPaths, ...newPaths];
  const document_path = allPaths.length ? allPaths.join(',') : null;
  db.run(`UPDATE employee_documents SET employee_id = ?, document_type = ?, document_number = ?, issued_date = ?, expiry_date = ?, document_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [employee_id, document_type, document_number || null, issued_date, expiry_date, document_path, req.params.id],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ message: 'Employee document updated' });
    }
  );
});

router.delete('/employee-documents/:id', (req, res) => {
  db.run('DELETE FROM employee_documents WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Employee document deleted' });
  });
});

// HR Settings - Document Types
router.get('/document-types', (req, res) => {
  db.all('SELECT * FROM document_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/document-types', (req, res) => {
  const { name, description, notification_days } = req.body;
  db.run('INSERT INTO document_types (name, description, notification_days) VALUES (?, ?, ?)', [name, description, notification_days || 30], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description, notification_days });
  });
});
router.put('/document-types/:id', (req, res) => {
  const { name, description, notification_days } = req.body;
  db.run('UPDATE document_types SET name = ?, description = ?, notification_days = ? WHERE id = ?', [name, description, notification_days || 30, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Document type updated' });
  });
});
router.delete('/document-types/:id', (req, res) => {
  db.run('DELETE FROM document_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Document type deleted' });
  });
});

// HR Settings - Uniform Types
router.get('/uniform-types', (req, res) => {
  db.all('SELECT * FROM uniform_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/uniform-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO uniform_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/uniform-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE uniform_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Uniform type updated' });
  });
});
router.delete('/uniform-types/:id', (req, res) => {
  db.run('DELETE FROM uniform_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Uniform type deleted' });
  });
});

// HR Settings - Accommodation Types
router.get('/accommodation-types', (req, res) => {
  db.all('SELECT * FROM accommodation_types ORDER BY name', [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/accommodation-types', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO accommodation_types (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});
router.put('/accommodation-types/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE accommodation_types SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation type updated' });
  });
});
router.delete('/accommodation-types/:id', (req, res) => {
  db.run('DELETE FROM accommodation_types WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation type deleted' });
  });
});

// HR Settings - Accommodation Locations
router.get('/accommodation-locations', (req, res) => {
  db.all(`SELECT al.*, c.name as country_name, lt.name as location_name FROM accommodation_locations al LEFT JOIN countries c ON al.country_id = c.id LEFT JOIN location_types lt ON al.location_id = lt.id ORDER BY al.name`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/accommodation-locations', (req, res) => {
  const { name, address, description, country_id, location_id } = req.body;
  db.run('INSERT INTO accommodation_locations (name, address, description, country_id, location_id) VALUES (?, ?, ?, ?, ?)', [name, address, description, country_id || null, location_id || null], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, address, description, country_id, location_id });
  });
});
router.put('/accommodation-locations/:id', (req, res) => {
  const { name, address, description, country_id, location_id } = req.body;
  db.run('UPDATE accommodation_locations SET name = ?, address = ?, description = ?, country_id = ?, location_id = ? WHERE id = ?', [name, address, description, country_id || null, location_id || null, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation location updated' });
  });
});
router.delete('/accommodation-locations/:id', (req, res) => {
  db.run('DELETE FROM accommodation_locations WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation location deleted' });
  });
});

// HR Settings - Accommodation Blocks
router.get('/accommodation-blocks', (req, res) => {
  db.all(`SELECT ab.*, al.name as location_name FROM accommodation_blocks ab LEFT JOIN accommodation_locations al ON ab.location_id = al.id ORDER BY ab.name`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/accommodation-blocks', (req, res) => {
  const { name, location_id, capacity, description } = req.body;
  db.run('INSERT INTO accommodation_blocks (name, location_id, capacity, description) VALUES (?, ?, ?, ?)', [name, location_id || null, capacity || 0, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, location_id, capacity, description });
  });
});
router.put('/accommodation-blocks/:id', (req, res) => {
  const { name, location_id, capacity, description } = req.body;
  db.run('UPDATE accommodation_blocks SET name = ?, location_id = ?, capacity = ?, description = ? WHERE id = ?', [name, location_id || null, capacity || 0, description, req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation block updated' });
  });
});
router.delete('/accommodation-blocks/:id', (req, res) => {
  db.run('DELETE FROM accommodation_blocks WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation block deleted' });
  });
});

// HR Settings - Accommodation Rooms
router.get('/accommodation-rooms', (req, res) => {
  db.all(`SELECT ar.*, al.name as location_name FROM accommodation_rooms ar LEFT JOIN accommodation_locations al ON ar.accommodation_location_id = al.id ORDER BY ar.name`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/accommodation-rooms', (req, res) => {
  const { name, accommodation_location_id, capacity, description } = req.body;
  db.get('SELECT id FROM accommodation_rooms WHERE name = ? AND accommodation_location_id IS ? AND id != ?', [name, accommodation_location_id || null, 0], (err, existing) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (existing) { res.status(409).json({ error: 'A room with this name already exists for this accommodation location' }); return; }
    db.run('INSERT INTO accommodation_rooms (name, accommodation_location_id, capacity, description) VALUES (?, ?, ?, ?)', [name, accommodation_location_id || null, capacity || 0, description], function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ id: this.lastID, name, accommodation_location_id, capacity, description });
    });
  });
});
router.put('/accommodation-rooms/:id', (req, res) => {
  const { name, accommodation_location_id, capacity, description } = req.body;
  db.get('SELECT id FROM accommodation_rooms WHERE name = ? AND accommodation_location_id IS ? AND id != ?', [name, accommodation_location_id || null, req.params.id], (err, existing) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (existing) { res.status(409).json({ error: 'A room with this name already exists for this accommodation location' }); return; }
    db.run('UPDATE accommodation_rooms SET name = ?, accommodation_location_id = ?, capacity = ?, description = ? WHERE id = ?', [name, accommodation_location_id || null, capacity || 0, description, req.params.id], function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json({ message: 'Accommodation room updated' });
    });
  });
});
router.delete('/accommodation-rooms/:id', (req, res) => {
  db.run('DELETE FROM accommodation_rooms WHERE id = ?', [req.params.id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Accommodation room deleted' });
  });
});

// HR Settings - Accommodation Room Assignments
router.get('/accommodation-room-assignments', (req, res) => {
  db.all(`SELECT e.id as emp_pk_id, e.first_name, e.last_name, e.employee_id as emp_code, e.photo_path,
                 ara.id as assignment_id, ara.room_id, ara.assigned_date, ara.notes,
                 r.name as room_name, al.name as accommodation_name,
                 al_c.name as acc_country, al_l.name as acc_location,
                 c.name as emp_country, lt.name as emp_location, slt.name as emp_sub_location, bt.name as emp_business_type, bta.business_unit_code as emp_unit_code
          FROM employees e
          LEFT JOIN accommodation_room_assignments ara ON ara.employee_id = e.id
          LEFT JOIN accommodation_rooms r ON ara.room_id = r.id
          LEFT JOIN accommodation_locations al ON r.accommodation_location_id = al.id
          LEFT JOIN countries al_c ON al.country_id = al_c.id
          LEFT JOIN location_types al_l ON al.location_id = al_l.id
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          WHERE e.is_terminated = 0 OR e.is_terminated IS NULL
          ORDER BY e.first_name, e.last_name`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});
router.post('/accommodation-room-assignments', (req, res) => {
  const { employee_id, room_id, assigned_date, notes } = req.body;
  db.get('SELECT id FROM accommodation_room_assignments WHERE employee_id = ?', [employee_id], (err, existing) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (existing) { res.status(409).json({ error: 'This employee is already assigned to a room' }); return; }
    db.get('SELECT r.capacity, COUNT(ara.id) as assigned_count FROM accommodation_rooms r LEFT JOIN accommodation_room_assignments ara ON ara.room_id = r.id WHERE r.id = ? GROUP BY r.id', [room_id], (err, room) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (room && room.assigned_count >= room.capacity) { res.status(409).json({ error: 'Room is at full capacity' }); return; }
      db.run('INSERT INTO accommodation_room_assignments (employee_id, room_id, assigned_date, notes) VALUES (?, ?, ?, ?)', [employee_id, room_id, assigned_date || null, notes], function(err) {
        if (err) { res.status(500).json({ error: err.message }); return; }
        const assignId = this.lastID;
        db.run('INSERT INTO accommodation_room_assignment_history (room_id, employee_id, assigned_date, notes) VALUES (?, ?, ?, ?)', [room_id, employee_id, assigned_date || null, notes], function() {
          res.json({ id: assignId, employee_id, room_id, assigned_date, notes });
        });
      });
    });
  });
});
router.put('/accommodation-room-assignments/:id', (req, res) => {
  const { employee_id, room_id, assigned_date, notes } = req.body;
  db.get('SELECT id FROM accommodation_room_assignments WHERE employee_id = ? AND id != ?', [employee_id, req.params.id], (err, existing) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (existing) { res.status(409).json({ error: 'This employee is already assigned to a room' }); return; }
    db.get('SELECT r.capacity, COUNT(ara.id) as assigned_count FROM accommodation_rooms r LEFT JOIN accommodation_room_assignments ara ON ara.room_id = r.id WHERE r.id = ? AND ara.id != ? GROUP BY r.id', [room_id, req.params.id], (err, room) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (room && room.assigned_count >= room.capacity) { res.status(409).json({ error: 'Room is at full capacity' }); return; }
      db.get('SELECT employee_id, room_id, assigned_date FROM accommodation_room_assignments WHERE id = ?', [req.params.id], (err, oldAssign) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        db.run('UPDATE accommodation_room_assignments SET employee_id = ?, room_id = ?, assigned_date = ?, notes = ? WHERE id = ?', [employee_id, room_id, assigned_date || null, notes, req.params.id], function(err) {
          if (err) { res.status(500).json({ error: err.message }); return; }
          if (oldAssign) {
            const today = new Date().toISOString().split('T')[0];
            db.run('UPDATE accommodation_room_assignment_history SET vacated_date = ? WHERE room_id = ? AND employee_id = ? AND vacated_date IS NULL', [today, oldAssign.room_id, oldAssign.employee_id], function() {
              db.run('INSERT INTO accommodation_room_assignment_history (room_id, employee_id, assigned_date, notes) VALUES (?, ?, ?, ?)', [room_id, employee_id, assigned_date || null, notes], function() {
                res.json({ message: 'Room assignment updated' });
              });
            });
          } else {
            db.run('INSERT INTO accommodation_room_assignment_history (room_id, employee_id, assigned_date, notes) VALUES (?, ?, ?, ?)', [room_id, employee_id, assigned_date || null, notes], function() {
              res.json({ message: 'Room assignment updated' });
            });
          }
        });
      });
    });
  });
});
router.delete('/accommodation-room-assignments/:id', (req, res) => {
  db.get('SELECT employee_id, room_id FROM accommodation_room_assignments WHERE id = ?', [req.params.id], (err, assign) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    db.run('DELETE FROM accommodation_room_assignments WHERE id = ?', [req.params.id], function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (assign) {
        const today = new Date().toISOString().split('T')[0];
        db.run('UPDATE accommodation_room_assignment_history SET vacated_date = ? WHERE room_id = ? AND employee_id = ? AND vacated_date IS NULL', [today, assign.room_id, assign.employee_id], function() {
          res.json({ message: 'Room assignment deleted' });
        });
      } else {
        res.json({ message: 'Room assignment deleted' });
      }
    });
  });
});

router.get('/accommodation-rooms/:id/history', (req, res) => {
  db.all(`SELECT arah.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_id as emp_code
          FROM accommodation_room_assignment_history arah
          LEFT JOIN employees e ON arah.employee_id = e.id
          WHERE arah.room_id = ?
          ORDER BY arah.assigned_date DESC, arah.id DESC`, [req.params.id], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

// HR Settings - Employee ID Prefix
router.get('/employee-id-prefix', (req, res) => {
  db.get('SELECT * FROM employee_id_prefixes LIMIT 1', [], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (!row) {
      db.run('INSERT INTO employee_id_prefixes (prefix) VALUES (?)', ['EMP'], function(err) {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ id: this.lastID, prefix: 'EMP' });
      });
    } else {
      res.json(row);
    }
  });
});
router.put('/employee-id-prefix', (req, res) => {
  const { prefix } = req.body;
  db.get('SELECT * FROM employee_id_prefixes LIMIT 1', [], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    if (row) {
      db.run('UPDATE employee_id_prefixes SET prefix = ? WHERE id = ?', [prefix, row.id], function(err) {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ message: 'Employee ID prefix updated', prefix });
      });
    } else {
      db.run('INSERT INTO employee_id_prefixes (prefix) VALUES (?)', [prefix], function(err) {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ id: this.lastID, prefix });
      });
    }
  });
});

// Uniform Sizes Routes
router.get('/uniform-sizes', (req, res) => {
  db.all('SELECT * FROM uniform_sizes ORDER BY id', (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

router.post('/uniform-sizes', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO uniform_sizes (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/uniform-sizes/:id', (req, res) => {
  const { name, description } = req.body;
  const { id } = req.params;
  db.run('UPDATE uniform_sizes SET name = ?, description = ? WHERE id = ?', [name, description, id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ id, name, description });
  });
});

router.delete('/uniform-sizes/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM uniform_sizes WHERE id = ?', [id], function(err) {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json({ message: 'Uniform size deleted' });
  });
});

// ==================== ATTENDANCE ROUTES ====================

// Get all leave records (for leave applications history)
router.get('/leave-records', (req, res) => {
  db.all(`SELECT ea.employee_id, ea.date, ea.status, ea.notes,
                 e.employee_id as emp_code, e.first_name, e.last_name
          FROM employee_attendance ea
          JOIN employees e ON ea.employee_id = e.id
          WHERE ea.status IN ('medical-leave','paid-leave','compassionate-leave','unpaid-leave')
          ORDER BY ea.date DESC`, [], (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    res.json(rows);
  });
});

// Get attendance register for a given month (YYYY-MM format) 
// Returns all active employees with their attendance for each day of the month
router.get('/attendance', (req, res) => {
  const { month } = req.query; // e.g., '2026-07'
  if (!month) {
    return res.status(400).json({ error: 'month parameter required (YYYY-MM)' });
  }
  const [year, mon] = month.split('-');
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  // Get employees who were active during this month:
  // - hired on or before end of month
  // - not terminated, OR terminated during or after this month
  db.all(`SELECT e.id, e.employee_id, e.first_name, e.last_name, e.email, e.phone, e.department, e.position,
          e.remuneration_type, e.remuneration, e.hire_date, e.is_terminated, e.termination_date,
          e.working_hours_per_day, e.overtime_rate
          FROM employees e 
          WHERE (e.hire_date IS NULL OR e.hire_date <= ?)
            AND (e.is_terminated = 0 OR e.is_terminated IS NULL OR e.termination_date >= ?)
          ORDER BY e.first_name, e.last_name`, [endDate, startDate], (err, employees) => {
    if (err) { return res.status(500).json({ error: err.message }); }

    // Get all attendance records for this month
    db.all(`SELECT * FROM employee_attendance 
            WHERE date >= ? AND date <= ?`, [startDate, endDate], (err, records) => {
      if (err) { return res.status(500).json({ error: err.message }); }

      // Map attendance records by employee_id and date
      const attendanceMap = {};
      records.forEach(r => {
        if (!attendanceMap[r.employee_id]) attendanceMap[r.employee_id] = {};
        attendanceMap[r.employee_id][r.date] = r;
      });

      // Auto-fill missing 'present' records for current month up to today
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (month === currentMonth) {
        const insertValues = [];
        const insertPlaceholders = [];
        employees.forEach(emp => {
          const empAtt = attendanceMap[emp.id] || {};
          const terminationDateStr = emp.termination_date ? emp.termination_date.substring(0, 10) : null;
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) continue;
            if (terminationDateStr && dateStr > terminationDateStr) continue;
            if (empAtt[dateStr]) continue;
            insertPlaceholders.push('(?, ?, ?, ?)');
            insertValues.push(emp.id, dateStr, 'present', emp.working_hours_per_day || 8);
            attendanceMap[emp.id] = attendanceMap[emp.id] || {};
            attendanceMap[emp.id][dateStr] = { status: 'present', hours: emp.working_hours_per_day || 8 };
          }
        });

        if (insertValues.length > 0) {
          db.run(`INSERT OR IGNORE INTO employee_attendance (employee_id, date, status, hours) VALUES ${insertPlaceholders.join(',')}`,
            insertValues, function(err) {
              if (err) console.error('Auto-fill attendance error:', err.message);
              finishResponse();
            });
        } else {
          finishResponse();
        }
      } else if (month < currentMonth) {
        // For past months, auto-fill all days (not just up to today)
        const insertValues = [];
        const insertPlaceholders = [];
        employees.forEach(emp => {
          const empAtt = attendanceMap[emp.id] || {};
          const terminationDateStr = emp.termination_date ? emp.termination_date.substring(0, 10) : null;
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            if (terminationDateStr && dateStr > terminationDateStr) continue;
            if (empAtt[dateStr]) continue;
            insertPlaceholders.push('(?, ?, ?, ?)');
            insertValues.push(emp.id, dateStr, 'present', emp.working_hours_per_day || 8);
            attendanceMap[emp.id] = attendanceMap[emp.id] || {};
            attendanceMap[emp.id][dateStr] = { status: 'present', hours: emp.working_hours_per_day || 8 };
          }
        });

        if (insertValues.length > 0) {
          db.run(`INSERT OR IGNORE INTO employee_attendance (employee_id, date, status, hours) VALUES ${insertPlaceholders.join(',')}`,
            insertValues, function(err) {
              if (err) console.error('Auto-fill attendance error:', err.message);
              finishResponse();
            });
        } else {
          finishResponse();
        }
      } else {
        finishResponse();
      }

      function finishResponse() {
        // Check if month is locked
        db.get('SELECT * FROM attendance_locks WHERE month = ?', [month], (err, lockRow) => {
          const isLocked = !!lockRow;

          // Get leave entitlements for all employees
          const empIds = employees.map(e => e.id);
          if (empIds.length === 0) {
            return res.json({ employees, attendanceMap, daysInMonth, month, leaveEntitlements: {}, isLocked });
          }
          db.all(`SELECT * FROM employee_leave_entitlements WHERE employee_id IN (${empIds.join(',')})`, [], (err, leaveRows) => {
            if (err) { return res.status(500).json({ error: err.message }); }
            const leaveEntitlements = {};
            (leaveRows || []).forEach(r => {
              if (!leaveEntitlements[r.employee_id]) leaveEntitlements[r.employee_id] = [];
              leaveEntitlements[r.employee_id].push(r);
            });
            res.json({ employees, attendanceMap, daysInMonth, month, leaveEntitlements, isLocked });
          });
        });
      }
    });
  });
});

// Save/update a single attendance record
router.post('/attendance', (req, res) => {
  const { employee_id, date, status, hours, check_in_time, check_out_time, notes } = req.body;
  if (!employee_id || !date || !status) {
    return res.status(400).json({ error: 'employee_id, date, and status are required' });
  }
  const dateMonth = date.substring(0, 7);
  db.get('SELECT * FROM attendance_locks WHERE month = ?', [dateMonth], (err, lock) => {
    if (lock) return res.status(403).json({ error: 'This month is locked' });
    db.run(`INSERT INTO employee_attendance (employee_id, date, status, hours, check_in_time, check_out_time, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, date) DO UPDATE SET 
            status = excluded.status, hours = excluded.hours, check_in_time = excluded.check_in_time, 
            check_out_time = excluded.check_out_time, notes = excluded.notes`,
      [employee_id, date, status, hours || null, check_in_time || null, check_out_time || null, notes || null],
      function(err) {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ id: this.lastID, message: 'Attendance saved' });
      }
    );
  });
});

// Bulk save attendance for multiple employees for a date
router.post('/attendance/bulk', (req, res) => {
  const { records } = req.body; // Array of { employee_id, date, status, check_in_time, check_out_time, notes }
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'records array required' });
  }
  const stmt = db.prepare(`INSERT INTO employee_attendance (employee_id, date, status, hours, check_in_time, check_out_time, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, date) DO UPDATE SET 
          status = excluded.status, hours = excluded.hours, check_in_time = excluded.check_in_time, 
          check_out_time = excluded.check_out_time, notes = excluded.notes`);
  records.forEach(r => {
    stmt.run([r.employee_id, r.date, r.status, r.hours || null, r.check_in_time || null, r.check_out_time || null, r.notes || null]);
  });
  stmt.finalize((err) => {
    if (err) { return res.status(500).json({ error: err.message }); }
    res.json({ message: `${records.length} attendance records saved` });
  });
});

// Bulk delete attendance records for a date range
router.delete('/attendance/bulk/:employeeId', (req, res) => {
  const { from_date, to_date } = req.body;
  if (!from_date || !to_date) return res.status(400).json({ error: 'from_date and to_date required' });
  const empId = req.params.employeeId;
  // Check locks for all months in range
  const months = [];
  let d = new Date(from_date + 'T00:00:00');
  const end = new Date(to_date + 'T00:00:00');
  while (d <= end) {
    const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!months.includes(m)) months.push(m);
    d.setMonth(d.getMonth() + 1);
  }
  db.all(`SELECT month FROM attendance_locks WHERE month IN (${months.map(() => '?').join(',')})`, months, (err, locks) => {
    if (err) return res.status(500).json({ error: err.message });
    if (locks && locks.length > 0) return res.status(403).json({ error: `Month ${locks[0].month} is locked` });
    db.run('DELETE FROM employee_attendance WHERE employee_id = ? AND date >= ? AND date <= ?',
      [empId, from_date, to_date], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Attendance records deleted', count: this.changes });
    });
  });
});

// Delete attendance record
router.delete('/attendance/:employeeId/:date', (req, res) => {
  const dateMonth = req.params.date.substring(0, 7);
  db.get('SELECT * FROM attendance_locks WHERE month = ?', [dateMonth], (err, lock) => {
    if (lock) return res.status(403).json({ error: 'This month is locked' });
    db.run('DELETE FROM employee_attendance WHERE employee_id = ? AND date = ?',
      [req.params.employeeId, req.params.date], function(err) {
      if (err) { return res.status(500).json({ error: err.message }); }
      res.json({ message: 'Attendance record deleted' });
    });
  });
});

// Lock a month's attendance data
router.post('/attendance/lock', (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  // Cannot lock current or future months
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month >= currentMonth) {
    return res.status(400).json({ error: 'Cannot lock the current or future months. You can only lock completed months.' });
  }

  db.run('INSERT OR IGNORE INTO attendance_locks (month) VALUES (?)', [month], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Month ${month} locked successfully` });
  });
});

// Unlock a month's attendance data
router.post('/attendance/unlock', (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });
  db.run('DELETE FROM attendance_locks WHERE month = ?', [month], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Month ${month} unlocked successfully` });
  });
});

// ==================== ADVANCE PAYMENTS ROUTES ====================

// Get advance payments for a month
router.get('/advance-payments', (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month parameter required (YYYY-MM)' });
  const [year, mon] = month.split('-');
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  db.all(`SELECT ap.*, e.first_name, e.last_name, e.employee_id as emp_id
          FROM advance_payments ap
          JOIN employees e ON ap.employee_id = e.id
          WHERE ap.date >= ? AND ap.date <= ?
          ORDER BY ap.date DESC`, [startDate, endDate], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create advance payment
router.post('/advance-payments', (req, res) => {
  const { employee_id, amount, date, notes } = req.body;
  if (!employee_id || !amount || !date) {
    return res.status(400).json({ error: 'employee_id, amount, and date are required' });
  }
  db.run('INSERT INTO advance_payments (employee_id, amount, date, notes) VALUES (?, ?, ?, ?)',
    [employee_id, amount, date, notes || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Advance payment saved' });
  });
});

// Delete advance payment
router.delete('/advance-payments/:id', requireModulePermission('payments', 'delete'), (req, res) => {
  db.run('DELETE FROM advance_payments WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Advance payment deleted' });
  });
});

// ==================== EMPLOYEE PAYMENTS ROUTES ====================

// Get employee payments for a month
router.get('/employee-payments', (req, res) => {
  const { month, employee_id } = req.query;
  let query = 'SELECT ep.*, e.first_name, e.last_name, e.employee_id as emp_code FROM employee_payments ep JOIN employees e ON ep.employee_id = e.id';
  const params = [];
  
  if (month) {
    query += ' WHERE ep.month = ?';
    params.push(month);
  }
  if (employee_id) {
    query += month ? ' AND ep.employee_id = ?' : ' WHERE ep.employee_id = ?';
    params.push(employee_id);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get carry forward balance for an employee
router.get('/employee-payments/carry-forward/:employee_id', (req, res) => {
  const { employee_id } = req.params;

  // Get the most recent payment balance (carry forward)
  db.get(`SELECT balance FROM employee_payments WHERE employee_id = ? ORDER BY month DESC LIMIT 1`,
    [employee_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ carry_forward: row ? row.balance : 0 });
  });
});

// Get carry forward balances for all employees as of a given month
router.get('/employee-payments/carry-forward', (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: 'month is required' });
  }

  const query = `
    SELECT e.id AS employee_id, COALESCE(ep.balance, 0) AS carry_forward
    FROM employees e
    LEFT JOIN (
      SELECT employee_id, balance
      FROM employee_payments
      WHERE (employee_id, month) IN (
        SELECT employee_id, MAX(month)
        FROM employee_payments
        WHERE month < ?
        GROUP BY employee_id
      )
    ) ep ON ep.employee_id = e.id
  `;

  db.all(query, [month], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = {};
    rows.forEach(r => {
      result[r.employee_id] = r.carry_forward || 0;
    });
    res.json(result);
  });
});

// Create employee payment
router.post('/employee-payments', (req, res) => {
  const { employee_id, month, net_amount, paid_amount, balance, gross_amount, advance_amount } = req.body;
  if (!employee_id || !month || !net_amount || paid_amount === undefined) {
    return res.status(400).json({ error: 'employee_id, month, net_amount, and paid_amount are required' });
  }

  // Calculate carry forward from previous month
  const [year, mon] = month.split('-');
  const prevMonth = mon === '01' ? `${parseInt(year) - 1}-12` : `${year}-${String(parseInt(mon) - 1).padStart(2, '0')}`;

  db.get(`SELECT balance FROM employee_payments WHERE employee_id = ? AND month = ?`, [employee_id, prevMonth], (err, prevPayment) => {
    if (err) return res.status(500).json({ error: err.message });

    const carry_forward = prevPayment ? prevPayment.balance : 0;
    // net_amount sent from frontend already includes carry forward
    const final_balance = net_amount - paid_amount;

    // Insert or update payment record
    db.run(`INSERT INTO employee_payments (employee_id, month, net_amount, paid_amount, balance, gross_amount, advance_amount, carry_forward) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, month) DO UPDATE SET
            net_amount = excluded.net_amount,
            paid_amount = excluded.paid_amount,
            balance = excluded.balance,
            gross_amount = excluded.gross_amount,
            advance_amount = excluded.advance_amount,
            carry_forward = excluded.carry_forward,
            paid_at = CURRENT_TIMESTAMP`,
      [employee_id, month, net_amount, paid_amount, final_balance, gross_amount, advance_amount, carry_forward],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, carry_forward, balance: final_balance });
      });
  });
});

// Update employee payment
router.put('/employee-payments/:id', (req, res) => {
  const { paid_amount, balance } = req.body;
  if (paid_amount === undefined) {
    return res.status(400).json({ error: 'paid_amount is required' });
  }
  
  db.run(`UPDATE employee_payments SET paid_amount = ?, balance = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [paid_amount, balance, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Payment updated' });
  });
});

// Delete employee payment
router.delete('/employee-payments/:id', (req, res) => {
  const id = req.params.id;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Valid payment id is required' });
  db.run('DELETE FROM employee_payments WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Payment record not found' });
    res.json({ message: 'Payment deleted' });
  });
});

// Upload signed payslip for a payment
router.post('/employee-payments/:id/signed-payslip', (req, res, next) => {
  uploadSignedPayslip.single('signed_payslip')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const webPath = `/signed-payslips/${req.file.filename}`;
  
  db.run(`UPDATE employee_payments SET signed_payslip_path = ?, signed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [webPath, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Signed payslip uploaded', path: webPath });
  });
});

// Delete signed payslip for a payment
router.delete('/employee-payments/:id/signed-payslip', (req, res) => {
  const { id } = req.params;
  
  // Get the current file path
  db.get('SELECT signed_payslip_path FROM employee_payments WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row || !row.signed_payslip_path) return res.status(404).json({ error: 'No signed payslip found' });
    
    const filePath = path.join(__dirname, '../public', row.signed_payslip_path);
    
    // Delete file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Update database
    db.run(`UPDATE employee_payments SET signed_payslip_path = NULL, signed_at = NULL WHERE id = ?`,
      [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Signed payslip deleted' });
    });
  });
});

// ==================== PAYSLIP TRANSFER PERIODS ====================

// Get salary periods for an employee in a given month (for payslip breakdown)
router.get('/employee-salary-periods', (req, res) => {
  const { employee_id, month } = req.query;
  if (!employee_id || !month) return res.status(400).json({ error: 'employee_id and month required' });

  const [year, mon] = month.split('-');
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  // Get transfers for this employee that happened during or before this month
  db.all(`SELECT et.transfer_date, et.prev_remuneration_type, et.prev_remuneration, 
          et.new_remuneration_type, et.new_remuneration,
          et.from_location_id, et.to_location_id,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name as from_location_name,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name as to_location_name
          FROM employee_transfers et
          LEFT JOIN business_type_assignments fbta ON et.from_location_id = fbta.id
          LEFT JOIN countries fc ON fbta.country_id = fc.id
          LEFT JOIN location_types flt ON fbta.location_id = flt.id
          LEFT JOIN sub_location_types fslt ON fbta.sub_location_id = fslt.id
          LEFT JOIN business_types fbt ON fbta.business_type_id = fbt.id
          LEFT JOIN business_type_assignments tbta ON et.to_location_id = tbta.id
          LEFT JOIN countries tc ON tbta.country_id = tc.id
          LEFT JOIN location_types tlt ON tbta.location_id = tlt.id
          LEFT JOIN sub_location_types tslt ON tbta.sub_location_id = tslt.id
          LEFT JOIN business_types tbt ON tbta.business_type_id = tbt.id
          WHERE et.employee_id = ? AND et.transfer_date >= ? AND et.transfer_date <= ?
          ORDER BY et.transfer_date`, [employee_id, startDate, endDate], (err, transfers) => {
    if (err) return res.status(500).json({ error: err.message });

    // Also get the employee's current location name
    db.get(`SELECT e.location_id, e.remuneration_type, e.remuneration,
            c.name || ' - ' || lt.name || ' - ' || slt.name || ' - ' || bt.name as location_name
            FROM employees e
            LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
            LEFT JOIN countries c ON bta.country_id = c.id
            LEFT JOIN location_types lt ON bta.location_id = lt.id
            LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
            LEFT JOIN business_types bt ON bta.business_type_id = bt.id
            WHERE e.id = ?`, [employee_id], (err2, emp) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ transfers, employee: emp });
    });
  });
});

// ==================== PAYSLIP EMAIL ROUTE ====================

const nodemailer = require('nodemailer');

router.post('/send-payslip', async (req, res) => {
  const { email, name, month, pdfBase64 } = req.body;
  if (!email || !pdfBase64) {
    return res.status(400).json({ error: 'email and pdfBase64 are required' });
  }

  // Configure your SMTP settings here
  // You can use environment variables or a config file
  const smtpConfig = {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  };

  if (!smtpConfig.host || !smtpConfig.auth.user) {
    return res.status(500).json({ error: 'Email not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.' });
  }

  try {
    const transporter = nodemailer.createTransport(smtpConfig);

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const filename = `Payslip_${name.replace(/\s+/g, '_')}_${month.replace(/\s+/g, '_')}.pdf`;

    await transporter.sendMail({
      from: smtpConfig.auth.user,
      to: email,
      subject: `Payslip for ${month} - MWH Management`,
      html: `<p>Dear ${name},</p><p>Please find attached your payslip for the month of <strong>${month}</strong>.</p><p>Regards,<br>MWH Management</p>`,
      attachments: [{
        filename: filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email: ' + error.message });
  }
});

module.exports = router;
