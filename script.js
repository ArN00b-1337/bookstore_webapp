import { db } from "./firebase-config.js";
import { collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Book Data
let books = [];

// DOM Elements
const bookGrid = document.getElementById('book-grid');
const categoryGrid = document.getElementById('category-grid');
const backButton = document.getElementById('back-to-categories');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navMenu = document.getElementById('nav-menu');

// State
let currentCategory = 'all';
let searchQuery = '';
let viewMode = 'categories'; // 'categories' or 'books'

// Dynamic Categories Store
let categories = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    fetchBooks();
    loadReviews();
    fetchSettings();
    updateView();
    setupEventListeners();
    initTheme();
    renderCart(); // Initialize empty UI cleanly
    setupStickyNav();
    animateLogoTyping();
    setupSliderControls();
    
    // Initial loading skeletons
    renderSkeletons();
});

// Skeleton Loader Logic
function renderSkeletons() {
    const featuredGrid = document.getElementById('featured-grid');
    const bookGrid = document.getElementById('book-grid');
    const categoryGrid = document.getElementById('category-grid');

    const bookSkeletonHTML = `
        <div class="skeleton-card">
            <div class="skeleton-img skeleton"></div>
            <div class="skeleton-info">
                <div class="skeleton-text category skeleton"></div>
                <div class="skeleton-text title skeleton"></div>
                <div class="skeleton-text author skeleton"></div>
                <div class="skeleton-btn-group">
                    <div class="skeleton-btn skeleton"></div>
                    <div class="skeleton-btn skeleton"></div>
                </div>
            </div>
        </div>
    `;

    const categorySkeletonHTML = `
        <div style="text-align:center;">
            <div class="skeleton-category skeleton"></div>
            <div class="skeleton-text title skeleton" style="margin: 0 auto; width: 60%;"></div>
        </div>
    `;

    if (featuredGrid) featuredGrid.innerHTML = Array(4).fill(bookSkeletonHTML).join('');
    if (bookGrid) {
        bookGrid.innerHTML = Array(8).fill(bookSkeletonHTML).join('');
        // Ensure grid layout matches viewMode (hack to prevent layout shift)
        if (viewMode === 'books') {
            bookGrid.classList.add('two-col-grid');
        }
    }
    if (categoryGrid) categoryGrid.innerHTML = Array(6).fill(categorySkeletonHTML).join('');
}

// Logo Typing Effect
function animateLogoTyping() {
    const logoText = document.getElementById('logo-text');
    if (!logoText) return;

    const fullText = "মেহেদী বুক কর্নার";
    logoText.textContent = "";
    let i = 0;

    function type() {
        if (i < fullText.length) {
            logoText.textContent += fullText.charAt(i);
            i++;
            setTimeout(type, 100 + Math.random() * 50); // Slight random delay for "natural" feel
        } else {
            logoText.classList.add('typing-finished');
        }
    }

    // Start with a small delay
    setTimeout(type, 800);
}

