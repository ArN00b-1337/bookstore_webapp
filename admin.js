import { db, auth } from "./firebase-config.js";
import {
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
    query,
    orderBy,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const booksCollection = collection(db, "books");
const reviewsCollection = collection(db, "reviews");
const categoriesCollection = collection(db, "categories");

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

// --- File Upload Helpers ---
function setupDragAndDrop(areaId, inputId, previewAreaId, messageId) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const previewArea = document.getElementById(previewAreaId);
    const message = document.getElementById(messageId);
    if (!area || !input || !previewArea || !message) return;
    
    const previewImg = previewArea.querySelector('img');

    // Prevent defaults for all drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.remove('active'), false);
    });

    area.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            handleFileSelection(files[0]);
        }
    }, false);

    input.addEventListener('change', e => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    function handleFileSelection(file) {
        if (!file.type.startsWith('image/')) {
            alert("Please select an image file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            message.style.display = 'none';
            previewArea.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

function resetUploadArea(areaId, inputId, previewAreaId, messageId) {
    const message = document.getElementById(messageId);
    const previewArea = document.getElementById(previewAreaId);
    const input = document.getElementById(inputId);
    if (message) message.style.display = 'flex';
    if (previewArea) previewArea.style.display = 'none';
    if (input) input.value = '';
}

// --- Theme Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('theme-toggle');
    const loginThemeToggle = document.getElementById('login-theme-toggle'); // In case I add one there too

    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.querySelector('i').className = 'fas fa-sun';
        if (loginThemeToggle) loginThemeToggle.querySelector('i').className = 'fas fa-sun';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.querySelector('i').className = 'fas fa-moon';
        if (loginThemeToggle) loginThemeToggle.querySelector('i').className = 'fas fa-moon';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const themeToggle = document.getElementById('theme-toggle');

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeToggle) themeToggle.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Initial theme call (at top level or DOM loaded)
document.addEventListener('DOMContentLoaded', initTheme);

// --- Auth Logic ---
onAuthStateChanged(auth, (user) => {
    initTheme(); // Re-init to catch theme toggle element if it just became visible
    if (user) {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadBooks();
        loadReviews();
        loadCategories();
        loadSettings();
        
        // Initialize Drag & Drop
        setupDragAndDrop('book-drop-area', 'image-file', 'book-preview-area', 'book-upload-message');
        setupDragAndDrop('category-drop-area', 'category-image-file', 'category-preview-area', 'category-upload-message');
        setupDragAndDrop('review-drop-area', 'review-image-file', 'review-preview-area', 'review-upload-message');

        // Theme Toggle Listener
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.onclick = toggleTheme;
    } else {
        document.getElementById('login-panel').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    }
});

// --- Login Handler ---
document.getElementById('login-btn').addEventListener('click', async (e) => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = e.target;

    if (!email || !password) return alert("Please enter both email and password.");

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error);
        let msg = 'Login failed. Please check your credentials.';
        if (error.code === 'auth/too-many-requests') {
            msg = 'Too many failed login attempts. Please wait and try again.';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Invalid email format.';
        } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            msg = 'Incorrect email or password.';
        }
        alert(msg);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
});

