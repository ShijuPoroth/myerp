# MWH Management ERP — Agent Reference File

> **Purpose:** Complete structural backup of the app. Use this to recover context without reading the entire codebase.
> **Last Updated:** 2026-09-14

---

## 1. Project Overview

- **Name:** MWH Management ERP (Maintenance & Warehouse Management)
- **Type:** Full-stack Node.js + Express + SQLite web application
- **Package:** `mwh-management-erp` v1.0.0
- **Entry Point:** `server.js`
- **Port:** 3000 (default), Host: 127.0.0.1
- **Database:** SQLite (`mwh_management.db`)
- **Frontend:** Vanilla JS + Tailwind CSS (CDN) + Font Awesome 6
- **Authentication:** Session-based (SQLite-backed session store)
- **Production:** Runs behind Cloudflare tunnel (`trust proxy: 1`)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Express 4.18, Node.js |
| Database | SQLite3 (sqlite3 npm package) |
| Auth | express-session, bcrypt |
| Security | helmet (CSP, HSTS, COEP, COOP, CORP, XFO), cors, express-rate-limit |
| File Uploads | multer |
| Email | nodemailer (SMTP) |
| Excel Export | exceljs |
| Frontend | Vanilla JS, Tailwind CSS (CDN), Font Awesome 6 (CDN) |
| Template | Static HTML (`public/index.html`), no templating engine |

---

