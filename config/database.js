const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Initialize SQLite database
const db = new sqlite3.Database('./mwh_management.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Configure database for immediate data persistence (disable WAL for now)
    db.run('PRAGMA journal_mode = DELETE');
    db.run('PRAGMA synchronous = FULL');
    initializeDatabase();
  }
});

// Graceful shutdown handler
function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  db.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
    if (err) {
      console.error('Error checkpointing database:', err);
    } else {
      console.log('Database checkpointed successfully');
    }
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database closed successfully');
      }
      process.exit(0);
    });
  });
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function dedupeEquipmentStatuses(callback) {
  db.all('SELECT id, TRIM(name) as name FROM equipment_statuses', [], (err, rows) => {
    if (err) { console.error('Error reading equipment_statuses for dedupe:', err.message); if (callback) callback(); return; }
    const canonical = {};
    rows.forEach(r => {
      const key = r.name.toLowerCase();
      if (!canonical[key] || r.id < canonical[key].id) canonical[key] = r;
    });

    const tasks = [];
    rows.forEach(r => {
      const key = r.name.toLowerCase();
      const c = canonical[key];
      if (r.id !== c.id) tasks.push({ dup: r.id, canon: c.id, key });
    });

    if (!tasks.length) { if (callback) callback(); return; }

    let pending = tasks.length;
    tasks.forEach(t => {
      db.run('UPDATE equipment SET status_id = ? WHERE status_id = ?', [t.canon, t.dup], (err) => {
        if (err) console.error(`Error remapping status_id ${t.dup} -> ${t.canon}:`, err.message);
        db.run('DELETE FROM equipment_statuses WHERE id = ?', [t.dup], (delErr) => {
          if (delErr) console.error(`Error deleting duplicate status ${t.dup}:`, delErr.message);
          else console.log(`Deduplicated equipment status id ${t.dup} -> ${t.canon}`);
          if (--pending === 0 && callback) callback();
        });
      });
    });
  });
}

function dedupeSuppliers(callback) {
  const supplierFkTables = [
    { table: 'equipment', fkCol: 'supplier_id' },
    { table: 'spare_parts', fkCol: 'supplier_id' },
    { table: 'spare_part_transactions', fkCol: 'supplier_id' },
    { table: 'equipment_purchases', fkCol: 'supplier_id' },
    { table: 'parts_purchases', fkCol: 'supplier_id' },
    { table: 'kitchen_purchases', fkCol: 'supplier_id' },
    { table: 'uniform_purchases', fkCol: 'supplier_id' },
    { table: 'purchase_orders', fkCol: 'supplier_id' }
  ];

  db.all('SELECT id, TRIM(name) as name FROM suppliers', [], (err, rows) => {
    if (err) { console.error('Error reading suppliers for dedupe:', err.message); if (callback) callback(); return; }
    const canonical = {};
    rows.forEach(r => {
      const key = r.name.toLowerCase();
      if (!canonical[key] || r.id < canonical[key].id) canonical[key] = r;
    });

    const tasks = [];
    rows.forEach(r => {
      const key = r.name.toLowerCase();
      const c = canonical[key];
      if (r.id !== c.id) tasks.push({ dup: r.id, canon: c.id, key });
    });

    if (!tasks.length) { if (callback) callback(); return; }

    let pending = tasks.length;
    tasks.forEach(t => {
      supplierFkTables.forEach(({ table, fkCol }) => {
        db.run(`UPDATE ${table} SET ${fkCol} = ? WHERE ${fkCol} = ?`, [t.canon, t.dup], (err) => {
          if (err) console.error(`Error remapping ${table}.${fkCol} ${t.dup} -> ${t.canon}:`, err.message);
        });
      });
      db.run('DELETE FROM suppliers WHERE id = ?', [t.dup], (delErr) => {
        if (delErr) console.error(`Error deleting duplicate supplier ${t.dup}:`, delErr.message);
        else console.log(`Deduplicated supplier id ${t.dup} -> ${t.canon}`);
        if (--pending === 0 && callback) callback();
      });
    });
  });
}