// --- Logout Handler ---
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// --- Review Management Logic ---
function loadReviews() {
    const q = query(reviewsCollection, orderBy("createdAt", "desc"));
    document.getElementById('loading-reviews').style.display = 'block';

    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('admin-review-list');
        document.getElementById('loading-reviews').style.display = 'none';

        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No reviews found.</p>';
            return;
        }

        container.innerHTML = snapshot.docs.map(doc => {
            const review = doc.data();
            return `
                <div style="position: relative; border: 1px solid var(--border-color); border-radius: 0.5rem; overflow: hidden; box-shadow: var(--shadow-sm);">
                    <img src="${escapeHTML(review.image)}" loading="lazy" decoding="async" style="width: 100%; height: 200px; object-fit: cover;">
                    <button id="del-rev-${escapeHTML(doc.id)}" onclick="window.deleteReview('${escapeHTML(doc.id)}')" style="position: absolute; top: 5px; right: 5px; background: rgba(239, 68, 68, 0.9); color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }, (error) => {
        console.error("Admin reviews error:", error);
        document.getElementById('loading-reviews').style.display = 'none';
        document.getElementById('admin-review-list').innerHTML = `<p style="color:#ef4444; grid-column:1/-1; text-align:center; padding:1rem; border:1px solid #ef4444; background:rgba(239, 68, 68, 0.1); border-radius:0.5rem;"><b>Error loading reviews:</b> ${error.message}</p>`;
    });
}

// --- Settings Logic ---
const settingsDoc = doc(db, "settings", "homepage");
function loadSettings() {
    onSnapshot(settingsDoc, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('featured-title-input').value = data.featuredTitle || '';
            document.getElementById('featured-subtitle-input').value = data.featuredSubtitle || '';
        }
    });
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Saving...';

    try {
        await setDoc(settingsDoc, {
            featuredTitle: document.getElementById('featured-title-input').value.trim(),
            featuredSubtitle: document.getElementById('featured-subtitle-input').value.trim()
        }, { merge: true });
        alert("Homepage settings updated successfully!");
    } catch (error) {
        alert("Error saving settings: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
});

// --- CRUD Operations ---
window.deleteReview = async (id) => {
    if (!confirm('Permanently delete this review screenshot?')) return;
    try {
        await deleteDoc(doc(db, "reviews", id));
    } catch (error) {
        alert("Error deleting review: " + error.message);
    }
};

document.getElementById('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-review-btn');
    const fileInput = document.getElementById('review-image-file');
    const file = fileInput.files[0];

    if (!file) return alert("Please select an image");

    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const imageUrl = await uploadImageToCloudinary(file);
        await addDoc(reviewsCollection, {
            image: imageUrl,
            createdAt: new Date()
        });
        window.closeReviewModal();
        e.target.reset();
        resetUploadArea('review-drop-area', 'review-image-file', 'review-preview-area', 'review-upload-message');
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload & Save';
    }
});

window.openReviewModal = () => document.getElementById('review-modal').classList.add('active');
window.closeReviewModal = () => {
    document.getElementById('review-modal').classList.remove('active');
    resetUploadArea('review-drop-area', 'review-image-file', 'review-preview-area', 'review-upload-message');
};

function loadCategories() {
    const q = query(categoriesCollection, orderBy("createdAt", "desc"));
    document.getElementById('loading-categories').style.display = 'block';

    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('admin-category-list');
        const select = document.getElementById('category');
        document.getElementById('loading-categories').style.display = 'none';

        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No categories found.</p>';
            select.innerHTML = '<option value="">No categories available</option>';
            return;
        }

        let selectOptions = '';
        container.innerHTML = snapshot.docs.map(doc => {
            const cat = doc.data();
            selectOptions += `<option value="${escapeHTML(doc.id)}">${escapeHTML(cat.name)}</option>`;
            return `
                <div style="position: relative; border: 1px solid var(--border-color); border-radius: 0.5rem; overflow: hidden; box-shadow: var(--shadow-sm); padding: 1rem; background: var(--card-bg); color: var(--text-color); text-align: center;">
                    <img src="${escapeHTML(cat.image)}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 0.9rem;">${escapeHTML(cat.name)}</h4>
                    <button onclick="window.deleteCategory('${escapeHTML(doc.id)}')" style="position: absolute; top: 5px; right: 5px; background: rgba(239, 68, 68, 0.9); color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        selectOptions += `
            <option value="1" disabled style="background:var(--bg-color);color:var(--text-secondary);">-- OLD CATEGORIES (Legacy) --</option>
            <option value="1">TEST PAPER</option>
            <option value="2">HSC MAIN BOOK</option>
            <option value="3">SSC OLD BOOKS</option>
            <option value="4">CLASS 1-9</option>
        `;
        select.innerHTML = selectOptions;
    });
}

document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-category-btn');
    const fileInput = document.getElementById('category-image-file');
    const file = fileInput.files[0];
    const name = document.getElementById('category-name').value.trim();

    if (!file) return alert("Please select an image");
    if (!name) return alert("Please enter a category name");

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const imageUrl = await uploadImageToCloudinary(file);
        await addDoc(categoriesCollection, {
            name: name,
            image: imageUrl,
            createdAt: new Date()
        });
        window.closeCategoryModal();
        e.target.reset();
        resetUploadArea('category-drop-area', 'category-image-file', 'category-preview-area', 'category-upload-message');
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Category';
    }
});

window.deleteCategory = async (id) => {
    if (!confirm('Permanently delete this category?')) return;
    try {
        await deleteDoc(doc(db, "categories", id));
    } catch (error) {
        alert("Error deleting category: " + error.message);
    }
};

window.openCategoryModal = () => document.getElementById('category-modal').classList.add('active');
window.closeCategoryModal = () => {
    document.getElementById('category-modal').classList.remove('active');
    resetUploadArea('category-drop-area', 'category-image-file', 'category-preview-area', 'category-upload-message');
};

function loadBooks() {
    const q = query(booksCollection, orderBy("title"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('admin-book-list');
        document.getElementById('loading').style.display = 'none';

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No books found.</p>';
            return;
        }

        container.innerHTML = snapshot.docs.map(doc => {
            const book = doc.data();
            const imgSrc = book.image || 'https://images.unsplash.com/photo-1543005120-019f2ef5542e?auto=format&fit=crop&q=80&w=300&h=400';
            const featuredBadge = book.isFeatured ? '<span style="background: rgba(254, 240, 138, 0.2); border: 1px solid #fef08a; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left:8px; color:#facc15;"><i class="fas fa-star" title="Featured"></i> Featured</span>' : '';
            return `
                <div class="book-list-item">
                    <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(book.title)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1543005120-019f2ef5542e?auto=format&fit=crop&q=80&w=300&h=400';">
                    <div style="flex-grow: 1;">
                        <h4 style="margin-bottom: 0.25rem; display:flex; align-items:center;">${escapeHTML(book.title)} ${featuredBadge}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${escapeHTML(book.author)}</p>
                    </div>
                    <div class="actions">
                        <button class="btn btn-danger" onclick="window.deleteBook('${escapeHTML(doc.id)}')" title="Delete Book">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    });
}

