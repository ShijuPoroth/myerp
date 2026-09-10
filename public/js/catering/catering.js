// Catering Management

let allRecipes = [];
let allMenus = [];
let allMenuAssignments = [];
let allIngredients = [];
let allSales = [];
let allCateringEmployees = [];
let allDeployments = [];
let allRecipeCategories = [];
// allBusinessTypeAssignments is already defined in admin-settings.js
// allLocations is already defined in config.js

function safeAddFormListener(formId, listener) {
    document.addEventListener('modalsLoaded', function() {
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', listener);
    });
}

// Sub-tab switching
function showCateringSubTab(tab) {
    if (typeof hasTabPermission === 'function' && !hasTabPermission('catering', tab, '')) {
        const allowed = typeof getAllowedTabs === 'function' ? getAllowedTabs('catering')[0] : null;
        if (allowed && allowed !== tab) { showCateringSubTab(allowed); }
        return;
    }
    if (typeof setCurrentModuleTabContext === 'function') setCurrentModuleTabContext('catering', tab, '');
const subTabBtns = document.querySelectorAll('.catering-sub-tab');
    if (subTabBtns.length === 0) {
return;
    }

    subTabBtns.forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });

    const activeBtn = document.querySelector(`.catering-sub-tab[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }

    const subTabContents = document.querySelectorAll('.catering-sub-tab-content');
    subTabContents.forEach(content => {
        content.classList.add('hidden');
        content.style.display = '';
    });

    const activeContent = document.getElementById(`catering-${tab}-tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.style.display = 'flex';
} else {
}

    // Load data based on tab
    if (tab === 'recipes') {
        loadRecipes();
    } else if (tab === 'menus') {
        loadMenus();
    } else if (tab === 'menu-assignments') {
        loadMenuAssignments();
    } else if (tab === 'ingredients') {
        loadIngredients();
    } else if (tab === 'sales') {
        loadSales();
    } else if (tab === 'employees') {
        loadCateringEmployees();
    } else if (tab === 'deployments') {
        loadDeployments();
    }
}

// Attach to window for event dispatcher
window.showCateringSubTab = showCateringSubTab;
window.openRecipeModal = openRecipeModal;
window.closeRecipeModal = closeRecipeModal;
window.addRecipeIngredientRow = addRecipeIngredientRow;
window.openMenuModal = openMenuModal;
window.closeMenuModal = closeMenuModal;
window.addMenuRecipeRow = addMenuRecipeRow;
window.openMenuAssignmentModal = openMenuAssignmentModal;
window.closeMenuAssignmentModal = closeMenuAssignmentModal;
window.openIngredientModal = openIngredientModal;
window.closeIngredientModal = closeIngredientModal;
window.openSaleModal = openSaleModal;
window.closeSaleModal = closeSaleModal;
window.loadMenuRecipesForSale = loadMenuRecipesForSale;
window.openDeploymentModal = openDeploymentModal;
window.closeDeploymentModal = closeDeploymentModal;
window.onDeploymentEmployeeChange = onDeploymentEmployeeChange;
window.onDeploymentFromCountryChange = onDeploymentFromCountryChange;
window.onDeploymentFromLocationChange = onDeploymentFromLocationChange;
window.onDeploymentFromSublocationChange = onDeploymentFromSublocationChange;
window.onDeploymentFromBusinessTypeChange = onDeploymentFromBusinessTypeChange;
window.onDeploymentToCountryChange = onDeploymentToCountryChange;
window.onDeploymentToLocationChange = onDeploymentToLocationChange;
window.onDeploymentToSublocationChange = onDeploymentToSublocationChange;
window.onDeploymentToBusinessTypeChange = onDeploymentToBusinessTypeChange;
window.editRecipe = editRecipe;
window.deleteRecipe = deleteRecipe;
window.editMenu = editMenu;
window.deleteMenu = deleteMenu;
window.deleteMenuAssignment = deleteMenuAssignment;
window.editIngredient = editIngredient;
window.deleteIngredient = deleteIngredient;
window.deleteSale = deleteSale;
window.completeDeployment = completeDeployment;
window.deleteDeployment = deleteDeployment;

// Load all catering data
async function loadCateringData() {
    await Promise.all([
        loadRecipeCategories(),
        loadIngredients(),
        loadLocations(),
        loadRecipes(),
        loadMenus(),
        loadMenuAssignments(),
        loadSales(),
        loadCateringEmployees(),
        loadDeployments()
    ]);
}

// Recipe Categories
async function loadRecipeCategories() {
    try {
        const response = await fetch(`${API_BASE}/catering/recipe-categories`);
        if (response.ok) {
            allRecipeCategories = await response.json();
        }
    } catch (error) {
        console.error('Error loading recipe categories:', error);
    }
}

// Locations
async function loadLocations() {
    try {
        const response = await fetch(`${API_BASE}/locations`);
        if (response.ok) {
            allLocations = await response.json();
        }
    } catch (error) {
        console.error('Error loading locations:', error);
    }
}

// Recipes
async function loadRecipes() {
    showTableLoading('recipes-table-body', 'Loading recipes...');
    try {
        const response = await fetch(`${API_BASE}/catering/recipes`);
        if (response.ok) {
            allRecipes = await response.json();
            renderRecipes();
        }
    } catch (error) {
        console.error('Error loading recipes:', error);
    }
}

