const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// ─── Recipe Categories ───
router.get('/recipe-categories', (req, res) => {
  db.all('SELECT * FROM recipe_categories ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/recipe-categories', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO recipe_categories (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/recipe-categories/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE recipe_categories SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Category updated' });
  });
});

router.delete('/recipe-categories/:id', (req, res) => {
  db.run('DELETE FROM recipe_categories WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Category deleted' });
  });
});

// ─── Recipes ───
router.get('/recipes', (req, res) => {
  db.all(`SELECT r.*, rc.name as category_name 
          FROM recipes r 
          LEFT JOIN recipe_categories rc ON r.category_id = rc.id 
          ORDER BY r.name`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/recipes/:id', (req, res) => {
  db.get(`SELECT r.*, rc.name as category_name 
          FROM recipes r 
          LEFT JOIN recipe_categories rc ON r.category_id = rc.id 
          WHERE r.id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Recipe not found' });
    
    // Get recipe ingredients
    db.all(`SELECT ri.*, i.name as ingredient_name, i.unit 
            FROM recipe_ingredients ri 
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id 
            WHERE ri.recipe_id = ?`, [req.params.id], (err, ingredients) => {
      if (err) return res.status(500).json({ error: err.message });
      row.ingredients = ingredients;
      res.json(row);
    });
  });
});

router.post('/recipes', (req, res) => {
  const { name, category_id, description, instructions, default_portions, ingredients } = req.body;
  db.run('INSERT INTO recipes (name, category_id, description, instructions, default_portions) VALUES (?, ?, ?, ?, ?)', 
    [name, category_id, description, instructions, default_portions], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const recipeId = this.lastID;
    
    // Add ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      const stmt = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');
      ingredients.forEach(ing => {
        stmt.run(recipeId, ing.ingredient_id, ing.quantity, ing.unit);
      });
      stmt.finalize();
    }
    
    res.json({ id: recipeId, message: 'Recipe created' });
  });
});

router.put('/recipes/:id', (req, res) => {
  const { name, category_id, description, instructions, default_portions, ingredients } = req.body;
  db.run('UPDATE recipes SET name = ?, category_id = ?, description = ?, instructions = ?, default_portions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name, category_id, description, instructions, default_portions, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Update ingredients - delete old and add new
    db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (ingredients && Array.isArray(ingredients)) {
        const stmt = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');
        ingredients.forEach(ing => {
          stmt.run(req.params.id, ing.ingredient_id, ing.quantity, ing.unit);
        });
        stmt.finalize();
      }
    });
    
    res.json({ message: 'Recipe updated' });
  });
});

router.delete('/recipes/:id', (req, res) => {
  db.run('DELETE FROM recipes WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Recipe deleted' });
  });
});

// ─── Ingredients ───
router.get('/ingredients', (req, res) => {
  db.all('SELECT * FROM ingredients ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/ingredients', (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  const trimmedName = (name || '').trim();
  if (!trimmedName) return res.status(400).json({ error: 'Ingredient name is required' });
  
  db.get('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)', [trimmedName], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'An ingredient with this name already exists' });
    
    db.run('INSERT INTO ingredients (name, unit, current_stock, min_stock, cost_per_unit) VALUES (?, ?, ?, ?, ?)', 
      [trimmedName, unit, current_stock || 0, min_stock || 0, cost_per_unit || 0], function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'An ingredient with this name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      const ingredientId = this.lastID;
      if (current_stock > 0) {
        db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
          [ingredientId, 'add', current_stock, 'manual', 'Initial stock']);
      }
      res.json({ id: ingredientId, name: trimmedName, unit, current_stock, min_stock, cost_per_unit });
    });
  });
});

router.put('/ingredients/:id', (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  const trimmedName = (name || '').trim();
  if (!trimmedName) return res.status(400).json({ error: 'Ingredient name is required' });
  
  db.get('SELECT current_stock FROM ingredients WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Ingredient not found' });
    
    db.get('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?) AND id != ?', [trimmedName, req.params.id], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: 'An ingredient with this name already exists' });
      
      const oldStock = row.current_stock || 0;
      const newStock = parseFloat(current_stock) || 0;
      const delta = newStock - oldStock;
      
      db.run('UPDATE ingredients SET name = ?, unit = ?, current_stock = ?, min_stock = ?, cost_per_unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [trimmedName, unit, current_stock, min_stock, cost_per_unit, req.params.id], function(err) {
        if (err) {
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'An ingredient with this name already exists' });
          }
          return res.status(500).json({ error: err.message });
        }
        
        if (delta !== 0) {
          db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, delta > 0 ? 'add' : 'subtract', Math.abs(delta), 'manual', 'Stock adjustment']);
        }
        
        res.json({ message: 'Ingredient updated' });
      });
    });
  });
});

router.get('/ingredients/:id/transactions', (req, res) => {
  db.all('SELECT * FROM ingredient_stock_transactions WHERE ingredient_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
router.get('/menus', (req, res) => {
  db.all(`SELECT m.*, 
          (SELECT COUNT(*) FROM menu_recipes WHERE menu_id = m.id) as recipe_count 
          FROM menus m ORDER BY m.name`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/menus/:id', (req, res) => {
  db.get('SELECT * FROM menus WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Menu not found' });
    
    // Get menu recipes
    db.all(`SELECT mr.*, r.name as recipe_name 
            FROM menu_recipes mr 
            LEFT JOIN recipes r ON mr.recipe_id = r.id 
            WHERE mr.menu_id = ?`, [req.params.id], (err, recipes) => {
      if (err) return res.status(500).json({ error: err.message });
      row.recipes = recipes;
      res.json(row);
    });
  });
});

router.post('/menus', (req, res) => {
  const { name, description, recipes } = req.body;
  db.run('INSERT INTO menus (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const menuId = this.lastID;
    
    // Add recipes if provided
    if (recipes && Array.isArray(recipes)) {
      const stmt = db.prepare('INSERT INTO menu_recipes (menu_id, recipe_id, portions) VALUES (?, ?, ?)');
      recipes.forEach(rec => {
        stmt.run(menuId, rec.recipe_id, rec.portions || 1);
      });
      stmt.finalize();
    }
    
    res.json({ id: menuId, message: 'Menu created' });
  });
});

router.put('/menus/:id', (req, res) => {
  const { name, description, recipes } = req.body;
  db.run('UPDATE menus SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name, description, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Update recipes - delete old and add new
    db.run('DELETE FROM menu_recipes WHERE menu_id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (recipes && Array.isArray(recipes)) {
        const stmt = db.prepare('INSERT INTO menu_recipes (menu_id, recipe_id, portions) VALUES (?, ?, ?)');
        recipes.forEach(rec => {
          stmt.run(req.params.id, rec.recipe_id, rec.portions || 1);
        });
        stmt.finalize();
      }
    });
    
    res.json({ message: 'Menu updated' });
  });
});

router.delete('/menus/:id', (req, res) => {
  db.run('DELETE FROM menus WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Menu deleted' });
  });
});

// ─── Menu Assignments ───
router.get('/menu-assignments', (req, res) => {
  db.all(`SELECT ma.*, m.name as menu_name, l.name as location_name 
          FROM menu_assignments ma 
          LEFT JOIN menus m ON ma.menu_id = m.id 
          LEFT JOIN locations l ON ma.location_id = l.id 
          ORDER BY ma.effective_date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/menu-assignments', (req, res) => {
  const { menu_id, location_id, effective_date, end_date, status } = req.body;
  db.run('INSERT INTO menu_assignments (menu_id, location_id, effective_date, end_date, status) VALUES (?, ?, ?, ?, ?)', 
    [menu_id, location_id, effective_date, end_date, status || 'Active'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Menu assignment created' });
  });
});

router.delete('/menu-assignments/:id', (req, res) => {
  db.run('DELETE FROM menu_assignments WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Menu assignment deleted' });
  });
});