## 3. Environment Variables (`.env`)

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password-here
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
SESSION_SECRET=replace-with-random-64-byte-hex
CLIENT_ORIGIN=https://yourdomain.com
```

---

## 4. Directory Structure

```
MWH Management/
├── server.js                  # Express app setup, session, route mounting
├── package.json               # Dependencies & scripts
├── .env / .env.example        # Environment config
├── mwh_management.db          # SQLite database (main)
├── database-schema.md         # Partial schema doc (outdated — see Section 6)
├── start-app.bat              # Windows batch launcher
├── test-endpoints.js          # API endpoint tests
├── config/
│   └── database.js            # DB connection + all table creation (CREATE TABLE IF NOT EXISTS)
├── middleware/
│   └── auth.js                # requireAuth middleware, session check, module permissions
├── routes/
│   ├── auth.js                # Login, logout, check-session
│   ├── equipment.js           # Equipment CRUD, transfers, maintenance, spare parts, write-offs, parts
│   ├── hr.js                  # Employees, uniforms, accommodation, payments, attendance, leave, settings
│   ├── admin.js               # Countries, locations, business types, audit logs, module managers, items, PM tasks
│   ├── warehouse.js           # Kitchen items, purchases, deliveries, locations
│   ├── warehouse-management.js # Warehouse management UI (business units, stock, transfers)
│   ├── suppliers.js           # Suppliers CRUD, supplier assignments
│   ├── procurement.js         # Purchase orders
│   └── catering.js            # Recipes, menus, ingredients, sales, deployments
├── public/
│   ├── index.html             # Main app SPA (~297KB, all sections in one page)
│   ├── login.html             # Login page
│   ├── mwh_index.html         # Alternate landing page
│   ├── partials/
│   │   └── modals.html        # Shared modal templates (~220KB, loaded via fetch)
│   ├── css/
│   │   ├── tailwind.css       # Tailwind CSS framework
│   │   ├── all.min.css        # Font Awesome 6 CSS
│   │   └── custom.css         # Custom styles (extracted from inline <style> blocks for CSP compliance)
│   ├── company-logo/          # Uploaded company logos
│   ├── images/                # Static images
│   ├── signed-payslips/       # Uploaded signed payslip PDFs
│   └── js/
│       ├── config.js          # API_BASE URL config
│       ├── auth.js            # Frontend auth helpers
│       ├── login.js           # Login page logic
│       ├── app.js             # App initialization, session check
│       ├── loader.js          # Page loader spinner
│       ├── navigation.js      # Section/tab switching logic
│       ├── dashboard.js       # Dashboard stats & charts
│       ├── locations.js       # Location management
│       ├── utils.js           # Shared utility functions
│       ├── audit.js           # Audit logging (client-side logAudit function)
│       ├── authorizer.js      # Module permission management UI
│       ├── developer-info.js  # Dev info panel
│       ├── event-dispatcher.js# Custom event dispatcher
│       ├── kitchen.js         # Kitchen module (legacy)
│       ├── uniforms.js        # Uniform management
│       ├── employees.js       # Employee management (~207KB)
│       ├── admin-settings.js  # Admin settings + column visibility for all tables (~203KB)
│       ├── payment-management.js # Legacy payment management
│       ├── procurement.js     # Procurement UI
│       ├── equipment/
│       │   ├── equipment-core.js          # Equipment list, CRUD, filters, column settings (~163KB)
│       │   ├── equipment-transfers.js     # Equipment transfers
│       │   ├── equipment-maintenance.js   # Maintenance logs
│       │   ├── equipment-spare-parts.js   # Spare parts inventory
│       │   ├── equipment-parts.js         # Parts items & purchases
│       │   └── equipment-write-offs.js    # Write-off management
│       ├── hr-accommodation/
│       │   ├── hr-accommodation-locations.js  # Accommodation locations
│       │   ├── hr-accommodation-rooms.js      # Accommodation rooms
│       │   └── hr-accommodation-room-assignments.js # Room assignments
│       ├── payment-management/
│       │   ├── payment-management-attendance.js  # Attendance register
│       │   ├── payment-management-leave-entry.js # Leave entry
│       │   ├── payment-management-payroll.js     # Payroll calculation
│       │   ├── payment-management-advance.js     # Advance payments
│       │   ├── payment-management-payslip.js     # Payslip generation
│       │   └── payment-management-history.js     # Payment history
│       ├── admin-settings-hr/
│       │   ├── admin-settings-hr-main.js              # Main HR settings entry
│       │   ├── admin-settings-hr-shared.js            # Shared helpers
│       │   ├── admin-settings-hr-positions.js         # Positions CRUD
│       │   ├── admin-settings-hr-departments.js       # Departments CRUD
│       │   ├── admin-settings-hr-employee-statuses.js # Employee statuses CRUD
│       │   ├── admin-settings-hr-nationalities.js     # Nationalities CRUD
│       │   ├── admin-settings-hr-document-types.js    # Document types CRUD
│       │   ├── admin-settings-hr-uniform-types.js     # Uniform types CRUD
│       │   ├── admin-settings-hr-uniform-sizes.js     # Uniform sizes CRUD
│       │   ├── admin-settings-hr-accommodation-types.js    # Accommodation types CRUD
│       │   ├── admin-settings-hr-accommodation-locations.js # Accommodation locations CRUD
│       │   ├── admin-settings-hr-accommodation-blocks.js   # Accommodation blocks CRUD
│       │   ├── admin-settings-hr-remuneration-types.js # Remuneration types CRUD
│       │   ├── admin-settings-hr-leave-types.js       # Leave types CRUD
│       │   ├── admin-settings-hr-overtime-types.js    # Overtime types CRUD
│       │   └── admin-settings-hr-employee-id-prefix.js # Employee ID prefix setting
│       └── catering/
│           └── catering.js     # Catering module (recipes, menus, ingredients, sales, deployments)
│       ├── warehouse-management.js # Warehouse management UI (business units, stock, transfers)
└── uploads/                   # User-uploaded files (equipment photos, employee photos, documents)
```

---

## 5. Server Architecture (`server.js`)

### Route Mounting

| Mount Point | Route File | Description |
|---|---|---|
| `/api` (before auth) | `routes/auth.js` | Login, logout, check-session |
| `/api` (after auth) | `routes/equipment.js` → `/api/equipment` | Equipment module |
| `/api` | `routes/hr.js` | HR module (employees, uniforms, accommodation, payments) |
| `/api` | `routes/admin.js` | Admin module (settings, countries, audit, module managers) |
| `/api` | `routes/warehouse.js` | Warehouse module |
| `/api/suppliers` | `routes/suppliers.js` | Suppliers module |
| `/api` | `routes/procurement.js` | Procurement module |
| `/api/catering` | `routes/catering.js` | Catering module |

### Key Routes

| Route | Method | Description |
|---|---|---|
| `/` | GET | Serves `login.html` |
| `/login` | GET | Serves `login.html` |
| `/app` | GET | Serves `index.html` (main app) |
| `/api/login` | POST | Login (rate-limited: 10 attempts/15min) |
| `/api/logout` | POST | Logout |
| `/api/check-session` | GET | Session check |
| `/api/client-error` | POST | Client-side error logging |

### Middleware

- **`requireAuth`** (`middleware/auth.js`): Checks session for all `/api` routes (except auth routes mounted before it)
- **`requireModulePermission(module, action)`**: Permission check for specific module actions
- **`requireAdmin`**: Admin-only access for sensitive endpoints
- **Helmet**: Strict CSP (`default-src 'none'`), HSTS (1 year + preload), COEP, COOP, CORP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options. CSP `scriptSrc` includes specific Cloudflare challenge platform script hashes. No `'unsafe-inline'` or `'unsafe-eval'` in `scriptSrc`. `styleSrcAttr` allows `'unsafe-inline'` for inline style attributes.
- **CORS**: Allows localhost + `CLIENT_ORIGIN` env var
- **Session**: SQLite-backed, 24h cookie, secure flag auto-upgraded for Cloudflare HTTPS
- **Favicon**: Inline data URI favicons in `index.html` and `login.html`; `/favicon.ico` route returns 204

---

## 6. Database Tables

All tables created in `config/database.js` via `CREATE TABLE IF NOT EXISTS`.

### Core Tables

| Table | Purpose |
|---|---|
| `locations` | Physical locations (equipment, kitchen, uniform types) |
| `equipment` | Main equipment records |
| `equipment_transfers` | Equipment transfer history |
| `equipment_photos` | Photos linked to equipment |
| `equipment_purchases` | Equipment purchase records |
| `equipment_write_offs` | Write-off records |
| `equipment_write_off_photos` | Write-off photo evidence |
| `equipment_categories` | Equipment categories |
| `equipment_statuses` | Equipment statuses (with color coding) |
| `equipment_catalog` | Equipment catalog/templates |
| `equipment_conditions` | Equipment conditions |
| `equipment_owners` | Equipment owners |
| `maintenance_logs` | Maintenance records |
| `maintenance_log_tasks` | Tasks within maintenance logs |
| `maintenance_photos` | Maintenance photo evidence |
| `maintenance_parts` | Parts used in maintenance |
| `spare_parts` | Spare parts inventory |
| `spare_part_transactions` | Spare part stock movements |
| `parts_items` | Parts items catalog |
| `parts_purchases` | Parts purchase records |
| `part_equipment_assignments` | Part-to-equipment assignments |
| `preventive_maintenance_tasks` | PM task templates |

### HR Tables

| Table | Purpose |
|---|---|
| `employees` | Employee records (extensive fields, see `config/database.js:661`) |
| `employee_leave_entitlements` | Leave entitlements per employee |
| `employee_transfers` | Employee transfer history |
| `employee_attendance` | Daily attendance records |
| `employee_documents` | Employee documents (with expiry tracking) |
| `employee_payments` | Payroll payments |
| `employee_id_prefixes` | Employee ID prefix config |
| `advance_payments` | Advance payment records |
| `attendance_locks` | Attendance period locks |
| `positions` | Job positions |
| `departments` | Departments |
| `employee_statuses` | Employee status types |
| `nationalities` | Nationalities |
| `document_types` | Document type config |
| `remuneration_types` | Remuneration types |
| `leave_types` | Leave types |
| `overtime_types` | Overtime types |
| `contact_categories` | Contact categories |
| `contact_statuses` | Contact statuses |
| `contact_status_assignments` | Status assignments to contacts |

### Accommodation Tables

| Table | Purpose |
|---|---|
| `accommodation_types` | Accommodation type config |
| `accommodation_locations` | Accommodation locations (with country_id) |
| `accommodation_blocks` | Blocks within accommodation locations |
| `accommodation_rooms` | Rooms within blocks |
| `accommodation_room_assignments` | Employee-to-room assignments |
| `accommodation_room_assignment_history` | Room occupancy history (assigned/vacated dates) |

### Uniform Tables

| Table | Purpose |
|---|---|
| `uniform_items` | Uniform inventory items |
| `uniform_purchases` | Uniform purchase records |
| `uniform_distributions` | Uniform distribution to employees |
| `uniform_types` | Uniform type config |
| `uniform_sizes` | Uniform size config |

### Kitchen/Catering Tables

| Table | Purpose |
|---|---|
| `kitchen_items` | Kitchen inventory |
| `kitchen_purchases` | Kitchen purchase records |
| `kitchen_deliveries` | Kitchen delivery records |
| `recipe_categories` | Recipe categories |
| `recipes` | Recipe definitions |
| `recipe_ingredients` | Ingredients per recipe |
| `ingredients` | Ingredient inventory |
| `menus` | Menu definitions |
| `menu_recipes` | Recipe-to-menu assignments |
| `menu_assignments` | Menu assignments to locations |
| `catering_sales` | Catering sales records |
| `ingredient_stock_transactions` | Ingredient stock movements |
| `catering_deployments` | Employee catering deployments |

### Admin/Settings Tables

| Table | Purpose |
|---|---|
| `countries` | Country definitions |
| `location_types` | Location type config |
| `sub_location_types` | Sub-location type config |
| `business_types` | Business type config |
| `business_type_assignments` | Business type to sub-location assignments |
| `item_categories` | Item categories (warehouse) |
| `item_units` | Item units (warehouse) |
| `item_subcategories` | Item subcategories (warehouse) |
| `item_types` | Item types (warehouse) |
| `items` | Warehouse items |
| `purchase_orders` | Purchase orders |
| `suppliers` | Supplier records |
| `supplier_assignments` | Supplier-to-item assignments |
| `audit_logs` | Audit trail (all modules) |
| `module_managers` | Module manager accounts (with login IDs) |
| `module_table_permissions` | Table-level permissions per manager |
| `module_tab_permissions` | Tab-level permissions per manager |
| `sessions` | Session store (SQLite-backed) |

---

## 7. Frontend Architecture

### Main Page (`public/index.html`)

Single-page application with all sections in one HTML file (~297KB). Sections are shown/hidden via `data-section` attributes and JS.

### Sidebar Navigation (Main Sections)

| Section ID | Label | Description |
|---|---|---|
| `dashboard` | Dashboard | Overview stats |
| `equipment-dashboard` | Equipment Dashboard | Equipment-specific stats |
| `hr-dashboard` | HR Dashboard | HR-specific stats |
| `equipment` | Equipment | Equipment management module |
| `catering` | Catering | Catering management module |
| `hr` | HR | Human resources module |
| `authorizer` | Authorizer | Permission management |
| `audit` | Audit | Audit log viewer |
| `admin` | Admin Settings | System configuration |

### Tab Hierarchy

#### Equipment Module
- **Equipment List** (`equipment`) — Main equipment table with column filters, header filters, freeze columns
- **Equipment Transfers** (`transfers`) — Transfer history
- **Equipment Maintenance** (`maintenance`) — Maintenance logs
- **Spare Parts** (`spare-parts`) — Spare parts inventory
- **Write Off** (`write-offs`) — Equipment write-off management

#### HR Module
- **Employee Management**
  - Add Employee (`add-employee`)
  - Terminate Employee (`terminate-employee`)
  - Transfer Employee (`transfer-employee`)
  - Employee Documents (`employee-documents`)
  - Bulk Settings (`bulk-settings`)
- **Accommodation Management**
  - Room Assignment (`room-assignments`)
  - Locations (`locations`)
  - Rooms (`rooms`)
- **Uniform Management**
  - Items (`items`)
  - Purchases (`purchases`)
  - Distributions (`distributions`)
- **Payment Management**
  - Attendance Register (`attendance-register`)
  - Leave Entry (`leave-entry`)
  - Advance Payments (`advance-payments`)
  - Payment Calculation (`payment-calculation`)
  - Payment History (`payment-history`)

#### Admin Settings
- **Contacts Settings** — Contact Categories, Contact Statuses, Assign Status
- **Location Settings** — Countries, Location Types, Sub-Location Types, Business Types, Assign Business Types
- **Equipment Settings** — Equipment Statuses, Conditions, Owners, PM Tasks
- **Warehouse Settings** — Item Categories, Subcategories, Units, Types, Items List
- **Supplier Settings** — Suppliers, Supplier Assignments
- **HR Settings** — Positions, Departments, Employee Statuses, Nationalities, Document Types, Uniform Types, Uniform Sizes, Remuneration Types, Leave Types, Overtime Types, Accommodation Types/Locations/Blocks, Employee ID Prefix

#### Catering Module
- Recipes, Menus, Menu Assignments, Ingredients Stock, Sales, Catering Employees, Employee Deployments

#### Authorizer
- Equipment Management, HR Management, Warehouse, Procurement (tab-level permission management)

---

## 8. API Endpoints (Summary)

### Equipment (`/api/equipment`)
- `GET /` — List all equipment
- `GET /:id` — Get equipment by ID
- `POST /` — Create equipment (with photo/manual/document uploads)
- `PUT /:id` — Update equipment
- `DELETE /:id` — Delete equipment
- `GET /:id/photos` — Get equipment photos
- `POST /:id/photos` — Upload photos
- `POST /:id/link-photos` — Link existing photos
- `DELETE /:equipmentId/photos/:photoId` — Delete photo
- `POST /import-csv` — Import from CSV
- `GET /export-csv` — Export to CSV
- `GET /export-template` — Download import template
- `GET/POST/PUT/DELETE /transfers` — Equipment transfers
- `GET/POST /maintenance-logs` — Maintenance logs
- `PUT/DELETE /maintenance-logs/:id` — Update/delete maintenance
- `GET/POST /maintenance-logs/:id/photos` — Maintenance photos
- `DELETE /maintenance-logs/:id/photos/:photoId` — Delete maintenance photo
- `GET/POST /maintenance-logs/:id/tasks` — Maintenance tasks
- `GET/POST/PUT/DELETE /spare-parts` — Spare parts CRUD
- `POST /spare-parts/:id/purchase` — Spare part purchase
- `GET /spare-parts/:id/transactions` — Stock transactions
- `GET/POST/PUT/DELETE /parts-items` — Parts items CRUD
- `GET/POST/DELETE /parts-purchases` — Parts purchases
- `GET/POST/DELETE /purchases` — Equipment purchases
- `GET/POST/PUT/DELETE /categories` — Equipment categories
- `GET/POST/PUT/DELETE /statuses` — Equipment statuses
- `GET/POST/PUT/DELETE /conditions` — Equipment conditions
- `GET/POST/PUT/DELETE /owners` — Equipment owners
- `GET/POST/PUT/DELETE /catalog` — Equipment catalog
- `GET/POST/PUT/DELETE /write-offs` — Write-offs
- `POST /write-offs/:id/approve` — Approve write-off
- `POST /write-offs/:id/reject` — Reject write-off
- `DELETE /write-offs/:id/photos/:photoId` — Delete write-off photo

### HR (`/api`)
- `GET/POST /employees` — Employee CRUD
- `GET /employees/next-id` — Next employee ID
- `PUT/DELETE /employees/:id` — Update/delete employee
- `GET /employees/bulk-import/template` — Download import template
- `POST /employees/bulk-import` — Bulk import
- `GET /employees/:id/liabilities` — Employee liabilities
- `POST /employees/:id/terminate-with-deductions` — Terminate with deductions
- `PUT /employees/:id/terminate` — Terminate employee
- `GET/POST/PUT/DELETE /employee-transfers` — Employee transfers
- `GET/POST/PUT/DELETE /positions` — Positions CRUD
- `GET/POST/PUT/DELETE /departments` — Departments CRUD
- `GET/POST/PUT/DELETE /employee-statuses` — Employee statuses CRUD
- `GET/POST/PUT/DELETE /nationalities` — Nationalities CRUD
- `GET/POST/PUT/DELETE /document-types` — Document types CRUD
- `GET/POST/PUT/DELETE /uniform-types` — Uniform types CRUD
- `GET/POST/PUT/DELETE /uniform-sizes` — Uniform sizes CRUD
- `GET/POST/PUT/DELETE /accommodation-types` — Accommodation types CRUD
- `GET/POST/PUT/DELETE /accommodation-locations` — Accommodation locations CRUD
- `GET/POST/PUT/DELETE /accommodation-blocks` — Accommodation blocks CRUD
- `GET/POST/PUT/DELETE /accommodation-rooms` — Accommodation rooms CRUD
- `GET /accommodation-rooms/:id/history` — Room occupancy history
- `GET/POST/PUT/DELETE /accommodation-room-assignments` — Room assignments CRUD
- `GET/POST/PUT/DELETE /remuneration-types` — Remuneration types CRUD
- `GET/POST/PUT/DELETE /leave-types` — Leave types CRUD
- `GET/POST/PUT/DELETE /overtime-types` — Overtime types CRUD
- `GET/POST/PUT/DELETE /uniform-items` — Uniform items CRUD
- `GET/POST /uniform-purchases` — Uniform purchases
- `GET/POST /uniform-distributions` — Uniform distributions
- `GET /employee-leave-entitlements/:employeeId` — Leave entitlements
- `GET /employee-leave-balance/:employeeId` — Leave balance
- `POST /employee-leave-entitlements` — Set leave entitlements
- `GET/POST/PUT/DELETE /employee-documents` — Employee documents
- `GET /employee-documents/expiry-warnings` — Document expiry warnings
- `GET/POST /attendance` — Attendance records
- `POST /attendance/bulk` — Bulk attendance
- `DELETE /attendance/bulk/:employeeId` — Delete bulk attendance
- `DELETE /attendance/:employeeId/:date` — Delete attendance
- `POST /attendance/lock` — Lock attendance period
- `POST /attendance/unlock` — Unlock attendance period
- `GET/POST /advance-payments` — Advance payments
- `DELETE /advance-payments/:id` — Delete advance payment
- `GET /employee-payments` — Payment records
- `GET /employee-payments/carry-forward/:employee_id` — Carry-forward per employee
- `GET /employee-payments/carry-forward` — All carry-forwards
- `POST /employee-payments` — Create payment
- `PUT/DELETE /employee-payments/:id` — Update/delete payment
- `POST/DELETE /employee-payments/:id/signed-payslip` — Signed payslip upload/delete
- `GET /employee-salary-periods` — Salary periods
- `POST /send-payslip` — Email payslip
- `GET/PUT /employee-id-prefix` — Employee ID prefix
- `GET /leave-records` — Leave records
- `GET /dashboard/module-stats` — Module stats
- `GET /dashboard/stats` — Dashboard stats

### Admin (`/api`)
- `GET/POST/PUT/DELETE /contact-categories` — Contact categories CRUD
- `GET/POST/PUT/DELETE /contact-statuses` — Contact statuses CRUD
- `GET/POST/DELETE /contact-status-assignments` — Status assignments
- `GET/POST/PUT/DELETE /items` — Warehouse items CRUD
- `GET /items/next-product-code` — Next product code
- `GET/POST/DELETE /countries` — Countries CRUD
- `GET/POST/PUT/DELETE /location-types` — Location types CRUD
- `GET/POST/PUT/DELETE /sub-location-types` — Sub-location types CRUD
- `GET/POST/PUT/DELETE /business-types` — Business types CRUD
- `GET/POST/PUT/DELETE /business-type-assignments` — Business type assignments
- `GET/POST/DELETE /audit-logs` — Audit logs
- `DELETE /audit-logs/:id` — Delete audit log
- `GET/POST/PUT/DELETE /item-categories` — Item categories CRUD
- `GET/POST/PUT/DELETE /item-units` — Item units CRUD
- `GET/POST/PUT/DELETE /item-subcategories` — Item subcategories CRUD
- `GET/POST/PUT/DELETE /item-types` — Item types CRUD
- `GET /module-managers` — List module managers (admin only)
- `GET /module-managers/:id` — Get module manager
- `POST /module-managers/:id/login-id` — Set login ID
- `POST /module-managers/:id/password` — Set password
- `GET/POST /module-table-permissions/:managerId` — Table permissions
- `GET/POST /module-tab-permissions/:managerId` — Tab permissions
- `GET /equipment-items` — Equipment items list
- `GET/POST/PUT/DELETE /pm-tasks` — PM tasks CRUD

### Auth (`/api`)
- `POST /login` — Login
- `POST /logout` — Logout
- `GET /check-session` — Session check
- `GET /public/managers` — Public manager list (for login dropdown)

### Catering (`/api/catering`)
- `GET/POST/PUT/DELETE /recipe-categories` — Recipe categories CRUD
- `GET/POST/PUT/DELETE /recipes` — Recipes CRUD
- `GET/POST/PUT/DELETE /ingredients` — Ingredients CRUD
- `GET /ingredients/:id/transactions` — Ingredient transactions
- `GET/POST/PUT/DELETE /menus` — Menus CRUD
- `GET/POST/DELETE /menu-assignments` — Menu assignments
- `GET/POST/DELETE /sales` — Sales CRUD
- `GET /employees` — Catering employees
- `GET/POST/DELETE /deployments` — Employee deployments
- `PUT /deployments/:id/complete` — Complete deployment
- `GET/POST/PUT/DELETE /locations` — Catering locations
- `GET/POST/PUT /kitchen-items` — Kitchen items
- `GET/POST /kitchen-purchases` — Kitchen purchases
- `GET/POST /kitchen-deliveries` — Kitchen deliveries

### Warehouse (`/api`)
- `GET/POST/PUT/DELETE /kitchen-items` — Kitchen items
- `GET/POST /kitchen-purchases` — Kitchen purchases
- `GET/POST /kitchen-deliveries` — Kitchen deliveries
- `GET/POST/PUT/DELETE /locations` — Locations

### Suppliers (`/api/suppliers`)
- `GET/POST/PUT/DELETE /` — Suppliers CRUD
- `GET/POST/DELETE /assignments` — Supplier assignments

### Procurement (`/api`)
- `GET/POST/PUT/DELETE /purchase-orders` — Purchase orders CRUD

---

## 9. Key Frontend Patterns

### Column Visibility System
- **Equipment:** `EQUIPMENT_COLUMNS` array in `admin-settings.js`, stored in localStorage. `applyEquipmentColumnVisibility()` scoped to `#equipment-table`.
- **Employees:** `EMPLOYEE_COLUMNS` array in `admin-settings.js`, stored in localStorage. `applyEmployeeColumnVisibility()` scoped to `#employee-table`.
- **Payroll:** `PAYROLL_COLUMNS` array, scoped to `#payroll-table`.
- **Payment History:** `PAYMENT_HISTORY_COLUMNS` array, scoped to `#payment-history-wrapper`.
- **Room Assignments:** `ROOM_ASSIGNMENT_COLUMNS` array in `hr-accommodation-room-assignments.js`, stored in localStorage key `ra_col_visibility_v5`.

