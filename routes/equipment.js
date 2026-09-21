const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { db } = require('../config/database');

const router = express.Router();

// Helper: get allowed location_ids for current session manager (empty = no restriction)
function getAllowedLocationIds(req, callback) {
  if (!req.session || !req.session.managerId || req.session.moduleName === 'admin') {
    return callback(null, null); // null = no restriction (see all)
  }
  db.all('SELECT location_id FROM module_manager_location_filters WHERE module_manager_id = ?', [req.session.managerId], (err, rows) => {
    if (err) return callback(err, null);
    if (rows.length === 0) return callback(null, null); // no filters = no restriction (see all)
    callback(null, rows.map(r => r.location_id));
  });
}

// Helper: get allowed owner_ids for current session manager (empty = no restriction)
function getAllowedOwnerIds(req, callback) {
  if (!req.session || !req.session.managerId || req.session.moduleName === 'admin') {
    return callback(null, null); // null = no restriction (see all)
  }
  db.all('SELECT owner_id FROM module_manager_owner_filters WHERE module_manager_id = ?', [req.session.managerId], (err, rows) => {
    if (err) return callback(err, null);
    if (rows.length === 0) return callback(null, null); // no filters = no restriction (see all)
    callback(null, rows.map(r => r.owner_id));
  });
}

// Helper: get both location and owner filters in one call
function getAllowedFilters(req, callback) {
  getAllowedLocationIds(req, (err, locationIds) => {
    if (err) return callback(err);
    getAllowedOwnerIds(req, (err2, ownerIds) => {
      if (err2) return callback(err2);
      callback(null, locationIds, ownerIds);
    });
  });
}

// Map backend table names to access-control tab keys (module: equipment)
const EQUIPMENT_TABLE_TO_TAB = {
  'equipment': 'equipment',
  'transfers': 'transfers',
  'maintenance': 'maintenance',
  'spare-parts': 'spare-parts',
  'parts-items': 'spare-parts',
  'parts-purchases': 'spare-parts',
  'purchases': 'equipment',
  'write-offs': 'write-offs',
  'equipment-returns': 'returns'
};

// Helper: check module-manager tab-level permission (add, edit or delete).
// Reads module_tab_permissions — the same table the Access Control UI writes.
// No row = frontend default: add allowed until configured, edit/delete denied.
function checkModulePermission(managerId, tableName, action, callback) {
  if (!managerId) return callback(null, false);
  const tabKey = EQUIPMENT_TABLE_TO_TAB[tableName] || tableName;
  const field = action === 'add' ? 'can_add' : action === 'delete' ? 'can_delete' : action === 'export' ? 'can_export' : 'can_edit';
  db.get(`SELECT ${field} AS allowed FROM module_tab_permissions WHERE module_manager_id = ? AND module_name = 'equipment' AND tab_key = ? AND subtab_key = ''`,
    [managerId, tabKey], (err, row) => {
      if (err) return callback(err, false);
      // No row = frontend default: add/export allowed until configured, edit/delete denied
      if (!row) return callback(null, action === 'add' || action === 'export');
      callback(null, !!row.allowed);
    });
}