// ─── Sales ───
router.get('/sales', (req, res) => {
  db.all(`SELECT cs.*, c.name as country_name, lt.name as location_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code, r.name as recipe_name 
          FROM catering_sales cs 
          LEFT JOIN recipes r ON cs.recipe_id = r.id 
          LEFT JOIN business_type_assignments bta ON cs.location_id = bta.id 
          LEFT JOIN countries c ON bta.country_id = c.id 
          LEFT JOIN location_types lt ON bta.location_id = lt.id 
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id 
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id 
          ORDER BY cs.sale_date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/sales', (req, res) => {
  const { location_id, sale_date, items } = req.body;
  
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one dish is required' });
  }
  if (!location_id || !sale_date) {
    return res.status(400).json({ error: 'Location and sale date are required' });
  }
  
  const recipeIds = items.map(i => i.recipe_id);
  const placeholders = recipeIds.map(() => '?').join(',');
  
  db.all(`SELECT ri.recipe_id, ri.ingredient_id, ri.quantity, i.current_stock, i.cost_per_unit
          FROM recipe_ingredients ri
          LEFT JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.recipe_id IN (${placeholders})`, recipeIds, (err, ingredients) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Aggregate required quantities and costs
    const requiredByIngredient = {};
    const itemCosts = {};
    
    for (const item of items) {
      const itemIngs = ingredients.filter(ing => ing.recipe_id == item.recipe_id);
      let itemCost = 0;
      for (const ing of itemIngs) {
        const required = ing.quantity * item.quantity;
        requiredByIngredient[ing.ingredient_id] = (requiredByIngredient[ing.ingredient_id] || 0) + required;
        itemCost += ing.quantity * (ing.cost_per_unit || 0) * item.quantity;
      }
      itemCosts[item.recipe_id] = itemCost;
    }
    
    // Check stock availability
    for (const item of items) {
      const itemIngs = ingredients.filter(ing => ing.recipe_id == item.recipe_id);
      for (const ing of itemIngs) {
        const required = ing.quantity * item.quantity;
        if ((ing.current_stock || 0) < required) {
          return res.status(400).json({ error: `Insufficient stock for ingredient ID ${ing.ingredient_id}` });
        }
      }
    }
    
    // Insert sale records (one per dish), then deduct stock and log transactions
    let pendingInserts = items.length;
    const saleIds = [];
    let insertError = null;
    
    function afterInserts() {
      if (insertError) return res.status(500).json({ error: insertError });
      
      // Deduct stock and log transactions
      let pendingUpdates = 0;
      for (const [ingredientId, quantity] of Object.entries(requiredByIngredient)) {
        pendingUpdates += 2;
        db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [ingredientId, 'subtract', quantity, 'sale', saleIds[0], 'Sale recorded']);
        db.run('UPDATE ingredients SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, ingredientId], (err) => {
            if (err) insertError = err.message;
            pendingUpdates--;
            if (pendingUpdates === 0) {
              if (insertError) return res.status(500).json({ error: insertError });
              res.json({ message: 'Sale recorded, stock updated' });
            }
          });
      }
      if (pendingUpdates === 0) {
        res.json({ message: 'Sale recorded, stock updated' });
      }
    }
    
    for (const item of items) {
      db.run('INSERT INTO catering_sales (menu_id, recipe_id, location_id, sale_date, quantity, total_cost, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [0, item.recipe_id, location_id, sale_date, item.quantity, itemCosts[item.recipe_id] || 0, req.session.userId], function(err) {
          if (err) insertError = err.message;
          else saleIds.push(this.lastID);
          pendingInserts--;
          if (pendingInserts === 0) afterInserts();
        });
    }
  });
});

router.delete('/sales/:id', (req, res) => {
  // Get sale details to restore stock
  db.get('SELECT * FROM catering_sales WHERE id = ?', [req.params.id], (err, sale) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    
    // Restore stock
    db.all(`SELECT ri.ingredient_id, ri.quantity 
            FROM recipe_ingredients ri 
            WHERE ri.recipe_id = ?`, [sale.recipe_id], (err, ingredients) => {
      if (err) return res.status(500).json({ error: err.message });
      
      ingredients.forEach(ing => {
        const restoration = ing.quantity * sale.quantity;
        db.run('UPDATE ingredients SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          [restoration, ing.ingredient_id]);
        db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [ing.ingredient_id, 'add', restoration, 'sale_delete', sale.id, 'Sale deleted']);
      });
      
      // Delete sale record
      db.run('DELETE FROM catering_sales WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Sale deleted, stock restored' });
      });
    });
  });
});

// ─── Catering Employees ───
router.get('/employees', (req, res) => {
  db.all(`SELECT e.id, e.employee_id, e.first_name, e.last_name, p.name as position, 
          es.name as status,
          c.name as country_name,
          lt.name as location_type_name,
          slt.name as sub_location_name,
          bt.name as business_type_name,
          bta.business_unit_code
          FROM employees e 
          LEFT JOIN positions p ON e.position_id = p.id 
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          LEFT JOIN employee_statuses es ON e.employee_status_id = es.id 
          WHERE (e.is_terminated = 0 OR e.is_terminated IS NULL)
            AND e.department_id IN (SELECT id FROM departments WHERE LOWER(name) LIKE '%catering%')
          ORDER BY e.first_name, e.last_name`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─── Catering Deployments ───
router.get('/deployments', (req, res) => {
  db.all(`SELECT cd.*, 
          (e.first_name || ' ' || e.last_name) as employee_name,
          l1.name as from_location,
          l2.name as to_location 
          FROM catering_deployments cd 
          LEFT JOIN employees e ON cd.employee_id = e.id 
          LEFT JOIN locations l1 ON cd.from_location_id = l1.id 
          LEFT JOIN locations l2 ON cd.to_location_id = l2.id 
          ORDER BY cd.deploy_date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/deployments', (req, res) => {
  const { employee_id, from_location_id, to_location_id, deploy_date, return_date, notes, created_by } = req.body;
  db.run('INSERT INTO catering_deployments (employee_id, from_location_id, to_location_id, deploy_date, return_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [employee_id, from_location_id, to_location_id, deploy_date, return_date, notes, created_by], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Deployment created' });
  });
});