function initializeDatabase() {
  // Create tables
  db.serialize(() => {
    // Locations table
    db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT,
      location TEXT,
      sub_location TEXT,
      business_type TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Equipment table
    db.run(`CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auto_serial_number TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      serial_number TEXT,
      barcode TEXT,
      category TEXT,
      model TEXT,
      purchase_date DATE,
      purchase_cost DECIMAL,
      price DECIMAL,
      shipping_charge DECIMAL,
      manufacturer TEXT,
      warranty_expiry DATE,
      location_id INTEGER,
      supplier_id INTEGER,
      condition TEXT,
      status TEXT,
      comments TEXT,
      photo_path TEXT,
      manual_document_path TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      catalog_id INTEGER,
      owner_id INTEGER,
      preventive_maintenance_months INTEGER,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (catalog_id) REFERENCES equipment_catalog(id),
      FOREIGN KEY (owner_id) REFERENCES equipment_owners(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating equipment table:', err);
        return;
      }
      // Add new column if it doesn't exist
      db.run(`ALTER TABLE equipment ADD COLUMN preventive_maintenance_months INTEGER`, [], (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding preventive_maintenance_months to equipment:', err);
        }
      });

      // Check if table has old CHECK constraint by trying to insert a test value
      db.run("INSERT INTO equipment (name, condition) VALUES ('_test_', 'test_condition')", (err) => {
        if (err && err.message.includes('CHECK constraint failed')) {
          console.log('Old CHECK constraint detected, recreating table...');
          // Recreate table without CHECK constraint
          db.run(`DROP TABLE equipment`, (err) => {
            if (err) {
              console.error('Error dropping equipment table:', err);
            } else {
              // Create new table without CHECK constraint
              db.run(`CREATE TABLE equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                auto_serial_number TEXT,
                name TEXT NOT NULL,
                serial_number TEXT,
                category TEXT,
                model TEXT,
                purchase_date DATE,
                purchase_cost DECIMAL,
                price DECIMAL,
                shipping_charge DECIMAL,
                manufacturer TEXT,
                warranty_expiry DATE,
                location_id INTEGER,
                supplier_id INTEGER,
                condition TEXT,
                status TEXT,
                comments TEXT,
                photo_path TEXT,
                manual_document_path TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                catalog_id INTEGER,
                owner_id INTEGER,
                preventive_maintenance_months INTEGER,
                FOREIGN KEY (location_id) REFERENCES locations(id),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (catalog_id) REFERENCES equipment_catalog(id),
                FOREIGN KEY (owner_id) REFERENCES equipment_owners(id)
              )`, (err) => {
                if (err) {
                  console.error('Error recreating equipment table:', err);
                } else {
                  console.log('Equipment table recreated without CHECK constraint');
                }
              });
            }
          });
        } else {
          // Clean up test row
          db.run("DELETE FROM equipment WHERE name = '_test_'");
        }
      });
    });

    // Add columns if they don't exist
    const columnsToAdd = [
      'supplier_id INTEGER',
      'price DECIMAL',
      'shipping_charge DECIMAL',
      'manufacturer TEXT',
      'warranty_expiry DATE',
      'manual_document_path TEXT',
      'auto_serial_number TEXT',
      'brand TEXT',
      'specification TEXT',
      'other_charges DECIMAL',
      'barcode TEXT',
      'catalog_id INTEGER',
      'condition TEXT',
      'status TEXT',
      'comments TEXT',
      'owner_id INTEGER',
      'purchase_order_number TEXT',
      'in_service_date DATE',
      'assigned_to INTEGER',
      'accumulated_usage_days INTEGER DEFAULT 0'
    ];

    columnsToAdd.forEach(column => {
      db.run(`ALTER TABLE equipment ADD COLUMN ${column}`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log(`${column.split(' ')[0]} column may already exist`);
        }
      });
    });

    // Add columns for other tables
    db.run(`ALTER TABLE equipment_transfers ADD COLUMN assigned_to TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('assigned_to column may already exist');
      }
    });
    db.run(`ALTER TABLE equipment_transfers ADD COLUMN previous_assigned_to TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('previous_assigned_to column may already exist');
      }
    });
    db.run(`ALTER TABLE equipment_transfers ADD COLUMN transfer_serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('transfer_serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE maintenance_logs ADD COLUMN maintenance_serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('maintenance_serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN specification TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('specification column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN photo_path TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('photo_path column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN spare_part_serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('spare_part_serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN purchase_order_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('purchase_order_number column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN part_serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('part_serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN po_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('po_number column may already exist');
      }
    });

    // Backfill spare_part_serial_number for existing records
    db.all(`SELECT id, spare_part_serial_number, purchase_order_number FROM spare_parts ORDER BY id ASC`, [], (err, rows) => {
      if (err) { console.error('Error reading spare parts for backfill:', err); return; }
      let counter = 1;
      rows.forEach(row => {
        if (!row.spare_part_serial_number) {
          const autoSerial = `SP-${String(counter).padStart(3, '0')}`;
          db.run('UPDATE spare_parts SET spare_part_serial_number = ? WHERE id = ?', [autoSerial, row.id], (err) => {
            if (err) console.error(`Error backfilling spare_part_serial_number for id ${row.id}:`, err);
          });
        }
        counter++;
      });
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN total_cost DECIMAL`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('total_cost column may already exist');
      }
    });
    db.run(`ALTER TABLE spare_parts ADD COLUMN purchase_date DATE`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('purchase_date column may already exist');
      }
    });
    db.run(`ALTER TABLE item_types ADD COLUMN item_category_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_category_id column may already exist');
      }
    });
    db.run(`ALTER TABLE item_categories ADD COLUMN serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_categories serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE item_units ADD COLUMN serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_units serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE item_types ADD COLUMN serial_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_types serial_number column may already exist');
      }
    });
    db.run(`ALTER TABLE item_types ADD COLUMN item_subcategory_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_subcategory_id column may already exist');
      }
    });
    db.run(`ALTER TABLE item_types ADD COLUMN item_unit_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('item_unit_id column may already exist');
      }
    });
    db.run(`ALTER TABLE maintenance_logs ADD COLUMN maintenance_status TEXT DEFAULT 'Pending'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('maintenance_status column may already exist');
      }
    });
    db.run(`ALTER TABLE maintenance_logs ADD COLUMN requested_by TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('requested_by column may already exist');
      }
    });

    // Equipment Transfers table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_serial_number TEXT,
      equipment_id INTEGER,
      from_location_id INTEGER,
      to_location_id INTEGER,
      transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_to TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (from_location_id) REFERENCES locations(id),
      FOREIGN KEY (to_location_id) REFERENCES locations(id)
    )`);

    // Maintenance Logs table
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_serial_number TEXT,
      equipment_id INTEGER,
      maintenance_type TEXT CHECK(maintenance_type IN ('preventive', 'corrective', 'emergency')),
      maintenance_status TEXT DEFAULT 'Pending',
      description TEXT,
      cost DECIMAL,
      performed_by TEXT,
      performed_date DATE,
      next_maintenance_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Spare Parts table
    db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spare_part_serial_number TEXT,
      purchase_order_number TEXT,
      name TEXT NOT NULL,
      part_number TEXT,
      part_serial_number TEXT,
      brand TEXT,
      category TEXT,
      specification TEXT,
      photo_path TEXT,
      quantity INTEGER DEFAULT 0,
      unit_cost DECIMAL,
      total_cost DECIMAL,
      location TEXT NOT NULL,
      supplier TEXT NOT NULL,
      purchase_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Maintenance Parts table (tracks parts used in maintenance)
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_log_id INTEGER,
      spare_part_id INTEGER,
      quantity_used INTEGER,
      cost_at_time DECIMAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_log_id) REFERENCES maintenance_logs(id),
      FOREIGN KEY (spare_part_id) REFERENCES spare_parts(id)
    )`);

    // Maintenance Photos table (tracks photos attached to maintenance logs)
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_log_id INTEGER NOT NULL,
      photo_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_log_id) REFERENCES maintenance_logs(id)
    )`);

    // Spare Part Transactions table (tracks purchase, consumption and adjustment history)
    db.run(`CREATE TABLE IF NOT EXISTS spare_part_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spare_part_id INTEGER NOT NULL,
      transaction_type TEXT CHECK(transaction_type IN ('purchase', 'consumption', 'adjustment')),
      quantity INTEGER NOT NULL,
      unit_cost DECIMAL,
      total_cost DECIMAL,
      supplier TEXT,
      reference_id INTEGER,
      reference_type TEXT,
      transaction_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (spare_part_id) REFERENCES spare_parts(id)
    )`);

    // Migrate existing table to allow 'adjustment' type if it still uses the old constraint
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='spare_part_transactions'`, [], (err, row) => {
      if (err || !row || !row.sql) return;
      if (!row.sql.includes("'adjustment'")) {
        db.run(`ALTER TABLE spare_part_transactions RENAME TO spare_part_transactions_old`, (err) => {
          if (err) return;
          db.run(`CREATE TABLE spare_part_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spare_part_id INTEGER NOT NULL,
            transaction_type TEXT CHECK(transaction_type IN ('purchase', 'consumption', 'adjustment')),
            quantity INTEGER NOT NULL,
            unit_cost DECIMAL,
            total_cost DECIMAL,
            supplier TEXT,
            reference_id INTEGER,
            reference_type TEXT,
            transaction_date DATE,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (spare_part_id) REFERENCES spare_parts(id)
          )`, (err) => {
            if (err) return;
            db.run(`INSERT INTO spare_part_transactions (id, spare_part_id, transaction_type, quantity, unit_cost, total_cost, supplier, reference_id, reference_type, transaction_date, notes, created_at)
                    SELECT id, spare_part_id, transaction_type, quantity, unit_cost, total_cost, supplier, reference_id, reference_type, transaction_date, notes, created_at FROM spare_part_transactions_old`, (err) => {
              if (err) return;
              db.run(`DROP TABLE spare_part_transactions_old`);
            });
          });
        });
      }
    });

    // Parts Items table
    db.run(`CREATE TABLE IF NOT EXISTS parts_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      part_number TEXT,
      brand TEXT,
      specification TEXT,
      image_path TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Parts Purchases table
    db.run(`CREATE TABLE IF NOT EXISTS parts_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      supplier_name TEXT,
      quantity INTEGER,
      unit_price DECIMAL,
      total_cost DECIMAL,
      purchase_date DATE,
      invoice_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES parts_items(id)
    )`);

    // Part Equipment Assignments table (many-to-many relationship)
    db.run(`CREATE TABLE IF NOT EXISTS part_equipment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER,
      equipment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts_items(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Equipment Photos table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      photo_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Equipment Purchases table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      supplier_name TEXT,
      purchase_cost DECIMAL,
      purchase_date DATE,
      invoice_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Kitchen Items table
    db.run(`CREATE TABLE IF NOT EXISTS kitchen_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT CHECK(category IN ('utensil', 'consumable')),
      sku TEXT,
      unit TEXT CHECK(unit IN ('piece', 'kg', 'liter', 'box')),
      current_stock INTEGER DEFAULT 0,
      minimum_stock INTEGER DEFAULT 0,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Kitchen Purchases table
    db.run(`CREATE TABLE IF NOT EXISTS kitchen_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      supplier_name TEXT,
      quantity INTEGER,
      unit_price DECIMAL,
      total_cost DECIMAL,
      purchase_date DATE,
      invoice_number TEXT,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES kitchen_items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Kitchen Deliveries table
    db.run(`CREATE TABLE IF NOT EXISTS kitchen_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      catering_unit_name TEXT,
      quantity INTEGER,
      delivery_date DATE,
      received_by TEXT,
      notes TEXT,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES kitchen_items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Uniform Items table
    db.run(`CREATE TABLE IF NOT EXISTS uniform_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      size TEXT,
      gender TEXT,
      current_stock INTEGER DEFAULT 0,
      minimum_stock INTEGER DEFAULT 0,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Migrate uniform_items: add color and notes columns if missing
    db.all("PRAGMA table_info(uniform_items)", [], (err, cols) => {
      if (err || !cols) return;
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('color')) {
        db.run("ALTER TABLE uniform_items ADD COLUMN color TEXT");
      }
      if (!colNames.includes('notes')) {
        db.run("ALTER TABLE uniform_items ADD COLUMN notes TEXT");
      }
    });

    // Uniform Purchases table
    db.run(`CREATE TABLE IF NOT EXISTS uniform_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      supplier_name TEXT,
      quantity INTEGER,
      unit_price DECIMAL,
      total_cost DECIMAL,
      purchase_date DATE,
      invoice_number TEXT,
      location_id INTEGER,
      business_type_assignment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES uniform_items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Migrate uniform_purchases: add business_type_assignment_id column if missing
    db.all("PRAGMA table_info(uniform_purchases)", [], (err, cols) => {
      if (err || !cols) return;
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('business_type_assignment_id')) {
        db.run("ALTER TABLE uniform_purchases ADD COLUMN business_type_assignment_id INTEGER");
      }
    });

    // Uniform Distributions table
    db.run(`CREATE TABLE IF NOT EXISTS uniform_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      staff_name TEXT,
      staff_id TEXT,
      department TEXT,
      quantity INTEGER,
      distribution_date DATE,
      notes TEXT,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES uniform_items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Employees table
    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      location_id INTEGER,
      hire_date DATE,
      status TEXT DEFAULT 'active',
      address TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )`);

    // Add photo_path column to employees table if it doesn't exist
    db.run(`ALTER TABLE employees ADD COLUMN photo_path TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('photo_path column may already exist');
      }
    });

    // Add nationality column to employees table if it doesn't exist
    db.run(`ALTER TABLE employees ADD COLUMN nationality TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('nationality column may already exist');
      }
    });

    // Add termination columns to employees table if they don't exist
    db.run(`ALTER TABLE employees ADD COLUMN termination_date DATE`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('termination_date column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN termination_reason TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('termination_reason column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN termination_notes TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('termination_notes column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN is_terminated INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('is_terminated column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN remuneration_type TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('remuneration_type column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN remuneration TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('remuneration column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN assigned_to INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('assigned_to column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN working_hours_per_day REAL DEFAULT 8`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('working_hours_per_day column may already exist');
      }
    });
    db.run(`ALTER TABLE employees ADD COLUMN overtime_rate REAL DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('overtime_rate column may already exist');
      }
    });

    // Employee Leave Entitlements table
    db.run(`CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      days_count INTEGER NOT NULL,
      condition_type TEXT DEFAULT 'after',
      months_count INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    // Add period_type column if not exists
    db.run(`ALTER TABLE employee_leave_entitlements ADD COLUMN period_type TEXT DEFAULT 'months'`, (err) => {
      // Ignore error if column already exists
    });

    // Employee Transfers table
    db.run(`CREATE TABLE IF NOT EXISTS employee_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      transfer_serial_number TEXT,
      from_location_id INTEGER,
      to_location_id INTEGER NOT NULL,
      transfer_date DATE NOT NULL,
      reason TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (from_location_id) REFERENCES locations(id),
      FOREIGN KEY (to_location_id) REFERENCES locations(id)
    )`);

    // Add remuneration snapshot columns to employee_transfers
    db.run(`ALTER TABLE employee_transfers ADD COLUMN prev_remuneration_type TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('prev_remuneration_type column may already exist');
      }
    });
    db.run(`ALTER TABLE employee_transfers ADD COLUMN prev_remuneration TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('prev_remuneration column may already exist');
      }
    });
    db.run(`ALTER TABLE employee_transfers ADD COLUMN new_remuneration_type TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('new_remuneration_type column may already exist');
      }
    });
    db.run(`ALTER TABLE employee_transfers ADD COLUMN new_remuneration TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('new_remuneration column may already exist');
      }
    });
    db.run(`ALTER TABLE employee_transfers ADD COLUMN prev_leave_entitlements TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('prev_leave_entitlements column may already exist');
      }
    });
    db.run(`ALTER TABLE employee_transfers ADD COLUMN new_leave_entitlements TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('new_leave_entitlements column may already exist');
      }
    });

    // Employee Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS employee_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      hours REAL,
      check_in_time TEXT,
      check_out_time TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    )`);
    db.run(`ALTER TABLE employee_attendance ADD COLUMN hours REAL`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('hours column may already exist');
      }
    });

    // Advance Payments table
    db.run(`CREATE TABLE IF NOT EXISTS advance_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      amount DECIMAL NOT NULL,
      date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    // Employee Payments table
    db.run(`CREATE TABLE IF NOT EXISTS employee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      net_amount DECIMAL NOT NULL,
      paid_amount DECIMAL NOT NULL,
      balance DECIMAL NOT NULL,
      gross_amount DECIMAL NOT NULL,
      advance_amount DECIMAL NOT NULL,
      carry_forward DECIMAL DEFAULT 0,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      signed_at DATETIME,
      signed_payslip_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, month)
    )`);

    // Add new columns to existing employee_payments table if they don't exist
    db.run(`ALTER TABLE employee_payments ADD COLUMN signed_at DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column name')) console.error('Error adding signed_at column:', err.message);
    });
    db.run(`ALTER TABLE employee_payments ADD COLUMN signed_payslip_path TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) console.error('Error adding signed_payslip_path column:', err.message);
    });

    // Attendance Month Locks table
    db.run(`CREATE TABLE IF NOT EXISTS attendance_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      locked_by TEXT
    )`);

    // Contact Categories table
    db.run(`CREATE TABLE IF NOT EXISTS contact_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Contact Statuses table
    db.run(`CREATE TABLE IF NOT EXISTS contact_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Employee Documents table
    db.run(`CREATE TABLE IF NOT EXISTS employee_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      issued_date DATE,
      expiry_date DATE,
      document_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )`);

    db.run(`ALTER TABLE employee_documents ADD COLUMN document_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('document_number column may already exist');
      }
    });

    // Document Types table
    db.run(`CREATE TABLE IF NOT EXISTS document_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      notification_days INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add notification_days column if it doesn't exist (migration)
    db.run(`ALTER TABLE document_types ADD COLUMN notification_days INTEGER DEFAULT 30`, (err) => {});

    // Nationalities table
    db.run(`CREATE TABLE IF NOT EXISTS nationalities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Contact Status Assignments table
    db.run(`CREATE TABLE IF NOT EXISTS contact_status_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      status_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES contact_categories(id),
      FOREIGN KEY (status_id) REFERENCES contact_statuses(id),
      UNIQUE(category_id, status_id)
    )`);

    // Purchase Orders table
    db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      order_date DATE NOT NULL,
      supplier_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`);

    // Items table
    db.run(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER,
      subcategory_id INTEGER,
      type_id INTEGER,
      unit_id INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES item_categories(id),
      FOREIGN KEY (subcategory_id) REFERENCES item_subcategories(id),
      FOREIGN KEY (type_id) REFERENCES item_types(id),
      FOREIGN KEY (unit_id) REFERENCES item_units(id)
    )`);

    // Add product_code column to existing items table if it doesn't exist
    db.run(`ALTER TABLE items ADD COLUMN product_code TEXT`, [], (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding product_code column:', err);
      }
    });
    db.run(`ALTER TABLE items ADD COLUMN preventive_maintenance_months INTEGER`, [], (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding preventive_maintenance_months column:', err);
      }
    });

    // Equipment Categories table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Equipment Statuses table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating equipment_statuses table:', err);
      else console.log('Equipment statuses table initialized');
    });

    // Equipment Catalog table (for equipment types - name + category only)
    db.run(`CREATE TABLE IF NOT EXISTS equipment_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Equipment Conditions table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Equipment Owners table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Preventive Maintenance Tasks table
    db.run(`CREATE TABLE IF NOT EXISTS preventive_maintenance_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      task_text TEXT NOT NULL,
      pm_type TEXT DEFAULT 'monthly',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`);

    // Add pm_type column to existing table if it doesn't exist
    db.run(`ALTER TABLE preventive_maintenance_tasks ADD COLUMN pm_type TEXT DEFAULT 'monthly'`, [], (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding pm_type column:', err);
      }
    });

    // Maintenance Log Tasks table (stores checked PM tasks per maintenance log)
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_log_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_log_id INTEGER NOT NULL,
      pm_task_id INTEGER,
      task_text TEXT NOT NULL,
      is_checked INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (maintenance_log_id) REFERENCES maintenance_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (pm_task_id) REFERENCES preventive_maintenance_tasks(id)
    )`);

    // HR Settings - Positions
    db.run(`CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      department_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`);

    // Migrate: add department_id column to positions if it doesn't exist
    db.all("PRAGMA table_info(positions)", [], (err, cols) => {
      if (err) return;
      const hasDeptId = cols.some(c => c.name === 'department_id');
      if (!hasDeptId) {
        db.run('ALTER TABLE positions ADD COLUMN department_id INTEGER REFERENCES departments(id)', (e) => {
          if (e && !e.message.includes('duplicate column')) console.error('Error adding department_id to positions:', e.message);
        });
      }
    });

    // HR Settings - Departments
    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Position-Department junction (many-to-many)
    db.run(`CREATE TABLE IF NOT EXISTS position_departments (
      position_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      PRIMARY KEY (position_id, department_id),
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )`);

    // HR Settings - Employee Statuses
    db.run(`CREATE TABLE IF NOT EXISTS employee_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Uniform Types
    db.run(`CREATE TABLE IF NOT EXISTS uniform_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Accommodation Types
    db.run(`CREATE TABLE IF NOT EXISTS accommodation_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Accommodation Locations
    db.run(`CREATE TABLE IF NOT EXISTS accommodation_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      description TEXT,
      country_id INTEGER,
      location_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
      FOREIGN KEY (location_id) REFERENCES location_types(id) ON DELETE SET NULL
    )`);
    // Migration: add columns if they don't exist
    db.all("PRAGMA table_info(accommodation_locations)", [], (err, cols) => {
      if (err) return;
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('country_id')) {
        db.run('ALTER TABLE accommodation_locations ADD COLUMN country_id INTEGER');
      }
      if (!colNames.includes('location_id')) {
        db.run('ALTER TABLE accommodation_locations ADD COLUMN location_id INTEGER');
      }
    });

    // HR Settings - Accommodation Blocks (legacy, kept for compatibility)
    db.run(`CREATE TABLE IF NOT EXISTS accommodation_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location_id INTEGER,
      capacity INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES accommodation_locations(id) ON DELETE SET NULL
    )`);

    // HR Settings - Accommodation Rooms
    db.run(`CREATE TABLE IF NOT EXISTS accommodation_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      accommodation_location_id INTEGER,
      capacity INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accommodation_location_id) REFERENCES accommodation_locations(id) ON DELETE SET NULL
    )`);

    // HR Settings - Accommodation Room Assignments
    db.run(`CREATE TABLE IF NOT EXISTS accommodation_room_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      assigned_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES accommodation_rooms(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS accommodation_room_assignment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      assigned_date DATE,
      vacated_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Remuneration Types
    db.run(`CREATE TABLE IF NOT EXISTS remuneration_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Leave Types
    db.run(`CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Overtime Types
    db.run(`CREATE TABLE IF NOT EXISTS overtime_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Uniform Sizes
    db.run(`CREATE TABLE IF NOT EXISTS uniform_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // HR Settings - Employee ID Prefix (single record)
    db.run(`CREATE TABLE IF NOT EXISTS employee_id_prefixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL DEFAULT 'EMP',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Countries table
    db.run(`CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Location Types table
    db.run(`CREATE TABLE IF NOT EXISTS location_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_id) REFERENCES countries(id)
    )`);

    // Sub Location Types table
    db.run(`CREATE TABLE IF NOT EXISTS sub_location_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER,
      location_id INTEGER,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_id) REFERENCES countries(id),
      FOREIGN KEY (location_id) REFERENCES location_types(id)
    )`);

    // Business Types table
    db.run(`CREATE TABLE IF NOT EXISTS business_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Business Type Assignments table
    db.run(`CREATE TABLE IF NOT EXISTS business_type_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER,
      location_id INTEGER,
      sub_location_id INTEGER,
      business_type_id INTEGER,
      business_unit_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (country_id) REFERENCES countries(id),
      FOREIGN KEY (location_id) REFERENCES location_types(id),
      FOREIGN KEY (sub_location_id) REFERENCES sub_location_types(id),
      FOREIGN KEY (business_type_id) REFERENCES business_types(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating business_type_assignments table:', err);
      } else {
        // Try to add unique constraint if it doesn't exist
        db.run(`ALTER TABLE business_type_assignments ADD CONSTRAINT unique_assignment UNIQUE(country_id, location_id, sub_location_id, business_type_id)`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.log('Unique constraint may already exist or table has data');
          }
        });
      }
    });

    // Audit Log table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      manager_module TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE audit_logs ADD COLUMN manager_module TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('manager_module column may already exist');
      }
    });

    // Item Categories table
    db.run(`CREATE TABLE IF NOT EXISTS item_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      serial_number TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Item Units table
    db.run(`CREATE TABLE IF NOT EXISTS item_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      serial_number TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Item Subcategories table
    db.run(`CREATE TABLE IF NOT EXISTS item_subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      item_category_id INTEGER,
      serial_number TEXT UNIQUE,
      is_equipment INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_category_id) REFERENCES item_categories(id),
      UNIQUE(name, item_category_id)
    )`, (err) => {
      if (err) {
        console.error('Error creating item_subcategories table:', err);
      } else {
        db.run(`ALTER TABLE item_subcategories ADD COLUMN is_equipment INTEGER DEFAULT 0`, [], (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding is_equipment column:', err);
          }
        });
      }
    });

    // Item Types table
    db.run(`CREATE TABLE IF NOT EXISTS item_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      item_category_id INTEGER,
      item_subcategory_id INTEGER,
      item_unit_id INTEGER,
      serial_number TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_category_id) REFERENCES item_categories(id),
      FOREIGN KEY (item_subcategory_id) REFERENCES item_subcategories(id),
      FOREIGN KEY (item_unit_id) REFERENCES item_units(id),
      UNIQUE(name, item_category_id)
    )`);

    // Suppliers table
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating suppliers table:', err);
      else console.log('Suppliers table initialized');
    });

    // Supplier Assignments table
    db.run(`CREATE TABLE IF NOT EXISTS supplier_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      business_type_assignment_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (business_type_assignment_id) REFERENCES business_type_assignments(id)
    )`);

    // Equipment Write-offs table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_write_offs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      write_off_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      requested_by TEXT,
      approved_by TEXT,
      approval_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Equipment Write-off Photos table
    db.run(`CREATE TABLE IF NOT EXISTS equipment_write_off_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      write_off_id INTEGER NOT NULL,
      photo_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (write_off_id) REFERENCES equipment_write_offs(id) ON DELETE CASCADE
    )`);

    // Equipment Returns table (return to supplier)
    db.run(`CREATE TABLE IF NOT EXISTS equipment_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      supplier_name TEXT,
      return_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      requested_by TEXT,
      approved_by TEXT,
      approval_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    // Drop old user/permission tables (replaced by module managers)
    db.run(`DROP TABLE IF EXISTS delete_permission_requests`);
    db.run(`DROP TABLE IF EXISTS delete_permissions`);
    db.run(`DROP TABLE IF EXISTS users`);

    // Module managers (can have multiple per module)
    db.run(`CREATE TABLE IF NOT EXISTS module_managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      module_name TEXT NOT NULL,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating module_managers table:', err);
      } else {
        // Add password_hash column if upgrading an existing database
        db.run(`ALTER TABLE module_managers ADD COLUMN password_hash TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding password_hash column:', err);
          }
        });
        db.run(`ALTER TABLE module_managers ADD COLUMN login_id TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding login_id column:', err);
          }
          db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_module_managers_login_id ON module_managers(login_id) WHERE login_id IS NOT NULL`, (err) => {
            if (err) console.error('Error creating login_id index:', err);
          });
        });
        db.run(`INSERT OR IGNORE INTO module_managers (name, module_name) VALUES ('HR Manager', 'hr')`);
        db.run(`INSERT OR IGNORE INTO module_managers (name, module_name) VALUES ('Equipment Manager', 'equipment')`);
        db.run(`INSERT OR IGNORE INTO module_managers (name, module_name) VALUES ('Admin', 'admin')`);
        db.run(`INSERT OR IGNORE INTO module_managers (name, module_name) VALUES ('Catering Manager', 'catering')`);
        // Set default admin password if not already set
        const adminPassword = 'admin';
        bcrypt.hash(adminPassword, 10, (err, hash) => {
          if (err) {
            console.error('Error hashing admin password:', err);
            return;
          }
          db.run(`UPDATE module_managers SET password_hash = ? WHERE name = 'Admin' AND password_hash IS NULL`, [hash]);
        });
      }
    });

    // Migration: remove UNIQUE constraint on module_name (SQLite requires table rebuild)
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='module_managers'", (err, row) => {
      if (err || !row) return;
      if (row.sql.includes('module_name TEXT NOT NULL UNIQUE')) {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          db.run('CREATE TABLE module_managers_new (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, module_name TEXT NOT NULL, password_hash TEXT, login_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
          db.run('INSERT INTO module_managers_new (id, name, module_name, password_hash, login_id, created_at) SELECT id, name, module_name, password_hash, login_id, created_at FROM module_managers');
          db.run('DROP TABLE module_managers');
          db.run('ALTER TABLE module_managers_new RENAME TO module_managers');
          db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_module_managers_login_id ON module_managers(login_id) WHERE login_id IS NOT NULL');
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error in module_managers migration:', err);
              db.run('ROLLBACK');
            } else {
              console.log('module_managers table migrated: removed UNIQUE constraint on module_name');
            }
          });
        });
      }
    });

    // Sessions table (persistent store so logins survive server restarts)
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating sessions table:', err);
      else {
        db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)`, (err) => {
          if (err) console.error('Error creating sessions index:', err);
        });
      }
    });

    // Per-table add/edit/delete permissions for each module manager
    db.run(`CREATE TABLE IF NOT EXISTS module_table_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_manager_id INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      can_add INTEGER DEFAULT 1,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      UNIQUE(module_manager_id, table_name),
      FOREIGN KEY (module_manager_id) REFERENCES module_managers(id) ON DELETE CASCADE
    )`, (err) => {
      if (!err) {
        db.run(`ALTER TABLE module_table_permissions ADD COLUMN can_add INTEGER DEFAULT 1`, (e) => {
          if (e && !e.message.includes('duplicate column')) console.error('Migration can_add:', e.message);
        });
      }
    });

    // Per-tab/subtab permissions (view and actions) for each module manager
    db.run(`CREATE TABLE IF NOT EXISTS module_tab_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_manager_id INTEGER NOT NULL,
      module_name TEXT NOT NULL,
      tab_key TEXT NOT NULL,
      subtab_key TEXT NOT NULL DEFAULT '',
      can_view INTEGER DEFAULT 1,
      can_add INTEGER DEFAULT 1,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      UNIQUE(module_manager_id, module_name, tab_key, subtab_key),
      FOREIGN KEY (module_manager_id) REFERENCES module_managers(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating module_tab_permissions table:', err);
      } else {
        // Migration: add action columns if they don't exist
        ['can_add', 'can_edit', 'can_delete'].forEach(col => {
          db.run(`ALTER TABLE module_tab_permissions ADD COLUMN ${col} INTEGER DEFAULT 0`, (e) => {
            if (e && !e.message.includes('duplicate column')) console.error(`Migration ${col}:`, e.message);
          });
        });
      }
    });

    // Location-based access filters for equipment managers
    db.run(`CREATE TABLE IF NOT EXISTS module_manager_location_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_manager_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      UNIQUE(module_manager_id, location_id),
      FOREIGN KEY (module_manager_id) REFERENCES module_managers(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) console.error('Error creating module_manager_location_filters table:', err);
    });

    // Column visibility permissions per module manager
    db.run(`CREATE TABLE IF NOT EXISTS module_manager_column_visibility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_manager_id INTEGER NOT NULL,
      module_name TEXT NOT NULL,
      tab_key TEXT NOT NULL,
      column_key TEXT NOT NULL,
      is_visible INTEGER DEFAULT 1,
      UNIQUE(module_manager_id, tab_key, column_key),
      FOREIGN KEY (module_manager_id) REFERENCES module_managers(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) console.error('Error creating module_manager_column_visibility table:', err);
    });

    // Cancel pending maintenance logs for approved write-offs
    db.run(`UPDATE maintenance_logs
            SET maintenance_status = 'Cancelled due to write off',
                description = COALESCE(description, '') || CASE WHEN COALESCE(description, '') = '' THEN '' ELSE ' ' END || '(Cancelled due to write off)'
            WHERE equipment_id IN (SELECT equipment_id FROM equipment_write_offs WHERE status = 'Approved')
              AND LOWER(maintenance_status) NOT IN ('completed', 'cancelled', 'cancelled due to write off')`,
      [], (err) => {
      if (err) {
        console.error('Error cancelling maintenance logs for approved write-offs:', err);
      } else {
        console.log('Maintenance logs for approved write-offs checked');
      }
    });

    console.log('Database tables initialized');
    migrateRedundantData();
  });
}