### Header Filters (Equipment)
- `EQUIPMENT_HEADER_FILTER_COLS` in `equipment-core.js`: `['auto_serial', 'name', 'barcode', 'serial_number', 'category', 'po_number', 'country', 'location', 'sublocation_business_type', 'status', 'owner', 'assigned_to', 'maintenance_status']`
- `equipmentHeaderFilterState` object tracks `selected` (Set) and `allValues` (array) per column.
- `populateEquipmentHeaderFilters()` updates `allValues` from data, preserves existing `selected` values.
- `updateEquipmentHeaderFilterIcon()` toggles yellow icon when filter is active (`selected.size < allValues.length`).
- After saving equipment, saved item's values are added to `selected` sets so it appears in filtered list.

### Sticky Headers & Frozen Columns
- Equipment table: CSS `position: sticky` on `thead th`, JS handles frozen column left offsets.
- Room assignment table: CSS `border-collapse: separate; border-spacing: 0;` + `thead th { position: sticky; top: 0; }`, JS handles frozen columns.

### Audit Logging
- Client-side `logAudit(action, module, itemType, itemId, details)` function in `audit.js`.
- Posts to `/api/audit-logs`.
- Server stores in `audit_logs` table.

### Permission System
- `module_managers` table: User accounts with login IDs and passwords.
- `module_table_permissions`: Per-manager CRUD permissions on tables (add/edit/delete).
- `module_tab_permissions`: Per-manager tab visibility.
- `requireModulePermission(module, action)` middleware on server.
- `hasTablePermission(tableName, action)` function on frontend.
- `authorizer.js`: UI for managing permissions.