function requireModulePermission(tableName, action) {
  return (req, res, next) => {
    if (req.session && req.session.moduleName === 'admin') return next();
    if (!req.session || req.session.moduleName !== 'equipment' || !req.session.managerId) {
      res.status(403).json({ error: `You do not have permission to ${action} this record.` });
      return;
    }
    const managerId = req.session.managerId;
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Only allow images for photo-style fields
function uploadFileFilter(req, file, cb) {
  const imageFields = ['photo', 'photos', 'image'];
  if (imageFields.includes(file.fieldname)) {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Only image files are allowed for photos'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage: storage,
  fileFilter: uploadFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

// Dedup helper: if an identical file (by hash) already exists in uploads/, reuse it and delete the newly uploaded copy
function dedupUploadedFile(file) {
  if (!file || !file.path) return file;
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  // Hash the newly uploaded file synchronously
  const newFileBuf = fs.readFileSync(file.path);
  const fileHash = crypto.createHash('sha256').update(newFileBuf).digest('hex');
  // Read uploads directory and check each existing file
  let files;
  try {
    files = fs.readdirSync(uploadsDir);
  } catch (err) {
    return file; // If we can't read the dir, just keep the new file
  }
  for (const f of files) {
    if (f === file.filename) continue;
    const otherPath = path.join(uploadsDir, f);
    try {
      const otherBuf = fs.readFileSync(otherPath);
      const otherHash = crypto.createHash('sha256').update(otherBuf).digest('hex');
      if (otherHash === fileHash) {
        // Delete the newly uploaded duplicate, reuse the existing file
        fs.unlinkSync(file.path);
        file.filename = f;
        file.path = otherPath;
        break;
      }
    } catch (err) {
      // Skip files that can't be read
    }
  }
  return file;
}

// Dedup multiple files sequentially
function dedupUploadedFiles(files) {
  if (!files || files.length === 0) return [];
  return files.map(f => dedupUploadedFile(f));
}

// Check if a photo file is referenced by any other equipment_photos, equipment.photo_path, or maintenance_photos rows
function isPhotoReferencedElsewhere(photoPath, excludePhotoId, callback) {
  const checks = [
    (cb) => db.get('SELECT COUNT(*) as cnt FROM equipment_photos WHERE photo_path = ? AND id != ?', [photoPath, excludePhotoId || -1], (err, row) => cb(err, row ? row.cnt : 0)),
    (cb) => db.get('SELECT COUNT(*) as cnt FROM equipment WHERE photo_path = ?', [photoPath], (err, row) => cb(err, row ? row.cnt : 0)),
    (cb) => db.get('SELECT COUNT(*) as cnt FROM maintenance_photos WHERE photo_path = ?', [photoPath], (err, row) => cb(err, row ? row.cnt : 0)),
    (cb) => db.get('SELECT COUNT(*) as cnt FROM equipment_write_off_photos WHERE photo_path = ?', [photoPath], (err, row) => cb(err, row ? row.cnt : 0)),
  ];
  let total = 0;
  let done = 0;
  checks.forEach(check => {
    check((err, cnt) => {
      if (!err) total += cnt;
      done++;
      if (done === checks.length) callback(null, total);
    });
  });
}

const EQUIPMENT_LIST_QUERY = `SELECT e.*,
          c.name as country_name,
          c.id as country_id,
          lt.name as location_name,
          lt.id as location_type_id,
          slt.name as sub_location_name,
          slt.id as sub_location_id,
          bt.name as business_type_name,
          bt.id as business_type_id,
          bta.business_unit_code as business_unit_code,
          bta.id as assignment_id,
          eo.name as owner_name,
          ec.name as condition_name,
          es.name as status_name,
          CASE 
            WHEN CAST(e.assigned_to AS INTEGER) > 0 THEN emp.first_name || ' ' || emp.last_name
            ELSE e.assigned_to
          END as assigned_to_name,
          s.name as supplier_name
          FROM equipment e 
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id 
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          LEFT JOIN equipment_owners eo ON e.owner_id = eo.id
          LEFT JOIN equipment_conditions ec ON e.condition_id = ec.id
          LEFT JOIN equipment_statuses es ON e.status_id = es.id
          LEFT JOIN suppliers s ON e.supplier_id = s.id
          LEFT JOIN employees emp ON CAST(e.assigned_to AS INTEGER) = emp.id`;

// EQUIPMENT
router.get('/', (req, res) => {
  getAllowedFilters(req, (err, allowedLocationIds, allowedOwnerIds) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let query = `${EQUIPMENT_LIST_QUERY} ORDER BY e.name`;
    let params = [];
    const conditions = [];
    if (allowedLocationIds !== null) {
      if (allowedLocationIds.length === 0) {
        // No locations allowed - return empty
        return res.json([]);
      }
      conditions.push(`e.location_id IN (${allowedLocationIds.map(() => '?').join(',')})`);
      params.push(...allowedLocationIds);
    }
    if (allowedOwnerIds !== null) {
      if (allowedOwnerIds.length === 0) {
        // No owners allowed - return empty
        return res.json([]);
      }
      conditions.push(`e.owner_id IN (${allowedOwnerIds.map(() => '?').join(',')})`);
      params.push(...allowedOwnerIds);
    }
    if (conditions.length > 0) {
      query = `${EQUIPMENT_LIST_QUERY} WHERE ${conditions.join(' AND ')} ORDER BY e.name`;
    }
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (rows.length === 0) {
      res.json(rows);
      return;
    }

    const equipmentIds = rows.map(r => r.id);
    const eqPlaceholders = equipmentIds.map(() => '?').join(',');
    const catalogIds = [...new Set(rows.map(r => r.catalog_id).filter(Boolean))];

    // Bulk fetch last completed maintenance date per equipment
    db.all(
      `SELECT equipment_id, MAX(performed_date) as last_done FROM maintenance_logs WHERE equipment_id IN (${eqPlaceholders}) AND LOWER(maintenance_status) = 'completed' GROUP BY equipment_id`,
      equipmentIds,
      (errLastMaint, lastMaintRows) => {
        if (errLastMaint) { res.status(500).json({ error: errLastMaint.message }); return; }
        const lastMaintMap = {};
        lastMaintRows.forEach(r => { lastMaintMap[r.equipment_id] = r.last_done; });

        // Bulk fetch latest non-completed maintenance status per equipment
        db.all(
          `SELECT ml.equipment_id, ml.maintenance_status FROM maintenance_logs ml INNER JOIN (SELECT equipment_id, MAX(performed_date || '_' || id) as max_key FROM maintenance_logs WHERE equipment_id IN (${eqPlaceholders}) AND LOWER(maintenance_status) NOT IN ('completed','cancelled','cancelled due to write off') GROUP BY equipment_id) latest ON (ml.equipment_id || '_' || ml.performed_date || '_' || ml.id) = latest.max_key`,
          equipmentIds,
          (errMaintStatus, maintStatusRows) => {
            if (errMaintStatus) { res.status(500).json({ error: errMaintStatus.message }); return; }
            const maintStatusMap = {};
            maintStatusRows.forEach(r => { maintStatusMap[r.equipment_id] = r.maintenance_status; });

            // Bulk fetch transfer counts and last service transfer date
            db.all(
              `SELECT et.equipment_id, COUNT(*) as transfer_count, MAX(CASE WHEN LOWER(bt.name) NOT IN ('store','stores') THEN et.transfer_date END) as last_service_transfer_date FROM equipment_transfers et LEFT JOIN business_type_assignments bta ON et.to_location_id = bta.id LEFT JOIN business_types bt ON bta.business_type_id = bt.id WHERE et.equipment_id IN (${eqPlaceholders}) GROUP BY et.equipment_id`,
              equipmentIds,
              (errTransfers, transferRows) => {
                if (errTransfers) { res.status(500).json({ error: errTransfers.message }); return; }
                const transferMap = {};
                transferRows.forEach(r => { transferMap[r.equipment_id] = { count: r.transfer_count, lastServiceDate: r.last_service_transfer_date }; });

                // Bulk fetch transfer assigned history (distinct names)
                db.all(
                  `SELECT et.equipment_id, CASE WHEN CAST(et.assigned_to AS INTEGER) > 0 THEN (SELECT emp.first_name || ' ' || emp.last_name FROM employees emp WHERE emp.id = CAST(et.assigned_to AS INTEGER)) ELSE et.assigned_to END as name FROM equipment_transfers et WHERE et.equipment_id IN (${eqPlaceholders}) AND et.assigned_to IS NOT NULL AND et.assigned_to != '' UNION SELECT et.equipment_id, CASE WHEN CAST(et.previous_assigned_to AS INTEGER) > 0 THEN (SELECT emp.first_name || ' ' || emp.last_name FROM employees emp WHERE emp.id = CAST(et.previous_assigned_to AS INTEGER)) ELSE et.previous_assigned_to END as name FROM equipment_transfers et WHERE et.equipment_id IN (${eqPlaceholders}) AND et.previous_assigned_to IS NOT NULL AND et.previous_assigned_to != ''`,
                  [...equipmentIds, ...equipmentIds],
                  (errAssignHist, assignHistRows) => {
                    if (errAssignHist) { res.status(500).json({ error: errAssignHist.message }); return; }
                    const assignHistMap = {};
                    assignHistRows.forEach(r => {
                      if (r.name) {
                        if (!assignHistMap[r.equipment_id]) assignHistMap[r.equipment_id] = new Set();
                        assignHistMap[r.equipment_id].add(r.name);
                      }
                    });

                    // Bulk fetch write-off history and pending counts
                    db.all(
                      `SELECT equipment_id, GROUP_CONCAT(reason || COALESCE(' ' || notes, ''), '§§') as write_off_history, SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending_count FROM equipment_write_offs WHERE equipment_id IN (${eqPlaceholders}) GROUP BY equipment_id`,
                      equipmentIds,
                      (errWriteOff, writeOffRows) => {
                        if (errWriteOff) { res.status(500).json({ error: errWriteOff.message }); return; }
                        const writeOffMap = {};
                        writeOffRows.forEach(r => {
                          const history = (r.write_off_history || '').split('§§').filter(Boolean);
                          writeOffMap[r.equipment_id] = { history: [...new Set(history)], pendingCount: r.pending_count || 0 };
                        });

                        // Bulk fetch thumbnail photos (first photo per equipment)
                        db.all(
                          `SELECT equipment_id, photo_path FROM equipment_photos WHERE equipment_id IN (${eqPlaceholders}) GROUP BY equipment_id HAVING MIN(created_at)`,
                          equipmentIds,
                          (errThumb, thumbRows) => {
                            if (errThumb) { res.status(500).json({ error: errThumb.message }); return; }
                            const thumbMap = {};
                            thumbRows.forEach(r => { thumbMap[r.equipment_id] = r.photo_path; });

                            // Bulk fetch pending write-off existence and under-maintenance existence for display_status
                            db.all(
                              `SELECT equipment_id, SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending_wo FROM equipment_write_offs WHERE equipment_id IN (${eqPlaceholders}) GROUP BY equipment_id`,
                              equipmentIds,
                              (errPendWO, pendWORows) => {
                                if (errPendWO) { res.status(500).json({ error: errPendWO.message }); return; }
                                const pendWOMap = {};
                                pendWORows.forEach(r => { pendWOMap[r.equipment_id] = r.pending_wo > 0; });

                                db.all(
                                  `SELECT DISTINCT equipment_id FROM maintenance_logs WHERE equipment_id IN (${eqPlaceholders}) AND LOWER(maintenance_status) NOT IN ('completed','cancelled','cancelled due to write off')`,
                                  equipmentIds,
                                  (errUnderMaint, underMaintRows) => {
                                    if (errUnderMaint) { res.status(500).json({ error: errUnderMaint.message }); return; }
                                    const underMaintSet = new Set(underMaintRows.map(r => r.equipment_id));

                                    // Bulk fetch pending and approved equipment returns
                                    db.all(
                                      `SELECT equipment_id, SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) as completed_count FROM equipment_returns WHERE equipment_id IN (${eqPlaceholders}) GROUP BY equipment_id`,
                                      equipmentIds,
                                      (errReturns, returnRows) => {
                                        if (errReturns) { res.status(500).json({ error: errReturns.message }); return; }
                                        const returnMap = {};
                                        returnRows.forEach(r => { returnMap[r.equipment_id] = { pendingCount: r.pending_count || 0, completedCount: r.completed_count || 0 }; });

                                    // Attach all bulk-fetched data to rows
                                    rows.forEach(eq => {
                                      eq.last_maintenance_date = lastMaintMap[eq.id] || null;
                                      eq.maintenance_status = maintStatusMap[eq.id] || null;
                                      const tInfo = transferMap[eq.id];
                                      eq.transfer_count = tInfo ? tInfo.count : 0;
                                      eq.last_service_transfer_date = tInfo ? tInfo.lastServiceDate : null;
                                      const ahs = assignHistMap[eq.id];
                                      eq.transfer_assigned_history = ahs ? [...ahs].join(', ') : null;
                                      const wo = writeOffMap[eq.id];
                                      eq.write_off_history = wo ? wo.history.join(', ') : null;
                                      eq.pending_write_off_count = wo ? wo.pendingCount : 0;
                                      eq.thumbnail_photo = thumbMap[eq.id] || null;

                                      // Compute display_status
                                      const statusName = eq.status_name || eq.status;
                                      const retInfo = returnMap[eq.id];
                                      if (statusName === 'Written Off' || eq.status === 'Written Off') {
                                        eq.display_status = 'Written Off';
                                      } else if (pendWOMap[eq.id]) {
                                        eq.display_status = 'Pending Write Off';
                                      } else if (retInfo && retInfo.completedCount > 0) {
                                        eq.display_status = 'Returned';
                                      } else if (eq.status === 'Returned') {
                                        eq.display_status = 'Returned';
                                      } else if (retInfo && retInfo.pendingCount > 0) {
                                        eq.display_status = 'Pending Return';
                                      } else if (underMaintSet.has(eq.id)) {
                                        eq.display_status = 'Under Maintenance';
                                      } else {
                                        eq.display_status = statusName;
                                      }
                                      eq.pending_return_count = retInfo ? retInfo.pendingCount : 0;
                                    });

                                    // Bulk fetch all PM types for relevant catalog items
                                    const pmTypePlaceholders = catalogIds.length ? catalogIds.map(() => '?').join(',') : 'NULL';
                                    db.all(`SELECT DISTINCT item_id, pm_type FROM preventive_maintenance_tasks WHERE item_id IN (${pmTypePlaceholders})`, catalogIds.length ? catalogIds : [0], (err2, pmTypeRows) => {
                                      if (err2) { res.status(500).json({ error: err2.message }); return; }

                                      // Group PM types by item_id
                                      const pmTypesByItem = {};
                                      pmTypeRows.forEach(r => {
                                        if (!pmTypesByItem[r.item_id]) pmTypesByItem[r.item_id] = [];
                                        pmTypesByItem[r.item_id].push(r.pm_type);
                                      });

                                      // Bulk fetch last completed maintenance date per equipment per PM type
                                      db.all(
                                        `SELECT ml.equipment_id, pmt.pm_type, MAX(ml.performed_date) as last_done_date
                                         FROM maintenance_logs ml
                                         JOIN maintenance_log_tasks mlt ON mlt.maintenance_log_id = ml.id
                                         JOIN preventive_maintenance_tasks pmt ON mlt.pm_task_id = pmt.id
                                         WHERE ml.equipment_id IN (${eqPlaceholders}) AND LOWER(ml.maintenance_status) = 'completed'
                                         GROUP BY ml.equipment_id, pmt.pm_type`,
                                        equipmentIds,
                                        (err3, lastDoneRows) => {
                                          if (err3) { res.status(500).json({ error: err3.message }); return; }

                                          // Build lookup: {equipmentId: {pm_type: last_done_date}}
                                          const lastDoneMap = {};
                                          lastDoneRows.forEach(r => {
                                            if (!lastDoneMap[r.equipment_id]) lastDoneMap[r.equipment_id] = {};
                                            lastDoneMap[r.equipment_id][r.pm_type] = r.last_done_date;
                                          });

                                          const pmIntervalMonths = { 'daily': 0, 'weekly': 0, 'monthly': 1, 'quarterly': 3, 'bi-annually': 6, 'annually': 12 };
                                          const pmIntervalDays = { 'daily': 1, 'weekly': 7 };

                                          function addInterval(date, pmType) {
                                            const d = new Date(date);
                                            if (isNaN(d.getTime())) return null;
                                            if (pmType === 'daily') d.setDate(d.getDate() + 1);
                                            else if (pmType === 'weekly') d.setDate(d.getDate() + 7);
                                            else if (pmType === 'monthly') d.setMonth(d.getMonth() + 1);
                                            else if (pmType === 'quarterly') d.setMonth(d.getMonth() + 3);
                                            else if (pmType === 'bi-annually') d.setMonth(d.getMonth() + 6);
                                            else if (pmType === 'annually') d.setFullYear(d.getFullYear() + 1);
                                            else return null;
                                            return d;
                                          }

                                          function advanceToFuture(date, pmType) {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            let d = new Date(date);
                                            while (d < today) {
                                              const next = addInterval(d, pmType);
                                              if (!next || next.getTime() === d.getTime()) break;
                                              d = next;
                                            }
                                            return d;
                                          }

                                          function getMissedDates(anchor, pmType) {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            const missed = [];
                                            let d = addInterval(anchor, pmType);
                                            while (d && d < today) {
                                              missed.push(d.toISOString().split('T')[0]);
                                              const next = addInterval(d, pmType);
                                              if (!next || next.getTime() === d.getTime()) break;
                                              d = next;
                                            }
                                            return missed;
                                          }

                                          const today = new Date();
                                          today.setHours(0, 0, 0, 0);

                                          rows.forEach(eq => {
                                            eq.next_pm_date = null;
                                            eq.next_pm_type = null;
                                            eq.next_pm_overdue = false;
                                            eq.missed_pm_dates = [];

                                            if (!eq.catalog_id) return;

                                            const pmTypes = pmTypesByItem[eq.catalog_id];
                                            if (!pmTypes || pmTypes.length === 0) return;

                                            let earliestDate = null;
                                            let earliestType = null;
                                            let earliestOverdue = false;
                                            let allMissedDates = [];

                                            pmTypes.forEach(pmType => {
                                              const eqLastDone = lastDoneMap[eq.id] && lastDoneMap[eq.id][pmType];
                                              let nextDue = null;
                                              let isOverdue = false;
                                              let missed = [];

                                              if (eqLastDone) {
                                                const next = addInterval(eqLastDone, pmType);
                                                if (next) {
                                                  if (next < today) {
                                                    isOverdue = true;
                                                    missed = getMissedDates(eqLastDone, pmType);
                                                    const advanced = advanceToFuture(next, pmType);
                                                    nextDue = advanced.toISOString().split('T')[0];
                                                  } else {
                                                    nextDue = next.toISOString().split('T')[0];
                                                  }
                                                }
                                              } else {
                                                const isInStore = eq.status && eq.status.toLowerCase() === 'in stores';
                                                if (eq.in_service_date && !isInStore) {
                                                  const accDays = parseInt(eq.accumulated_usage_days) || 0;
                                                  const baseDate = new Date(eq.in_service_date);
                                                  baseDate.setDate(baseDate.getDate() + accDays);
                                                  const anchor = baseDate.toISOString().split('T')[0];
                                                  const firstDue = addInterval(anchor, pmType);
                                                  if (firstDue) {
                                                    if (firstDue < today) {
                                                      isOverdue = true;
                                                      missed = getMissedDates(anchor, pmType);
                                                      const advanced = advanceToFuture(firstDue, pmType);
                                                      nextDue = advanced.toISOString().split('T')[0];
                                                    } else {
                                                      nextDue = firstDue.toISOString().split('T')[0];
                                                    }
                                                  }
                                                }
                                              }

                                              if (nextDue && (!earliestDate || nextDue < earliestDate)) {
                                                earliestDate = nextDue;
                                                earliestType = pmType;
                                                earliestOverdue = isOverdue;
                                              }
                                              if (missed.length > 0) {
                                                allMissedDates.push({ pm_type: pmType, missed_dates: missed });
                                              }
                                            });

                                            eq.next_pm_date = earliestDate;
                                            eq.next_pm_type = earliestType;
                                            eq.next_pm_overdue = earliestOverdue;
                                            eq.missed_pm_dates = allMissedDates;
                                          });

                                          res.json(rows);
                                        }
                                      );
                                    });
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
  });
});

router.get('/:id(\\d+)', (req, res) => {
  db.get(`SELECT e.*,
          c.name as country_name,
          lt.name as location_name,
          slt.name as sub_location_name,
          bt.name as business_type_name,
          bta.business_unit_code as business_unit_code,
          eo.name as owner_name,
          cat.name as catalog_name,
          ec.name as condition_name,
          es.name as status_name,
          s.name as supplier_name,
          (SELECT MAX(performed_date) FROM maintenance_logs ml WHERE ml.equipment_id = e.id AND LOWER(ml.maintenance_status) = 'completed') as last_maintenance_date,
          (SELECT maintenance_status FROM maintenance_logs ml WHERE ml.equipment_id = e.id AND LOWER(ml.maintenance_status) NOT IN ('completed', 'cancelled', 'cancelled due to write off') ORDER BY ml.performed_date DESC, ml.id DESC LIMIT 1) as maintenance_status,
          (SELECT COUNT(*) FROM equipment_transfers et WHERE et.equipment_id = e.id) as transfer_count,
          (SELECT MAX(et.transfer_date) FROM equipment_transfers et JOIN business_type_assignments bta ON et.to_location_id = bta.id JOIN business_types bt ON bta.business_type_id = bt.id WHERE et.equipment_id = e.id AND LOWER(bt.name) NOT IN ('store', 'stores')) as last_service_transfer_date,
          (SELECT photo_path FROM equipment_photos ep WHERE ep.equipment_id = e.id ORDER BY ep.created_at ASC LIMIT 1) as thumbnail_photo,
          (SELECT COUNT(*) FROM equipment_write_offs wo WHERE wo.equipment_id = e.id AND LOWER(wo.status) = 'pending') as pending_write_off_count,
          (SELECT COUNT(*) FROM equipment_returns er WHERE er.equipment_id = e.id AND LOWER(er.status) = 'pending') as pending_return_count,
          CASE
            WHEN COALESCE(es.name, e.status) = 'Written Off' OR e.status = 'Written Off' THEN 'Written Off'
            WHEN EXISTS (
              SELECT 1 FROM equipment_write_offs wo WHERE wo.equipment_id = e.id AND LOWER(wo.status) = 'pending'
            ) THEN 'Pending Write Off'
            WHEN e.status = 'Returned' OR EXISTS (
              SELECT 1 FROM equipment_returns er WHERE er.equipment_id = e.id AND LOWER(er.status) = 'approved'
            ) THEN 'Returned'
            WHEN EXISTS (
              SELECT 1 FROM equipment_returns er WHERE er.equipment_id = e.id AND LOWER(er.status) = 'pending'
            ) THEN 'Pending Return'
            WHEN EXISTS (
              SELECT 1 FROM maintenance_logs ml
              WHERE ml.equipment_id = e.id AND LOWER(ml.maintenance_status) NOT IN ('completed', 'cancelled', 'cancelled due to write off')
            ) THEN 'Under Maintenance'
            ELSE COALESCE(es.name, e.status)
          END as display_status,
          CASE
            WHEN CAST(e.assigned_to AS INTEGER) > 0 THEN emp.first_name || ' ' || emp.last_name
            ELSE e.assigned_to
          END as assigned_to_name
          FROM equipment e
          LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
          LEFT JOIN countries c ON bta.country_id = c.id
          LEFT JOIN location_types lt ON bta.location_id = lt.id
          LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
          LEFT JOIN business_types bt ON bta.business_type_id = bt.id
          LEFT JOIN equipment_owners eo ON e.owner_id = eo.id
          LEFT JOIN equipment_catalog cat ON e.catalog_id = cat.id
          LEFT JOIN equipment_conditions ec ON e.condition_id = ec.id
          LEFT JOIN equipment_statuses es ON e.status_id = es.id
          LEFT JOIN suppliers s ON e.supplier_id = s.id
          LEFT JOIN employees emp ON CAST(e.assigned_to AS INTEGER) = emp.id
          WHERE e.id = ?`, [req.params.id], (err, eq) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!eq) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    // Compute next PM date, type, overdue flag, and missed dates
    eq.next_pm_date = null;
    eq.next_pm_type = null;
    eq.next_pm_overdue = false;
    eq.missed_pm_dates = [];
    eq.pm_types = [];

    if (!eq.catalog_id) {
      res.json(eq);
      return;
    }

    function addInterval(date, pmType) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      if (pmType === 'daily') d.setDate(d.getDate() + 1);
      else if (pmType === 'weekly') d.setDate(d.getDate() + 7);
      else if (pmType === 'monthly') d.setMonth(d.getMonth() + 1);
      else if (pmType === 'quarterly') d.setMonth(d.getMonth() + 3);
      else if (pmType === 'bi-annually') d.setMonth(d.getMonth() + 6);
      else if (pmType === 'annually') d.setFullYear(d.getFullYear() + 1);
      else return null;
      return d;
    }

    function getMissedDates(anchor, pmType) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const missed = [];
      let d = addInterval(anchor, pmType);
      while (d && d < today) {
        missed.push(d.toISOString().split('T')[0]);
        const next = addInterval(d, pmType);
        if (!next || next.getTime() === d.getTime()) break;
        d = next;
      }
      return missed;
    }

    function advanceToFuture(date, pmType) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let d = new Date(date);
      while (d < today) {
        const next = addInterval(d, pmType);
        if (!next || next.getTime() === d.getTime()) break;
        d = next;
      }
      return d;
    }

    // Get all PM types and their tasks for this equipment's catalog item
    db.all('SELECT id, pm_type, task_text FROM preventive_maintenance_tasks WHERE item_id = ?', [eq.catalog_id], (err2, pmTasks) => {
      if (err2 || !pmTasks || pmTasks.length === 0) {
        res.json(eq);
        return;
      }

      // Store PM tasks for display
      eq.pm_types = pmTasks;

      const pmTypeSet = [...new Set(pmTasks.map(t => t.pm_type))];
      let pmDone = 0;
      const totalPm = pmTypeSet.length;
      let earliestDate = null;
      let earliestType = null;
      let earliestOverdue = false;
      let allMissedDates = [];

      pmTypeSet.forEach(pmType => {
        db.get(
          `SELECT MAX(ml.performed_date) as last_done_date
           FROM maintenance_logs ml
           JOIN maintenance_log_tasks mlt ON mlt.maintenance_log_id = ml.id
           JOIN preventive_maintenance_tasks pmt ON mlt.pm_task_id = pmt.id
           WHERE ml.equipment_id = ? AND LOWER(ml.maintenance_status) = 'completed'
             AND pmt.pm_type = ?`,
          [eq.id, pmType],
          (err3, row) => {
            pmDone++;
            const lastDone = row && row.last_done_date;
            let nextDue = null;
            let isOverdue = false;
            let missed = [];

            if (lastDone) {
              const next = addInterval(lastDone, pmType);
              if (next) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (next < today) {
                  isOverdue = true;
                  missed = getMissedDates(lastDone, pmType);
                  const advanced = advanceToFuture(next, pmType);
                  nextDue = advanced.toISOString().split('T')[0];
                } else {
                  nextDue = next.toISOString().split('T')[0];
                }
              }
            } else {
              // No maintenance done for this PM type — use in_service_date only (not purchase_date)
              // Add accumulated_usage_days (store days) to in_service_date, then calculate PM interval
              // Skip PM calculation if equipment is currently in store
              const isInStore = eq.status && eq.status.toLowerCase() === 'in stores';
              if (eq.in_service_date && !isInStore) {
                const accDays = parseInt(eq.accumulated_usage_days) || 0;
                const baseDate = new Date(eq.in_service_date);
                baseDate.setDate(baseDate.getDate() + accDays);
                const anchor = baseDate.toISOString().split('T')[0];
                const firstDue = addInterval(anchor, pmType);
                if (firstDue) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (firstDue < today) {
                    isOverdue = true;
                    missed = getMissedDates(anchor, pmType);
                    const advanced = advanceToFuture(firstDue, pmType);
                    nextDue = advanced.toISOString().split('T')[0];
                  } else {
                    nextDue = firstDue.toISOString().split('T')[0];
                  }
                }
              }
            }

            if (nextDue && (!earliestDate || nextDue < earliestDate)) {
              earliestDate = nextDue;
              earliestType = pmType;
              earliestOverdue = isOverdue;
            }
            if (missed.length > 0) {
              allMissedDates.push({ pm_type: pmType, missed_dates: missed });
            }

            if (pmDone === totalPm) {
              eq.next_pm_date = earliestDate;
              eq.next_pm_type = earliestType;
              eq.next_pm_overdue = earliestOverdue;
              eq.missed_pm_dates = allMissedDates;
              res.json(eq);
            }
          }
        );
      });
    });
  });
});

// Get next PM schedule for an equipment considering all configured PM types
router.get('/:id(\\d+)/next-pm-schedule', (req, res) => {
  const equipmentId = req.params.id;
  const fallbackDate = req.query.fallback_date || null;

  // Step 1: Get the equipment's catalog_id (item_id)
  db.get('SELECT catalog_id, in_service_date, purchase_date, accumulated_usage_days FROM equipment WHERE id = ?', [equipmentId], (err, eq) => {
    if (err || !eq) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    if (!eq.catalog_id) {
      res.json({ pm_schedules: [], next_pm_type: null, next_pm_date: null });
      return;
    }

    // Step 2: Get all distinct PM types configured for this equipment's item
    db.all('SELECT DISTINCT pm_type FROM preventive_maintenance_tasks WHERE item_id = ?', [eq.catalog_id], (err2, pmTypes) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }

      if (pmTypes.length === 0) {
        res.json({ pm_schedules: [], next_pm_type: null, next_pm_date: null });
        return;
      }

      const intervalMap = {
        'daily': 1,        // days
        'weekly': 7,       // days
        'monthly': 30,     // approx days
        'quarterly': 90,   // approx days
        'bi-annually': 180, // approx days
        'annually': 365    // approx days
      };

      const intervalMonthsMap = {
        'daily': 0,
        'weekly': 0,
        'monthly': 1,
        'quarterly': 3,
        'bi-annually': 6,
        'annually': 12
      };

      const schedules = [];
      let completed = 0;
      const totalPmTypes = pmTypes.length;

      pmTypes.forEach(pmTypeRow => {
        const pmType = pmTypeRow.pm_type;

        // Step 3: Find the last completed maintenance log that used this PM type
        // Join maintenance_log_tasks -> preventive_maintenance_tasks to get pm_type
        db.get(
          `SELECT MAX(ml.performed_date) as last_done_date
           FROM maintenance_logs ml
           JOIN maintenance_log_tasks mlt ON mlt.maintenance_log_id = ml.id
           JOIN preventive_maintenance_tasks pmt ON mlt.pm_task_id = pmt.id
           WHERE ml.equipment_id = ? AND LOWER(ml.maintenance_status) = 'completed'
             AND pmt.pm_type = ?`,
          [equipmentId, pmType],
          (err3, row) => {
            completed++;

            const lastDoneDate = row && row.last_done_date;

            // Calculate next due date for this PM type
            let nextDueDate = null;
            if (lastDoneDate) {
              const base = new Date(lastDoneDate);
              if (!isNaN(base.getTime())) {
                const next = new Date(base);
                if (pmType === 'daily') {
                  next.setDate(next.getDate() + 1);
                } else if (pmType === 'weekly') {
                  next.setDate(next.getDate() + 7);
                } else if (pmType === 'monthly') {
                  next.setMonth(next.getMonth() + 1);
                } else if (pmType === 'quarterly') {
                  next.setMonth(next.getMonth() + 3);
                } else if (pmType === 'bi-annually') {
                  next.setMonth(next.getMonth() + 6);
                } else if (pmType === 'annually') {
                  next.setFullYear(next.getFullYear() + 1);
                }
                nextDueDate = next.toISOString().split('T')[0];
              }
            } else {
              // No maintenance done yet for this PM type — use in_service_date only (not purchase_date)
              // Add accumulated_usage_days (store days) to in_service_date, then calculate PM interval
              if (eq.in_service_date) {
                const accDays = parseInt(eq.accumulated_usage_days) || 0;
                const baseDate = new Date(eq.in_service_date);
                baseDate.setDate(baseDate.getDate() + accDays);
              const base = new Date(baseDate.toISOString().split('T')[0]);
              if (!isNaN(base.getTime())) {
                const next = new Date(base);
                if (pmType === 'daily') {
                  next.setDate(next.getDate() + 1);
                } else if (pmType === 'weekly') {
                  next.setDate(next.getDate() + 7);
                } else if (pmType === 'monthly') {
                  next.setMonth(next.getMonth() + 1);
                } else if (pmType === 'quarterly') {
                  next.setMonth(next.getMonth() + 3);
                } else if (pmType === 'bi-annually') {
                  next.setMonth(next.getMonth() + 6);
                } else if (pmType === 'annually') {
                  next.setFullYear(next.getFullYear() + 1);
                }
                // Keep advancing until it's in the future
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                while (next < today) {
                  if (pmType === 'daily') next.setDate(next.getDate() + 1);
                  else if (pmType === 'weekly') next.setDate(next.getDate() + 7);
                  else if (pmType === 'monthly') next.setMonth(next.getMonth() + 1);
                  else if (pmType === 'quarterly') next.setMonth(next.getMonth() + 3);
                  else if (pmType === 'bi-annually') next.setMonth(next.getMonth() + 6);
                  else if (pmType === 'annually') next.setFullYear(next.getFullYear() + 1);
                }
                nextDueDate = next.toISOString().split('T')[0];
              }
              }
            }

            schedules.push({
              pm_type: pmType,
              last_done_date: lastDoneDate,
              next_due_date: nextDueDate
            });

            if (completed === totalPmTypes) {
              // Find the earliest next due date
              let earliest = null;
              let earliestType = null;
              schedules.forEach(s => {
                if (s.next_due_date && (!earliest || s.next_due_date < earliest)) {
                  earliest = s.next_due_date;
                  earliestType = s.pm_type;
                }
              });

              res.json({
                pm_schedules: schedules,
                next_pm_type: earliestType,
                next_pm_date: earliest
              });
            }
          }
        );
      });
    });
  });
});

router.post('/', requireModulePermission('equipment', 'add'), upload.fields([{ name: 'photo' }, { name: 'manual' }, { name: 'document' }]), async (req, res) => {
  const { name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, condition_id, condition, status_id, status, comments, description, catalog_id, brand, specification, other_charges, barcode, owner_id, preventive_maintenance_months, purchase_order_number, assigned_to, in_service_date } = req.body;

  // Dedup uploaded files
  let photo_path = null, manual_document_path = null, document_path = null;
  try {
    if (req.files && req.files['photo'] && req.files['photo'][0]) {
      const deduped = await dedupUploadedFile(req.files['photo'][0]);
      photo_path = `/uploads/${deduped.filename}`;
    }
    if (req.files && req.files['manual'] && req.files['manual'][0]) {
      const deduped = await dedupUploadedFile(req.files['manual'][0]);
      manual_document_path = `/uploads/${deduped.filename}`;
    }
    if (req.files && req.files['document'] && req.files['document'].length > 0) {
      const docPaths = [];
      for (const docFile of req.files['document']) {
        const deduped = await dedupUploadedFile(docFile);
        docPaths.push(`/uploads/${deduped.filename}`);
      }
      document_path = docPaths.join(',');
    }
  } catch (err) {
    return res.status(500).json({ error: 'File dedup error: ' + err.message });
  }

  // Check for duplicate serial_number or barcode before creating
  const dupChecks = [];
  if (serial_number && serial_number.trim()) {
    dupChecks.push(new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM equipment WHERE serial_number = ?', [serial_number.trim()], (err, row) => {
        if (err) reject(err);
        else resolve(row ? { field: 'Serial Number', value: serial_number.trim(), name: row.name } : null);
      });
    }));
  }
  if (barcode && barcode.trim()) {
    dupChecks.push(new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM equipment WHERE barcode = ?', [barcode.trim()], (err, row) => {
        if (err) reject(err);
        else resolve(row ? { field: 'Barcode', value: barcode.trim(), name: row.name } : null);
      });
    }));
  }

  Promise.all(dupChecks).then(dupResults => {
    const dup = dupResults.find(r => r !== null);
    if (dup) {
      return res.status(409).json({ error: `${dup.field} "${dup.value}" already exists on equipment: ${dup.name}` });
    }

    resolveConditionId(condition_id, condition, (err, resolvedConditionId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      resolveStatusId(status_id, status, (err, resolvedStatusId) => {
        if (err) { res.status(500).json({ error: err.message }); return; }

        const statusText = status ? status.trim() : '';
        const finalInServiceDate = (statusText.toLowerCase() === 'in service') ? (in_service_date || null) : null;

        // Generate auto serial number
        db.get('SELECT COUNT(*) as count FROM equipment', [], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          const count = row.count + 1;
          const autoSerialNumber = `EQ-${String(count).padStart(3, '0')}`;

          db.run(`INSERT INTO equipment (auto_serial_number, name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, condition_id, condition, status_id, status, comments, photo_path, manual_document_path, description, catalog_id, brand, specification, other_charges, barcode, owner_id, preventive_maintenance_months, purchase_order_number, assigned_to, in_service_date)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [autoSerialNumber, name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, resolvedConditionId, condition, resolvedStatusId, status, comments, photo_path, document_path, description, catalog_id, brand, specification, other_charges, barcode, owner_id || null, preventive_maintenance_months || null, purchase_order_number || null, assigned_to || null, finalInServiceDate],
            function(err) {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({ id: this.lastID, auto_serial_number: autoSerialNumber, name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, condition_id: resolvedConditionId, status_id: resolvedStatusId, condition, status, photo_path, document_path, description, preventive_maintenance_months });
            }
          );
        });
      });
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Bulk copy equipment
router.post('/:id(\\d+)/bulk-copy', requireModulePermission('equipment', 'add'), (req, res) => {
  const sourceId = req.params.id;
  const count = Math.min(parseInt(req.body.count, 10) || 1, 500);

  if (count < 1) {
    return res.status(400).json({ error: 'Count must be at least 1' });
  }

  db.get('SELECT * FROM equipment WHERE id = ?', [sourceId], (err, source) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!source) return res.status(404).json({ error: 'Source equipment not found' });

    // Fetch source photos
    db.all('SELECT photo_path FROM equipment_photos WHERE equipment_id = ? ORDER BY created_at ASC', [sourceId], (err2, photos) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.get('SELECT COUNT(*) as count FROM equipment', [], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });
        let nextNum = row.count + 1;

        const insertSql = `INSERT INTO equipment (auto_serial_number, name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, condition_id, condition, status_id, status, comments, photo_path, manual_document_path, description, catalog_id, brand, specification, other_charges, barcode, owner_id, preventive_maintenance_months, purchase_order_number, assigned_to, in_service_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const photoInsertSql = 'INSERT INTO equipment_photos (equipment_id, photo_path) VALUES (?, ?)';

        let inserted = 0;
        let hasError = false;

        for (let i = 0; i < count; i++) {
          if (hasError) break;
          const autoSerial = `EQ-${String(nextNum).padStart(3, '0')}`;
          nextNum++;

          db.run(insertSql,
            [autoSerial, source.name, null, source.category, source.model, source.purchase_date, source.purchase_cost, source.price, source.shipping_charge, source.manufacturer, source.warranty_expiry, source.location_id, source.supplier_id, source.condition_id, source.condition, source.status_id, source.status, source.comments, source.photo_path, source.manual_document_path, source.description, source.catalog_id, source.brand, source.specification, source.other_charges, null, source.owner_id, source.preventive_maintenance_months, source.purchase_order_number, source.assigned_to, null],
            function(err4) {
              if (err4) {
                if (!hasError) {
                  hasError = true;
                  res.status(500).json({ error: 'Error creating copy ' + (i + 1) + ': ' + err4.message });
                }
                return;
              }
              const newId = this.lastID;

              // Copy photos
              if (photos && photos.length > 0) {
                let photoDone = 0;
                photos.forEach(p => {
                  db.run(photoInsertSql, [newId, p.photo_path], (e) => {
                    photoDone++;
                    if (photoDone === photos.length) {
                      inserted++;
                      if (inserted === count && !hasError) {
                        res.json({ success: true, count: inserted, message: `Created ${inserted} copies of "${source.name}"` });
                      }
                    }
                  });
                });
              } else {
                inserted++;
                if (inserted === count && !hasError) {
                  res.json({ success: true, count: inserted, message: `Created ${inserted} copies of "${source.name}"` });
                }
              }
            }
          );
        }
      });
    });
  });
});

router.put('/:id(\\d+)', upload.fields([{ name: 'photo' }, { name: 'manual' }, { name: 'document' }]), requireModulePermission('equipment', 'edit'), async (req, res) => {
  const { name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, condition_id, condition, status_id, status, comments, description, catalog_id, brand, specification, other_charges, barcode, owner_id, preventive_maintenance_months, purchase_order_number, assigned_to, in_service_date } = req.body;

  // Dedup uploaded files
  let photo_path = req.body.existing_photo || null;
  let manual_document_path = req.body.existing_manual || null;
  let document_path = req.body.existing_document || null;
  try {
    if (req.files && req.files['photo'] && req.files['photo'][0]) {
      const deduped = await dedupUploadedFile(req.files['photo'][0]);
      photo_path = `/uploads/${deduped.filename}`;
    }
    if (req.files && req.files['manual'] && req.files['manual'][0]) {
      const deduped = await dedupUploadedFile(req.files['manual'][0]);
      manual_document_path = `/uploads/${deduped.filename}`;
    }
    if (req.files && req.files['document'] && req.files['document'].length > 0) {
      const existingDocPaths = document_path ? document_path.split(',').filter(p => p.trim()) : [];
      const newDocPaths = [];
      for (const docFile of req.files['document']) {
        const deduped = await dedupUploadedFile(docFile);
        newDocPaths.push(`/uploads/${deduped.filename}`);
      }
      document_path = [...existingDocPaths, ...newDocPaths].join(',');
    }
  } catch (err) {
    return res.status(500).json({ error: 'File dedup error: ' + err.message });
  }

  // Check for duplicate serial_number or barcode before updating (exclude current record)
  const dupChecks = [];
  if (serial_number && serial_number.trim()) {
    dupChecks.push(new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM equipment WHERE serial_number = ? AND id != ?', [serial_number.trim(), req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? { field: 'Serial Number', value: serial_number.trim(), name: row.name } : null);
      });
    }));
  }
  if (barcode && barcode.trim()) {
    dupChecks.push(new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM equipment WHERE barcode = ? AND id != ?', [barcode.trim(), req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? { field: 'Barcode', value: barcode.trim(), name: row.name } : null);
      });
    }));
  }

  Promise.all(dupChecks).then(dupResults => {
    const dup = dupResults.find(r => r !== null);
    if (dup) {
      return res.status(409).json({ error: `${dup.field} "${dup.value}" already exists on equipment: ${dup.name}` });
    }

    resolveConditionId(condition_id, condition, (err, resolvedConditionId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      resolveStatusId(status_id, status, (err, resolvedStatusId) => {
        if (err) { res.status(500).json({ error: err.message }); return; }

        db.get('SELECT status, status_id, in_service_date, accumulated_usage_days FROM equipment WHERE id = ?', [req.params.id], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          const oldStatus = row ? (row.status || '') : '';
          const oldStatusName = row && row.status_id ? null : oldStatus;
          const statusText = status ? status.trim() : (oldStatusName || '');
          const alreadyInServiceDate = row ? row.in_service_date : null;
          const currentAccumulated = row ? (row.accumulated_usage_days || 0) : 0;
          const isInService = statusText.toLowerCase() === 'in service';
          const wasInService = oldStatus.toLowerCase() === 'in service';

          let newInServiceDate, newAccumulated;
          if (isInService) {
            if (wasInService) {
              // Staying in service — use new in_service_date if provided, otherwise keep existing
              newInServiceDate = in_service_date || alreadyInServiceDate || null;
              newAccumulated = currentAccumulated;
            } else {
              // Moving from stores to service via edit
              if (alreadyInServiceDate) {
                // Was in service before, went to store, now back — keep original in_service_date
                newInServiceDate = alreadyInServiceDate;
                newAccumulated = currentAccumulated;
              } else {
                // First time in service — set in_service_date
                newInServiceDate = in_service_date || new Date().toISOString().split('T')[0];
                newAccumulated = currentAccumulated;
              }
            }
          } else {
            // Not in service (In Stores or other) — keep in_service_date unchanged
            newInServiceDate = alreadyInServiceDate;
            newAccumulated = currentAccumulated;
          }

          db.run(`UPDATE equipment SET name = ?, serial_number = ?, category = ?, model = ?, purchase_date = ?,
                  purchase_cost = ?, price = ?, shipping_charge = ?, manufacturer = ?, warranty_expiry = ?, location_id = ?, supplier_id = ?, condition_id = ?, condition = ?, status_id = ?, status = ?, comments = ?, photo_path = ?, manual_document_path = ?, description = ?, catalog_id = ?, brand = ?, specification = ?, other_charges = ?, barcode = ?, owner_id = ?, preventive_maintenance_months = ?, purchase_order_number = ?, in_service_date = ?, accumulated_usage_days = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
            [name, serial_number, category, model, purchase_date, purchase_cost, price, shipping_charge, manufacturer, warranty_expiry, location_id, supplier_id, resolvedConditionId, condition, resolvedStatusId, status, comments, photo_path, document_path, description, catalog_id, brand, specification, other_charges, barcode, owner_id || null, preventive_maintenance_months || null, purchase_order_number || null, newInServiceDate, newAccumulated, assigned_to || null, req.params.id],
            function(err) {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({ message: 'Equipment updated' });
            }
          );
        });
      });
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

router.delete('/:id(\\d+)', requireModulePermission('equipment', 'delete'), (req, res) => {
  const equipmentId = req.params.id;

  db.get(`SELECT
    (SELECT COUNT(*) FROM equipment_transfers WHERE equipment_id = ?) as transfers,
    (SELECT COUNT(*) FROM equipment_write_offs WHERE equipment_id = ?) as write_offs,
    (SELECT COUNT(*) FROM maintenance_logs WHERE equipment_id = ?) as maintenance_logs`,
    [equipmentId, equipmentId, equipmentId],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const related = [];
      if (row.transfers > 0) related.push(`${row.transfers} transfer(s)`);
      if (row.write_offs > 0) related.push(`${row.write_offs} write-off(s)`);
      if (row.maintenance_logs > 0) related.push(`${row.maintenance_logs} maintenance log(s)`);

      if (related.length > 0) {
        res.status(400).json({ error: `Cannot delete equipment with related records: ${related.join(', ')}` });
        return;
      }

      db.run('DELETE FROM equipment WHERE id = ?', [equipmentId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Equipment deleted' });
      });
    }
  );
});

// Equipment Photos routes
router.get('/:id(\\d+)/photos', (req, res) => {
  db.all('SELECT * FROM equipment_photos WHERE equipment_id = ? ORDER BY created_at ASC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.post('/:id(\\d+)/photos', upload.array('photos', 10), async (req, res) => {
  const equipmentId = req.params.id;
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No photos uploaded' });
  try {
    await dedupUploadedFiles(req.files);
  } catch (err) {
    return res.status(500).json({ error: 'File dedup error: ' + err.message });
  }
  const stmt = db.prepare('INSERT INTO equipment_photos (equipment_id, photo_path) VALUES (?, ?)');
  const saved = [];
  req.files.forEach(file => {
    const photoPath = `/uploads/${file.filename}`;
    stmt.run([equipmentId, photoPath]);
    saved.push(photoPath);
  });
  stmt.finalize();
  res.json({ uploaded: saved });
});

// Link existing photo paths to an equipment (used by copy feature - files already exist on disk)
router.post('/:id(\\d+)/link-photos', (req, res) => {
  const equipmentId = req.params.id;
  const { photo_paths } = req.body;
  if (!photo_paths || !Array.isArray(photo_paths) || photo_paths.length === 0) {
    return res.status(400).json({ error: 'photo_paths array required' });
  }
  const stmt = db.prepare('INSERT INTO equipment_photos (equipment_id, photo_path) VALUES (?, ?)');
  const saved = [];
  photo_paths.forEach(p => {
    stmt.run([equipmentId, p]);
    saved.push(p);
  });
  stmt.finalize();
  res.json({ linked: saved });
});

router.delete('/:equipmentId(\\d+)/photos/:photoId(\\d+)', (req, res) => {
  db.get('SELECT photo_path FROM equipment_photos WHERE id = ? AND equipment_id = ?', [req.params.photoId, req.params.equipmentId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Photo not found' });
    db.run('DELETE FROM equipment_photos WHERE id = ?', [req.params.photoId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      // Only delete the physical file if no other rows reference the same path
      isPhotoReferencedElsewhere(row.photo_path, req.params.photoId, (err3, refCount) => {
        if (!err3 && refCount === 0) {
          const filePath = path.join(__dirname, '..', 'public', row.photo_path);
          fs.unlink(filePath, () => {});
        }
        res.json({ message: 'Photo deleted' });
      });
    });
  });
});

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (cell !== '' || row.length > 0) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      }
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

router.post('/import-csv', requireModulePermission('equipment', 'add'), upload.single('csv'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No CSV file uploaded' });
    return;
  }

  const csvText = fs.readFileSync(req.file.path, 'utf-8');
  fs.unlink(req.file.path, (err) => {
    if (err) console.error('Error deleting temp CSV file:', err);
  });
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    res.status(400).json({ error: 'CSV file is empty or missing header' });
    return;
  }

  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
  const nameIndex = headers.indexOf('name');
  if (nameIndex === -1) {
    res.status(400).json({ error: 'CSV must contain a "name" column' });
    return;
  }

  const columnMap = {
    auto_serial_number: headers.indexOf('auto_serial_number'),
    serial_number: headers.indexOf('serial_number'),
    category: headers.indexOf('category'),
    model: headers.indexOf('model'),
    barcode: headers.indexOf('barcode'),
    brand: headers.indexOf('brand'),
    manufacturer: headers.indexOf('manufacturer'),
    specification: headers.indexOf('specification'),
    purchase_date: headers.indexOf('purchase_date'),
    warranty_expiry: headers.indexOf('warranty_expiry'),
    purchase_cost: headers.indexOf('purchase_cost'),
    price: headers.indexOf('price'),
    shipping_charge: headers.indexOf('shipping_charge'),
    other_charges: headers.indexOf('other_charges'),
    condition: headers.indexOf('condition'),
    status: headers.indexOf('status'),
    location_id: headers.indexOf('location_id'),
    supplier_id: headers.indexOf('supplier_id'),
    owner_id: headers.indexOf('owner_id'),
    catalog_id: headers.indexOf('catalog_id'),
    preventive_maintenance_months: headers.indexOf('preventive_maintenance_months'),
    description: headers.indexOf('description'),
    comments: headers.indexOf('comments')
  };

  db.get('SELECT COUNT(*) as count FROM equipment', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const startCount = row.count;
    const errors = [];
    let importedCount = 0;
    let successCount = 0;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`INSERT INTO equipment (
        auto_serial_number, name, serial_number, category, model, barcode, brand, manufacturer, specification,
        purchase_date, warranty_expiry, purchase_cost, price, shipping_charge, other_charges,
        condition, status, location_id, supplier_id, owner_id, catalog_id, preventive_maintenance_months, description, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      for (let i = 1; i < rows.length; i++) {
        const csvRow = rows[i];
        const name = csvRow[nameIndex];
        if (!name || name.trim() === '') {
          errors.push(`Row ${i + 1}: name is required`);
          continue;
        }

        const autoSerialNumber = `EQ-${String(startCount + importedCount + 1).padStart(3, '0')}`;
        importedCount++;
        const values = [
          autoSerialNumber,
          name,
          columnMap.serial_number >= 0 ? csvRow[columnMap.serial_number] || null : null,
          columnMap.category >= 0 ? csvRow[columnMap.category] || null : null,
          columnMap.model >= 0 ? csvRow[columnMap.model] || null : null,
          columnMap.barcode >= 0 ? csvRow[columnMap.barcode] || null : null,
          columnMap.brand >= 0 ? csvRow[columnMap.brand] || null : null,
          columnMap.manufacturer >= 0 ? csvRow[columnMap.manufacturer] || null : null,
          columnMap.specification >= 0 ? csvRow[columnMap.specification] || null : null,
          columnMap.purchase_date >= 0 ? csvRow[columnMap.purchase_date] || null : null,
          columnMap.warranty_expiry >= 0 ? csvRow[columnMap.warranty_expiry] || null : null,
          columnMap.purchase_cost >= 0 ? (parseFloat(csvRow[columnMap.purchase_cost]) || null) : null,
          columnMap.price >= 0 ? (parseFloat(csvRow[columnMap.price]) || null) : null,
          columnMap.shipping_charge >= 0 ? (parseFloat(csvRow[columnMap.shipping_charge]) || null) : null,
          columnMap.other_charges >= 0 ? (parseFloat(csvRow[columnMap.other_charges]) || null) : null,
          columnMap.condition >= 0 ? csvRow[columnMap.condition] || null : null,
          columnMap.status >= 0 ? csvRow[columnMap.status] || null : null,
          columnMap.location_id >= 0 ? (parseInt(csvRow[columnMap.location_id]) || null) : null,
          columnMap.supplier_id >= 0 ? (parseInt(csvRow[columnMap.supplier_id]) || null) : null,
          columnMap.owner_id >= 0 ? (parseInt(csvRow[columnMap.owner_id]) || null) : null,
          columnMap.catalog_id >= 0 ? (parseInt(csvRow[columnMap.catalog_id]) || null) : null,
          columnMap.preventive_maintenance_months >= 0 ? (parseInt(csvRow[columnMap.preventive_maintenance_months]) || null) : null,
          columnMap.description >= 0 ? csvRow[columnMap.description] || null : null,
          columnMap.comments >= 0 ? csvRow[columnMap.comments] || null : null
        ];

        stmt.run(values, function(err) {
          if (err) {
            errors.push(`Row ${i + 1}: ${err.message}`);
          } else {
            successCount++;
          }
        });
      }

      stmt.finalize((err) => {
        if (err) {
          errors.push(err.message);
        }
        db.run('COMMIT', (err) => {
          if (err) {
            errors.push(err.message);
          }
          res.json({
            imported: successCount,
            errors: errors.length > 0 ? errors : undefined,
            message: `Imported ${successCount} equipment${errors.length > 0 ? `, ${errors.length} errors` : ''}`
          });
        });
      });
    });
  });
});

function escapeCSV(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCSVRow(values) {
  return values.map(escapeCSV).join(',') + '\n';
}

const csvHeaders = [
  'name', 'serial_number', 'auto_serial_number', 'category', 'model', 'barcode', 'brand', 'manufacturer', 'specification',
  'purchase_date', 'warranty_expiry', 'purchase_cost', 'price', 'shipping_charge', 'other_charges',
  'condition', 'status', 'location_id', 'supplier_id', 'owner_id', 'catalog_id', 'preventive_maintenance_months',
  'description', 'comments'
];

const exportCsvHeaders = [
  'name', 'serial_number', 'auto_serial_number', 'category', 'model', 'barcode', 'brand', 'manufacturer', 'specification',
  'purchase_date', 'warranty_expiry', 'purchase_cost', 'price', 'shipping_charge', 'other_charges',
  'condition', 'status', 'country', 'location', 'sublocation_business_type', 'supplier', 'owner', 'catalog_id', 'preventive_maintenance_months',
  'description', 'comments'
];

router.get('/export-template', (req, res) => {
  const sampleRow = [
    'Sample Equipment', 'SN-12345', 'EQ-001', 'Category', 'Model X', 'BC-001', 'Brand', 'Manufacturer', 'Spec',
    '2024-01-15', '2026-01-15', '1000', '1200', '50', '0',
    'Good', 'Active', '1', '1', '1', '1', '6',
    'Description', 'Comments'
  ];

  const csv = buildCSVRow(csvHeaders) + buildCSVRow(sampleRow);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="equipment_template.csv"');
  res.send(csv);
});

router.get('/export-csv', requireModulePermission('equipment', 'export'), (req, res) => {
  const { search, status, country, location, sublocation, owner, assignedTo } = req.query;
  const searchLower = search ? String(search).toLowerCase() : '';

  getAllowedFilters(req, (err, allowedLocationIds, allowedOwnerIds) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let query = `${EQUIPMENT_LIST_QUERY} ORDER BY e.id`;
    let params = [];
    const conditions = [];
    if (allowedLocationIds !== null) {
      if (allowedLocationIds.length === 0) {
        return res.json([]);
      }
      conditions.push(`e.location_id IN (${allowedLocationIds.map(() => '?').join(',')})`);
      params.push(...allowedLocationIds);
    }
    if (allowedOwnerIds !== null) {
      if (allowedOwnerIds.length === 0) {
        return res.json([]);
      }
      conditions.push(`e.owner_id IN (${allowedOwnerIds.map(() => '?').join(',')})`);
      params.push(...allowedOwnerIds);
    }
    if (conditions.length > 0) {
      query = `${EQUIPMENT_LIST_QUERY} WHERE ${conditions.join(' AND ')} ORDER BY e.id`;
    }
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const filtered = rows.filter(row => {
      const matchesSearch = !searchLower ||
        (row.name && String(row.name).toLowerCase().includes(searchLower)) ||
        (row.serial_number && String(row.serial_number).toLowerCase().includes(searchLower)) ||
        (row.barcode && String(row.barcode).toLowerCase().includes(searchLower)) ||
        (row.auto_serial_number && String(row.auto_serial_number).toLowerCase().includes(searchLower)) ||
        (row.assigned_to_name && String(row.assigned_to_name).toLowerCase().includes(searchLower)) ||
        (row.purchase_order_number && String(row.purchase_order_number).toLowerCase().includes(searchLower)) ||
        (row.location_name && String(row.location_name).toLowerCase().includes(searchLower)) ||
        (row.country_name && String(row.country_name).toLowerCase().includes(searchLower)) ||
        (row.sub_location_name && String(row.sub_location_name).toLowerCase().includes(searchLower)) ||
        (row.business_type_name && String(row.business_type_name).toLowerCase().includes(searchLower)) ||
        (row.owner_name && String(row.owner_name).toLowerCase().includes(searchLower)) ||
        (row.category && String(row.category).toLowerCase().includes(searchLower)) ||
        (row.transfer_assigned_history && String(row.transfer_assigned_history).toLowerCase().includes(searchLower)) ||
        (row.write_off_history && String(row.write_off_history).toLowerCase().includes(searchLower));
      const matchesStatus = !status || row.status === status || (row.display_status && row.display_status === status);
      const matchesCountry = !country || row.country_name === country;
      const matchesLocation = !location || row.location_name === location;
      const matchesSublocation = !sublocation || row.location_id == sublocation;
      const matchesOwner = !owner || row.owner_name === owner;
      const matchesAssignedTo = !assignedTo || row.assigned_to_name === assignedTo;
      return matchesSearch && matchesStatus && matchesCountry && matchesLocation && matchesSublocation && matchesOwner && matchesAssignedTo;
    });

    let csv = buildCSVRow(exportCsvHeaders);
    filtered.forEach(row => {
      row.country = row.country_name || '-';
      row.location = row.location_name || '-';
      row.sublocation_business_type = [row.sub_location_name, row.business_type_name, row.business_unit_code].filter(Boolean).join(' - ') || '-';
      row.supplier = row.supplier_name || '-';
      row.owner = row.owner_name || '-';
      csv += buildCSVRow(exportCsvHeaders.map(h => row[h] || ''));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment_export.csv"');
    res.send(csv);
  });
  });
});

// EQUIPMENT TRANSFERS
router.get('/transfers', (req, res) => {
  db.all(`SELECT et.*, e.name as equipment_name, e.auto_serial_number as equipment_auto_serial, e.barcode as equipment_barcode,
          fc.name as from_country_name, flt.name as from_location_type_name, fslt.name as from_sub_location_name, fbt.name as from_business_type_name, fbta.business_unit_code as from_business_unit_code,
          tc.name as to_country_name, tlt.name as to_location_type_name, tslt.name as to_sub_location_name, tbt.name as to_business_type_name, tbta.business_unit_code as to_business_unit_code,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name || ' - ' || fbta.business_unit_code as from_location_name,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name || ' - ' || tbta.business_unit_code as to_location_name,
          CASE
            WHEN CAST(et.assigned_to AS INTEGER) > 0 THEN emp.first_name || ' ' || emp.last_name
            ELSE et.assigned_to
          END as assigned_to_name,
          CASE
            WHEN CAST(et.previous_assigned_to AS INTEGER) > 0 THEN prev_emp.first_name || ' ' || prev_emp.last_name
            ELSE et.previous_assigned_to
          END as previous_assigned_to_name
          FROM equipment_transfers et
          JOIN equipment e ON et.equipment_id = e.id
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
          LEFT JOIN employees emp ON CAST(et.assigned_to AS INTEGER) = emp.id
          LEFT JOIN employees prev_emp ON CAST(et.previous_assigned_to AS INTEGER) = prev_emp.id
          ORDER BY et.transfer_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/transfers/next-serial', (req, res) => {
  db.get(`SELECT et.transfer_serial_number
          FROM equipment_transfers et
          JOIN equipment e ON et.equipment_id = e.id
          WHERE et.transfer_serial_number IS NOT NULL
          ORDER BY et.id DESC LIMIT 1`, [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'TRF-001';
    if (row && row.transfer_serial_number) {
      const currentNum = parseInt(row.transfer_serial_number.split('-')[1]);
      const nextNum = currentNum + 1;
      nextSerial = `TRF-${String(nextNum).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.delete('/transfers/:id', requireModulePermission('transfers', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_transfers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Transfer deleted' });
  });
});

router.put('/transfers/:id', requireModulePermission('transfers', 'edit'), (req, res) => {
  const { transfer_serial_number, equipment_id, from_location_id, to_location_id, transfer_date, assigned_to, notes, created_by } = req.body;
  db.get('SELECT id FROM equipment_transfers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Transfer not found' });
      return;
    }
    db.run('BEGIN TRANSACTION');
    db.run('UPDATE equipment SET location_id = ? WHERE id = ?', [to_location_id, equipment_id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      db.run(`UPDATE equipment_transfers SET transfer_serial_number = ?, equipment_id = ?, from_location_id = ?, to_location_id = ?, transfer_date = ?, assigned_to = ?, notes = ?, created_by = ?
              WHERE id = ?`,
        [transfer_serial_number, equipment_id, from_location_id, to_location_id, transfer_date || new Date().toISOString().split('T')[0], assigned_to, notes, created_by, req.params.id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          db.run('UPDATE equipment SET assigned_to = ? WHERE id = ?', [assigned_to || null, equipment_id], function(err2) {
            if (err2) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err2.message });
              return;
            }
            db.run('COMMIT');
            res.json({ message: 'Transfer updated' });
          });
        }
      );
    });
  });
});