function renderRecipes() {
    const tbody = document.getElementById('recipes-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allRecipes.map(recipe => `
        <tr>
            <td class="px-4 py-2">${recipe.name}</td>
            <td class="px-4 py-2">${recipe.category_name || '-'}</td>
            <td class="px-4 py-2">${recipe.default_portions || '-'}</td>
            <td class="px-4 py-2">
                <button onclick="editRecipe(${recipe.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteRecipe(${recipe.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function openRecipeModal(id = null) {
    const modal = document.getElementById('recipe-modal');
    const title = document.getElementById('recipe-modal-title');
    const form = document.getElementById('recipe-form');
    
    // Load categories
    const categorySelect = document.getElementById('recipe-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>' +
        allRecipeCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    // Load ingredients
    await loadIngredients();
    
    // Clear form
    form.reset();
    document.getElementById('recipe-id').value = '';
    document.getElementById('recipe-ingredients-container').innerHTML = '';
    
    if (id) {
        title.textContent = 'Edit Recipe';
        const recipe = allRecipes.find(r => r.id === id);
        if (recipe) {
            document.getElementById('recipe-id').value = recipe.id;
            document.getElementById('recipe-name').value = recipe.name;
            document.getElementById('recipe-category').value = recipe.category_id || '';
            document.getElementById('recipe-portions').value = recipe.default_portions || 1;
            document.getElementById('recipe-description').value = recipe.description || '';
            document.getElementById('recipe-instructions').value = recipe.instructions || '';
            
            // Load recipe ingredients
            const response = await fetch(`${API_BASE}/catering/recipes/${id}`);
            if (response.ok) {
                const recipeData = await response.json();
                recipeData.ingredients.forEach(ing => {
                    addRecipeIngredientRow(ing.ingredient_id, ing.quantity, ing.unit);
                });
            }
        }
    } else {
        title.textContent = 'Add Recipe';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeRecipeModal() {
    const modal = document.getElementById('recipe-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addRecipeIngredientRow(ingredientId = '', quantity = '', unit = '') {
    const container = document.getElementById('recipe-ingredients-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `
        <select class="recipe-ingredient-select flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select Ingredient</option>
            ${allIngredients.map(ing => `<option value="${ing.id}" ${ing.id == ingredientId ? 'selected' : ''}>${ing.name}</option>`).join('')}
        </select>
        <input type="number" step="0.01" class="recipe-ingredient-quantity w-24 px-2 py-1 border rounded text-sm" placeholder="Qty" value="${quantity}">
        <input type="text" class="recipe-ingredient-unit w-20 px-2 py-1 border rounded text-sm" placeholder="Unit" value="${unit}">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
}

safeAddFormListener('recipe-form', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('recipe-id').value;
    const name = document.getElementById('recipe-name').value;
    const category_id = document.getElementById('recipe-category').value || null;
    const description = document.getElementById('recipe-description').value;
    const instructions = document.getElementById('recipe-instructions').value;
    const default_portions = parseInt(document.getElementById('recipe-portions').value) || 1;
    
    // Collect ingredients
    const ingredientRows = document.querySelectorAll('#recipe-ingredients-container > div');
    const ingredients = [];
    ingredientRows.forEach(row => {
        const ingredient_id = row.querySelector('.recipe-ingredient-select').value;
        const quantity = parseFloat(row.querySelector('.recipe-ingredient-quantity').value);
        const unit = row.querySelector('.recipe-ingredient-unit').value;
        if (ingredient_id && quantity) {
            ingredients.push({ ingredient_id, quantity, unit });
        }
    });
    
    const data = { name, category_id, description, instructions, default_portions, ingredients };
    
    try {
        const url = id ? `${API_BASE}/catering/recipes/${id}` : `${API_BASE}/catering/recipes`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeRecipeModal();
            loadRecipes();
        } else {
            alert('Error saving recipe');
        }
    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('Error saving recipe');
    }
});

function editRecipe(id) {
    openRecipeModal(id);
}

async function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/recipes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadRecipes();
            }
        } catch (error) {
            console.error('Error deleting recipe:', error);
        }
    }
}

// Menus
async function loadMenus() {
    showTableLoading('menus-table-body', 'Loading menus...');
    try {
        const response = await fetch(`${API_BASE}/catering/menus`);
        if (response.ok) {
            allMenus = await response.json();
            renderMenus();
        }
    } catch (error) {
        console.error('Error loading menus:', error);
    }
}

