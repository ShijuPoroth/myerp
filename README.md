# MWH Management ERP System

A comprehensive ERP-style system for managing equipment, kitchen utensils/consumables, and staff uniforms across multiple locations.

## Features

### Equipment Management
- Add, edit, and delete equipment
- Track equipment by serial number, category, and model
- Assign equipment to locations
- Upload equipment photos
- Track equipment status (active, maintenance, retired)
- Search and filter equipment

### Equipment Transfers
- Transfer equipment between locations
- Track transfer history with dates and notes
- Record who initiated the transfer

### Maintenance Logs
- Log maintenance activities for equipment
- Track maintenance types (preventive, corrective, emergency)
- Record costs and performed-by information
- Schedule next maintenance dates

### Kitchen Warehouse
- Manage kitchen utensils and consumables
- Track inventory with SKU and unit measurements
- Set minimum stock alerts
- Record purchases from suppliers
- Track deliveries to catering units

### Uniform Warehouse
- Manage uniform inventory by category, size, and gender
- Track stock levels with minimum stock alerts
- Record purchases from suppliers
- Track distributions to staff members

### Dashboard
- Overview of total equipment count
- Equipment currently in maintenance
- Total kitchen items in inventory
- Total uniform items in inventory
- Quick action buttons for common tasks

## Getting Started

### Prerequisites
- Node.js installed on your system

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### First Steps

1. **Create Locations**: Before adding equipment or inventory, create your locations first:
   - Go to the "Locations" section
   - Click "Add Location"
   - Enter location name, address, and type (equipment, kitchen, or uniform)

2. **Add Equipment**: 
   - Go to the "Equipment" section
   - Click "Add Equipment"
   - Fill in equipment details and upload a photo if needed
   - Assign to a location

3. **Add Kitchen Items**:
   - Go to "Kitchen Warehouse" → "Items" tab
   - Click "Add Item"
   - Enter item details and assign to a kitchen location

4. **Add Uniform Items**:
   - Go to "Uniform Warehouse" → "Items" tab
   - Click "Add Item"
   - Enter uniform details and assign to a uniform location

### Common Workflows

#### Transfer Equipment
1. Go to "Transfers" section
2. Click "New Transfer"
3. Select equipment, from location, and to location
4. Add notes and who initiated the transfer
5. Click "Transfer"

#### Log Maintenance
1. Go to "Maintenance" section
2. Click "Add Maintenance Log"
3. Select equipment and maintenance type
4. Enter description, cost, and performed-by information
5. Click "Save"

#### Purchase Kitchen Items
1. Go to "Kitchen Warehouse" → "Purchases" tab
2. Click "Add Purchase"
3. Select item, enter supplier details and quantity
4. The stock will automatically update

#### Deliver Kitchen Items
1. Go to "Kitchen Warehouse" → "Deliveries" tab
2. Click "Add Delivery"
3. Select item and catering unit
4. Enter quantity and delivery details
5. The stock will automatically decrease

#### Distribute Uniforms
1. Go to "Uniform Warehouse" → "Distributions" tab
2. Click "Add Distribution"
3. Select uniform item and staff member
4. Enter quantity and distribution details
5. The stock will automatically decrease

## Database

The system uses SQLite for data storage. The database file (`mwh_management.db`) is created automatically when you start the server for the first time.

### Database Schema

The database includes the following tables:
- `locations` - Storage locations
- `equipment` - Equipment inventory
- `equipment_transfers` - Transfer history
- `maintenance_logs` - Maintenance records
- `kitchen_items` - Kitchen inventory
- `kitchen_purchases` - Purchase records
- `kitchen_deliveries` - Delivery records
- `uniform_items` - Uniform inventory
- `uniform_purchases` - Purchase records
- `uniform_distributions` - Distribution records

## File Structure

```
MWH Management/
├── server.js              # Express server with API endpoints
├── package.json           # Node.js dependencies
├── database-schema.md    # Database documentation
├── README.md             # This file
├── public/
│   ├── index.html        # Frontend HTML
│   └── app.js           # Frontend JavaScript
├── uploads/              # Uploaded equipment photos
└── mwh_management.db    # SQLite database (auto-created)
```

## API Endpoints

### Locations
- GET `/api/locations` - Get all locations
- POST `/api/locations` - Create location
- PUT `/api/locations/:id` - Update location
- DELETE `/api/locations/:id` - Delete location

### Equipment
- GET `/api/equipment` - Get all equipment
- GET `/api/equipment/:id` - Get single equipment
- POST `/api/equipment` - Create equipment (supports photo upload)
- PUT `/api/equipment/:id` - Update equipment
- DELETE `/api/equipment/:id` - Delete equipment

### Equipment Transfers
- GET `/api/equipment/transfers` - Get transfer history
- POST `/api/equipment/transfers` - Create transfer
- GET `/api/equipment/transfers/next-serial` - Get next transfer serial

### Maintenance Logs
- GET `/api/equipment/maintenance-logs` - Get maintenance logs (optionally filter by `?equipment_id=X`)
- POST `/api/equipment/maintenance-logs` - Create maintenance log
- PUT `/api/equipment/maintenance-logs/:id` - Update maintenance log
- DELETE `/api/equipment/maintenance-logs/:id` - Delete maintenance log
- GET `/api/equipment/maintenance-logs/next-serial` - Get next maintenance serial

### Kitchen Items
- GET `/api/kitchen-items` - Get all kitchen items
- POST `/api/kitchen-items` - Create kitchen item
- PUT `/api/kitchen-items/:id` - Update kitchen item

### Kitchen Purchases
- GET `/api/kitchen-purchases` - Get purchase history
- POST `/api/kitchen-purchases` - Create purchase (updates stock)

### Kitchen Deliveries
- GET `/api/kitchen-deliveries` - Get delivery history
- POST `/api/kitchen-deliveries` - Create delivery (updates stock)

### Uniform Items
- GET `/api/uniform-items` - Get all uniform items
- POST `/api/uniform-items` - Create uniform item
- PUT `/api/uniform-items/:id` - Update uniform item

### Uniform Purchases
- GET `/api/uniform-purchases` - Get purchase history
- POST `/api/uniform-purchases` - Create purchase (updates stock)

### Uniform Distributions
- GET `/api/uniform-distributions` - Get distribution history
- POST `/api/uniform-distributions` - Create distribution (updates stock)

### Dashboard
- GET `/api/dashboard/stats` - Get dashboard statistics

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, JavaScript (Vanilla)
- **Styling**: TailwindCSS (via CDN)
- **Icons**: Font Awesome (via CDN)
- **File Upload**: Multer

## Support

For issues or questions, please refer to the database schema documentation in `database-schema.md`.