router.delete('/transfers/all', requireModulePermission('transfers', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_transfers', [], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'All transfers deleted' });
  });
});

router.get('/transfers/delete-all', requireModulePermission('transfers', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_transfers', [], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'All transfers deleted' });
  });
});

router.post('/transfers', requireModulePermission('transfers', 'add'), (req, res) => {
  const { transfer_serial_number, equipment_id, from_location_id, to_location_id, transfer_date, assigned_to, notes, created_by } = req.body;

  db.run('BEGIN TRANSACTION');

  db.get(`SELECT e.status, e.in_service_date, e.accumulated_usage_days, e.assigned_to as previous_assigned_to,
            (SELECT bt.name FROM business_types bt WHERE bt.id = (SELECT bta.business_type_id FROM business_type_assignments bta WHERE bta.id = ?)) as from_business_type,
            (SELECT bt.name FROM business_types bt WHERE bt.id = (SELECT bta.business_type_id FROM business_type_assignments bta WHERE bta.id = ?)) as to_business_type
          FROM equipment e
          WHERE e.id = ?`, [from_location_id, to_location_id, equipment_id], (err, row) => {
    if (err) {
      db.run('ROLLBACK');
      res.status(500).json({ error: err.message });
      return;
    }

    const previousAssignedTo = row ? row.previous_assigned_to : null;
    const assignedToValue = assigned_to || null;
    const effectiveToLocationId = to_location_id || from_location_id;
    const effectiveTransferDate = transfer_date || new Date().toISOString().split('T')[0];

    function doTransferUpdate(sql, params) {
      db.run(sql, params, (err) => {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        db.run(`INSERT INTO equipment_transfers (transfer_serial_number, equipment_id, from_location_id, to_location_id, transfer_date, assigned_to, previous_assigned_to, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [transfer_serial_number, equipment_id, from_location_id, effectiveToLocationId, effectiveTransferDate, assigned_to, previousAssignedTo, notes, created_by],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }
            db.run('COMMIT');
            res.json({ id: this.lastID, equipment_id, from_location_id, to_location_id: effectiveToLocationId, notes, created_by });
          }
        );
      });
    }

    if (to_location_id) {
      const toType = row ? row.to_business_type : null;
      const isStoreType = (type) => type && (type.toLowerCase() === 'store' || type.toLowerCase() === 'stores');
      const isToStore = isStoreType(toType);
      const wasInStore = row && row.status && row.status.toLowerCase() === 'in stores';
      const newStatus = isToStore ? 'In Stores' : 'In service';

      if (!isToStore && wasInStore && row.in_service_date) {
        // Moving FROM store back to service — calculate store days and add to accumulated
        db.get(
          `SELECT MAX(et.transfer_date) as store_entry_date
           FROM equipment_transfers et
           JOIN business_type_assignments bta ON et.to_location_id = bta.id
           JOIN business_types bt ON bta.business_type_id = bt.id
           WHERE et.equipment_id = ? AND LOWER(bt.name) IN ('store', 'stores')
           AND et.transfer_date <= ?`,
          [equipment_id, effectiveTransferDate],
          (storeErr, storeRow) => {
            const storeEntryDate = storeRow && storeRow.store_entry_date;
            let storeDays = 0;
            if (storeEntryDate) {
              storeDays = Math.round((new Date(effectiveTransferDate) - new Date(storeEntryDate)) / (1000 * 60 * 60 * 24));
              storeDays = Math.max(0, storeDays);
            }
            const currentAccumulated = row.accumulated_usage_days || 0;
            const newAccumulated = currentAccumulated + storeDays;
            doTransferUpdate(
              'UPDATE equipment SET location_id = ?, status = ?, accumulated_usage_days = ?, assigned_to = ? WHERE id = ?',
              [to_location_id, newStatus, newAccumulated, assignedToValue, equipment_id]
            );
          }
        );
      } else if (!isToStore && wasInStore && !row.in_service_date) {
        // First time moving from store to service — set in_service_date
        doTransferUpdate(
          'UPDATE equipment SET location_id = ?, status = ?, in_service_date = ?, assigned_to = ? WHERE id = ?',
          [to_location_id, newStatus, effectiveTransferDate, assignedToValue, equipment_id]
        );
      } else if (isToStore) {
        // Moving TO store — keep in_service_date and accumulated unchanged
        doTransferUpdate(
          'UPDATE equipment SET location_id = ?, status = ?, assigned_to = ? WHERE id = ?',
          [to_location_id, newStatus, assignedToValue, equipment_id]
        );
      } else {
        // Service to service transfer
        doTransferUpdate(
          'UPDATE equipment SET location_id = ?, status = ?, assigned_to = ? WHERE id = ?',
          [to_location_id, newStatus, assignedToValue, equipment_id]
        );
      }
    } else {
      doTransferUpdate(
        'UPDATE equipment SET assigned_to = ? WHERE id = ?',
        [assignedToValue, equipment_id]
      );
    }
  });
});

// MAINTENANCE LOGS
router.get('/maintenance-logs', (req, res) => {
  const equipment_id = req.query.equipment_id;
  let query = `SELECT ml.*, e.name as equipment_name, e.auto_serial_number as equipment_auto_serial,
               ml.performed_by_id, ml.requested_by_id,
               emp.first_name || ' ' || emp.last_name as performed_by_name,
               emp2.first_name || ' ' || emp2.last_name as requested_by_name,
               c.name as country_name, lt.name as location_type_name, slt.name as sub_location_name, bt.name as business_type_name, bta.business_unit_code,
               eo.name as owner_name,
               e.location_id,
               c.name || ' - ' || lt.name || ' - ' || slt.name || ' - ' || bt.name || ' - ' || bta.business_unit_code as location_name
               FROM maintenance_logs ml
               LEFT JOIN equipment e ON ml.equipment_id = e.id
               LEFT JOIN business_type_assignments bta ON e.location_id = bta.id
               LEFT JOIN countries c ON bta.country_id = c.id
               LEFT JOIN location_types lt ON bta.location_id = lt.id
               LEFT JOIN sub_location_types slt ON bta.sub_location_id = slt.id
               LEFT JOIN business_types bt ON bta.business_type_id = bt.id
               LEFT JOIN equipment_owners eo ON e.owner_id = eo.id
               LEFT JOIN employees emp ON ml.performed_by = emp.id
               LEFT JOIN employees emp2 ON ml.requested_by = emp2.id`;
  let params = [];

  if (equipment_id) {
    query += ' WHERE ml.equipment_id = ?';
    params.push(equipment_id);
  }

  query += ' ORDER BY ml.performed_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get maintenance history for a specific equipment
router.get('/:id/maintenance-history', (req, res) => {
  db.all(`SELECT ml.*, e.name as equipment_name, e.auto_serial_number as equipment_auto_serial,
          emp.first_name || ' ' || emp.last_name as performed_by_name
          FROM maintenance_logs ml
          JOIN equipment e ON ml.equipment_id = e.id
          LEFT JOIN employees emp ON ml.performed_by = emp.id
          WHERE ml.equipment_id = ?
          ORDER BY ml.performed_date DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (rows.length === 0) {
        res.json([]);
        return;
      }
      let completed = 0;
      rows.forEach(row => {
        // Get parts
        db.all(`SELECT mp.*, sp.name as spare_part_name, sp.part_number as spare_part_part_number
                FROM maintenance_parts mp
                JOIN spare_parts sp ON mp.spare_part_id = sp.id
                WHERE mp.maintenance_log_id = ?`,
          [row.id],
          (errParts, parts) => {
            if (errParts) {
              row.parts = [];
            } else {
              row.parts = parts;
            }
            // Get PM types for this log
            db.all(`SELECT DISTINCT pmt.pm_type
                    FROM maintenance_log_tasks mlt
                    JOIN preventive_maintenance_tasks pmt ON mlt.pm_task_id = pmt.id
                    WHERE mlt.maintenance_log_id = ?`,
              [row.id],
              (errPm, pmTypes) => {
                row.pm_types = (errPm || !pmTypes) ? [] : pmTypes.map(p => p.pm_type);
                completed++;
                if (completed === rows.length) {
                  res.json(rows);
                }
              }
            );
          }
        );
      });
    }
  );
});

// Get transfer history for a specific equipment
router.get('/:id/transfer-history', (req, res) => {
  db.all(`SELECT et.*,
          fc.name || ' - ' || flt.name || ' - ' || fslt.name || ' - ' || fbt.name || ' - ' || fbta.business_unit_code as from_location_name,
          tc.name || ' - ' || tlt.name || ' - ' || tslt.name || ' - ' || tbt.name || ' - ' || tbta.business_unit_code as to_location_name,
          CASE 
            WHEN CAST(et.assigned_to AS INTEGER) > 0 THEN emp.first_name || ' ' || emp.last_name
            ELSE et.assigned_to
          END as assigned_to_name,
          CASE 
            WHEN CAST(et.previous_assigned_to AS INTEGER) > 0 THEN prev_emp.first_name || ' ' || prev_emp.last_name
            ELSE et.previous_assigned_to
          END as previous_assigned_to_name
          FROM equipment_transfers et
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
          LEFT JOIN employees emp ON CAST(et.assigned_to AS INTEGER) = emp.id
          LEFT JOIN employees prev_emp ON CAST(et.previous_assigned_to AS INTEGER) = prev_emp.id
          WHERE et.equipment_id = ?
          ORDER BY et.transfer_date DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

router.get('/maintenance-logs/next-serial', (req, res) => {
  db.get('SELECT maintenance_serial_number FROM maintenance_logs WHERE maintenance_serial_number IS NOT NULL ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let nextSerial = 'MA-001';
    if (row && row.maintenance_serial_number) {
      const currentNum = parseInt(row.maintenance_serial_number.split('-')[1]);
      const nextNum = currentNum + 1;
      nextSerial = `MA-${String(nextNum).padStart(3, '0')}`;
    }
    res.json({ next_serial: nextSerial });
  });
});

router.get('/maintenance-logs/:id/parts', (req, res) => {
  db.all(`SELECT mp.*, sp.name as spare_part_name, sp.part_number as spare_part_number, sp.part_serial_number as spare_part_serial, sp.spare_part_serial_number as spare_part_auto_serial
          FROM maintenance_parts mp
          JOIN spare_parts sp ON mp.spare_part_id = sp.id
          WHERE mp.maintenance_log_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

router.get('/maintenance-logs/:id/photos', (req, res) => {
  db.all('SELECT * FROM maintenance_photos WHERE maintenance_log_id = ? ORDER BY created_at',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

router.post('/maintenance-logs/:id/photos', upload.array('photos', 20), async (req, res) => {
  const maintenanceLogId = req.params.id;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No photos uploaded' });
  }
  try {
    dedupUploadedFiles(req.files);
  } catch (err) {
    console.error('[MAINT PHOTOS] Dedup error:', err.message);
    return res.status(500).json({ error: 'File dedup error: ' + err.message });
  }
  const saved = [];
  let completed = 0;
  let hasError = false;
  req.files.forEach((file) => {
    const photoPath = `/uploads/${file.filename}`;
    db.run('INSERT INTO maintenance_photos (maintenance_log_id, photo_path) VALUES (?, ?)',
      [maintenanceLogId, photoPath],
      function(err) {
        completed++;
        if (err) {
          console.error('[MAINT PHOTOS] DB insert error for', photoPath + ':', err.message);
          if (!hasError) {
            hasError = true;
            return res.status(500).json({ error: 'DB insert error: ' + err.message });
          }
          return;
        }
        saved.push({ id: file.filename, photo_path: photoPath });
        if (completed === req.files.length && !hasError) {
          res.json({ saved });
        }
      }
    );
  });
});

router.delete('/maintenance-logs/:id/photos/:photoId', (req, res) => {
  db.get('SELECT photo_path FROM maintenance_photos WHERE id = ? AND maintenance_log_id = ?', [req.params.photoId, req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Photo not found' });
    db.run('DELETE FROM maintenance_photos WHERE id = ?', [req.params.photoId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      isPhotoReferencedElsewhere(row.photo_path, req.params.photoId, (err3, refCount) => {
        if (!err3 && refCount === 0) {
          const filePath = path.join(__dirname, '..', row.photo_path);
          fs.unlink(filePath, () => {});
        }
        res.json({ message: 'Photo deleted' });
      });
    });
  });
});

router.post('/maintenance-logs', requireModulePermission('maintenance', 'add'), (req, res) => {
  const { maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by_id, performed_by, requested_by_id, requested_by, performed_date, next_maintenance_date, parts } = req.body;

  resolveEmployeeId(performed_by_id, performed_by, (err, resolvedPerformedById) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolveEmployeeId(requested_by_id, requested_by, (err, resolvedRequestedById) => {
      if (err) { res.status(500).json({ error: err.message }); return; }

  db.run('BEGIN TRANSACTION');

  db.run(`INSERT INTO maintenance_logs (maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by_id, performed_by, requested_by_id, requested_by, performed_date, next_maintenance_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, resolvedPerformedById, performed_by, resolvedRequestedById, requested_by || null, performed_date, next_maintenance_date],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }

      const maintenanceLogId = this.lastID;

      // If maintenance is completed, reset accumulated usage days
      if (maintenance_status && maintenance_status.toLowerCase() === 'completed') {
        db.run('UPDATE equipment SET accumulated_usage_days = 0 WHERE id = ?', [equipment_id]);
      }

      // If parts are provided, save them and deduct from inventory
      if (parts && Array.isArray(parts) && parts.length > 0) {
        let partsSaved = 0;
        let partsError = null;

        parts.forEach((part, index) => {
          db.run(`INSERT INTO maintenance_parts (maintenance_log_id, spare_part_id, quantity_used, cost_at_time)
                  VALUES (?, ?, ?, ?)`,
            [maintenanceLogId, part.spare_part_id, part.quantity_used, part.cost_at_time],
            function(err) {
              if (err) {
                partsError = err;
                return;
              }

              // Deduct from spare parts inventory
              db.run(`UPDATE spare_parts SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [part.quantity_used, part.spare_part_id],
                function(err) {
                  if (err) {
                    partsError = err;
                    return;
                  }

                  // Record consumption transaction
                  db.run(`INSERT INTO spare_part_transactions (spare_part_id, transaction_type, quantity, unit_cost, total_cost, reference_id, reference_type, transaction_date, notes)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [part.spare_part_id, 'consumption', part.quantity_used, part.cost_at_time, part.cost_at_time ? (part.cost_at_time * part.quantity_used) : 0, maintenanceLogId, 'maintenance_log', performed_date, `Used in maintenance ${maintenance_serial_number || '#' + maintenanceLogId}`],
                    function(err) {
                      if (err) {
                        partsError = err;
                        return;
                      }

                      partsSaved++;
                      if (partsSaved === parts.length) {
                        if (partsError) {
                          db.run('ROLLBACK');
                          res.status(500).json({ error: partsError.message });
                        } else {
                          db.run('COMMIT');
                          res.json({ id: maintenanceLogId, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by, performed_date, next_maintenance_date, parts });
                        }
                      }
                    }
                  );
                }
              );
            }
          );
        });
      } else {
        db.run('COMMIT');
        res.json({ id: maintenanceLogId, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by, performed_date, next_maintenance_date });
      }
    }
  );
    });
  });
});

router.delete('/maintenance-logs/:id', requireModulePermission('maintenance', 'delete'), (req, res) => {
  db.run('DELETE FROM maintenance_parts WHERE maintenance_log_id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run('DELETE FROM maintenance_log_tasks WHERE maintenance_log_id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('DELETE FROM maintenance_logs WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Maintenance log deleted' });
      });
    });
  });
});

// Get maintenance log tasks
router.get('/maintenance-logs/:id/tasks', (req, res) => {
  db.all('SELECT * FROM maintenance_log_tasks WHERE maintenance_log_id = ? ORDER BY id', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Save maintenance log tasks
router.post('/maintenance-logs/:id/tasks', (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks)) {
    res.status(400).json({ error: 'Tasks array is required' });
    return;
  }
  db.run('DELETE FROM maintenance_log_tasks WHERE maintenance_log_id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (tasks.length === 0) {
      res.json({ saved: 0 });
      return;
    }
    let saved = 0;
    let saveError = null;
    tasks.forEach(task => {
      db.run('INSERT INTO maintenance_log_tasks (maintenance_log_id, pm_task_id, task_text, is_checked, notes) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, task.pm_task_id || null, task.task_text, task.is_checked ? 1 : 0, task.notes || null],
        function(err) {
          if (err) { saveError = err; return; }
          saved++;
          if (saved === tasks.length) {
            if (saveError) {
              res.status(500).json({ error: saveError.message });
            } else {
              res.json({ saved });
            }
          }
        }
      );
    });
  });
});

router.put('/maintenance-logs/:id', requireModulePermission('maintenance', 'edit'), (req, res) => {
  const { maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by_id, performed_by, requested_by_id, requested_by, performed_date, next_maintenance_date, parts } = req.body;

  resolveEmployeeId(performed_by_id, performed_by, (err, resolvedPerformedById) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolveEmployeeId(requested_by_id, requested_by, (err, resolvedRequestedById) => {
      if (err) { res.status(500).json({ error: err.message }); return; }

  db.run('BEGIN TRANSACTION');

  db.run(`UPDATE maintenance_logs SET maintenance_serial_number = ?, equipment_id = ?, maintenance_type = ?, maintenance_status = ?, description = ?, cost = ?, performed_by_id = ?, performed_by = ?, requested_by_id = ?, requested_by = ?, performed_date = ?, next_maintenance_date = ?
          WHERE id = ?`,
    [maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, resolvedPerformedById, performed_by, resolvedRequestedById, requested_by || null, performed_date, next_maintenance_date, req.params.id],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }

      // Get existing parts to restore inventory later
      db.all('SELECT spare_part_id, quantity_used FROM maintenance_parts WHERE maintenance_log_id = ?', [req.params.id], function(err, existingParts) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        // Delete existing parts for this maintenance log
        db.run('DELETE FROM maintenance_parts WHERE maintenance_log_id = ?', [req.params.id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }

          function restoreInventoryAndSave() {
            // Delete old consumption transactions for this maintenance log
            db.run('DELETE FROM spare_part_transactions WHERE reference_id = ? AND reference_type = ?',
              [req.params.id, 'maintenance_log'],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                  return;
                }

                // Restore inventory for previously used parts
                let restoredCount = 0;
                let restoreError = null;

                if (existingParts.length === 0) {
                  saveNewParts();
                  return;
                }

                existingParts.forEach(part => {
                  db.run('UPDATE spare_parts SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [part.quantity_used, part.spare_part_id],
                    function(err) {
                      if (err) {
                        restoreError = err;
                        return;
                      }
                      restoredCount++;
                      if (restoredCount === existingParts.length) {
                        if (restoreError) {
                          db.run('ROLLBACK');
                          res.status(500).json({ error: restoreError.message });
                        } else {
                          saveNewParts();
                        }
                      }
                    }
                  );
                });
              }
            );
          }

          function saveNewParts() {
            if (parts && Array.isArray(parts) && parts.length > 0) {
              let partsSaved = 0;
              let partsError = null;

              parts.forEach((part, index) => {
                db.run(`INSERT INTO maintenance_parts (maintenance_log_id, spare_part_id, quantity_used, cost_at_time)
                        VALUES (?, ?, ?, ?)`,
                  [req.params.id, part.spare_part_id, part.quantity_used, part.cost_at_time],
                  function(err) {
                    if (err) {
                      partsError = err;
                      return;
                    }

                    // Deduct from spare parts inventory
                    db.run(`UPDATE spare_parts SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                      [part.quantity_used, part.spare_part_id],
                      function(err) {
                        if (err) {
                          partsError = err;
                          return;
                        }

                        // Record consumption transaction
                        db.run(`INSERT INTO spare_part_transactions (spare_part_id, transaction_type, quantity, unit_cost, total_cost, reference_id, reference_type, transaction_date, notes)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                          [part.spare_part_id, 'consumption', part.quantity_used, part.cost_at_time, part.cost_at_time ? (part.cost_at_time * part.quantity_used) : 0, req.params.id, 'maintenance_log', performed_date, `Used in maintenance ${maintenance_serial_number || '#' + req.params.id}`],
                          function(err) {
                            if (err) {
                              partsError = err;
                              return;
                            }

                            partsSaved++;
                            if (partsSaved === parts.length) {
                              if (partsError) {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: partsError.message });
                              } else {
                                db.run('COMMIT');
                                res.json({ id: req.params.id, maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by, performed_date, next_maintenance_date, parts });
                              }
                            }
                          }
                        );
                      }
                    );
                  }
                );
              });
            } else {
              db.run('COMMIT');
              res.json({ id: req.params.id, maintenance_serial_number, equipment_id, maintenance_type, maintenance_status, description, cost, performed_by, performed_date, next_maintenance_date });
            }
          }

          restoreInventoryAndSave();
        });
      });
    }
  );
    });
  });
});

// Spare Parts Next Serial
router.get('/spare-parts/next-serial', (req, res) => {
  db.get(`SELECT spare_part_serial_number, purchase_order_number FROM spare_parts ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    let nextSerial = 'SP-001';
    if (row) {
      const existing = row.spare_part_serial_number || row.purchase_order_number;
      if (existing && existing.startsWith('SP-')) {
        const currentNum = parseInt(existing.split('-')[1]);
        const nextNum = currentNum + 1;
        nextSerial = `SP-${String(nextNum).padStart(3, '0')}`;
      }
    }
    res.json({ next_serial: nextSerial });
  });
});

// SPARE PARTS
router.get('/spare-parts', (req, res) => {
  db.all(`SELECT sp.*, s.name as supplier_name, l.name as location_name
          FROM spare_parts sp
          LEFT JOIN suppliers s ON sp.supplier_id = s.id
          LEFT JOIN locations l ON sp.location_id = l.id
          ORDER BY sp.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Helper: resolve supplier_id from supplier_id or supplier text
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

// Helper: resolve location_id from location_id or location text
function resolveLocationId(locationId, locationName, callback) {
  if (locationId) { callback(null, locationId); return; }
  if (!locationName || !locationName.trim()) { callback(null, null); return; }
  db.get(`SELECT id FROM locations WHERE name = ?`, [locationName.trim()], (err, row) => {
    if (err) { callback(err, null); return; }
    callback(null, row ? row.id : null);
  });
}

// Helper: resolve employee_id from employee_id or employee name text
function resolveEmployeeId(employeeId, employeeName, callback) {
  if (employeeId) { callback(null, employeeId); return; }
  if (!employeeName || !employeeName.trim()) { callback(null, null); return; }
  db.get(`SELECT id FROM employees WHERE (first_name || ' ' || last_name) = ?`, [employeeName.trim()], (err, row) => {
    if (err) { callback(err, null); return; }
    callback(null, row ? row.id : null);
  });
}

// Helper: resolve condition_id from condition_id or condition text
function resolveConditionId(conditionId, conditionName, callback) {
  if (conditionId) { callback(null, conditionId); return; }
  if (!conditionName || !conditionName.trim()) { callback(null, null); return; }
  db.get(`SELECT id FROM equipment_conditions WHERE name = ?`, [conditionName.trim()], (err, row) => {
    if (err) { callback(err, null); return; }
    if (row) { callback(null, row.id); return; }
    db.run(`INSERT INTO equipment_conditions (name) VALUES (?)`, [conditionName.trim()], function(err) {
      callback(err, err ? null : this.lastID);
    });
  });
}

// Helper: resolve status_id from status_id or status text
function resolveStatusId(statusId, statusName, callback) {
  if (statusId) { callback(null, statusId); return; }
  if (!statusName || !statusName.trim()) { callback(null, null); return; }
  db.get(`SELECT id FROM equipment_statuses WHERE name = ?`, [statusName.trim()], (err, row) => {
    if (err) { callback(err, null); return; }
    if (row) { callback(null, row.id); return; }
    db.run(`INSERT INTO equipment_statuses (name) VALUES (?)`, [statusName.trim()], function(err) {
      callback(err, err ? null : this.lastID);
    });
  });
}

router.post('/spare-parts', requireModulePermission('spare-parts', 'add'), upload.single('photo'), (req, res) => {
  const { purchase_order_number, po_number, part_serial_number, name, brand, category, specification, quantity, unit_cost, total_cost, location_id, location, supplier_id, supplier, purchase_date } = req.body;
  const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

  resolveSupplierId(supplier_id, supplier, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolveLocationId(location_id, location, (err, resolvedLocationId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }

      const effectivePoNumber = purchase_order_number || po_number;

      // Check for duplicate part_serial_number before creating
      if (part_serial_number && part_serial_number.trim()) {
        db.get('SELECT id, name FROM spare_parts WHERE part_serial_number = ?', [part_serial_number.trim()], (err, row) => {
          if (err) { res.status(500).json({ error: err.message }); return; }
          if (row) {
            return res.status(409).json({ error: `Part Serial "${part_serial_number.trim()}" already exists on spare part: ${row.name}` });
          }
          _insertSparePart();
        });
      } else {
        _insertSparePart();
      }

      function _insertSparePart() {
      db.run(`INSERT INTO spare_parts (spare_part_serial_number, purchase_order_number, part_serial_number, name, brand, category, specification, photo_path, quantity, unit_cost, total_cost, location_id, supplier_id, purchase_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [purchase_order_number, effectivePoNumber, part_serial_number, name, brand, category, specification, photo_path, quantity, unit_cost, total_cost, resolvedLocationId, resolvedSupplierId, purchase_date],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          const sparePartId = this.lastID;
          // Record purchase transaction
          db.run(`INSERT INTO spare_part_transactions (spare_part_id, transaction_type, quantity, unit_cost, total_cost, supplier_id, reference_id, reference_type, transaction_date, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sparePartId, 'purchase', quantity, unit_cost, total_cost, resolvedSupplierId, sparePartId, 'spare_part', purchase_date, 'Initial purchase'],
            function(err) {
              if (err) {
                console.error('Error recording spare part transaction:', err);
              }
            }
          );
          res.json({ id: sparePartId, purchase_order_number, part_serial_number, name, brand, category, specification, photo_path, quantity, unit_cost, total_cost, location_id: resolvedLocationId, supplier_id: resolvedSupplierId, purchase_date });
        }
      );
      }
    });
  });
});

router.put('/spare-parts/:id', upload.single('photo'), requireModulePermission('spare-parts', 'edit'), (req, res) => {
  const { purchase_order_number, po_number, part_serial_number, name, brand, category, specification, quantity, unit_cost, total_cost, location_id, location, supplier_id, supplier, purchase_date, existing_photo } = req.body;
  const photo_path = req.file ? `/uploads/${req.file.filename}` : (existing_photo || null);

  resolveSupplierId(supplier_id, supplier, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    resolveLocationId(location_id, location, (err, resolvedLocationId) => {
      if (err) { res.status(500).json({ error: err.message }); return; }

      const effectivePoNumber = purchase_order_number || po_number;

      // Check for duplicate part_serial_number before updating (exclude current record)
      if (part_serial_number && part_serial_number.trim()) {
        db.get('SELECT id, name FROM spare_parts WHERE part_serial_number = ? AND id != ?', [part_serial_number.trim(), req.params.id], (err, row) => {
          if (err) { res.status(500).json({ error: err.message }); return; }
          if (row) {
            return res.status(409).json({ error: `Part Serial "${part_serial_number.trim()}" already exists on spare part: ${row.name}` });
          }
          _updateSparePart();
        });
      } else {
        _updateSparePart();
      }

      function _updateSparePart() {
      db.get('SELECT quantity FROM spare_parts WHERE id = ?', [req.params.id], (err, oldRow) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        const oldQuantity = oldRow ? oldRow.quantity : 0;
        const newQuantity = parseInt(quantity, 10) || 0;
        const adjustment = newQuantity - oldQuantity;

        db.run(`UPDATE spare_parts SET spare_part_serial_number = ?, purchase_order_number = ?, part_serial_number = ?, name = ?, brand = ?, category = ?, specification = ?, photo_path = ?, quantity = ?, unit_cost = ?, total_cost = ?, location_id = ?, supplier_id = ?, purchase_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          [purchase_order_number, effectivePoNumber, part_serial_number, name, brand, category, specification, photo_path, quantity, unit_cost, total_cost, resolvedLocationId, resolvedSupplierId, purchase_date, req.params.id],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            if (adjustment !== 0) {
              db.run(`INSERT INTO spare_part_transactions (spare_part_id, transaction_type, quantity, unit_cost, total_cost, supplier_id, notes, transaction_date, created_at)
                      VALUES (?, 'adjustment', ?, 0, 0, ?, DATE('now'), CURRENT_TIMESTAMP)`,
                [req.params.id, Math.abs(adjustment), resolvedSupplierId, `Manual stock adjustment from ${oldQuantity} to ${newQuantity} (${adjustment > 0 ? '+' + adjustment : adjustment})`]);
            }
            res.json({ id: req.params.id, purchase_order_number, part_serial_number, name, brand, category, specification, photo_path, quantity, unit_cost, total_cost, location_id: resolvedLocationId, supplier_id: resolvedSupplierId, purchase_date });
          }
        );
      });
      }
    });
  });
});

router.delete('/spare-parts/:id', requireModulePermission('spare-parts', 'delete'), (req, res) => {
  db.get(`SELECT COUNT(*) as count FROM maintenance_parts mp
          JOIN maintenance_logs ml ON mp.maintenance_log_id = ml.id
          WHERE mp.spare_part_id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row.count > 0) {
      res.status(409).json({ error: 'Cannot delete this spare part because it is linked to one or more maintenance logs.' });
      return;
    }
    db.run('DELETE FROM spare_parts WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Spare part deleted' });
    });
  });
});

// Add stock / record purchase for existing spare part
router.post('/spare-parts/:id/purchase', (req, res) => {
  const { quantity, unit_cost, total_cost, supplier_id, supplier, purchase_date, notes } = req.body;
  const sparePartId = req.params.id;

  resolveSupplierId(supplier_id, supplier, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }

    db.run('BEGIN TRANSACTION');
    db.run(`UPDATE spare_parts SET quantity = quantity + ?, unit_cost = ?, total_cost = ?, supplier_id = ?, purchase_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [quantity, unit_cost, total_cost, resolvedSupplierId, purchase_date, sparePartId],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        db.run(`INSERT INTO spare_part_transactions (spare_part_id, transaction_type, quantity, unit_cost, total_cost, supplier_id, reference_id, reference_type, transaction_date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sparePartId, 'purchase', quantity, unit_cost, total_cost, resolvedSupplierId, sparePartId, 'spare_part', purchase_date, notes || 'Additional purchase'],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }
            db.run('COMMIT');
            res.json({ message: 'Stock added and purchase recorded' });
          }
        );
      }
    );
  });
});

// Get spare part transaction history
router.get('/spare-parts/:id/transactions', (req, res) => {
  db.all(`SELECT spt.*, sp.name as spare_part_name, sp.part_number as spare_part_part_number, s.name as supplier_name
          FROM spare_part_transactions spt
          JOIN spare_parts sp ON spt.spare_part_id = sp.id
          LEFT JOIN suppliers s ON spt.supplier_id = s.id
          WHERE spt.spare_part_id = ?
          ORDER BY spt.created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// PARTS ITEMS
router.get('/parts-items', (req, res) => {
  db.all(`SELECT pi.*, COALESCE(SUM(pp.quantity), 0) as current_stock,
          GROUP_CONCAT(e.name || ' (' || e.auto_serial_number || ')', ', ') as assigned_equipment
          FROM parts_items pi 
          LEFT JOIN parts_purchases pp ON pi.id = pp.item_id
          LEFT JOIN part_equipment_assignments pea ON pi.id = pea.part_id
          LEFT JOIN equipment e ON pea.equipment_id = e.id
          GROUP BY pi.id
          ORDER BY pi.name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/parts-items', requireModulePermission('parts-items', 'add'), upload.single('image'), (req, res) => {
  const { name, part_number, brand, specification, category, equipment_ids } = req.body;
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.run('BEGIN TRANSACTION');
  
  db.run(`INSERT INTO parts_items (name, part_number, brand, specification, image_path, category) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [name, part_number, brand, specification, image_path, category],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      const partId = this.lastID;
      
      // Insert equipment assignments if provided
      if (equipment_ids) {
        const equipmentIdArray = Array.isArray(equipment_ids) ? equipment_ids : [equipment_ids];
        equipmentIdArray.forEach(equipmentId => {
          db.run(`INSERT INTO part_equipment_assignments (part_id, equipment_id) VALUES (?, ?)`,
            [partId, equipmentId], (err) => {
              if (err) {
                console.error('Error inserting equipment assignment:', err);
              }
            });
        });
      }
      
      db.run('COMMIT');
      res.json({ id: partId, name, part_number, brand, specification, image_path, category });
    }
  );
});

router.put('/parts-items/:id', upload.single('image'), requireModulePermission('parts-items', 'edit'), (req, res) => {
  const { name, part_number, brand, specification, category, equipment_ids } = req.body;
  const image_path = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;
  
  db.run('BEGIN TRANSACTION');
  
  db.run(`UPDATE parts_items SET name = ?, part_number = ?, brand = ?, specification = ?, image_path = ?, category = ? 
          WHERE id = ?`,
    [name, part_number, brand, specification, image_path, category, req.params.id],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Delete existing equipment assignments
      db.run(`DELETE FROM part_equipment_assignments WHERE part_id = ?`, [req.params.id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Insert new equipment assignments if provided
        if (equipment_ids) {
          const equipmentIdArray = Array.isArray(equipment_ids) ? equipment_ids : [equipment_ids];
          equipmentIdArray.forEach(equipmentId => {
            db.run(`INSERT INTO part_equipment_assignments (part_id, equipment_id) VALUES (?, ?)`,
              [req.params.id, equipmentId], (err) => {
                if (err) {
                  console.error('Error inserting equipment assignment:', err);
                }
              });
          });
        }
        
        db.run('COMMIT');
        res.json({ message: 'Parts item updated' });
      });
    }
  );
});

router.delete('/parts-items/:id', requireModulePermission('parts-items', 'delete'), (req, res) => {
  db.run('BEGIN TRANSACTION');
  
  // Delete equipment assignments first
  db.run('DELETE FROM part_equipment_assignments WHERE part_id = ?', [req.params.id], (err) => {
    if (err) {
      db.run('ROLLBACK');
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Delete the part
    db.run('DELETE FROM parts_items WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('COMMIT');
      res.json({ message: 'Parts item deleted' });
    });
  });
});

// PARTS PURCHASES
router.get('/parts-purchases', (req, res) => {
  db.all(`SELECT pp.*, pi.name as item_name, s.name as supplier_name 
          FROM parts_purchases pp 
          JOIN parts_items pi ON pp.item_id = pi.id
          LEFT JOIN suppliers s ON pp.supplier_id = s.id
          ORDER BY pp.purchase_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/parts-purchases', requireModulePermission('parts-purchases', 'add'), (req, res) => {
  const { item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number } = req.body;

  resolveSupplierId(supplier_id, supplier_name, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }

    db.run(`INSERT INTO parts_purchases (item_id, supplier_id, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item_id, resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, item_id, supplier_id: resolvedSupplierId, supplier_name, quantity, unit_price, total_cost, purchase_date, invoice_number });
      }
    );
  });
});

router.delete('/parts-purchases/:id', requireModulePermission('parts-purchases', 'delete'), (req, res) => {
  db.run('DELETE FROM parts_purchases WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Parts purchase deleted' });
  });
});

// EQUIPMENT PURCHASES
router.get('/purchases', (req, res) => {
  db.all(`SELECT ep.*, e.name as equipment_name, e.auto_serial_number, s.name as supplier_name
          FROM equipment_purchases ep
          JOIN equipment e ON ep.equipment_id = e.id
          LEFT JOIN suppliers s ON ep.supplier_id = s.id
          ORDER BY ep.purchase_date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/purchases', requireModulePermission('purchases', 'add'), (req, res) => {
  const { equipment_id, supplier_id, supplier_name, purchase_cost, purchase_date, invoice_number, notes } = req.body;

  resolveSupplierId(supplier_id, supplier_name, (err, resolvedSupplierId) => {
    if (err) { res.status(500).json({ error: err.message }); return; }

    db.run(`INSERT INTO equipment_purchases (equipment_id, supplier_id, supplier_name, purchase_cost, purchase_date, invoice_number, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [equipment_id, resolvedSupplierId, supplier_name, purchase_cost, purchase_date, invoice_number, notes],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, equipment_id, supplier_id: resolvedSupplierId, supplier_name, purchase_cost, purchase_date, invoice_number, notes });
      }
    );
  });
});