// Sticky Navigation Scroll Effect
function setupStickyNav() {
    const header = document.getElementById('main-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Setup Featured Slider Arrows
function setupSliderControls() {
    const slider = document.getElementById('featured-grid');
    const prevBtn = document.getElementById('featured-prev');
    const nextBtn = document.getElementById('featured-next');

    if (slider && prevBtn && nextBtn) {
        // Card width (280px) + Gap (1.5rem = 24px) = 304px shift
        prevBtn.addEventListener('click', () => {
            slider.scrollBy({ left: -304, behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            slider.scrollBy({ left: 304, behavior: 'smooth' });
        });
    }
}

// Fetch Data from Firestore
function fetchBooks() {
    const booksCollection = collection(db, "books");

    // Real-time listener
    onSnapshot(booksCollection, (snapshot) => {
        books = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderFeaturedBooks();
        if (viewMode === 'books') renderBooks();
    }, (error) => {
        console.error("Error fetching books:", error);
        categoryGrid.style.display = 'none';
        bookGrid.style.display = 'block';
        if (error.code === 'permission-denied') {
            bookGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;"><b>Error: Permission Denied.</b><br>Please configure your Firestore Database Rules correctly as outlined in the setup plan.</div>';
        } else {
            bookGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;">সার্ভার থেকে বই লোড করতে ব্যর্থ হয়েছে। (Server disconnected or invalid config)</div>';
        }
    });
}

// Fetch Settings from Firestore
function fetchSettings() {
    const settingsDocRef = doc(db, "settings", "homepage");
    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const titleEl = document.getElementById('dynamic-featured-title');
            const subEl = document.getElementById('dynamic-featured-subtitle');
            if (titleEl && data.featuredTitle) titleEl.textContent = data.featuredTitle;
            if (subEl && data.featuredSubtitle) subEl.textContent = data.featuredSubtitle;
        }
    }, (error) => {
        console.error("Error fetching homepage settings:", error);
    });
}

// Fetch Categories from Firestore
function fetchCategories() {
    const categoriesCollection = collection(db, "categories");

    onSnapshot(categoriesCollection, (snapshot) => {
        categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderCategories();
        // re-render books if already on book view and category data just arrived
        if (viewMode === 'books') renderBooks(); 
    }, (error) => {
        console.error("Error fetching categories:", error);
    });
}

// Render Featured Books
function renderFeaturedBooks() {
    const featuredContainer = document.getElementById('featured-grid');
    if (!featuredContainer) return;

    // Filter books where isFeatured is true
    const featuredBooks = books.filter(book => book.isFeatured === true);

    featuredContainer.innerHTML = '';

    if (featuredBooks.length === 0) {
        featuredContainer.innerHTML = '<p style="text-align:center;width:100%;color:var(--text-secondary);">বর্তমানে কোনো নির্বাচিত বই নেই।</p>';
    } else {
        featuredBooks.forEach(book => {
            featuredContainer.appendChild(createBookCard(book));
        });
    }

    const section = document.getElementById('featured');
    if (section) {
        section.style.display = 'block'; // Always show, just with empty message if none.
    }
}

// Fetch and Render Reviews
function loadReviews() {
    const reviewsCollection = collection(db, "reviews");
    const reviewsSection = document.getElementById('reviews');

    onSnapshot(reviewsCollection, (snapshot) => {
        if (snapshot.empty) {
            reviewsSection.style.display = 'none';
            return;
        }

        reviewsSection.style.display = 'block';
        const reviews = snapshot.docs.map(doc => doc.data());
        const track = document.querySelector('.slide-track');

        track.innerHTML = '';

        let baseReviews = [...reviews];
        while (baseReviews.length < 6) {
            baseReviews = [...baseReviews, ...reviews];
        }

        const displayReviews = [...baseReviews, ...baseReviews];

        // Pass the absolute count of base reviews to CSS for completely dynamic tracking
        track.style.setProperty('--slide-count', baseReviews.length);

        track.innerHTML = displayReviews.map(review => `
            <div class="slide">
                <img src="${escapeHTML(review.image)}" alt="Customer Review" decoding="async">
            </div>
        `).join('');
    }, (error) => {
        console.error("Error loading reviews:", error);
        reviewsSection.style.display = 'none'; // Degrade gracefully
    });
}

function renderCategories() {
    categoryGrid.innerHTML = '';
    
    if (categories.length === 0) {
        categoryGrid.innerHTML = '<p style="text-align:center; width: 100%; color: var(--text-secondary); grid-column: 1/-1;">কোনো ক্যাটাগরি তৈরি করা হয়নি। Admin panel থেকে category add করুন।</p>';
        return;
    }

    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <img src="${escapeHTML(cat.image)}" alt="${escapeHTML(cat.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=100&h=100';">
            <div class="category-name">${escapeHTML(cat.name)}</div>
        `;
        card.addEventListener('click', () => {
            currentCategory = cat.id;
            viewMode = 'books';
            searchQuery = searchInput.value = '';
            window.scrollTo({ top: document.getElementById('shop').offsetTop - 80, behavior: 'smooth' });
            updateView();
        });
        categoryGrid.appendChild(card);
    });
}

function updateView() {
    if (viewMode === 'categories' && !searchQuery) {
        categoryGrid.style.display = 'grid';
        bookGrid.style.display = 'none';
        backButton.style.display = 'none';
        bookGrid.classList.remove('two-col-grid');
    } else {
        categoryGrid.style.display = 'none';
        bookGrid.style.display = 'grid';
        
        if (searchQuery) {
            backButton.style.display = 'none';
            bookGrid.classList.remove('two-col-grid');
            currentCategory = 'all';
        } else {
            backButton.style.display = 'inline-flex';
            bookGrid.classList.add('two-col-grid');
        }
        renderBooks();
    }
}

// Render Books (Shop)
function renderBooks() {
    bookGrid.innerHTML = '';

    const filteredBooks = books.filter(book => {
        // Universal parser to cleanly catch old inputs, cached inputs, and new inputs
        const mapToId = {
            'TEST PAPER': '1', 'HSC MAIN BOOK': '2', 'SSC OLD BOOKS AND GUIDE': '3', 'CLASS 1-9 BOOKS & GUIDES': '4',
            'academic': '2', 'novel': '3', 'islamic': '1', 'kids': '4'
        };
        const normalizedBookCat = mapToId[book.category] || book.category;
        
        const matchesCategory = currentCategory === 'all' || 
                                normalizedBookCat === currentCategory || 
                                book.category === currentCategory;
        const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredBooks.length === 0) {
        bookGrid.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 2rem;"><p>দুঃখিত, কোনো বই পাওয়া যায়নি।</p></div>';
        return;
    }

    filteredBooks.forEach(book => {
        bookGrid.appendChild(createBookCard(book));
    });
}

// Order Book
window.orderBook = function (bookId, platform = 'whatsapp') {
    const book = books.find(b => b.id == bookId); 
    if (!book) {
        console.error("Book not found", bookId);
        return;
    }

    const text = `Hi, I want to order the following book:\n\nTitle: ${book.title}\nAuthor: ${book.author}`;
    
    let url = "";
    if (platform === 'whatsapp') {
        const phone = "8801754463744";
        url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    } else if (platform === 'facebook') {
        url = `https://www.facebook.com/profile.php?id=105702565614247`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                alert("Order details copied to clipboard! Paste them in a message on our Facebook Page.");
                window.open(url, '_blank');
            }).catch(() => window.open(url, '_blank'));
        } else {
            window.open(url, '_blank');
        }
    }
}