function migrateRedundantData() {
  db.serialize(() => {

    // ─── 1. Supplier text → supplier_id FK in 6 tables ───
    const supplierTables = [
      { table: 'spare_parts', textCol: 'supplier', fkCol: 'supplier_id' },
      { table: 'spare_part_transactions', textCol: 'supplier', fkCol: 'supplier_id' },
      { table: 'parts_purchases', textCol: 'supplier_name', fkCol: 'supplier_id' },
      { table: 'equipment_purchases', textCol: 'supplier_name', fkCol: 'supplier_id' },
      { table: 'kitchen_purchases', textCol: 'supplier_name', fkCol: 'supplier_id' },
      { table: 'uniform_purchases', textCol: 'supplier_name', fkCol: 'supplier_id' }
    ];

    supplierTables.forEach(({ table, textCol, fkCol }) => {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${fkCol} INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error(`Error adding ${fkCol} to ${table}:`, err.message);
        } else {
          // Create missing suppliers from text values, then update FK
          db.run(`INSERT OR IGNORE INTO suppliers (name) SELECT DISTINCT TRIM(${textCol}) FROM ${table} WHERE ${textCol} IS NOT NULL AND ${textCol} != ''`, (err) => {
            if (err) { console.error(`Error inserting suppliers from ${table}:`, err.message); return; }
            db.run(`UPDATE ${table} SET ${fkCol} = (SELECT id FROM suppliers WHERE LOWER(suppliers.name) = LOWER(TRIM(${table}.${textCol}))) WHERE ${textCol} IS NOT NULL AND ${textCol} != ''`, (err) => {
              if (err) console.error(`Error migrating ${fkCol} in ${table}:`, err.message);
              else console.log(`Migrated supplier FK in ${table}`);
            });
          });
        }
      });
    });

    // ─── 2. spare_parts.location text → location_id FK ───
    db.run(`ALTER TABLE spare_parts ADD COLUMN location_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding location_id to spare_parts:', err.message);
      } else {
        db.run(`UPDATE spare_parts SET location_id = (SELECT id FROM locations WHERE locations.name = spare_parts.location) WHERE location IS NOT NULL AND location != ''`, (err) => {
          if (err) console.error('Error migrating location_id in spare_parts:', err.message);
          else console.log('Migrated location_id in spare_parts');
        });
      }
    });

    // ─── 3. Equipment condition text → condition_id FK ───
    db.run(`ALTER TABLE equipment ADD COLUMN condition_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding condition_id to equipment:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO equipment_conditions (name) SELECT DISTINCT condition FROM equipment WHERE condition IS NOT NULL AND condition != ''`, (err) => {
          if (err) { console.error('Error inserting equipment_conditions:', err.message); return; }
          db.run(`UPDATE equipment SET condition_id = (SELECT id FROM equipment_conditions WHERE equipment_conditions.name = equipment.condition) WHERE condition IS NOT NULL AND condition != ''`, (err) => {
            if (err) console.error('Error migrating condition_id:', err.message);
            else console.log('Migrated condition_id in equipment');
          });
        });
      }
    });

    // ─── 4. Equipment status text → status_id FK ───
    db.run(`ALTER TABLE equipment ADD COLUMN status_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding status_id to equipment:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO equipment_statuses (name) SELECT DISTINCT TRIM(status) FROM equipment WHERE status IS NOT NULL AND status != ''`, (err) => {
          if (err) { console.error('Error inserting equipment_statuses:', err.message); return; }
          db.run(`UPDATE equipment SET status_id = (SELECT id FROM equipment_statuses WHERE LOWER(equipment_statuses.name) = LOWER(TRIM(equipment.status))) WHERE status IS NOT NULL AND status != ''`, (err) => {
            if (err) console.error('Error migrating status_id:', err.message);
            else console.log('Migrated status_id in equipment');
          });
        });
      }
    });

    // ─── 5. Employees department text → department_id FK ───
    db.run(`ALTER TABLE employees ADD COLUMN department_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding department_id to employees:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO departments (name) SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != ''`, (err) => {
          if (err) { console.error('Error inserting departments:', err.message); return; }
          db.run(`UPDATE employees SET department_id = (SELECT id FROM departments WHERE departments.name = employees.department) WHERE department IS NOT NULL AND department != ''`, (err) => {
            if (err) console.error('Error migrating department_id:', err.message);
            else console.log('Migrated department_id in employees');
          });
        });
      }
    });

    // ─── 6. Employees position text → position_id FK ───
    db.run(`ALTER TABLE employees ADD COLUMN position_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding position_id to employees:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO positions (name) SELECT DISTINCT position FROM employees WHERE position IS NOT NULL AND position != ''`, (err) => {
          if (err) { console.error('Error inserting positions:', err.message); return; }
          db.run(`UPDATE employees SET position_id = (SELECT id FROM positions WHERE positions.name = employees.position) WHERE position IS NOT NULL AND position != ''`, (err) => {
            if (err) console.error('Error migrating position_id:', err.message);
            else console.log('Migrated position_id in employees');
          });
        });
      }
    });

    // ─── 7. Employees status text → employee_status_id FK ───
    db.run(`ALTER TABLE employees ADD COLUMN employee_status_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding employee_status_id to employees:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO employee_statuses (name) SELECT DISTINCT status FROM employees WHERE status IS NOT NULL AND status != ''`, (err) => {
          if (err) { console.error('Error inserting employee_statuses:', err.message); return; }
          db.run(`UPDATE employees SET employee_status_id = (SELECT id FROM employee_statuses WHERE employee_statuses.name = employees.status) WHERE status IS NOT NULL AND status != ''`, (err) => {
            if (err) console.error('Error migrating employee_status_id:', err.message);
            else console.log('Migrated employee_status_id in employees');
          });
        });
      }
    });

    // ─── 8. Employees nationality text → nationality_id FK ───
    db.run(`ALTER TABLE employees ADD COLUMN nationality_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding nationality_id to employees:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO nationalities (name) SELECT DISTINCT nationality FROM employees WHERE nationality IS NOT NULL AND nationality != ''`, (err) => {
          if (err) { console.error('Error inserting nationalities:', err.message); return; }
          db.run(`UPDATE employees SET nationality_id = (SELECT id FROM nationalities WHERE nationalities.name = employees.nationality) WHERE nationality IS NOT NULL AND nationality != ''`, (err) => {
            if (err) console.error('Error migrating nationality_id:', err.message);
            else console.log('Migrated nationality_id in employees');
          });
        });
      }
    });

    // ─── 9. Employees remuneration_type text → remuneration_type_id FK ───
    db.run(`ALTER TABLE employees ADD COLUMN remuneration_type_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding remuneration_type_id to employees:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO remuneration_types (name) SELECT DISTINCT remuneration_type FROM employees WHERE remuneration_type IS NOT NULL AND remuneration_type != ''`, (err) => {
          if (err) { console.error('Error inserting remuneration_types:', err.message); return; }
          db.run(`UPDATE employees SET remuneration_type_id = (SELECT id FROM remuneration_types WHERE remuneration_types.name = employees.remuneration_type) WHERE remuneration_type IS NOT NULL AND remuneration_type != ''`, (err) => {
            if (err) console.error('Error migrating remuneration_type_id:', err.message);
            else console.log('Migrated remuneration_type_id in employees');
          });
        });
      }
    });

    // ─── 10. uniform_distributions staff → employee_id FK ───
    db.run(`ALTER TABLE uniform_distributions ADD COLUMN employee_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding employee_id to uniform_distributions:', err.message);
      } else {
        // Try to match by staff_id (employee_id text field) or staff_name
        db.run(`UPDATE uniform_distributions SET employee_id = (SELECT id FROM employees WHERE employees.employee_id = uniform_distributions.staff_id) WHERE staff_id IS NOT NULL AND staff_id != ''`, (err) => {
          if (err) console.error('Error migrating employee_id in uniform_distributions:', err.message);
          else console.log('Migrated employee_id in uniform_distributions');
        });
      }
    });

    // ─── 11. kitchen_deliveries received_by → employee_id FK ───
    db.run(`ALTER TABLE kitchen_deliveries ADD COLUMN employee_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding employee_id to kitchen_deliveries:', err.message);
      } else {
        // Try to match by name (first_name + ' ' + last_name)
        db.run(`UPDATE kitchen_deliveries SET employee_id = (SELECT id FROM employees WHERE (employees.first_name || ' ' || employees.last_name) = kitchen_deliveries.received_by) WHERE received_by IS NOT NULL AND received_by != ''`, (err) => {
          if (err) console.error('Error migrating employee_id in kitchen_deliveries:', err.message);
          else console.log('Migrated employee_id in kitchen_deliveries');
        });
      }
    });

    // ─── 12. maintenance_logs performed_by / requested_by → employee_id FKs ───
    db.run(`ALTER TABLE maintenance_logs ADD COLUMN performed_by_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding performed_by_id to maintenance_logs:', err.message);
      } else {
        db.run(`UPDATE maintenance_logs SET performed_by_id = (SELECT id FROM employees WHERE (employees.first_name || ' ' || employees.last_name) = maintenance_logs.performed_by) WHERE performed_by IS NOT NULL AND performed_by != ''`, (err) => {
          if (err) console.error('Error migrating performed_by_id in maintenance_logs:', err.message);
          else console.log('Migrated performed_by_id in maintenance_logs');
        });
      }
    });

    db.run(`ALTER TABLE maintenance_logs ADD COLUMN requested_by_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding requested_by_id to maintenance_logs:', err.message);
      } else {
        db.run(`UPDATE maintenance_logs SET requested_by_id = (SELECT id FROM employees WHERE (employees.first_name || ' ' || employees.last_name) = maintenance_logs.requested_by) WHERE requested_by IS NOT NULL AND requested_by != ''`, (err) => {
          if (err) console.error('Error migrating requested_by_id in maintenance_logs:', err.message);
          else console.log('Migrated requested_by_id in maintenance_logs');
        });
      }
    });

    // ─── 13. Remove spare_parts.po_number (duplicate of purchase_order_number) ───
    // Copy po_number data to purchase_order_number if purchase_order_number is empty
    db.run(`UPDATE spare_parts SET purchase_order_number = po_number WHERE (purchase_order_number IS NULL OR purchase_order_number = '') AND po_number IS NOT NULL AND po_number != ''`, (err) => {
      if (err) console.error('Error consolidating po_number:', err.message);
      else console.log('Consolidated spare_parts po_number into purchase_order_number');
    });

    // ─── 13. Migrate equipment.photo_path to equipment_photos table ───
    db.run(`INSERT OR IGNORE INTO equipment_photos (equipment_id, photo_path) SELECT id, photo_path FROM equipment WHERE photo_path IS NOT NULL AND photo_path != '' AND id NOT IN (SELECT equipment_id FROM equipment_photos)`, (err) => {
      if (err) console.error('Error migrating equipment photos:', err.message);
      else console.log('Migrated equipment.photo_path to equipment_photos table');
    });

    console.log('Database redundancy migration completed');

    // ─── Catering Management Tables ───
    
    // Recipe Categories
    db.run(`CREATE TABLE IF NOT EXISTS recipe_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Recipes
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT,
      instructions TEXT,
      default_portions INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES recipe_categories(id)
    )`);

    // Recipe Ingredients (junction table)
    db.run(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
      UNIQUE(recipe_id, ingredient_id)
    )`);

    // Ingredients
    db.run(`CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_item_id INTEGER,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE ingredients ADD COLUMN warehouse_item_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding warehouse_item_id to ingredients:', err.message);
      }
    });

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_warehouse_item_id ON ingredients(warehouse_item_id)`);

    // Menus
    db.run(`CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Menu Recipes (junction table)
    db.run(`CREATE TABLE IF NOT EXISTS menu_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      portions INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(menu_id, recipe_id)
    )`);

    // Menu Assignments (assign menus to locations)
    db.run(`CREATE TABLE IF NOT EXISTS menu_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      effective_date DATE NOT NULL,
      end_date DATE,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