router.delete('/purchases/:id', requireModulePermission('purchases', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_purchases WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment purchase deleted' });
  });
});

// EQUIPMENT CATEGORIES
router.get('/categories', (req, res) => {
  db.all('SELECT * FROM equipment_categories ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/categories', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO equipment_categories (name, description) VALUES (?, ?)', 
    [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/categories/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE equipment_categories SET name = ?, description = ? WHERE id = ?', 
    [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment category updated' });
  });
});

router.delete('/categories/:id', (req, res) => {
  db.run('DELETE FROM equipment_categories WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment category deleted' });
  });
});

// EQUIPMENT STATUSES
router.get('/statuses', (req, res) => {
  console.log('GET /statuses called');
  db.all('SELECT * FROM equipment_statuses ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching equipment statuses:', err);
      // Check if table doesn't exist
      if (err.message.includes('no such table')) {
        console.log('Table equipment_statuses does not exist, creating it...');
        db.run(`CREATE TABLE IF NOT EXISTS equipment_statuses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
          if (createErr) {
            console.error('Error creating table:', createErr);
            res.status(500).json({ error: createErr.message });
          } else {
            console.log('Table created successfully, returning empty array');
            res.json([]);
          }
        });
        return;
      }
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Equipment statuses fetched:', rows);
    // Always return an array, even if empty
    res.json(rows || []);
  });
});

router.post('/statuses', (req, res) => {
  const { name, description } = req.body;
  console.log('POST /statuses request body:', req.body);
  console.log('Name:', name, 'Description:', description);

  if (!name) {
    console.error('Name is required');
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  db.run('INSERT INTO equipment_statuses (name, description) VALUES (?, ?)',
    [name, description], function(err) {
    if (err) {
      console.error('Error inserting equipment status:', err);
      // Check if table doesn't exist
      if (err.message.includes('no such table')) {
        console.log('Table equipment_statuses does not exist, creating it...');
        db.run(`CREATE TABLE IF NOT EXISTS equipment_statuses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
          if (createErr) {
            console.error('Error creating table:', createErr);
            res.status(500).json({ error: createErr.message });
          } else {
            // Retry the insert after creating table
            db.run('INSERT INTO equipment_statuses (name, description) VALUES (?, ?)',
              [name, description], function(retryErr) {
                if (retryErr) {
                  console.error('Error inserting after table creation:', retryErr);
                  res.status(500).json({ error: retryErr.message });
                } else {
                  console.log('Equipment status inserted successfully after table creation:', { id: this.lastID, name, description });
                  res.json({ id: this.lastID, name, description });
                }
              });
          }
        });
        return;
      }
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Equipment status inserted successfully:', { id: this.lastID, name, description });
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/statuses/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE equipment_statuses SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment status updated' });
  });
});