// Helper to create card HTML
function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';

    const imgSrc = book.image || 'https://images.unsplash.com/photo-1543005120-019f2ef5542e?auto=format&fit=crop&q=80&w=300&h=400';

    card.innerHTML = `
        <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(book.title)}" class="book-image" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1543005120-019f2ef5542e?auto=format&fit=crop&q=80&w=300&h=400';">
        <div class="book-info">
            <span class="book-category">${escapeHTML(getCategoryName(book.category))}</span>
            <h3 class="book-title">${escapeHTML(book.title)}</h3>
            <p class="book-author">${escapeHTML(book.author)}</p>
            <div class="btn-group" style="margin-top: 0.5rem;">
                <button class="btn btn-outline" onclick="window.addToCart(event, '${escapeHTML(book.id)}')" title="Add to Cart">
                    <i class="fas fa-cart-plus"></i> Add
                </button>
                <button class="btn btn-primary" onclick="window.openCheckoutModal('${escapeHTML(book.id)}')" title="Buy Now instantly">
                    <i class="fas fa-shopping-bag"></i> Buy Now
                </button>
            </div>
        </div>
    `;
    return card;
}

// --- Helpers ---
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function getCategoryName(cat) {
    const map = {
        '1': 'TEST PAPER',
        '2': 'HSC MAIN BOOK',
        '3': 'SSC OLD BOOKS AND GUIDE',
        '4': 'CLASS 1-9 BOOKS & GUIDES',
        'academic': 'HSC MAIN BOOK',
        'novel': 'SSC OLD BOOKS AND GUIDE',
        'islamic': 'TEST PAPER',
        'kids': 'CLASS 1-9 BOOKS & GUIDES',
        'all': 'সব'
    };
    
    // Check dynamic categories first
    const found = categories.find(c => c.id === cat);
    if (found) return found.name;
    
    return map[cat] || cat;
}

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (searchQuery) {
            viewMode = 'books';
        } else {
            viewMode = 'categories';
        }
        updateView();
    });

    if (backButton) {
        backButton.addEventListener('click', () => {
            viewMode = 'categories';
            searchQuery = searchInput.value = '';
            currentCategory = 'all';
            updateView();
        });
    }

    mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking a link (assuming navigation links are anchors)
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });

    themeToggle.addEventListener('change', toggleTheme);
}

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.checked = false;
    }
}