async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "bookstore");
    const cloudName = "dzpzsbzyz";
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
    });
    const data = await response.json();
    if (response.ok && data.secure_url) {
        return data.secure_url;
    } else {
        throw new Error(data.error ? data.error.message : "Image upload failed");
    }
}

document.getElementById('book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    const fileInput = document.getElementById('image-file');
    const file = fileInput.files[0];

    if (!file) return alert("Please select a book cover image.");

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const imageUrl = await uploadImageToCloudinary(file);
        await addDoc(booksCollection, {
            title: document.getElementById('title').value.trim(),
            author: document.getElementById('author').value.trim(),
            category: document.getElementById('category').value,
            isFeatured: document.getElementById('featured').checked,
            image: imageUrl,
            createdAt: new Date()
        });

        window.closeModal();
        e.target.reset();
        resetUploadArea('book-drop-area', 'image-file', 'book-preview-area', 'book-upload-message');
    } catch (error) {
        alert("Error saving book: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Book';
    }
});

window.deleteBook = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this book?')) return;
    try {
        await deleteDoc(doc(db, "books", id));
    } catch (error) {
        alert("Error deleting book: " + error.message);
    }
};

window.openModal = () => document.getElementById('book-modal').classList.add('active');
window.closeModal = () => {
    document.getElementById('book-modal').classList.remove('active');
    resetUploadArea('book-drop-area', 'image-file', 'book-preview-area', 'book-upload-message');
};