router.delete('/statuses/:id', (req, res) => {
  db.run('DELETE FROM equipment_statuses WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment status deleted' });
  });
});

// Equipment Conditions API endpoints
router.get('/conditions', (req, res) => {
  db.all('SELECT * FROM equipment_conditions ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/conditions', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO equipment_conditions (name, description) VALUES (?, ?)',
    [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/conditions/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE equipment_conditions SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment condition updated' });
  });
});

router.delete('/conditions/:id', (req, res) => {
  db.run('DELETE FROM equipment_conditions WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment condition deleted' });
  });
});

// Equipment Owners API endpoints
router.get('/owners', (req, res) => {
  db.all('SELECT * FROM equipment_owners ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/owners', (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO equipment_owners (name, description) VALUES (?, ?)',
    [name, description], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, description });
  });
});

router.put('/owners/:id', (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE equipment_owners SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment owner updated' });
  });
});

router.delete('/owners/:id', (req, res) => {
  db.run('DELETE FROM equipment_owners WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment owner deleted' });
  });
});

// Equipment Catalog API endpoints
router.get('/catalog', (req, res) => {
  db.all('SELECT * FROM equipment_catalog ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/catalog', (req, res) => {
  const { name, category } = req.body;
  db.run('INSERT INTO equipment_catalog (name, category) VALUES (?, ?)',
    [name, category], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, category });
  });
});

