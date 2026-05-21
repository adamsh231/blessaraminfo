let blessings = [];
let filteredBlessings = [];
let visibleCount = 40;
const ITEMS_PER_PAGE = 40;

// State management
const state = {
  searchQuery: '',
  viewMode: 'grid'
};

// Elements
const loadingScreen = document.getElementById('loading-screen');
const blessingsGrid = document.getElementById('blessings-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const resultsCount = document.getElementById('results-count');
const statsBadge = document.getElementById('stats-badge');
const loadMoreContainer = document.getElementById('load-more-container');
const loadMoreBtn = document.getElementById('load-more-btn');
const noResults = document.getElementById('no-results');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalIcon = document.getElementById('modal-icon');
const modalIconFallback = document.getElementById('modal-icon-fallback');
const modalTitle = document.getElementById('modal-title');
const modalId = document.getElementById('modal-id');
const modalCategory = document.getElementById('modal-category');
const modalDescription = document.getElementById('modal-description');
const modalFooterCloseBtn = document.getElementById('modal-footer-close-btn');

// View Mode Toggles
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

// CSV Parser State Machine (Robust for quotes, commas, newlines)
function parseCSV(text) {
  const rows = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      rows.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    rows.push(row);
  }
  return rows;
}

// Category Classifier
function getCategory(id) {
  const cleanId = id.replace('bless_', '');
  if (cleanId.startsWith('2')) {
    return 'active';
  } else if (cleanId.length >= 6 && cleanId.startsWith('100')) {
    return 'upgrade';
  } else {
    return 'common';
  }
}

// Escape special regex chars
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlighting text without breaking HTML tags
function highlightText(text, search) {
  if (!search) return text;
  
  // Split by HTML tags to prevent highlighting tag attributes like color='#83d18a'
  const parts = text.split(/(<[^>]*>)/);
  const regex = new RegExp(`(${escapeRegExp(search)})`, 'gi');
  
  return parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part; // Return tag unchanged
    }
    return part.replace(regex, '<span class="highlight">$1</span>');
  }).join('');
}

// Initialize application
async function init() {
  try {
    const response = await fetch('/output.csv');
    if (!response.ok) throw new Error('Failed to load output.csv');
    
    const csvText = await response.text();
    const parsedData = parseCSV(csvText);
    
    // Header should be: id,name english,description,desc english
    // Let's find index mappings
    const headers = parsedData[0].map(h => h.trim().toLowerCase());
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name english') !== -1 ? headers.indexOf('name english') : 1;
    const descIdx = headers.indexOf('description') !== -1 ? headers.indexOf('description') : 2;
    
    // Process items
    blessings = parsedData.slice(1)
      .filter(row => row.length > 1 && row[idIdx] && row[idIdx].startsWith('bless_'))
      .map(row => {
        const id = row[idIdx].trim();
        const name = row[nameIdx] ? row[nameIdx].trim() : 'Unknown';
        const description = row[descIdx] ? row[descIdx].trim() : '';
        
        return {
          id,
          name,
          description,
          category: getCategory(id)
        };
      });
      
    // Update Stats Badge
    updateStats();
    
    // Filter and Render
    filterAndSort();
    
    // Hide loader
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 400);
    }, 300);
    
  } catch (error) {
    console.error('Error starting the database:', error);
    document.querySelector('.loading-text').textContent = 'Error loading database. Please refresh.';
    document.querySelector('.spinner').style.borderLeftColor = 'var(--accent-red)';
  }
}

// Update statistics
function updateStats() {
  statsBadge.textContent = `${blessings.length} Total Blessings`;
}

// Filter and Sort Engine (Search Query Filter & ID Sorting)
function filterAndSort() {
  const query = state.searchQuery.toLowerCase();
  
  // Filter by Search Query
  filteredBlessings = blessings.filter(item => {
    if (query) {
      return item.id.toLowerCase().includes(query) || 
             item.name.toLowerCase().includes(query) || 
             item.description.toLowerCase().includes(query);
    }
    return true;
  });
  
  // Sort by ID naturally
  filteredBlessings.sort((a, b) => {
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });
  
  // Render
  visibleCount = ITEMS_PER_PAGE;
  renderBlessings();
}