### Session Management
- SQLite-backed session store (custom `SQLiteSessionStore` class in `server.js`).
- Session cookie: 24h max age, `httpOnly: true`, `sameSite: 'lax'`.
- `secure` flag auto-upgraded when behind Cloudflare HTTPS tunnel.
- `sessionReady` custom event dispatched on frontend after session validation.

### Modals
- Shared modals in `public/partials/modals.html`, loaded via `fetch()` at runtime.
- Equipment, employee, uniform item view, uniform distribution, and other entity modals defined here.
- Modal visibility controlled by adding/removing `active` class (CSS: `.modal { display: none; }` / `.modal.active { display: flex; }`).
- `loader.js` fetches `partials/modals.html?v=34` and dispatches `modalsLoaded` event.

---

## 10. Important Notes & Known Issues (Fixed)

### Column Visibility Cross-Contamination (Fixed)
- **Issue:** `applyEmployeeColumnVisibility()` and `applyEquipmentColumnVisibility()` in `admin-settings.js` previously used unscoped `document.querySelectorAll(`[data-col="${col.key}"]`)` which affected ALL tables on the page.
- **Fix:** Scoped to `#employee-table` and `#equipment-table` respectively.
- **Date:** 2025-08-13

### Equipment Header Filter After Edit (Fixed)
- **Issue:** After editing equipment, `populateEquipmentHeaderFilters()` only kept previously selected filter values. New values (e.g., newly added barcode) were excluded, causing the edited item to disappear.
- **Fix:** After `loadEquipment()`, saved item's column values are added to each filter's `selected` set.
- **Date:** 2025-08-13