router.put('/deployments/:id/complete', (req, res) => {
  const { employee_id, to_location_id } = req.body;
  db.run('UPDATE catering_deployments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Completed', req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Update employee location
    db.run('UPDATE employees SET location_id = ? WHERE id = ?', [to_location_id, employee_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Deployment completed, employee location updated' });
    });
  });
});

router.delete('/deployments/:id', (req, res) => {
  db.run('DELETE FROM catering_deployments WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deployment deleted' });
  });
});

// ─── Warehouse Transfers (Catering side: receive and accept) ───

// Get pending transfers (for notification badge)
router.get('/pending-transfers', (req, res) => {
  db.all(`SELECT t.*, 
          (SELECT COUNT(*) FROM warehouse_catering_transfer_items ti WHERE ti.transfer_id = t.id AND ti.status = 'Pending') as pending_item_count
          FROM warehouse_catering_transfers t
          WHERE t.status = 'Pending'
          ORDER BY t.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get a specific transfer with items (for catering to review)
router.get('/transfers/:id', (req, res) => {
  db.get('SELECT * FROM warehouse_catering_transfers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Transfer not found' });

    db.all(`SELECT ti.*, wi.name as item_name, wi.unit as item_unit,
            ing.name as ingredient_name, ing.id as ingredient_id
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

// Accept transfer (full or with edited received quantities)
router.post('/transfers/:id/accept', (req, res) => {
  const transferId = req.params.id;
  const { items } = req.body; // array of { item_id, received_quantity }

  db.get('SELECT status FROM warehouse_catering_transfers WHERE id = ?', [transferId], (err, transfer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status !== 'Pending') return res.status(400).json({ error: 'Transfer already processed' });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items to accept' });
    }

    let pending = items.length;
    let itemError = null;

    items.forEach(item => {
      // Update transfer item with received quantity and status
      db.run('UPDATE warehouse_catering_transfer_items SET received_quantity = ?, status = ? WHERE id = ?',
        [item.received_quantity, 'Received', item.item_id], (err) => {
          if (err) { itemError = err.message; pending--; if (pending === 0) finishAccept(); return; }

          // Get the ingredient_id for this transfer item
          db.get('SELECT ingredient_id FROM warehouse_catering_transfer_items WHERE id = ?', [item.item_id], (err, row) => {
            if (err) { itemError = err.message; pending--; if (pending === 0) finishAccept(); return; }
            if (!row || !row.ingredient_id) { pending--; if (pending === 0) finishAccept(); return; }

            // Add received quantity to catering ingredient stock
            db.run('UPDATE ingredients SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [item.received_quantity, row.ingredient_id], (err) => {
                if (err) itemError = err.message;

                // Log stock transaction
                db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                  [row.ingredient_id, 'add', item.received_quantity, 'warehouse_transfer', transferId, 'Received from warehouse'], (err) => {
                    pending--;
                    if (pending === 0) finishAccept();
                  });
              });
          });
        });
    });

    function finishAccept() {
      if (itemError) return res.status(500).json({ error: itemError });

      // Mark transfer as completed
      db.run('UPDATE warehouse_catering_transfers SET status = ? WHERE id = ?',
        ['Completed', transferId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Transfer accepted, stock added to catering' });
        });
    }
  });
});