--      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
      UNIQUE(menu_id, location_id, effective_date)
    )`);

    // Sales
    db.run(`CREATE TABLE IF NOT EXISTS catering_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      sale_date DATE NOT NULL,
      quantity INTEGER NOT NULL,
      total_cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--      FOREIGN KEY (menu_id) REFERENCES menus(id),
--      FOREIGN KEY (recipe_id) REFERENCES recipes(id),
--      FOREIGN KEY (location_id) REFERENCES locations(id)
      created_by INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ingredient_stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )`);

    // Catering Deployments
    db.run(`CREATE TABLE IF NOT EXISTS catering_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      from_location_id INTEGER,
      to_location_id INTEGER NOT NULL,
      deploy_date DATE NOT NULL,
      return_date DATE,
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--      FOREIGN KEY (employee_id) REFERENCES employees(id),
--      FOREIGN KEY (from_location_id) REFERENCES locations(id),
--      FOREIGN KEY (to_location_id) REFERENCES locations(id)
      created_by INTEGER
    )`);

    console.log('Catering Management tables created');

    // Final cleanup: merge duplicate lookup values and enforce uniqueness
    dedupeEquipmentStatuses(() => {
      dedupeSuppliers(() => {
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_statuses_name_lower ON equipment_statuses(LOWER(name))`, (err) => {
          if (err) console.error('Error creating equipment_statuses unique index:', err.message);
        });
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name_lower ON suppliers(LOWER(name))`, (err) => {
          if (err) console.error('Error creating suppliers unique index:', err.message);
        });

        // Performance indexes for equipment list query
        const perfIndexes = [
          'CREATE INDEX IF NOT EXISTS idx_equipment_location_id ON equipment(location_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_assigned_to ON equipment(assigned_to)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_status_id ON equipment(status_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_condition_id ON equipment(condition_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_owner_id ON equipment(owner_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_supplier_id ON equipment(supplier_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_id ON equipment(catalog_id)',
          'CREATE INDEX IF NOT EXISTS idx_maintenance_logs_equipment_id ON maintenance_logs(equipment_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_transfers_equipment_id ON equipment_transfers(equipment_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_photos_equipment_id ON equipment_photos(equipment_id)',
          'CREATE INDEX IF NOT EXISTS idx_equipment_write_offs_equipment_id ON equipment_write_offs(equipment_id)',
          'CREATE INDEX IF NOT EXISTS idx_business_type_assignments_country_loc ON business_type_assignments(country_id, location_id)',
        ];
        perfIndexes.forEach(idx => db.run(idx, (err) => {
          if (err && !err.message.includes('already exists')) console.error('Index error:', err.message);
        }));

        // Sync catering ingredients from warehouse items
        syncCateringIngredientsFromItems();
      });
    });
  });
}

function syncCateringIngredientsFromItems(callback) {
  db.all(`SELECT i.id as warehouse_item_id, i.name, iu.name as unit
          FROM items i
          LEFT JOIN item_categories ic ON i.category_id = ic.id
          LEFT JOIN item_subcategories isc ON i.subcategory_id = isc.id
          LEFT JOIN item_units iu ON i.unit_id = iu.id
          WHERE LOWER(ic.name) = 'catering' AND LOWER(isc.name) = 'ingredients'`, (err, items) => {
    if (err) {
      console.error('Error loading catering items for sync:', err.message);
      if (callback) callback();
      return;
    }

    let pending = items.length;
    if (pending === 0) {
      if (callback) callback();
      return;
    }

    items.forEach(item => {
      db.get('SELECT id FROM ingredients WHERE warehouse_item_id = ?', [item.warehouse_item_id], (err2, row) => {
        if (err2) {
          console.error('Error checking ingredient:', err2.message);
        } else if (row) {
          db.run('UPDATE ingredients SET name = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [item.name || '', item.unit || '', row.id]);
        } else {
          // Try to link an existing manual ingredient with the same name
          db.get('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?) AND warehouse_item_id IS NULL', [item.name], (err3, existing) => {
            if (err3) {
              console.error('Error checking existing ingredient:', err3.message);
            } else if (existing) {
              db.run('UPDATE ingredients SET warehouse_item_id = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [item.warehouse_item_id, item.unit || '', existing.id]);
            } else {
              db.run('INSERT INTO ingredients (warehouse_item_id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (?, ?, ?, 0, 0, 0)',
                [item.warehouse_item_id, item.name || '', item.unit || '']);
            }
          });
        }
        pending--;
        if (pending === 0 && callback) callback();
      });
    });
  });
}

module.exports = { db, syncCateringIngredientsFromItems };
