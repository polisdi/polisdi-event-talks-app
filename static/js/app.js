/**
 * BigQuery Release Notes Explorer - Client Application
 * Handles state management, DOM interactions, filtering, search, and Tweet creation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // === State Management ===
    let state = {
        entries: [],          // Raw release entries fetched from server
        currentFilter: 'all', // Active category pill filter
        searchQuery: '',      // Active keyword search query
        selectedItem: null,   // Currently selected release item for Tweet modal
        selectedDate: '',     // Date of the selected item
        selectedUrl: '',      // URL of the selected item
        hasUserEditedTweet: false // Tracks if user manually edited the tweet textarea
    };

    // === DOM Elements ===
    const elements = {
        refreshBtn: document.getElementById('refresh-btn'),
        retryBtn: document.getElementById('retry-btn'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        filterPills: document.querySelectorAll('.filter-pills .pill'),
        feedContainer: document.getElementById('feed-container'),
        loadingSkeleton: document.getElementById('loading-skeleton'),
        errorContainer: document.getElementById('error-container'),
        errorMessage: document.getElementById('error-message'),
        emptyState: document.getElementById('empty-state'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        statusDot: document.getElementById('status-dot'),
        statusText: document.getElementById('status-text'),
        
        // Stats
        statTotal: document.getElementById('stat-total'),
        statFeatures: document.getElementById('stat-features'),

        // Tweet Modal
        tweetModal: document.getElementById('tweet-modal'),
        modalClose: document.getElementById('modal-close'),
        tweetTextarea: document.getElementById('tweet-text'),
        charCounter: document.getElementById('char-counter'),
        tweetWarning: document.getElementById('tweet-length-warning'),
        copyTweetBtn: document.getElementById('copy-tweet-btn'),
        postTweetBtn: document.getElementById('post-tweet-btn'),
        
        // Checkboxes in Modal
        toggleDate: document.getElementById('toggle-date'),
        toggleType: document.getElementById('toggle-type'),
        toggleLink: document.getElementById('toggle-link'),
        toggleTags: document.getElementById('toggle-tags'),
        
        // Toasts
        toastContainer: document.getElementById('toast-container')
    };

    // === Toast Notification System ===
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Custom SVG icons for toasts
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M20 6L9 17l-5-5"/></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        }
        
        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        
        // Slide out and remove
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    // === API Calls ===
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'success') {
                state.entries = data.entries;
                updateStats();
                renderFeed();
                
                // Update header status details
                const dateStr = new Date(data.fetched_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const sourceMap = {
                    'network': 'Fetched live from Google Cloud',
                    'file_cache': 'Loaded from server cache',
                    'memory_cache': 'Loaded from memory',
                    'stale_cache_after_error': 'Network failed, loaded stale cache'
                };
                const sourceDetail = sourceMap[data.source] || 'Loaded';
                
                elements.statusDot.className = 'dot idle';
                elements.statusText.textContent = `${sourceDetail} at ${dateStr}`;
                
                if (forceRefresh) {
                    showToast('Release notes successfully refreshed!', 'success');
                }
            } else {
                throw new Error(data.message || 'Unknown server error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            elements.statusDot.className = 'dot error';
            elements.statusText.textContent = 'Failed to fetch release notes';
            
            // Show error container only if we don't have existing items
            if (state.entries.length === 0) {
                elements.errorMessage.textContent = error.message || 'Check your internet connection and try again.';
                elements.errorContainer.style.display = 'flex';
                elements.feedContainer.style.display = 'none';
            } else {
                showToast(`Refresh failed: ${error.message}`, 'error');
            }
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.refreshBtn.classList.add('loading');
            elements.refreshBtn.disabled = true;
            elements.refreshBtn.querySelector('.btn-text').textContent = 'Refreshing...';
            elements.statusDot.className = 'dot loading';
            elements.statusText.textContent = 'Fetching BigQuery feed...';
            
            // If empty feed, show skeleton
            if (state.entries.length === 0) {
                elements.loadingSkeleton.style.display = 'flex';
                elements.errorContainer.style.display = 'none';
                elements.emptyState.style.display = 'none';
            }
        } else {
            elements.refreshBtn.classList.remove('loading');
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.querySelector('.btn-text').textContent = 'Refresh';
            elements.loadingSkeleton.style.display = 'none';
        }
    }

    // === Stats Calculation ===
    function updateStats() {
        let totalItems = 0;
        let totalFeatures = 0;
        
        state.entries.forEach(entry => {
            entry.items.forEach(item => {
                totalItems++;
                if (item.type === 'Feature') {
                    totalFeatures++;
                }
            });
        });
        
        elements.statTotal.textContent = totalItems;
        elements.statFeatures.textContent = totalFeatures;
    }

    // === Search & Filters Logic ===
    function getFilteredEntries() {
        const query = state.searchQuery.toLowerCase().trim();
        const category = state.currentFilter;
        
        return state.entries.map(entry => {
            // Filter the items within the entry
            const matchedItems = entry.items.filter(item => {
                // 1. Category Filter
                let matchesCategory = true;
                if (category !== 'all') {
                    if (category === 'other') {
                        // "Other" matches anything that is not Feature, Issue, or Deprecation
                        matchesCategory = !['Feature', 'Issue', 'Deprecation'].includes(item.type);
                    } else {
                        matchesCategory = item.type === category;
                    }
                }
                
                // 2. Keyword Search Filter
                let matchesSearch = true;
                if (query) {
                    const textContent = item.text.toLowerCase();
                    const typeContent = item.type.toLowerCase();
                    matchesSearch = textContent.includes(query) || typeContent.includes(query);
                }
                
                return matchesCategory && matchesSearch;
            });
            
            // Return new entry structure with matched items
            return {
                ...entry,
                items: matchedItems
            };
        }).filter(entry => entry.items.length > 0); // Keep only entries that have items matching
    }

    // === Render DOM Feed ===
    function renderFeed() {
        const filtered = getFilteredEntries();
        elements.feedContainer.innerHTML = '';
        
        if (filtered.length === 0) {
            elements.feedContainer.style.display = 'none';
            elements.emptyState.style.display = 'flex';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        elements.errorContainer.style.display = 'none';
        elements.feedContainer.style.display = 'block';
        
        filtered.forEach(entry => {
            const section = document.createElement('div');
            section.className = 'date-section';
            
            // Date Header
            const header = document.createElement('div');
            header.className = 'date-header';
            header.innerHTML = `
                <h3 class="date-title">${entry.date}</h3>
                <div class="date-divider"></div>
                <a href="${entry.url}" target="_blank" class="date-link" rel="noopener noreferrer">
                    <span>Source Notes</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                </a>
            `;
            section.appendChild(header);
            
            // Render items under this date
            entry.items.forEach(item => {
                const card = document.createElement('article');
                card.className = 'note-card card';
                
                // Normalize type data attribute for CSS left borders
                const cssType = ['Feature', 'Issue', 'Deprecation'].includes(item.type) ? item.type : 'other';
                card.setAttribute('data-type', cssType);
                
                // Card header (badge)
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';
                cardHeader.innerHTML = `<span class="type-badge">${item.type}</span>`;
                card.appendChild(cardHeader);
                
                // Card content
                const cardContent = document.createElement('div');
                cardContent.className = 'card-content';
                cardContent.innerHTML = item.html;
                card.appendChild(cardContent);
                
                // Card Actions (Tweet Button)
                const cardActions = document.createElement('div');
                cardActions.className = 'card-actions';
                
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'btn btn-twitter btn-sm';
                tweetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Share on X</span>
                `;
                
                // Bind open modal on click
                tweetBtn.addEventListener('click', () => {
                    openTweetModal(item, entry.date, entry.url);
                });
                
                cardActions.appendChild(tweetBtn);
                // Copy to Clipboard button for note
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn btn-secondary btn-sm';
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy</span>
                `;
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(item.text).then(() => {
                        showToast('Note copied to clipboard!', 'success');
                    }).catch(err => {
                        console.error('Copy error:', err);
                        showToast('Failed to copy note.', 'error');
                    });
                });
                cardActions.appendChild(copyBtn);
                card.appendChild(cardActions);
                
                section.appendChild(card);
            });
            
            elements.feedContainer.appendChild(section);
        });
    }

    // === Tweet Modal Logic ===
    function openTweetModal(item, date, url) {
        state.selectedItem = item;
        state.selectedDate = date;
        state.selectedUrl = url;
        state.hasUserEditedTweet = false;
        
        // Reset toggles to default checked
        elements.toggleDate.checked = true;
        elements.toggleType.checked = true;
        elements.toggleLink.checked = true;
        elements.toggleTags.checked = true;
        
        // Generate Tweet Text
        generateTweetText();
        
        // Open Modal
        elements.tweetModal.classList.add('active');
        elements.tweetModal.setAttribute('aria-hidden', 'false');
        elements.tweetTextarea.focus();
    }

    function closeTweetModal() {
        elements.tweetModal.classList.remove('active');
        elements.tweetModal.setAttribute('aria-hidden', 'true');
        state.selectedItem = null;
    }

    function generateTweetText() {
        if (!state.selectedItem || state.hasUserEditedTweet) return;
        
        const item = state.selectedItem;
        const date = state.selectedDate;
        const url = state.selectedUrl;
        
        let prefix = '';
        if (elements.toggleType.checked) {
            prefix += `[BigQuery ${item.type}]`;
        } else {
            prefix += '[BigQuery Update]';
        }
        
        if (elements.toggleDate.checked) {
            prefix += ` (${date})`;
        }
        
        prefix += ': ';
        
        // We need to fit things. Let's start with raw text.
        let coreText = item.text;
        let suffix = '';
        
        if (elements.toggleLink.checked) {
            // Anchor tag link back to Google
            suffix += `\n\nNotes: ${url}`;
        }
        
        if (elements.toggleTags.checked) {
            suffix += '\n#GoogleCloud #BigQuery';
        }
        
        // Calculate max core text length: X limit 280
        const budget = 280 - prefix.length - suffix.length;
        
        if (coreText.length > budget) {
            // Smart truncate at word boundary
            coreText = coreText.substring(0, budget - 4);
            const lastSpace = coreText.lastIndexOf(' ');
            if (lastSpace > 0) {
                coreText = coreText.substring(0, lastSpace);
            }
            coreText += '...';
        }
        
        elements.tweetTextarea.value = `${prefix}${coreText}${suffix}`;
        updateCharCounter();
    }

    function updateCharCounter() {
        const textLength = elements.tweetTextarea.value.length;
        elements.charCounter.textContent = `${textLength} / 280`;
        
        // Style character counter appropriately
        if (textLength > 280) {
            elements.charCounter.className = 'character-counter danger';
            elements.tweetWarning.style.display = 'flex';
        } else if (textLength > 250) {
            elements.charCounter.className = 'character-counter warning';
            elements.tweetWarning.style.display = 'none';
        } else {
            elements.charCounter.className = 'character-counter';
            elements.tweetWarning.style.display = 'none';
        }
    }

    // === Event Listeners Setup ===
    
    // Refresh buttons
    elements.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.retryBtn.addEventListener('click', () => fetchReleaseNotes(true));

    // Keyword Search Input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery.length > 0) {
            elements.clearSearchBtn.style.display = 'block';
        } else {
            elements.clearSearchBtn.style.display = 'none';
        }
        renderFeed();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        renderFeed();
    });

    // Category Filter Pills
    elements.filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            // Remove active class from all pills
            elements.filterPills.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked pill
            const selectedPill = e.currentTarget;
            selectedPill.classList.add('active');
            
            // Update filter state and render
            state.currentFilter = selectedPill.getAttribute('data-type');
            renderFeed();
        });
    });

    // Reset Filters button
    const resetFilters = () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        
        elements.filterPills.forEach(p => p.classList.remove('active'));
        const allPill = Array.from(elements.filterPills).find(p => p.getAttribute('data-type') === 'all');
        if (allPill) allPill.classList.add('active');
        
        state.currentFilter = 'all';
        renderFeed();
    };
    
    elements.resetFiltersBtn.addEventListener('click', resetFilters);

    // Modal Events
    elements.modalClose.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });

    // Handle user manual editing
    elements.tweetTextarea.addEventListener('input', () => {
        state.hasUserEditedTweet = true;
        updateCharCounter();
    });

    // Modal Checkboxes
    [elements.toggleDate, elements.toggleType, elements.toggleLink, elements.toggleTags].forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            state.hasUserEditedTweet = false; // Reset editing flag on option toggles
            generateTweetText();
        });
    });

    // Copy to Clipboard
    elements.copyTweetBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(elements.tweetTextarea.value);
            showToast('Tweet text copied to clipboard!', 'success');
        } catch (err) {
            console.error('Clipboard error:', err);
            // Fallback selection copy
            elements.tweetTextarea.select();
            document.execCommand('copy');
            showToast('Tweet text copied!', 'success');
        }
    });

    // Post to X
    elements.postTweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        showToast('Redirected to X!', 'success');
        closeTweetModal();
    });

    // Escape Key Modal Close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.tweetModal.classList.contains('active')) {
            closeTweetModal();
        }
    });

    // === Initialize Application ===
    fetchReleaseNotes(false);
// Export to CSV button
elements.exportCsvBtn.addEventListener('click', () => {
    const filtered = getFilteredEntries();
    const rows = [['Date', 'Type', 'Text', 'Link']];
    filtered.forEach(entry => {
        entry.items.forEach(item => {
            rows.push([
                entry.date,
                item.type,
                item.text.replace(/\n/g, ' '),
                entry.url
            ]);
        });
    });
    const csvContent = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bigquery_release_notes.csv';
    a.click();
    URL.revokeObjectURL(url);
});
});