// Reject transfer
router.post('/transfers/:id/reject', (req, res) => {
  const transferId = req.params.id;
  const { reason } = req.body;

  db.get('SELECT status FROM warehouse_catering_transfers WHERE id = ?', [transferId], (err, transfer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status !== 'Pending') return res.status(400).json({ error: 'Transfer already processed' });

    // Get transfer items to return stock to warehouse
    db.all('SELECT warehouse_item_id, sent_quantity FROM warehouse_catering_transfer_items WHERE transfer_id = ?', [transferId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });

      let pending = (items || []).length;
      if (pending === 0) {
        db.run("UPDATE warehouse_catering_transfers SET status = 'Rejected' WHERE id = ?", [transferId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Transfer rejected' });
        });
        return;
      }

      items.forEach(item => {
        // Return stock to warehouse
        db.run('UPDATE warehouse_items SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.sent_quantity, item.warehouse_item_id], (err) => {
            pending--;
            if (pending === 0) {
              db.run("UPDATE warehouse_catering_transfer_items SET status = 'Rejected' WHERE transfer_id = ?", [transferId], (err) => {
                db.run("UPDATE warehouse_catering_transfers SET status = 'Rejected' WHERE id = ?", [transferId], (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  res.json({ message: 'Transfer rejected, stock returned to warehouse' });
                });
              });
            }
          });
      });
    });
  });
});