### Room Assignment Country Column Disappearing (Fixed)
- **Issue:** Country column header in room assignments table disappeared after a few seconds due to stale localStorage from older JS versions and cross-contamination from unscoped column visibility functions.
- **Fix:** Bumped localStorage key to `ra_col_visibility_v5`, cleared old keys (v2/v3/v4), scoped column visibility functions.
- **Date:** 2025-08-13

### Uniform Item View Button & Totals (Fixed)
- **Issue:** Uniform items list had no View button to see purchase/distribution totals per item.
- **Fix:** Added a View button to the uniform items list actions column. Static `uniform-item-view-modal` added to `modals.html`. `viewUniformItem()` in `uniforms.js` opens the modal showing item details, total purchased quantity, and total distributed quantity. Backend `/uniform-items` endpoint updated with correlated subqueries for totals.
- **Files:** `public/js/uniforms.js`, `public/partials/modals.html`, `routes/hr.js`
- **Date:** 2026-08-23

### Uniform Distribution Details — Size & Color (Fixed)
- **Issue:** Distribution details modal did not show item size and color.
- **Fix:** Added `item_size` and `item_color` to the `/uniform-distributions` GET query in `routes/hr.js`. Added Size and Color columns to the distribution details table in `viewUniformDistribution()`.
- **Files:** `routes/hr.js`, `public/js/uniforms.js`
- **Date:** 2026-08-23