function renderMenus() {
    const tbody = document.getElementById('menus-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allMenus.map(menu => `
        <tr>
            <td class="px-4 py-2">${menu.name}</td>
            <td class="px-4 py-2">${menu.recipe_count || 0} recipes</td>
            <td class="px-4 py-2">
                <button onclick="editMenu(${menu.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteMenu(${menu.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function openMenuModal(id = null) {
    const modal = document.getElementById('menu-modal');
    const title = document.getElementById('menu-modal-title');
    const form = document.getElementById('menu-form');
    
    // Load recipes
    await loadRecipes();
    
    // Clear form
    form.reset();
    document.getElementById('menu-id').value = '';
    document.getElementById('menu-recipes-container').innerHTML = '';
    
    if (id) {
        title.textContent = 'Edit Menu';
        const menu = allMenus.find(m => m.id === id);
        if (menu) {
            document.getElementById('menu-id').value = menu.id;
            document.getElementById('menu-name').value = menu.name;
            document.getElementById('menu-description').value = menu.description || '';
            
            // Load menu recipes
            const response = await fetch(`${API_BASE}/catering/menus/${id}`);
            if (response.ok) {
                const menuData = await response.json();
                menuData.recipes.forEach(rec => {
                    addMenuRecipeRow(rec.recipe_id, rec.portions);
                });
            }
        }
    } else {
        title.textContent = 'Create Menu';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMenuModal() {
    const modal = document.getElementById('menu-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function addMenuRecipeRow(recipeId = '', portions = 1) {
    const container = document.getElementById('menu-recipes-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `
        <select class="menu-recipe-select flex-1 px-2 py-1 border rounded text-sm">
            <option value="">Select Recipe</option>
            ${allRecipes.map(rec => `<option value="${rec.id}" ${rec.id == recipeId ? 'selected' : ''}>${rec.name}</option>`).join('')}
        </select>
        <input type="number" class="menu-recipe-portions w-24 px-2 py-1 border rounded text-sm" placeholder="Portions" value="${portions}" min="1">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
}

safeAddFormListener('menu-form', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('menu-id').value;
    const name = document.getElementById('menu-name').value;
    const description = document.getElementById('menu-description').value;
    
    // Collect recipes
    const recipeRows = document.querySelectorAll('#menu-recipes-container > div');
    const recipes = [];
    recipeRows.forEach(row => {
        const recipe_id = row.querySelector('.menu-recipe-select').value;
        const portions = parseInt(row.querySelector('.menu-recipe-portions').value) || 1;
        if (recipe_id) {
            recipes.push({ recipe_id, portions });
        }
    });
    
    const data = { name, description, recipes };
    
    try {
        const url = id ? `${API_BASE}/catering/menus/${id}` : `${API_BASE}/catering/menus`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeMenuModal();
            loadMenus();
        } else {
            alert('Error saving menu');
        }
    } catch (error) {
        console.error('Error saving menu:', error);
        alert('Error saving menu');
    }
});

function editMenu(id) {
    openMenuModal(id);
}

async function deleteMenu(id) {
    if (confirm('Are you sure you want to delete this menu?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/menus/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadMenus();
            }
        } catch (error) {
            console.error('Error deleting menu:', error);
        }
    }
}

// Menu Assignments
async function loadMenuAssignments() {
    showTableLoading('menu-assignments-table-body', 'Loading menu assignments...');
    try {
        const response = await fetch(`${API_BASE}/catering/menu-assignments`);
        if (response.ok) {
            allMenuAssignments = await response.json();
            renderMenuAssignments();
        }
    } catch (error) {
        console.error('Error loading menu assignments:', error);
    }
}

function renderMenuAssignments() {
    const tbody = document.getElementById('menu-assignments-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allMenuAssignments.map(assignment => `
        <tr>
            <td class="px-4 py-2">${assignment.menu_name}</td>
            <td class="px-4 py-2">${assignment.location_name}</td>
            <td class="px-4 py-2">${formatDate(assignment.effective_date)}</td>
            <td class="px-4 py-2">
                <button onclick="deleteMenuAssignment(${assignment.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function openMenuAssignmentModal() {
    const modal = document.getElementById('menu-assignment-modal');
    const form = document.getElementById('menu-assignment-form');
    
    // Load menus and locations
    await Promise.all([loadMenus(), loadLocations()]);
    
    // Populate dropdowns
    const menuSelect = document.getElementById('assignment-menu');
    menuSelect.innerHTML = '<option value="">Select Menu</option>' +
        allMenus.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    
    const locationSelect = document.getElementById('assignment-location');
    locationSelect.innerHTML = '<option value="">Select Location</option>' +
        allLocations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    
    // Clear form
    form.reset();
    document.getElementById('assignment-effective-date').value = new Date().toISOString().split('T')[0];
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMenuAssignmentModal() {
    const modal = document.getElementById('menu-assignment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

safeAddFormListener('menu-assignment-form', async function(e) {
    e.preventDefault();
    
    const data = {
        menu_id: document.getElementById('assignment-menu').value,
        location_id: document.getElementById('assignment-location').value,
        effective_date: document.getElementById('assignment-effective-date').value,
        end_date: document.getElementById('assignment-end-date').value || null,
        status: document.getElementById('assignment-status').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/catering/menu-assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeMenuAssignmentModal();
            loadMenuAssignments();
        } else {
            alert('Error assigning menu');
        }
    } catch (error) {
        console.error('Error assigning menu:', error);
        alert('Error assigning menu');
    }
});

async function deleteMenuAssignment(id) {
    if (confirm('Are you sure you want to delete this menu assignment?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/menu-assignments/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadMenuAssignments();
            }
        } catch (error) {
            console.error('Error deleting menu assignment:', error);
        }
    }
}

// Ingredients
async function loadIngredients() {
    showTableLoading('ingredients-table-body', 'Loading ingredients...');
    try {
        const response = await fetch(`${API_BASE}/catering/ingredients`);
        if (response.ok) {
            allIngredients = await response.json();
            renderIngredients();
        }
    } catch (error) {
        console.error('Error loading ingredients:', error);
    }
}

function renderIngredients() {
    const tbody = document.getElementById('ingredients-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allIngredients.map(ingredient => `
        <tr>
            <td class="px-4 py-2">${ingredient.name}</td>
            <td class="px-4 py-2">${ingredient.unit}</td>
            <td class="px-4 py-2 ${ingredient.current_stock <= ingredient.min_stock ? 'text-red-600 font-semibold' : ''}">${ingredient.current_stock}</td>
            <td class="px-4 py-2">${ingredient.min_stock}</td>
            <td class="px-4 py-2">
                <button onclick="viewIngredientTransactions(${ingredient.id})" class="text-green-600 hover:text-green-800 mr-2" title="View stock activity"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

async function viewIngredientTransactions(ingredientId) {
    const modal = document.getElementById('ingredient-transactions-modal');
    const title = document.getElementById('ingredient-transactions-title');
    const tbody = document.getElementById('ingredient-transactions-body');
    
    const ingredient = allIngredients.find(i => i.id === ingredientId);
    title.textContent = ingredient ? `Stock Activity: ${ingredient.name}` : 'Stock Activity';
    
    try {
        const response = await fetch(`${API_BASE}/catering/ingredients/${ingredientId}/transactions`);
        if (response.ok) {
            const transactions = await response.json();
            tbody.innerHTML = transactions.map(t => `
                <tr>
                    <td class="px-4 py-2">${new Date(t.created_at).toLocaleString()}</td>
                    <td class="px-4 py-2 ${t.type === 'add' ? 'text-green-600' : 'text-red-600'}">${t.type}</td>
                    <td class="px-4 py-2">${t.quantity}</td>
                    <td class="px-4 py-2">${t.reference_type || '-'}${t.reference_id ? ` #${t.reference_id}` : ''}</td>
                    <td class="px-4 py-2">${t.notes || '-'}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="px-4 py-2 text-center text-gray-500">No activity found</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-2 text-center text-red-600">Error loading activity</td></tr>';
        }
    } catch (error) {
        console.error('Error loading ingredient transactions:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-2 text-center text-red-600">Error loading activity</td></tr>';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeIngredientTransactionsModal() {
    const modal = document.getElementById('ingredient-transactions-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function openIngredientModal(id = null) {
    const modal = document.getElementById('ingredient-modal');
    const title = document.getElementById('ingredient-modal-title');
    const form = document.getElementById('ingredient-form');
    
    // Clear form
    form.reset();
    document.getElementById('ingredient-id').value = '';
    
    if (id) {
        title.textContent = 'Edit Ingredient Stock';
        const ingredient = allIngredients.find(i => i.id === id);
        if (ingredient) {
            document.getElementById('ingredient-id').value = ingredient.id;
            document.getElementById('ingredient-warehouse-item-id').value = ingredient.warehouse_item_id || '';
            document.getElementById('ingredient-name').value = ingredient.name;
            document.getElementById('ingredient-unit').value = ingredient.unit;
            document.getElementById('ingredient-stock').value = ingredient.current_stock;
            document.getElementById('ingredient-min-stock').value = ingredient.min_stock;
            document.getElementById('ingredient-cost').value = ingredient.cost_per_unit;
            
            const isSynced = !!ingredient.warehouse_item_id;
            document.getElementById('ingredient-name').readOnly = isSynced;
            document.getElementById('ingredient-unit').readOnly = isSynced;
        }
    } else {
        title.textContent = 'Add Ingredient';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeIngredientModal() {
    const modal = document.getElementById('ingredient-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

safeAddFormListener('ingredient-form', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('ingredient-id').value;
    const data = {
        name: document.getElementById('ingredient-name').value,
        unit: document.getElementById('ingredient-unit').value,
        current_stock: parseFloat(document.getElementById('ingredient-stock').value) || 0,
        min_stock: parseFloat(document.getElementById('ingredient-min-stock').value) || 0,
        cost_per_unit: parseFloat(document.getElementById('ingredient-cost').value) || 0
    };
    
    try {
        const url = id ? `${API_BASE}/catering/ingredients/${id}` : `${API_BASE}/catering/ingredients`;
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeIngredientModal();
            loadIngredients();
        } else {
            alert('Error saving ingredient');
        }
    } catch (error) {
        console.error('Error saving ingredient:', error);
        alert('Error saving ingredient');
    }
});

function editIngredient(id) {
    openIngredientModal(id);
}

async function deleteIngredient(id) {
    if (confirm('Are you sure you want to delete this ingredient?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/ingredients/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadIngredients();
            }
        } catch (error) {
            console.error('Error deleting ingredient:', error);
        }
    }
}

// Sales
async function loadSales() {
    showTableLoading('sales-table-body', 'Loading sales...');
    try {
        const response = await fetch(`${API_BASE}/catering/sales`);
        if (response.ok) {
            allSales = await response.json();
            renderSales();
        }
    } catch (error) {
        console.error('Error loading sales:', error);
    }
}

function renderSales() {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allSales.map(sale => `
        <tr>
            <td class="px-4 py-2">${formatDate(sale.sale_date)}</td>
            <td class="px-4 py-2">${sale.country_name || '-'}</td>
            <td class="px-4 py-2">${sale.location_name || '-'}</td>
            <td class="px-4 py-2">${sale.sub_location_name || '-'}</td>
            <td class="px-4 py-2">${sale.business_unit_code || '-'} ${sale.business_type_name ? `(${sale.business_type_name})` : ''}</td>
            <td class="px-4 py-2">${sale.recipe_name || '-'}</td>
            <td class="px-4 py-2">${sale.quantity}</td>
            <td class="px-4 py-2">
                <button onclick="deleteSale(${sale.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function openSaleModal() {
    const modal = document.getElementById('sale-modal');
    const form = document.getElementById('sale-form');
    
    // Load recipes and business type assignments (real locations)
    await Promise.all([loadRecipes(), loadBusinessTypeAssignments()]);
    
    // Populate country dropdown
    const countries = [...new Set(allBusinessTypeAssignments.map(bta => bta.country_name).filter(Boolean))].sort();
    const countrySelect = document.getElementById('sale-country');
    countrySelect.innerHTML = '<option value="">Select Country</option>' +
        countries.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // Reset dependent dropdowns
    document.getElementById('sale-location').innerHTML = '<option value="">Select Location</option>';
    document.getElementById('sale-sublocation').innerHTML = '<option value="">Select Sublocation</option>';
    document.getElementById('sale-business-unit').innerHTML = '<option value="">Select Business Unit</option>';
    
    // Reset dishes to one empty row
    const container = document.getElementById('sale-dishes-container');
    container.innerHTML = '';
    addSaleDishRow();
    
    // Clear form
    form.reset();
    document.getElementById('sale-country').value = '';
    document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function addSaleDishRow() {
    const container = document.getElementById('sale-dishes-container');
    const row = document.createElement('div');
    row.className = 'sale-dish-row grid grid-cols-12 gap-2 items-center';
    const recipeOptions = allRecipes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    row.innerHTML = `
        <div class="col-span-7">
            <select class="sale-recipe w-full px-3 py-2 border rounded-lg text-sm" required>
                <option value="">Select Recipe</option>
                ${recipeOptions}
            </select>
        </div>
        <div class="col-span-4">
            <input type="number" class="sale-quantity w-full px-3 py-2 border rounded-lg text-sm" required min="1" value="1" placeholder="Qty">
        </div>
        <div class="col-span-1 text-right">
            <button type="button" onclick="removeSaleDishRow(this)" class="text-red-600 hover:text-red-800" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
    `;
    container.appendChild(row);
}

function removeSaleDishRow(button) {
    const rows = document.querySelectorAll('.sale-dish-row');
    if (rows.length > 1) {
        button.closest('.sale-dish-row').remove();
    } else {
        // Reset the last row instead of removing
        const row = button.closest('.sale-dish-row');
        row.querySelector('.sale-recipe').value = '';
        row.querySelector('.sale-quantity').value = 1;
    }
}

function onSaleCountryChange() {
    const country = document.getElementById('sale-country').value;
    const locationSelect = document.getElementById('sale-location');
    const sublocationSelect = document.getElementById('sale-sublocation');
    const businessUnitSelect = document.getElementById('sale-business-unit');

    locationSelect.innerHTML = '<option value="">Select Location</option>';
    sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    businessUnitSelect.innerHTML = '<option value="">Select Business Unit</option>';

    if (!country) return;

    const locations = [...new Set(allBusinessTypeAssignments
        .filter(bta => bta.country_name === country)
        .map(bta => bta.location_name)
        .filter(Boolean))].sort();

    locationSelect.innerHTML += locations.map(l => `<option value="${l}">${l}</option>`).join('');
}

function onSaleLocationChange() {
    const country = document.getElementById('sale-country').value;
    const location = document.getElementById('sale-location').value;
    const sublocationSelect = document.getElementById('sale-sublocation');
    const businessUnitSelect = document.getElementById('sale-business-unit');

    sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    businessUnitSelect.innerHTML = '<option value="">Select Business Unit</option>';

    if (!country || !location) return;

    const sublocations = [...new Set(allBusinessTypeAssignments
        .filter(bta => bta.country_name === country && bta.location_name === location)
        .map(bta => bta.sub_location_name)
        .filter(Boolean))].sort();

    sublocationSelect.innerHTML += sublocations.map(sl => `<option value="${sl}">${sl}</option>`).join('');
}

function onSaleSublocationChange() {
    const country = document.getElementById('sale-country').value;
    const location = document.getElementById('sale-location').value;
    const sublocation = document.getElementById('sale-sublocation').value;
    const businessUnitSelect = document.getElementById('sale-business-unit');

    businessUnitSelect.innerHTML = '<option value="">Select Business Unit</option>';

    if (!country || !location || !sublocation) return;

    const units = allBusinessTypeAssignments.filter(bta =>
        bta.country_name === country &&
        bta.location_name === location &&
        bta.sub_location_name === sublocation
    );

    businessUnitSelect.innerHTML += units.map(bta =>
        `<option value="${bta.id}">${bta.business_unit_code} - ${bta.business_type_name || 'Unit'}</option>`
    ).join('');
}

function closeSaleModal() {
    const modal = document.getElementById('sale-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function loadMenuRecipesForSale() {
    const menuId = document.getElementById('sale-menu').value;
    const recipeSelect = document.getElementById('sale-recipe');
    
    if (!menuId) {
        recipeSelect.innerHTML = '<option value="">Select Recipe</option>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/catering/menus/${menuId}`);
        if (response.ok) {
            const menuData = await response.json();
            recipeSelect.innerHTML = '<option value="">Select Recipe</option>' +
                menuData.recipes.map(r => `<option value="${r.recipe_id}">${r.recipe_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading menu recipes:', error);
    }
}

safeAddFormListener('sale-form', async function(e) {
    e.preventDefault();
    
    const locationId = document.getElementById('sale-business-unit').value;
    const saleDate = document.getElementById('sale-date').value;
    
    const dishRows = document.querySelectorAll('.sale-dish-row');
    const items = [];
    for (const row of dishRows) {
        const recipeId = row.querySelector('.sale-recipe').value;
        const quantity = parseInt(row.querySelector('.sale-quantity').value);
        if (recipeId && quantity > 0) {
            items.push({ recipe_id: recipeId, quantity });
        }
    }
    
    if (items.length === 0) {
        alert('Please add at least one dish');
        return;
    }
    
    const data = {
        location_id: locationId,
        sale_date: saleDate,
        items
    };
    
    try {
        const response = await fetch(`${API_BASE}/catering/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeSaleModal();
            loadSales();
            loadIngredients(); // Refresh stock
        } else {
            const error = await response.json();
            alert(error.error || 'Error recording sale');
        }
    } catch (error) {
        console.error('Error recording sale:', error);
        alert('Error recording sale');
    }
});

async function deleteSale(id) {
    if (confirm('Are you sure you want to delete this sale? This will restore ingredient stock.')) {
        try {
            const response = await fetch(`${API_BASE}/catering/sales/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadSales();
                loadIngredients(); // Refresh stock
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
        }
    }
}

// Catering Employees
async function loadCateringEmployees() {
    showTableLoading('catering-employees-table-body', 'Loading employees...');
    try {
        const response = await fetch(`${API_BASE}/catering/employees`);
        if (response.ok) {
            allCateringEmployees = await response.json();
            renderCateringEmployees();
        }
    } catch (error) {
        console.error('Error loading catering employees:', error);
    }
}

function renderCateringEmployees() {
    const tbody = document.getElementById('catering-employees-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allCateringEmployees.map((employee, index) => `
        <tr>
            <td class="px-4 py-2">${index + 1}</td>
            <td class="px-4 py-2">${employee.employee_id}</td>
            <td class="px-4 py-2">${employee.first_name} ${employee.last_name}</td>
            <td class="px-4 py-2">${employee.position}</td>
            <td class="px-4 py-2">${employee.country_name || '-'}</td>
            <td class="px-4 py-2">${employee.location_type_name || '-'}</td>
            <td class="px-4 py-2">${employee.sub_location_name || '-'}</td>
            <td class="px-4 py-2">${employee.business_type_name || '-'}</td>
            <td class="px-4 py-2">${employee.business_unit_code || '-'}</td>
            <td class="px-4 py-2">${employee.status}</td>
        </tr>
    `).join('');
}

// Deployments
async function loadBusinessTypeAssignments() {
    try {
        const response = await fetch(`${API_BASE}/business-type-assignments`);
        if (response.ok) {
            allBusinessTypeAssignments = await response.json();
        }
    } catch (error) {
        console.error('Error loading business type assignments:', error);
    }
}

async function loadDeployments() {
    showTableLoading('deployments-table-body', 'Loading deployments...');
    try {
        const response = await fetch(`${API_BASE}/catering/deployments`);
        if (response.ok) {
            allDeployments = await response.json();
            renderDeployments();
        }
    } catch (error) {
        console.error('Error loading deployments:', error);
    }
}

function renderDeployments() {
    const tbody = document.getElementById('deployments-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = allDeployments.map(deployment => `
        <tr>
            <td class="px-4 py-2">${deployment.employee_name}</td>
            <td class="px-4 py-2">${deployment.from_location || '-'}</td>
            <td class="px-4 py-2">${deployment.to_location}</td>
            <td class="px-4 py-2">${formatDate(deployment.deploy_date)}</td>
            <td class="px-4 py-2">${deployment.status}</td>
            <td class="px-4 py-2">
                ${deployment.status === 'Pending' ? `<button onclick="completeDeployment(${deployment.id}, ${deployment.employee_id}, ${deployment.to_location_id})" class="text-green-600 hover:text-green-800 mr-2"><i class="fas fa-check"></i></button>` : ''}
                <button onclick="deleteDeployment(${deployment.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function openDeploymentModal() {
    const modal = document.getElementById('deployment-modal');
    const form = document.getElementById('deployment-form');
    
    // Load employees and business type assignments
    await Promise.all([loadCateringEmployees(), loadBusinessTypeAssignments()]);
    
    // Populate employee datalist with name and ID only (location info in data attributes)
    const employeeDatalist = document.getElementById('deployment-employee-list');
    employeeDatalist.innerHTML = allCateringEmployees.map(e => {
        return `<option value="${e.employee_id} - ${e.first_name} ${e.last_name}" data-id="${e.id}" data-country="${e.country_name || ''}" data-location="${e.location_type_name || ''}" data-sublocation="${e.sub_location_name || ''}" data-business-type="${e.business_type_name || ''}" data-unit-code="${e.business_unit_code || ''}" data-location-id="${e.location_id || ''}"></option>`;
    }).join('');
    
    // Populate "From" dropdowns with unique values from business type assignments
    populateDeploymentLocationDropdowns('from');
    
    // Populate "To" dropdowns with unique values from business type assignments
    populateDeploymentLocationDropdowns('to');
    
    // Clear form
    form.reset();
    document.getElementById('deployment-date').value = new Date().toISOString().split('T')[0];
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function onDeploymentEmployeeChange() {
    const employeeInput = document.getElementById('deployment-employee');
    const selectedValue = employeeInput.value;
// Find the matching option in the datalist
    const employeeDatalist = document.getElementById('deployment-employee-list');
    const selectedOption = Array.from(employeeDatalist.options).find(opt => opt.value === selectedValue);
if (selectedOption && selectedOption.dataset.id) {
        // Store the employee ID in a hidden field or data attribute for form submission
        employeeInput.dataset.employeeId = selectedOption.dataset.id;
        // Auto-populate "From" location fields from employee's current location
        document.getElementById('deployment-from-country').value = selectedOption.dataset.country || '';
        onDeploymentFromCountryChange();
        document.getElementById('deployment-from-location').value = selectedOption.dataset.location || '';
        onDeploymentFromLocationChange();
        document.getElementById('deployment-from-sublocation').value = selectedOption.dataset.sublocation || '';
        onDeploymentFromSublocationChange();
        document.getElementById('deployment-from-business-type').value = selectedOption.dataset.businessType || '';
        onDeploymentFromBusinessTypeChange();
        document.getElementById('deployment-from-unit-code').value = selectedOption.dataset.unitCode || '';
    }
}

function populateDeploymentLocationDropdowns(prefix) {
    const countries = [...new Set(allBusinessTypeAssignments.map(bta => bta.country_name).filter(Boolean))].sort();
    const countrySelect = document.getElementById(`deployment-${prefix}-country`);
    countrySelect.innerHTML = '<option value="">Select Country</option>' +
        countries.map(c => `<option value="${c}">${c}</option>`).join('');
    
    const locationSelect = document.getElementById(`deployment-${prefix}-location`);
    locationSelect.innerHTML = '<option value="">Select Location</option>';
    
    const sublocationSelect = document.getElementById(`deployment-${prefix}-sublocation`);
    sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    
    const businessTypeSelect = document.getElementById(`deployment-${prefix}-business-type`);
    businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>';
    
    const unitCodeSelect = document.getElementById(`deployment-${prefix}-unit-code`);
    unitCodeSelect.innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentEmployeeChange() {
    const employeeInput = document.getElementById('deployment-employee');
    const selectedValue = employeeInput.value;
// Find the matching option in the datalist
    const employeeDatalist = document.getElementById('deployment-employee-list');
    const selectedOption = Array.from(employeeDatalist.options).find(opt => opt.value === selectedValue);
if (selectedOption && selectedOption.dataset.id) {
        // Store the employee ID in a hidden field or data attribute for form submission
        employeeInput.dataset.employeeId = selectedOption.dataset.id;
        // Temporarily enable fields to set values
        const fromFields = ['deployment-from-country', 'deployment-from-location', 'deployment-from-sublocation', 'deployment-from-business-type', 'deployment-from-unit-code'];
        fromFields.forEach(id => document.getElementById(id).disabled = false);
        
        // Auto-populate "From" location fields from employee's current location
        document.getElementById('deployment-from-country').value = selectedOption.dataset.country || '';
        onDeploymentFromCountryChange();
        document.getElementById('deployment-from-location').value = selectedOption.dataset.location || '';
        onDeploymentFromLocationChange();
        document.getElementById('deployment-from-sublocation').value = selectedOption.dataset.sublocation || '';
        onDeploymentFromSublocationChange();
        document.getElementById('deployment-from-business-type').value = selectedOption.dataset.businessType || '';
        onDeploymentFromBusinessTypeChange();
        document.getElementById('deployment-from-unit-code').value = selectedOption.dataset.unitCode || '';
        
        // Disable fields again
        fromFields.forEach(id => document.getElementById(id).disabled = true);
    }
}

function onDeploymentFromCountryChange() {
    const country = document.getElementById('deployment-from-country').value;
    const locationSelect = document.getElementById('deployment-from-location');
    
    if (country) {
        const locations = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country)
            .map(bta => bta.location_name)
            .filter(Boolean))].sort();
        locationSelect.innerHTML = '<option value="">Select Location</option>' +
            locations.map(l => `<option value="${l}">${l}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">Select Location</option>';
    }
    
    document.getElementById('deployment-from-sublocation').innerHTML = '<option value="">Select Sublocation</option>';
    document.getElementById('deployment-from-business-type').innerHTML = '<option value="">Select Business Type</option>';
    document.getElementById('deployment-from-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentFromLocationChange() {
    const country = document.getElementById('deployment-from-country').value;
    const location = document.getElementById('deployment-from-location').value;
    const sublocationSelect = document.getElementById('deployment-from-sublocation');
    
    if (country && location) {
        const sublocations = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location)
            .map(bta => bta.sub_location_name)
            .filter(Boolean))].sort();
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>' +
            sublocations.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    }
    
    document.getElementById('deployment-from-business-type').innerHTML = '<option value="">Select Business Type</option>';
    document.getElementById('deployment-from-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentFromSublocationChange() {
    const country = document.getElementById('deployment-from-country').value;
    const location = document.getElementById('deployment-from-location').value;
    const sublocation = document.getElementById('deployment-from-sublocation').value;
    const businessTypeSelect = document.getElementById('deployment-from-business-type');
    
    if (country && location && sublocation) {
        const businessTypes = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location && bta.sub_location_name === sublocation)
            .map(bta => bta.business_type_name)
            .filter(Boolean))].sort();
        businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>' +
            businessTypes.map(bt => `<option value="${bt}">${bt}</option>`).join('');
    } else {
        businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>';
    }
    
    document.getElementById('deployment-from-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentFromBusinessTypeChange() {
    const country = document.getElementById('deployment-from-country').value;
    const location = document.getElementById('deployment-from-location').value;
    const sublocation = document.getElementById('deployment-from-sublocation').value;
    const businessType = document.getElementById('deployment-from-business-type').value;
    const unitCodeSelect = document.getElementById('deployment-from-unit-code');
    
    if (country && location && sublocation && businessType) {
        const unitCodes = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location && bta.sub_location_name === sublocation && bta.business_type_name === businessType)
            .map(bta => bta.business_unit_code)
            .filter(Boolean))].sort();
        unitCodeSelect.innerHTML = '<option value="">Select Unit Code</option>' +
            unitCodes.map(uc => `<option value="${uc}">${uc}</option>`).join('');
    } else {
        unitCodeSelect.innerHTML = '<option value="">Select Unit Code</option>';
    }
}

// Similar cascading functions for "To" location
function onDeploymentToCountryChange() {
    const country = document.getElementById('deployment-to-country').value;
    const locationSelect = document.getElementById('deployment-to-location');
    
    if (country) {
        const locations = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country)
            .map(bta => bta.location_name)
            .filter(Boolean))].sort();
        locationSelect.innerHTML = '<option value="">Select Location</option>' +
            locations.map(l => `<option value="${l}">${l}</option>`).join('');
    } else {
        locationSelect.innerHTML = '<option value="">Select Location</option>';
    }
    
    document.getElementById('deployment-to-sublocation').innerHTML = '<option value="">Select Sublocation</option>';
    document.getElementById('deployment-to-business-type').innerHTML = '<option value="">Select Business Type</option>';
    document.getElementById('deployment-to-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentToLocationChange() {
    const country = document.getElementById('deployment-to-country').value;
    const location = document.getElementById('deployment-to-location').value;
    const sublocationSelect = document.getElementById('deployment-to-sublocation');
    
    if (country && location) {
        const sublocations = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location)
            .map(bta => bta.sub_location_name)
            .filter(Boolean))].sort();
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>' +
            sublocations.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
        sublocationSelect.innerHTML = '<option value="">Select Sublocation</option>';
    }
    
    document.getElementById('deployment-to-business-type').innerHTML = '<option value="">Select Business Type</option>';
    document.getElementById('deployment-to-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentToSublocationChange() {
    const country = document.getElementById('deployment-to-country').value;
    const location = document.getElementById('deployment-to-location').value;
    const sublocation = document.getElementById('deployment-to-sublocation').value;
    const businessTypeSelect = document.getElementById('deployment-to-business-type');
    
    if (country && location && sublocation) {
        const businessTypes = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location && bta.sub_location_name === sublocation)
            .map(bta => bta.business_type_name)
            .filter(Boolean))].sort();
        businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>' +
            businessTypes.map(bt => `<option value="${bt}">${bt}</option>`).join('');
    } else {
        businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>';
    }
    
    document.getElementById('deployment-to-unit-code').innerHTML = '<option value="">Select Unit Code</option>';
}

function onDeploymentToBusinessTypeChange() {
    const country = document.getElementById('deployment-to-country').value;
    const location = document.getElementById('deployment-to-location').value;
    const sublocation = document.getElementById('deployment-to-sublocation').value;
    const businessType = document.getElementById('deployment-to-business-type').value;
    const unitCodeSelect = document.getElementById('deployment-to-unit-code');
    
    if (country && location && sublocation && businessType) {
        const unitCodes = [...new Set(allBusinessTypeAssignments
            .filter(bta => bta.country_name === country && bta.location_name === location && bta.sub_location_name === sublocation && bta.business_type_name === businessType)
            .map(bta => bta.business_unit_code)
            .filter(Boolean))].sort();
        unitCodeSelect.innerHTML = '<option value="">Select Unit Code</option>' +
            unitCodes.map(uc => `<option value="${uc}">${uc}</option>`).join('');
    } else {
        unitCodeSelect.innerHTML = '<option value="">Select Unit Code</option>';
    }
}

function closeDeploymentModal() {
    const modal = document.getElementById('deployment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

safeAddFormListener('deployment-form', async function(e) {
    e.preventDefault();
    
    const employeeInput = document.getElementById('deployment-employee');
    const employeeId = employeeInput.dataset.employeeId;
    
    if (!employeeId) {
        alert('Please select a valid employee');
        return;
    }
    
    // Find the business_type_assignment ID for "From" location
    const fromCountry = document.getElementById('deployment-from-country').value;
    const fromLocation = document.getElementById('deployment-from-location').value;
    const fromSublocation = document.getElementById('deployment-from-sublocation').value;
    const fromBusinessType = document.getElementById('deployment-from-business-type').value;
    const fromUnitCode = document.getElementById('deployment-from-unit-code').value;
    
    let fromLocationId = null;
    if (fromCountry && fromLocation && fromSublocation && fromBusinessType && fromUnitCode) {
        const fromAssignment = allBusinessTypeAssignments.find(bta => 
            bta.country_name === fromCountry &&
            bta.location_name === fromLocation &&
            bta.sub_location_name === fromSublocation &&
            bta.business_type_name === fromBusinessType &&
            bta.business_unit_code === fromUnitCode
        );
        fromLocationId = fromAssignment ? fromAssignment.id : null;
    }
    
    // Find the business_type_assignment ID for "To" location
    const toCountry = document.getElementById('deployment-to-country').value;
    const toLocation = document.getElementById('deployment-to-location').value;
    const toSublocation = document.getElementById('deployment-to-sublocation').value;
    const toBusinessType = document.getElementById('deployment-to-business-type').value;
    const toUnitCode = document.getElementById('deployment-to-unit-code').value;
    
    let toLocationId = null;
    if (toCountry && toLocation && toSublocation && toBusinessType && toUnitCode) {
        const toAssignment = allBusinessTypeAssignments.find(bta => 
            bta.country_name === toCountry &&
            bta.location_name === toLocation &&
            bta.sub_location_name === toSublocation &&
            bta.business_type_name === toBusinessType &&
            bta.business_unit_code === toUnitCode
        );
        toLocationId = toAssignment ? toAssignment.id : null;
    }
    
    if (!toLocationId) {
        alert('Please select a valid "To" location');
        return;
    }
    
    const data = {
        employee_id: employeeId,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        deploy_date: document.getElementById('deployment-date').value,
        return_date: document.getElementById('deployment-return-date').value || null,
        notes: document.getElementById('deployment-notes').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/catering/deployments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeDeploymentModal();
            loadDeployments();
        } else {
            alert('Error creating deployment');
        }
    } catch (error) {
        console.error('Error creating deployment:', error);
        alert('Error creating deployment');
    }
});

async function completeDeployment(id, employeeId, toLocationId) {
    if (confirm('Are you sure you want to mark this deployment as completed?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/deployments/${id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId, to_location_id: toLocationId })
            });
            if (response.ok) {
                loadDeployments();
                loadCateringEmployees();
            }
        } catch (error) {
            console.error('Error completing deployment:', error);
        }
    }
}

async function deleteDeployment(id) {
    if (confirm('Are you sure you want to delete this deployment?')) {
        try {
            const response = await fetch(`${API_BASE}/catering/deployments/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadDeployments();
            }
        } catch (error) {
            console.error('Error deleting deployment:', error);
        }
    }
}