router.put('/catalog/:id', (req, res) => {
  const { name, category } = req.body;
  db.run('UPDATE equipment_catalog SET name = ?, category = ? WHERE id = ?',
    [name, category, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Sync name to all equipment referencing this catalog item
    db.run('UPDATE equipment SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE catalog_id = ?',
      [name, req.params.id], function(err2) {
        if (err2) {
          console.error('Error syncing equipment names:', err2);
        }
        res.json({ message: 'Equipment catalog updated' });
      });
  });
});

router.delete('/catalog/:id', (req, res) => {
  db.run('DELETE FROM equipment_catalog WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Equipment catalog deleted' });
  });
});

// Equipment Write-offs API endpoints
function getWriteOffPhotos(writeOffIds, callback) {
  if (!writeOffIds || writeOffIds.length === 0) {
    return callback(null, {});
  }
  const placeholders = writeOffIds.map(() => '?').join(',');
  db.all(`SELECT * FROM equipment_write_off_photos WHERE write_off_id IN (${placeholders})`, writeOffIds, (err, rows) => {
    if (err) {
      return callback(err, {});
    }
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.write_off_id]) grouped[row.write_off_id] = [];
      grouped[row.write_off_id].push(row);
    });
    callback(null, grouped);
  });
}

router.get('/write-offs', (req, res) => {
  getAllowedFilters(req, (err, allowedLocationIds, allowedOwnerIds) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    let query = `SELECT wo.*,
            e.auto_serial_number as equipment_auto_serial,
            e.name as equipment_name,
            e.barcode as equipment_barcode,
            e.serial_number as equipment_serial_number,
            e.brand as equipment_brand,
            e.model as equipment_model,
            e.category as equipment_category,
            e.condition as equipment_condition,
            e.purchase_date as equipment_purchase_date,
            e.purchase_cost as equipment_purchase_cost,
            e.status as equipment_status,
            CASE WHEN CAST(e.assigned_to AS INTEGER) > 0
                 THEN emp.first_name || ' ' || emp.last_name
                 ELSE e.assigned_to END as equipment_assigned_to,
            eo.name as equipment_owner,
            c.name as equipment_country,
            lt.name as equipment_location,
            slt.name as equipment_sub_location,
            bt.name as equipment_business_type,
            bta.business_unit_code as equipment_business_unit_code
          FROM equipment_write_offs wo
          LEFT JOIN equipment e ON wo.equipment_id = e.id
          LEFT JOIN employees emp ON emp.id = CAST(e.assigned_to AS INTEGER)
          LEFT JOIN equipment_owners eo ON eo.id = e.owner_id
          LEFT JOIN business_type_assignments bta ON bta.id = e.location_id
          LEFT JOIN location_types lt ON lt.id = bta.location_id
          LEFT JOIN sub_location_types slt ON slt.id = bta.sub_location_id
          LEFT JOIN business_types bt ON bt.id = bta.business_type_id
          LEFT JOIN countries c ON c.id = lt.country_id`;
    let params = [];
    const conditions = [];
    if (allowedLocationIds !== null) {
      if (allowedLocationIds.length === 0) return res.json([]);
      conditions.push(`e.location_id IN (${allowedLocationIds.map(() => '?').join(',')})`);
      params.push(...allowedLocationIds);
    }
    if (allowedOwnerIds !== null) {
      if (allowedOwnerIds.length === 0) return res.json([]);
      conditions.push(`e.owner_id IN (${allowedOwnerIds.map(() => '?').join(',')})`);
      params.push(...allowedOwnerIds);
    }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY wo.created_at DESC`;
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const ids = rows.map(r => r.id);
    getWriteOffPhotos(ids, (err, photos) => {
      if (err) {
        console.error('Error loading write-off photos:', err);
      }
      rows.forEach(row => {
        row.photos = photos[row.id] || [];
      });
      res.json(rows);
    });
  });
  });
});

router.post('/write-offs', requireModulePermission('write-offs', 'add'), upload.array('photos', 10), async (req, res) => {
  const { equipment_id, write_off_date, reason, status, requested_by, approved_by, approval_date, notes } = req.body;

  // Dedup uploaded photos
  if (req.files && req.files.length > 0) {
    try { await dedupUploadedFiles(req.files); } catch (err) { return res.status(500).json({ error: 'File dedup error: ' + err.message }); }
  }

  // Check if equipment already has a write-off record
  db.get('SELECT ewo.id, e.name, e.auto_serial_number FROM equipment_write_offs ewo JOIN equipment e ON ewo.equipment_id = e.id WHERE ewo.equipment_id = ?', [equipment_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      return res.status(409).json({ error: `Equipment "${row.name}" (Serial: ${row.auto_serial_number}) already has a write-off record` });
    }

    db.run(`INSERT INTO equipment_write_offs (equipment_id, write_off_date, reason, status, requested_by, approved_by, approval_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [equipment_id, write_off_date, reason, status || 'Pending', requested_by, approved_by, approval_date, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const newId = this.lastID;
    const finalStatus = status || 'Pending';
    if (req.files && req.files.length > 0) {
      const stmt = db.prepare('INSERT INTO equipment_write_off_photos (write_off_id, photo_path) VALUES (?, ?)');
      req.files.forEach(file => {
        stmt.run(newId, `/uploads/${file.filename}`);
      });
      stmt.finalize();
    }
    if (finalStatus === 'Approved') {
      db.run('UPDATE equipment SET status = ? WHERE id = ?', ['Written Off', equipment_id], (err) => {
        if (err) {
          console.error('Error updating equipment status:', err);
        }
      });
    }
    res.json({ id: newId, equipment_id, write_off_date, reason, status: finalStatus, requested_by, approved_by, approval_date, notes });
  });
  });
});