function toggleTheme() {
    const isDark = themeToggle.checked;
    const newTheme = isDark ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- Modal Logic ---
window.openCheckoutModal = function(bookId) {
    const modal = document.getElementById('checkout-modal');
    modal.classList.add('active');
    
    document.getElementById('modal-wa-btn').onclick = () => {
        window.orderBook(bookId, 'whatsapp');
        window.closeCheckoutModal();
    };
    
    document.getElementById('modal-fb-btn').onclick = () => {
        window.orderBook(bookId, 'facebook');
        window.closeCheckoutModal();
    };
};

window.closeCheckoutModal = function() {
    document.getElementById('checkout-modal').classList.remove('active');
};

// --- Cart System Logic ---
let cart = [];

window.toggleCart = function() {
    document.getElementById('cart-sidebar').classList.toggle('active');
    document.getElementById('cart-overlay').classList.toggle('active');
};

window.addToCart = function(event, bookId) {
    const book = books.find(b => b.id == bookId);
    if (!book) return;

    const existing = cart.find(item => item.book.id == bookId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ book, quantity: 1 });
    }
    
    // Add quick visual feedback
    const btn = event.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Added!';
    setTimeout(() => btn.innerHTML = oldHtml, 1500);

    renderCart();
};

window.updateQuantity = function(bookId, delta) {
    const index = cart.findIndex(item => item.book.id == bookId);
    if (index !== -1) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
    }
    renderCart();
};

window.removeFromCart = function(bookId) {
    const index = cart.findIndex(item => item.book.id == bookId);
    if (index !== -1) cart.splice(index, 1);
    renderCart();
};

window.renderCart = function() {
    const badge = document.getElementById('cart-badge');
    const itemsContainer = document.getElementById('cart-items');
    
    // Calculate totals
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Update badge (hide if 0)
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
    
    // Disable active checkout state if empty
    const waBtn = document.getElementById('checkout-wa-btn');
    const fbBtn = document.getElementById('checkout-fb-btn');
    if (waBtn) {
        waBtn.style.opacity = totalQty > 0 ? '1' : '0.5';
        waBtn.style.pointerEvents = totalQty > 0 ? 'auto' : 'none';
    }
    if (fbBtn) {
        fbBtn.style.opacity = totalQty > 0 ? '1' : '0.5';
        fbBtn.style.pointerEvents = totalQty > 0 ? 'auto' : 'none';
    }
    
    // Draw Items
    if (cart.length === 0) {
        itemsContainer.innerHTML = '<div style="text-align:center; color:var(--text-secondary); margin-top:2rem;"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.3;"></i><p>আপনার কার্ট খালি!</p></div>';
        return;
    }
    
    itemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${escapeHTML(item.book.image)}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/60x80?text=No+Cover'">
            <div class="cart-item-details">
                <div class="cart-item-title">${escapeHTML(item.book.title)}</div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="window.updateQuantity('${escapeHTML(item.book.id)}', -1)"><i class="fas fa-minus" style="font-size:0.6rem;"></i></button>
                    <span style="font-size:0.9rem; min-width:20px; text-align:center;">${item.quantity}</span>
                    <button class="qty-btn" onclick="window.updateQuantity('${escapeHTML(item.book.id)}', 1)"><i class="fas fa-plus" style="font-size:0.6rem;"></i></button>
                </div>
            </div>
            <button onclick="window.removeFromCart('${escapeHTML(item.book.id)}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0.5rem;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
};

// Bulk Order Cart
window.checkoutCart = function(platform = 'whatsapp') {
    if (cart.length === 0) return alert("Your cart is empty!");
    
    let text = "Hi, I want to order the following books:\n\n";
    
    cart.forEach((item, i) => {
        text += `${i + 1}. ${item.book.title}\n`;
        text += `   - Author: ${item.book.author}\n`;
        text += `   - Qty: ${item.quantity}x\n\n`;
    });
    
    let url = "";
    if (platform === 'whatsapp') {
        const phone = "8801754463744";
        url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    } else if (platform === 'facebook') {
        url = `https://www.facebook.com/profile.php?id=105702565614247`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                alert("Order details copied to clipboard! Paste them in a message on our Facebook Page.");
                window.open(url, '_blank');
            }).catch(() => window.open(url, '_blank'));
        } else {
            // Fallback
            window.open(url, '_blank');
        }
    }
};