### Uniform Distribution Multi-Item Form (Enhancement)
- **Issue:** Distribution form only allowed one item per submission.
- **Fix:** Redesigned `uniform-distribution-modal` in `modals.html` to support multiple item rows with add/remove functionality. Added `addUniformDistributionItemRow()`, `removeUniformDistributionItemRow()`, `filterUniformDistributionItems()` functions. Rewrote `saveUniformDistribution()` to loop through all item rows and POST each one individually.
- **Files:** `public/partials/modals.html`, `public/js/uniforms.js`
- **Date:** 2026-08-23

### Uniform Distribution Employee Validation (Enhancement)
- **Issue:** Distribution form allowed selecting employees who already had distributions.
- **Fix:** Modified `filterUniformDistributionEmployees()` to disable employees who already have distributions, showing a message "Already has distributions".
- **Files:** `public/js/uniforms.js`
- **Date:** 2026-08-23

### Equipment Thumbnail Lazy Loading (Fixed)
- **Issue:** Equipment list loaded hundreds of thumbnail images simultaneously, causing Cloudflare tunnel stream cancellations.
- **Fix:** Added `loading="lazy"` attribute to all equipment thumbnail `<img>` tags in `equipment-core.js`.
- **Files:** `public/js/equipment/equipment-core.js`
- **Date:** 2026-08-23