router.put('/write-offs/:id', upload.array('photos', 10), requireModulePermission('write-offs', 'edit'), async (req, res) => {
  const { equipment_id, write_off_date, reason, status, requested_by, approved_by, approval_date, notes } = req.body;
  // Dedup uploaded photos
  if (req.files && req.files.length > 0) {
    try { await dedupUploadedFiles(req.files); } catch (err) { return res.status(500).json({ error: 'File dedup error: ' + err.message }); }
  }
  db.run(`UPDATE equipment_write_offs
          SET equipment_id = ?, write_off_date = ?, reason = ?, status = ?, requested_by = ?, approved_by = ?, approval_date = ?, notes = ?
          WHERE id = ?`,
    [equipment_id, write_off_date, reason, status, requested_by, approved_by, approval_date, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (req.files && req.files.length > 0) {
      const stmt = db.prepare('INSERT INTO equipment_write_off_photos (write_off_id, photo_path) VALUES (?, ?)');
      req.files.forEach(file => {
        stmt.run(req.params.id, `/uploads/${file.filename}`);
      });
      stmt.finalize();
    }
    if (status === 'Approved') {
      db.run('UPDATE equipment SET status = ? WHERE id = ?', ['Written Off', equipment_id], (err) => {
        if (err) {
          console.error('Error updating equipment status:', err);
        }
      });
    }
    res.json({ message: 'Write-off updated' });
  });
});

router.delete('/write-offs/:id', requireModulePermission('write-offs', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_write_offs WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Write-off deleted' });
  });
});

router.delete('/write-offs/:id/photos/:photoId', (req, res) => {
  db.get('SELECT photo_path FROM equipment_write_off_photos WHERE id = ? AND write_off_id = ?', [req.params.photoId, req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }
    db.run('DELETE FROM equipment_write_off_photos WHERE id = ?', [req.params.photoId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // Only delete the physical file if no other rows reference the same path
      isPhotoReferencedElsewhere(row.photo_path, req.params.photoId, (refErr, refCount) => {
        if (!refErr && refCount === 0) {
          const filePath = path.join(__dirname, '..', 'public', row.photo_path);
          fs.unlink(filePath, () => {});
        }
        res.json({ message: 'Photo deleted' });
      });
    });
  });
});

router.post('/write-offs/:id/approve', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.get('SELECT equipment_id FROM equipment_write_offs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Write-off not found' });
      return;
    }
    db.run(`UPDATE equipment_write_offs
            SET status = 'Approved', approval_date = ?, approved_by = ?
            WHERE id = ?`,
      [today, 'Authorizer', req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('UPDATE equipment SET status = ? WHERE id = ?', ['Written Off', row.equipment_id], (err) => {
        if (err) {
          console.error('Error updating equipment status:', err);
        }
      });
      // Cancel pending maintenance logs due to write off
      db.run(`UPDATE maintenance_logs
              SET maintenance_status = 'Cancelled due to write off',
                  description = COALESCE(description, '') || CASE WHEN COALESCE(description, '') = '' THEN '' ELSE ' ' END || '(Cancelled due to write off)'
              WHERE equipment_id = ? AND LOWER(maintenance_status) NOT IN ('completed', 'cancelled', 'cancelled due to write off')`,
        [row.equipment_id], (err) => {
        if (err) {
          console.error('Error cancelling maintenance logs:', err);
        }
      });
      res.json({ message: 'Write-off approved' });
    });
  });
});

router.post('/write-offs/:id/reject', (req, res) => {
  db.get('SELECT equipment_id FROM equipment_write_offs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Write-off not found' });
      return;
    }
    db.run(`UPDATE equipment_write_offs
            SET status = 'Rejected', approved_by = ?
            WHERE id = ?`,
      ['Authorizer', req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Write-off rejected' });
    });
  });
});