// Render visible cards
function renderBlessings() {
  const total = filteredBlessings.length;
  resultsCount.textContent = `Showing ${Math.min(visibleCount, total)} of ${total} results`;
  
  if (total === 0) {
    blessingsGrid.innerHTML = '';
    noResults.style.display = 'flex';
    loadMoreContainer.style.display = 'none';
    return;
  }
  
  noResults.style.display = 'none';
  
  const toRender = filteredBlessings.slice(0, visibleCount);
  
  const cardsHTML = toRender.map(item => {
    const cleanId = item.id.replace('bless_', '');
    const imgUrl = `/blesses/${cleanId}.png`;
    
    // Highlight matching text if search is active
    const highlightedName = highlightText(item.name, state.searchQuery);
    const highlightedId = highlightText(item.id, state.searchQuery);
    const highlightedDesc = highlightText(item.description, state.searchQuery);
    
    let categoryLabel = 'Common';
    if (item.category === 'active') categoryLabel = 'Active Skill';
    if (item.category === 'upgrade') categoryLabel = 'Upgrade';
    
    return `
      <div class="blessing-card" data-id="${item.id}">
        <div class="card-left">
          <div class="image-wrapper">
            <img src="${imgUrl}" class="blessing-img" alt="${item.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="image-fallback" style="display: none;">
              ${item.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div class="card-right">
          <div class="card-meta">
            <span class="blessing-id">${highlightedId}</span>
            <span class="category-tag ${item.category}">${categoryLabel}</span>
          </div>
          <h3 class="blessing-name">${highlightedName}</h3>
          <div class="blessing-description">${highlightedDesc}</div>
        </div>
      </div>
    `;
  }).join('');
  
  blessingsGrid.innerHTML = cardsHTML;
  
  // Show / Hide Load More
  if (visibleCount < total) {
    loadMoreContainer.style.display = 'flex';
  } else {
    loadMoreContainer.style.display = 'none';
  }
  
  // Attach event listeners to new cards
  document.querySelectorAll('.blessing-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const item = blessings.find(b => b.id === id);
      if (item) openModal(item);
    });
  });
}

// Load more action
function loadMore() {
  visibleCount += ITEMS_PER_PAGE;
  renderBlessings();
}

// Modal Interaction
function openModal(item) {
  const cleanId = item.id.replace('bless_', '');
  const imgUrl = `/blesses/${cleanId}.png`;
  
  modalTitle.textContent = item.name;
  modalId.textContent = item.id;
  
  let categoryLabel = 'Common';
  if (item.category === 'active') categoryLabel = 'Active Skill';
  if (item.category === 'upgrade') categoryLabel = 'Upgrade';
  
  modalCategory.textContent = categoryLabel;
  modalCategory.className = `category-tag ${item.category}`;
  modalDescription.innerHTML = item.description;
  
  // Set image inside modal
  modalIcon.src = imgUrl;
  modalIcon.style.display = 'block';
  modalIconFallback.style.display = 'none';
  
  modalIcon.onerror = () => {
    modalIcon.style.display = 'none';
    modalIconFallback.style.display = 'flex';
    modalIconFallback.textContent = item.name.charAt(0).toUpperCase();
  };
  
  // Modal class active toggle
  
  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// Modal Operations

// Event Listeners
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  if (state.searchQuery) {
    clearSearchBtn.style.display = 'flex';
  } else {
    clearSearchBtn.style.display = 'none';
  }
  filterAndSort();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  clearSearchBtn.style.display = 'none';
  filterAndSort();
  searchInput.focus();
});

loadMoreBtn.addEventListener('click', loadMore);

// View Mode Toggles
viewGridBtn.addEventListener('click', () => {
  viewGridBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  blessingsGrid.classList.remove('list-view');
  state.viewMode = 'grid';
});

viewListBtn.addEventListener('click', () => {
  viewListBtn.classList.add('active');
  viewGridBtn.classList.remove('active');
  blessingsGrid.classList.add('list-view');
  state.viewMode = 'list';
});

// Close modal on overlay click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalCloseBtn.addEventListener('click', closeModal);
modalFooterCloseBtn.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Run
init();