### CSP & Security Headers — Mozilla Observatory A+ (Enhancement)
- **Issue:** Browser console showed CSP warnings, inline script blocks, and Cloudflare CSP Report-Only XHR spam. Mozilla Observatory score was -20 due to `'unsafe-inline'` in `scriptSrc`.
- **Fix:** Extracted all inline `<style>` blocks from `index.html` and `login.html` into `public/css/custom.css`. Removed `'unsafe-inline'` from `scriptSrc`. Set `default-src` to `'none'`. Added specific SHA256 hashes for Cloudflare challenge platform inline scripts. Added HSTS (max-age 31536000, includeSubDomains, preload), COEP (`require-corp`), COOP (`same-origin`), CORP, X-Frame-Options, Referrer-Policy (`no-referrer`), X-Content-Type-Options (`nosniff`). Added inline data URI favicons to prevent 404s. Added `/favicon.ico` 204 route.
- **Files:** `server.js`, `public/index.html`, `public/login.html`, `public/css/custom.css`
- **Date:** 2026-09-12
- **Result:** Mozilla Observatory A+ (100/100). Console clean except harmless Firefox font glyph bbox warnings and CSS vendor prefix warnings.

### In-Service Date Not Saving on Edit (Fixed)
- **Issue:** When equipment status stayed "In Service", editing the `in_service_date` did not persist. The backend preferred the existing DB value over the form input (`alreadyInServiceDate || in_service_date`). This caused bad dates (e.g., year 0006) to be uncorrectable, which in turn generated illogical overdue PM schedule dates (e.g., `01/11/6`, `01/02/7`).
- **Fix:** Swapped priority in `routes/equipment.js` to `in_service_date || alreadyInServiceDate || null` so the form value takes precedence when staying in service.
- **Files:** `routes/equipment.js`
- **Date:** 2026-08-24

### Room Not Freed on Employee Termination (Fixed)
- **Issue:** When an employee was terminated, their accommodation room assignment was not removed from `accommodation_room_assignments`. The room still showed as full capacity, preventing other employees from being assigned to it.
- **Fix:** Added `DELETE FROM accommodation_room_assignments WHERE employee_id = ?` to both termination endpoints in `routes/hr.js` (`/employees/:id/terminate-with-deductions` and `/employees/:id/terminate`). Room assignment is now automatically removed upon termination.
- **Files:** `routes/hr.js`
- **Date:** 2026-08-26

### Room Assignment History Tracking (Enhancement)
- **Issue:** No history was kept when employees were assigned to or vacated rooms. Once an assignment was deleted, all trace was lost.
- **Fix:** Created `accommodation_room_assignment_history` table in `config/database.js` to track room_id, employee_id, assigned_date, vacated_date, and notes. History records are created on assignment creation, updated with vacated_date on assignment deletion/update/termination. Added `GET /accommodation-rooms/:id/history` API endpoint. Added View History (green eye) button in both the Rooms table and Room Assignments table. Modal shows employee name, code, assigned date, vacated date, duration, status (Current/Vacated), and notes.
- **Files:** `config/database.js`, `routes/hr.js`, `public/js/hr-accommodation/hr-accommodation-rooms.js`, `public/js/hr-accommodation/hr-accommodation-room-assignments.js`
- **Date:** 2026-08-26

### Equipment PDF Export Filter Display (Fixed)
- **Issue:** When exporting equipment list as PDF with header filters active, the filter criteria line showed all selected values (e.g., all barcodes) as a massive paragraph at the top of the first page.
- **Fix:** Changed `getEquipmentFilterCriteria()` in `equipment-core.js` to only show the column label names (e.g., "Barcode", "Owner", "Model") instead of listing all selected values.
- **Files:** `public/js/equipment/equipment-core.js`
- **Date:** 2026-08-26

### Maintenance Photo Upload — Multiple Photos Not Saving (Fixed)
- **Issue:** Multiple photos uploaded via the "Add Maintenance Log" form were not saved, while a single photo worked fine.
- **Root Cause 1:** `dedupUploadedFiles` processed files in parallel (`Promise.all`), causing Node.js thread pool exhaustion when each file's dedup read the entire `uploads/` directory concurrently (358+ files).
- **Root Cause 2:** Some uploaded photos exceeded Multer's 5MB `fileSize` limit, causing `MulterError: File too large` which silently failed the entire request.
- **Fix 1:** Rewrote `dedupUploadedFile` to use synchronous `fs.readFileSync` for hashing, eliminating concurrent stream issues. Simplified `dedupUploadedFiles` to use `.map()`.
- **Fix 2:** Increased Multer `fileSize` limit from 5MB to 15MB in `routes/equipment.js`.
- **Fix 3:** Refactored DB inserts in `POST /maintenance-logs/:id/photos` to use `db.run()` with callbacks, ensuring all inserts complete before responding.
- **Fix 4:** Added a global Multer error handler in `server.js` to return JSON errors for `LIMIT_FILE_SIZE` and file type issues.
- **Files:** `routes/equipment.js`, `server.js`
- **Date:** 2026-09-13