// Equipment Returns API endpoints
router.get('/returns', (req, res) => {
  getAllowedFilters(req, (err, allowedLocationIds, allowedOwnerIds) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    let query = `SELECT er.*,
            e.auto_serial_number as equipment_auto_serial,
            e.name as equipment_name,
            e.barcode as equipment_barcode,
            e.serial_number as equipment_serial_number,
            e.brand as equipment_brand,
            e.model as equipment_model,
            e.category as equipment_category,
            e.condition as equipment_condition,
            e.purchase_date as equipment_purchase_date,
            e.purchase_cost as equipment_purchase_cost,
            e.status as equipment_status,
            CASE WHEN CAST(e.assigned_to AS INTEGER) > 0
                 THEN emp.first_name || ' ' || emp.last_name
                 ELSE e.assigned_to END as equipment_assigned_to,
            eo.name as equipment_owner,
            c.name as equipment_country,
            lt.name as equipment_location,
            slt.name as equipment_sub_location,
            bt.name as equipment_business_type,
            bta.business_unit_code as equipment_business_unit_code
          FROM equipment_returns er
          LEFT JOIN equipment e ON er.equipment_id = e.id
          LEFT JOIN employees emp ON emp.id = CAST(e.assigned_to AS INTEGER)
          LEFT JOIN equipment_owners eo ON eo.id = e.owner_id
          LEFT JOIN business_type_assignments bta ON bta.id = e.location_id
          LEFT JOIN location_types lt ON lt.id = bta.location_id
          LEFT JOIN sub_location_types slt ON slt.id = bta.sub_location_id
          LEFT JOIN business_types bt ON bt.id = bta.business_type_id
          LEFT JOIN countries c ON c.id = lt.country_id`;
    let params = [];
    const conditions = [];
    if (allowedLocationIds !== null) {
      if (allowedLocationIds.length === 0) return res.json([]);
      conditions.push(`e.location_id IN (${allowedLocationIds.map(() => '?').join(',')})`);
      params.push(...allowedLocationIds);
    }
    if (allowedOwnerIds !== null) {
      if (allowedOwnerIds.length === 0) return res.json([]);
      conditions.push(`e.owner_id IN (${allowedOwnerIds.map(() => '?').join(',')})`);
      params.push(...allowedOwnerIds);
    }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY er.created_at DESC`;
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
  });
});

router.post('/returns', requireModulePermission('equipment-returns', 'add'), (req, res) => {
  const { equipment_id, supplier_name, return_date, reason, requested_by, notes } = req.body;
  if (!equipment_id || !return_date || !reason) {
    return res.status(400).json({ error: 'Equipment, return date, and reason are required' });
  }
  db.get('SELECT er.id, e.name, e.auto_serial_number FROM equipment_returns er JOIN equipment e ON er.equipment_id = e.id WHERE er.equipment_id = ? AND er.status != ? AND er.status != ?', [equipment_id, 'Completed', 'Rejected'], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      return res.status(400).json({ error: `Equipment "${row.name}" (${row.auto_serial_number}) already has a pending return request` });
    }
    db.run(`INSERT INTO equipment_returns (equipment_id, supplier_name, return_date, reason, status, requested_by, approved_by, approval_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [equipment_id, supplier_name || null, return_date, reason, 'Pending', requested_by || null, null, null, notes || null],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (typeof logAudit === 'function') {
          logAudit(req, 'create', 'equipment-returns', 'equipment_return', this.lastID, `Equipment return created for equipment ID ${equipment_id}`);
        }
        res.json({ id: this.lastID, message: 'Equipment return created successfully' });
      }
    );
  });
});

router.put('/returns/:id', requireModulePermission('equipment-returns', 'edit'), (req, res) => {
  const { equipment_id, supplier_name, return_date, reason, requested_by, notes } = req.body;
  if (!equipment_id || !return_date || !reason) {
    return res.status(400).json({ error: 'Equipment, return date, and reason are required' });
  }
  db.run(`UPDATE equipment_returns SET
            equipment_id = ?, supplier_name = ?, return_date = ?, reason = ?,
            requested_by = ?, notes = ?
          WHERE id = ?`,
    [equipment_id, supplier_name || null, return_date, reason, requested_by || null, notes || null, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Equipment return not found' });
      }
      if (typeof logAudit === 'function') {
        logAudit(req, 'update', 'equipment-returns', 'equipment_return', req.params.id, `Equipment return updated`);
      }
      res.json({ message: 'Equipment return updated successfully' });
    }
  );
});

router.delete('/returns/:id', requireModulePermission('equipment-returns', 'delete'), (req, res) => {
  db.run('DELETE FROM equipment_returns WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Equipment return not found' });
    }
    if (typeof logAudit === 'function') {
      logAudit(req, 'delete', 'equipment-returns', 'equipment_return', req.params.id, `Equipment return deleted`);
    }
    res.json({ message: 'Equipment return deleted successfully' });
  });
});

router.post('/returns/:id/approve', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.get('SELECT equipment_id FROM equipment_returns WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Equipment return not found' });
      return;
    }
    db.run(`UPDATE equipment_returns
            SET status = 'Approved', approval_date = ?, approved_by = ?
            WHERE id = ?`,
      [today, 'Authorizer', req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('UPDATE equipment SET status = ? WHERE id = ?', ['Returned', row.equipment_id], (err) => {
        if (err) {
          console.error('Error updating equipment status to Returned:', err);
        }
      });
      if (typeof logAudit === 'function') {
        logAudit(req, 'approve', 'equipment-returns', 'equipment_return', req.params.id, `Equipment return approved for equipment ID ${row.equipment_id}`);
      }
      res.json({ message: 'Equipment return approved' });
    });
  });
});

router.post('/returns/:id/reject', (req, res) => {
  db.get('SELECT equipment_id FROM equipment_returns WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Equipment return not found' });
      return;
    }
    db.run(`UPDATE equipment_returns
            SET status = 'Rejected'
            WHERE id = ?`,
      [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (typeof logAudit === 'function') {
        logAudit(req, 'reject', 'equipment-returns', 'equipment_return', req.params.id, `Equipment return rejected for equipment ID ${row.equipment_id}`);
      }
      res.json({ message: 'Equipment return rejected' });
    });
  });
});

// Export equipment to Excel with embedded images
router.post('/export-xlsx', requireModulePermission('equipment', 'export'), async (req, res) => {
  const { equipmentIds, columns, filterCriteria } = req.body;

  if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
    return res.status(400).json({ error: 'No equipment selected for export' });
  }

  const cols = Array.isArray(columns) && columns.length > 0 ? columns : [
    { key: 'serial', label: '#' },
    { key: 'auto_serial', label: 'Auto Serial' },
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'serial_number', label: 'Serial Number' },
    { key: 'category', label: 'Category' },
    { key: 'specification', label: 'Specification' },
    { key: 'condition', label: 'Condition' },
    { key: 'po_number', label: 'PO Number' },
    { key: 'country', label: 'Country' },
    { key: 'location', label: 'Location' },
    { key: 'sublocation_business_type', label: 'Sublocation / Business Type' },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Owner' },
    { key: 'assigned_to', label: 'Assigned To' },
    { key: 'price', label: 'Price' },
    { key: 'other_charges', label: 'Other Charges' },
    { key: 'purchase_cost', label: 'Purchase Cost' },
    { key: 'purchase_date', label: 'Purchase Date' },
    { key: 'warranty_expiry', label: 'Warranty Expiry' },
    { key: 'next_pm', label: 'Next PM Date' },
    { key: 'maintenance_status', label: 'Maintenance Status' },
    { key: 'comments', label: 'Comments' }
  ];

  // Filter out 'actions' and 'thumbnail' columns — thumbnail is handled specially
  const dataCols = cols.filter(c => c.key !== 'actions' && c.key !== 'thumbnail');
  const hasThumbnail = cols.some(c => c.key === 'thumbnail');

  try {
    // Fetch equipment data
    const placeholders = equipmentIds.map(() => '?').join(',');
    const rows = await new Promise((resolve, reject) => {
      db.all(`${EQUIPMENT_LIST_QUERY} WHERE e.id IN (${placeholders}) ORDER BY e.name`, equipmentIds, (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });

    // Fetch thumbnail photos for the equipment
    let thumbMap = {};
    if (hasThumbnail) {
      const thumbRows = await new Promise((resolve, reject) => {
        db.all(
          `SELECT equipment_id, photo_path FROM equipment_photos WHERE equipment_id IN (${placeholders}) GROUP BY equipment_id HAVING MIN(created_at)`,
          equipmentIds,
          (err, r) => { if (err) reject(err); else resolve(r); }
        );
      });
      thumbRows.forEach(r => { thumbMap[r.equipment_id] = r.photo_path; });
    }

    // Fetch display_status related data
    const eqIds = rows.map(r => r.id);
    const eqPlaceholders2 = eqIds.map(() => '?').join(',');

    const pendWORows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT equipment_id, SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending_wo FROM equipment_write_offs WHERE equipment_id IN (${eqPlaceholders2}) GROUP BY equipment_id`,
        eqIds,
        (err, r) => { if (err) reject(err); else resolve(r); }
      );
    });
    const pendWOMap = {};
    pendWORows.forEach(r => { pendWOMap[r.equipment_id] = r.pending_wo > 0; });

    const returnRows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT equipment_id, SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) as completed_count FROM equipment_returns WHERE equipment_id IN (${eqPlaceholders2}) GROUP BY equipment_id`,
        eqIds,
        (err, r) => { if (err) reject(err); else resolve(r); }
      );
    });
    const returnMap = {};
    returnRows.forEach(r => { returnMap[r.equipment_id] = { pendingCount: r.pending_count || 0, completedCount: r.completed_count || 0 }; });

    const underMaintRows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT equipment_id FROM maintenance_logs WHERE equipment_id IN (${eqPlaceholders2}) AND LOWER(maintenance_status) NOT IN ('completed','cancelled','cancelled due to write off')`,
        eqIds,
        (err, r) => { if (err) reject(err); else resolve(r); }
      );
    });
    const underMaintSet = new Set(underMaintRows.map(r => r.equipment_id));

    // Compute display_status for each row
    rows.forEach(eq => {
      const statusName = eq.status_name || eq.status;
      const retInfo = returnMap[eq.id];
      if (statusName === 'Written Off' || eq.status === 'Written Off') {
        eq.display_status = 'Written Off';
      } else if (pendWOMap[eq.id]) {
        eq.display_status = 'Pending Write-Off';
      } else if (retInfo && retInfo.pendingCount > 0) {
        eq.display_status = 'Pending Return';
      } else if (retInfo && retInfo.completedCount > 0) {
        eq.display_status = 'Returned';
      } else if (underMaintSet.has(eq.id)) {
        eq.display_status = 'Under Maintenance';
      } else {
        eq.display_status = statusName || eq.status || '-';
      }
    });

    // Helper to format dates as DD/MM/YYYY
    function fmtDate(d) {
      if (!d) return '-';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '-';
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    }

    // Helper to get cell value for a column
    function getCellValue(eq, key, serial) {
      switch (key) {
        case 'serial': return serial;
        case 'auto_serial': return eq.auto_serial_number || '-';
        case 'name': return eq.name || '-';
        case 'brand': return eq.brand || '-';
        case 'model': return eq.model || '-';
        case 'barcode': return (typeof eq.barcode === 'object' || eq.barcode === '[object Object]') ? '-' : (eq.barcode || '-');
        case 'serial_number': return eq.serial_number || '-';
        case 'category': return eq.category || '-';
        case 'specification': return eq.specification || '-';
        case 'condition': return eq.condition_name || eq.condition || '-';
        case 'po_number': return eq.purchase_order_number || '-';
        case 'country': return eq.country_name || '-';
        case 'location': return eq.location_name || '-';
        case 'sublocation_business_type': return (eq.sub_location_name && eq.business_type_name ? eq.sub_location_name + ' - ' + eq.business_type_name : eq.sub_location_name || eq.business_type_name || eq.business_unit_code || '-');
        case 'status': return eq.display_status || eq.status || '-';
        case 'owner': return eq.owner_name || '-';
        case 'assigned_to': return eq.assigned_to_name || '-';
        case 'price': return eq.price != null ? eq.price : '-';
        case 'other_charges': return eq.other_charges != null ? eq.other_charges : '-';
        case 'purchase_cost': return eq.purchase_cost != null ? eq.purchase_cost : '-';
        case 'purchase_date': return fmtDate(eq.purchase_date);
        case 'warranty_expiry': return fmtDate(eq.warranty_expiry);
        case 'next_pm': {
          const pmTypeLabels = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'quarterly': 'Quarterly', 'bi-annually': 'Bi-Annually', 'annually': 'Annually' };
          const nextPMDate = eq.next_pm_date ? fmtDate(eq.next_pm_date) : null;
          const nextPMTypeLabel = eq.next_pm_type ? (pmTypeLabels[eq.next_pm_type] || eq.next_pm_type) : '';
          return nextPMDate ? `${nextPMDate}${nextPMTypeLabel ? ' (' + nextPMTypeLabel + ')' : ''}` : '-';
        }
        case 'maintenance_status': return eq.maintenance_status || '-';
        case 'comments': return eq.comments || '-';
        default: return '';
      }
    }

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Equipment');

    // Determine column layout — data columns first, then thumbnail at the end
    let colIndex = 1;
    const colMap = {};

    dataCols.forEach(col => {
      sheet.getColumn(colIndex).width = Math.max(12, Math.min(40, (col.label || '').length + 5));
      colMap[col.key] = colIndex;
      colIndex++;
    });
    if (hasThumbnail) {
      sheet.getColumn(colIndex).width = 30;
      colMap.thumbnail = colIndex;
      colIndex++;
    }

    // Filter criteria row (if any)
    let headerRowIdx = 1;
    const hasFilters = Array.isArray(filterCriteria) && filterCriteria.length > 0;
    if (hasFilters) {
      const filterCell = sheet.getCell(1, 1);
      filterCell.value = 'Filters: ' + filterCriteria.join(' | ');
      filterCell.font = { bold: true, size: 11 };
      filterCell.alignment = { wrapText: true };
      // Merge across all columns for the filter row
      const totalCols = dataCols.length + (hasThumbnail ? 1 : 0);
      sheet.mergeCells(1, 1, 1, totalCols);
      sheet.getRow(1).height = 30;
      headerRowIdx = 2;
    }

    // Header row — data columns first, then thumbnail at the end
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
    let headerCol = 1;
    dataCols.forEach(col => {
      const headerCell = sheet.getCell(headerRowIdx, headerCol);
      headerCell.value = col.label;
      headerCell.font = { bold: true };
      headerCell.border = thinBorder;
      headerCell.fill = headerFill;
      headerCol++;
    });
    if (hasThumbnail) {
      const headerCell = sheet.getCell(headerRowIdx, headerCol);
      headerCell.value = 'Thumbnail';
      headerCell.font = { bold: true };
      headerCell.border = thinBorder;
      headerCell.fill = headerFill;
      headerCol++;
    }

    // Helper: get image dimensions from buffer (JPEG/PNG)
    function getImageDimensions(buf) {
      // PNG: width at offset 16 (4 bytes BE), height at offset 20 (4 bytes BE)
      if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
      // JPEG: scan markers for SOF0-SOFF (0xFFC0-0xFFCF) to find width/height
      if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
        let offset = 2;
        while (offset < buf.length - 1) {
          if (buf[offset] !== 0xFF) { offset++; continue; }
          const marker = buf[offset + 1];
          // SOF markers: C0-CF (except C4, C8, CC)
          if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            const height = buf.readUInt16BE(offset + 5);
            const width = buf.readUInt16BE(offset + 7);
            return { width, height };
          }
          // Skip to next marker
          const segLen = buf.readUInt16BE(offset + 2);
          offset += 2 + segLen;
        }
      }
      // GIF: width at offset 6 (2 bytes LE), height at offset 8 (2 bytes LE)
      if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
      }
      return null;
    }

    // Helper: scale image to fit within max dimensions while preserving aspect ratio
    function scaleImage(origW, origH, maxW, maxH) {
      if (!origW || !origH) return { width: maxW, height: maxH };
      const ratio = Math.min(maxW / origW, maxH / origH);
      return { width: Math.round(origW * ratio), height: Math.round(origH * ratio) };
    }

    const MAX_IMG_WIDTH = 200;
    const MAX_IMG_HEIGHT = 150;

    // Data rows
    const dataStartRow = headerRowIdx + 1;
    for (let i = 0; i < rows.length; i++) {
      const eq = rows[i];
      const serial = i + 1;
      const rowIdx = dataStartRow + i;
      let rowHeight = 20;

      let c = 1;
      dataCols.forEach(col => {
        const val = getCellValue(eq, col.key, serial);
        const cell = sheet.getCell(rowIdx, c);
        cell.value = val;
        cell.alignment = { vertical: 'middle', wrapText: true };
        c++;
      });
      if (hasThumbnail) {
        const photoPath = thumbMap[eq.id];
        if (photoPath) {
          const fullPath = path.join(__dirname, '..', photoPath.replace(/^\//, ''));
          try {
            if (fs.existsSync(fullPath)) {
              const imgBuffer = fs.readFileSync(fullPath);
              const imageId = workbook.addImage({
                buffer: imgBuffer,
                extension: path.extname(fullPath).slice(1) || 'jpeg',
              });
              const dims = getImageDimensions(imgBuffer);
              let imgW = MAX_IMG_WIDTH, imgH = MAX_IMG_HEIGHT;
              if (dims) {
                const scaled = scaleImage(dims.width, dims.height, MAX_IMG_WIDTH, MAX_IMG_HEIGHT);
                imgW = scaled.width;
                imgH = scaled.height;
              }
              sheet.addImage(imageId, {
                tl: { col: c - 1, row: rowIdx - 1 },
                ext: { width: imgW, height: imgH },
              });
              rowHeight = Math.max(rowHeight, Math.ceil(imgH * 0.75));
            } else {
              sheet.getCell(rowIdx, c).value = 'No file';
            }
          } catch (e) {
            sheet.getCell(rowIdx, c).value = 'Error';
          }
        } else {
          sheet.getCell(rowIdx, c).value = '-';
        }
        c++;
      }
      sheet.getRow(rowIdx).height = rowHeight;
    }

    // Send the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment_export.xlsx"');
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('Error generating Excel export:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