// ─── Business Unit Stock Distribution ───

// Get all business unit stock
router.get('/business-unit-stock', (req, res) => {
  db.all(`SELECT bus.*, i.name as ingredient_name, i.unit,
          bta.business_unit_code, c.name as country_name, lt.name as location_name,
          slt.name as sub_location_name, bt.name as business_type_name
          FROM catering_business_unit_stock bus
          LEFT JOIN ingredients i ON bus.ingredient_id = i.id
          LEFT JOIN business_type_assignments bta ON bus.business_type_assignment_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          ORDER BY i.name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Distribute stock to a business unit
router.post('/business-unit-stock/distribute', (req, res) => {
  const { ingredient_id, business_type_assignment_id, quantity } = req.body;
  if (!ingredient_id || !business_type_assignment_id || !quantity) {
    return res.status(400).json({ error: 'Ingredient, business unit, and quantity are required' });
  }

  // Check catering has enough stock
  db.get('SELECT current_stock, name FROM ingredients WHERE id = ?', [ingredient_id], (err, ing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ing) return res.status(404).json({ error: 'Ingredient not found' });
    if ((ing.current_stock || 0) < quantity) {
      return res.status(400).json({ error: `Insufficient catering stock for ${ing.name}. Available: ${ing.current_stock}, Requested: ${quantity}` });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Deduct from catering central stock
      db.run('UPDATE ingredients SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, ingredient_id], (err) => {
          if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

          // Log stock transaction
          db.run('INSERT INTO ingredient_stock_transactions (ingredient_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
            [ingredient_id, 'subtract', quantity, 'business_unit_distribution', 'Distributed to business unit'], (err) => {
              if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

              // Check if business unit stock record exists
              db.get('SELECT id, quantity FROM catering_business_unit_stock WHERE ingredient_id = ? AND business_type_assignment_id = ?',
                [ingredient_id, business_type_assignment_id], (err, existing) => {
                  if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

                  if (existing) {
                    // Update existing stock
                    db.run('UPDATE catering_business_unit_stock SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      [quantity, existing.id], (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                        db.run('COMMIT');
                        res.json({ message: 'Stock distributed to business unit' });
                      });
                  } else {
                    // Create new stock record
                    db.run('INSERT INTO catering_business_unit_stock (ingredient_id, business_type_assignment_id, quantity) VALUES (?, ?, ?)',
                      [ingredient_id, business_type_assignment_id, quantity], (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                        db.run('COMMIT');
                        res.json({ message: 'Stock distributed to business unit' });
                      });
                  }
                });
            });
        });
    });
  });
});

// ─── Business Unit Sales ───

// Get all business unit sales
router.get('/business-unit-sales', (req, res) => {
  const { business_type_assignment_id, from_date, to_date } = req.query;
  let query = `SELECT bus.*, r.name as recipe_name,
          bta.business_unit_code, c.name as country_name, lt.name as location_name,
          slt.name as sub_location_name, bt.name as business_type_name
          FROM catering_business_unit_sales bus
          LEFT JOIN recipes r ON bus.recipe_id = r.id
          LEFT JOIN business_type_assignments bta ON bus.business_type_assignment_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id`;
  const params = [];
  const conditions = [];

  if (business_type_assignment_id) { conditions.push('bus.business_type_assignment_id = ?'); params.push(business_type_assignment_id); }
  if (from_date) { conditions.push('bus.sale_date >= ?'); params.push(from_date); }
  if (to_date) { conditions.push('bus.sale_date <= ?'); params.push(to_date); }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY bus.sale_date DESC, bus.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a business unit sale (also deducts from business unit stock)
router.post('/business-unit-sales', (req, res) => {
  const { business_type_assignment_id, sale_date, items } = req.body;

  if (!business_type_assignment_id || !sale_date) {
    return res.status(400).json({ error: 'Business unit and sale date are required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one sale item is required' });
  }

  // Get recipe ingredients for all recipes in the sale
  const recipeIds = items.map(i => i.recipe_id).filter(id => id);
  let ingredientCheckDone = false;

  function processSale() {
    let pending = items.length;
    let saleError = null;

    items.forEach(item => {
      const totalCost = item.total_cost || 0;
      db.run('INSERT INTO catering_business_unit_sales (business_type_assignment_id, sale_date, recipe_id, quantity, total_cost, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [business_type_assignment_id, sale_date, item.recipe_id || null, item.quantity, totalCost, item.notes || '', req.session.userId || null], (err) => {
          if (err) saleError = err.message;
          pending--;
          if (pending === 0) {
            if (saleError) return res.status(500).json({ error: saleError });
            res.json({ message: 'Sale recorded' });
          }
        });
    });
  }

  // If there are recipes, deduct ingredients from business unit stock
  if (recipeIds.length > 0) {
    const placeholders = recipeIds.map(() => '?').join(',');
    db.all(`SELECT ri.recipe_id, ri.ingredient_id, ri.quantity
            FROM recipe_ingredients ri
            WHERE ri.recipe_id IN (${placeholders})`, recipeIds, (err, recipeIngredients) => {
      if (err) return res.status(500).json({ error: err.message });

      // Aggregate required ingredients per sale
      const requiredByIngredient = {};
      for (const item of items) {
        const itemIngs = recipeIngredients.filter(ri => ri.recipe_id === item.recipe_id);
        for (const ing of itemIngs) {
          const required = ing.quantity * item.quantity;
          requiredByIngredient[ing.ingredient_id] = (requiredByIngredient[ing.ingredient_id] || 0) + required;
        }
      }

      // Check and deduct from business unit stock
      const ingredientIds = Object.keys(requiredByIngredient);
      let pendingCheck = ingredientIds.length;

      if (pendingCheck === 0) { processSale(); return; }

      let checkError = null;
      ingredientIds.forEach(ingId => {
        const required = requiredByIngredient[ingId];
        db.get('SELECT id, quantity FROM catering_business_unit_stock WHERE ingredient_id = ? AND business_type_assignment_id = ?',
          [ingId, business_type_assignment_id], (err, busStock) => {
            if (err) { checkError = err.message; pendingCheck--; if (pendingCheck === 0) { if (checkError) return res.status(500).json({ error: checkError }); processSale(); } return; }

            if (!busStock || (busStock.quantity || 0) < required) {
              checkError = `Insufficient business unit stock for ingredient ID ${ingId}`;
              pendingCheck--;
              if (pendingCheck === 0) {
                if (checkError) return res.status(400).json({ error: checkError });
                processSale();
              }
              return;
            }

            // Deduct from business unit stock
            db.run('UPDATE catering_business_unit_stock SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [required, busStock.id], (err) => {
                if (err) checkError = err.message;
                pendingCheck--;
                if (pendingCheck === 0) {
                  if (checkError) return res.status(500).json({ error: checkError });
                  processSale();
                }
              });
          });
      });
    });
  } else {
    processSale();
  }
});

// Delete a business unit sale (restore stock)
router.delete('/business-unit-sales/:id', (req, res) => {
  db.get('SELECT * FROM catering_business_unit_sales WHERE id = ?', [req.params.id], (err, sale) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    // Restore ingredients to business unit stock
    if (sale.recipe_id) {
      db.all('SELECT ingredient_id, quantity FROM recipe_ingredients WHERE recipe_id = ?', [sale.recipe_id], (err, ingredients) => {
        if (err) return res.status(500).json({ error: err.message });

        let pending = (ingredients || []).length;
        if (pending === 0) {
          db.run('DELETE FROM catering_business_unit_sales WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Sale deleted' });
          });
          return;
        }

        ingredients.forEach(ing => {
          const restoration = ing.quantity * sale.quantity;
          db.get('SELECT id FROM catering_business_unit_stock WHERE ingredient_id = ? AND business_type_assignment_id = ?',
            [ing.ingredient_id, sale.business_type_assignment_id], (err, busStock) => {
              if (busStock) {
                db.run('UPDATE catering_business_unit_stock SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  [restoration, busStock.id], (err) => {
                    pending--;
                    if (pending === 0) {
                      db.run('DELETE FROM catering_business_unit_sales WHERE id = ?', [req.params.id], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: 'Sale deleted, stock restored' });
                      });
                    }
                  });
              } else {
                pending--;
                if (pending === 0) {
                  db.run('DELETE FROM catering_business_unit_sales WHERE id = ?', [req.params.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Sale deleted, stock restored' });
                  });
                }
              }
            });
        });
      });
    } else {
      db.run('DELETE FROM catering_business_unit_sales WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Sale deleted' });
      });
    }
  });
});

// ─── Business Unit Consumption Summary ───
router.get('/business-unit-consumption', (req, res) => {
  db.all(`SELECT bta.id as business_unit_id, bta.business_unit_code,
          c.name as country_name, lt.name as location_name,
          slt.name as sub_location_name, bt.name as business_type_name,
          COUNT(bus.id) as total_sales,
          COALESCE(SUM(bus.quantity), 0) as total_quantity_sold,
          COALESCE(SUM(bus.total_cost), 0) as total_cost
          FROM business_type_assignments bta
          LEFT JOIN catering_business_unit_sales bus ON bta.id = bus.business_type_assignment_id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          GROUP BY bta.id
          ORDER BY c.name, lt.name, bt.name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