### Maintenance Photo Upload — User-Friendly Error Messages (Enhancement)
- **Issue:** When photo uploads failed, errors were only logged to console — the user saw "saving" but no indication of failure.
- **Fix:** Updated `uploadMaintenancePhotos()` in `equipment-maintenance.js` to show user-visible `alert()` messages on failure, explaining possible reasons (file too large, not an image, server error).
- **Files:** `public/js/equipment/equipment-maintenance.js`
- **Date:** 2026-09-13

### Maintenance Parts Used Disappearing in Edit Form (Fixed)
- **Issue:** When opening the "Edit Maintenance Log" form, the "Parts Used" values (selected part names) disappeared — the dropdown buttons showed "Select Part" instead of the previously saved part.
- **Root Cause:** In `populateMaintenancePartsRows()`, the hidden input `value` was set to empty (`""`) in the row HTML, then `populateMaintenancePartsDropdown()` was called (which checks `hiddenInput.value` to update the button display text), and only *after* that was the actual `spare_part_id` set on the hidden input. So the button text never updated.
- **Fix:** Set `value`, `data-cost`, and `data-quantity` directly in the row HTML **before** calling `populateMaintenancePartsDropdown()`, so `populateMaintenancePartOptions()` sees the correct value and updates the button text to show the part name and photo.
- **Files:** `public/js/equipment/equipment-maintenance.js`
- **Date:** 2026-09-13

### Maintenance Photo Delete in Edit Form (Enhancement)
- **Issue:** When editing a maintenance log, there was no way to delete existing photos.
- **Fix:** Added `DELETE /maintenance-logs/:id/photos/:photoId` endpoint in `routes/equipment.js` (following the same pattern as equipment photo deletion with `isPhotoReferencedElsewhere` check). Updated `loadMaintenancePhotosForEdit()` in `equipment-maintenance.js` to render each photo with a red X delete button overlay (visible on hover). Added `deleteMaintenancePhoto()` function that calls the API, removes the photo element from DOM, and shows "No photos yet" if all are deleted.
- **Files:** `routes/equipment.js`, `public/js/equipment/equipment-maintenance.js`
- **Date:** 2026-09-13

### Maintenance Log Print — Text Too Small (In Progress)
- **Issue:** When printing or saving maintenance log details as PDF, text content was too small to read while photos appeared large.
 **Changes made so far:**
  1. Increased all font sizes in the print HTML template (body 11px→14px, labels 11px→13px, section titles 11px→14px, table headers/cells 11px→13px, etc.).
  2. Changed `@page size: auto` to `@page size: A4 portrait`.
  3. Changed `.page max-width: 800px` to `width: 100%; max-width: none`.
  4. Replaced iframe-based printing with `window.open()` approach for more reliable print scaling.
  5. Bumped cache-busting version to `?v=43`.
- **Status:** User reports issue still persists — further debugging needed.
- **Files:** `public/js/equipment/equipment-maintenance.js`, `public/index.html`
- **Date:** 2026-09-14

---

## 11. Cache Busting

All JS files in `public/index.html` are loaded with `?v=N` query parameters. When modifying any JS file, bump the version number in `index.html` to force browser cache invalidation.

Current versions (as of 2026-09-14):
- `equipment-core.js?v=123`
- `equipment-maintenance.js?v=43`
- `uniforms.js?v=45`
- `employees.js?v=93`
- `admin-settings.js?v=68`
- `navigation.js?v=54`
- `dashboard.js?v=53`
- `utils.js?v=36`
- `loader.js?v=35` (loads `modals.html?v=34`)
- `hr-accommodation-rooms.js?v=9`
- `hr-accommodation-room-assignments.js?v=50`
- Other files: see `public/index.html` script tags

---

## 12. Running the App

```bash
# Install dependencies
npm install

# Start the server
node server.js
# or
npm start

# Access
# Local: http://localhost:3000
# Login page: http://localhost:3000/login
# App: http://localhost:3000/app

# Windows quick start
start-app.bat
```

### Database
- SQLite file: `mwh_management.db`
- Schema auto-created on server start via `config/database.js`
- No migration system — tables use `CREATE TABLE IF NOT EXISTS`

### Production Deployment
- **Server:** Ubuntu 20.04, behind Cloudflare tunnel
- **Server path:** `/www/wwwroot/opsmaster.net/MWH_Management`
- **Process manager:** PM2 (process name: `mwh-erp`)
- **Deploy steps:**
  1. Local: `git add -A; git commit -m "message"; git push`
  2. Server: `cd /www/wwwroot/opsmaster.net/MWH_Management && git pull && pm2 restart all`
  3. Purge Cloudflare cache
  4. Test in private/incognito window (to avoid browser cache)
- **Domain:** `https://opsmaster.net`
- **Mozilla Observatory:** A+ (100/100) as of 2026-09-12

---

## 13. File Upload Handling

- **multer** handles all file uploads
- Uploads stored in `uploads/` directory
- Equipment: photos, manuals, documents (`upload.fields`)
- Employees: photos (`upload.single('photo')`)
- Employee documents: up to 20 files (`upload.array('documents', 20)`)
- Maintenance photos: up to 20 (`upload.array('photos', 20)`, 15MB max per file)
- Write-off photos: up to 10 (`upload.array('photos', 10)`)
- Signed payslips: stored in `public/signed-payslips/`
- Company logos: stored in `public/company-logo/`
