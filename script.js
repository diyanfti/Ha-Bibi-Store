// Taruh di paling atas script.js
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
});

// ===== TOGGLE TEMA =====
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
}

// =============================================
// GANTI NOMOR WA & KOORDINAT TOKO DI SINI
// =============================================
const NOMOR_WA   = "6283857710344";
const ONGKIR     = 500;
const MAX_KM     = 1; // radius maksimal pengiriman (km)

// Koordinat toko kamu — ganti sesuai lokasi asli
// Cara cari: buka Google Maps → klik lokasi toko → salin koordinat
const TOKO_LAT = -8.1725; // contoh: Jember
const TOKO_LNG = 113.7003;

// =============================================

let cart = [];
let userLat = null, userLng = null;
let pendingWAMessage = '';

// ---- Qty di card ----
function changeCardQty(btn, delta) {
    const qtyEl = btn.parentElement.querySelector('.qty-value');
    let qty = parseInt(qtyEl.textContent) + delta;
    if (qty < 1) qty = 1;
    qtyEl.textContent = qty;
}

// ---- Tambah ke keranjang ----
function addToCart(name, price, unit, btn) {
    const card = btn.closest('.product-card');
    const qtyEl = card.querySelector('.qty-value');
    const qty = parseInt(qtyEl.textContent);

    const existing = cart.find(i => i.name === name);
    if (existing) existing.qty += qty;
    else cart.push({ name, price, unit, qty });

    qtyEl.textContent = 1;
    renderCart();
    updateBadge();

    const panel = document.getElementById('cartPanel');
    if (!panel.classList.contains('active')) toggleCart();
}

function removeFromCart(name) {
    cart = cart.filter(i => i.name !== name);
    renderCart();
    updateBadge();
}

function changeQty(name, delta) {
    const item = cart.find(i => i.name === name);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeFromCart(name);
    else renderCart();
    updateBadge();
}

// ---- Render keranjang ----
function renderCart() {
    const container = document.getElementById('cartItems');
    const footer    = document.getElementById('cartFooter');

    if (cart.length === 0) {
        container.innerHTML = '<p class="cart-empty">Keranjang masih kosong</p>';
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';

    let html = '', subtotal = 0;
    cart.forEach(item => {
        const s = item.price * item.qty;
        subtotal += s;
        html += `
        <div class="cart-item">
            <div class="cart-item-name">
                ${item.name}
                <span class="cart-item-unit">${item.qty} × ${item.unit}</span>
            </div>
            <div class="cart-item-controls">
                <button onclick="changeQty('${item.name}', -1)">−</button>
                <span>${item.qty}</span>
                <button onclick="changeQty('${item.name}', 1)">+</button>
            </div>
            <div class="cart-item-price">Rp ${s.toLocaleString('id-ID')}</div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.name}')">🗑</button>
        </div>`;
    });

    container.innerHTML = html;
    document.getElementById('cartTotal').textContent = 'Rp ' + subtotal.toLocaleString('id-ID');
    updateGrandTotal(subtotal);
}

function updateGrandTotal(subtotal) {
    const isAntar  = document.querySelector('input[name="delivery"]:checked')?.value === 'antar';
    const grand    = subtotal + (isAntar ? ONGKIR : 0);
    document.getElementById('grandTotal').textContent = 'Rp ' + grand.toLocaleString('id-ID');
}

function getSubtotal() {
    return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function updateBadge() {
    document.getElementById('cartBadge').textContent = cart.reduce((s, i) => s + i.qty, 0);
}

// ---- Toggle pengiriman ----
function toggleDelivery(radio) {
    const addrGroup = document.getElementById('addressGroup');
    const ongkirBox = document.getElementById('ongkirBox');
    if (radio.value === 'antar') {
        addrGroup.style.display = 'block';
        ongkirBox.style.display = 'block';
    } else {
        addrGroup.style.display = 'none';
        ongkirBox.style.display = 'none';
        userLat = null; userLng = null;
        document.getElementById('locationStatus').textContent = '';
        document.getElementById('mapsLink').value = '';
    }
    updateGrandTotal(getSubtotal());
}

// ---- Geolocation ----
function getLocation() {
    const status = document.getElementById('locationStatus');
    status.textContent = '⏳ Mendapatkan lokasi...';
    status.className = 'location-status';

    if (!navigator.geolocation) {
        status.textContent = '❌ Browser tidak mendukung geolocation';
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            const dist = getDistance(userLat, userLng, TOKO_LAT, TOKO_LNG);
            if (dist > MAX_KM) {
                status.textContent = `❌ Lokasi kamu ${dist.toFixed(1)} km dari toko. Pengiriman hanya dalam ${MAX_KM} km.`;
                status.className = 'location-status error';
                userLat = null; userLng = null;
            } else {
                status.textContent = `✅ Lokasi terdeteksi! Jarak ±${dist.toFixed(2)} km dari toko.`;
                status.className = 'location-status success';
                // Isi link maps otomatis
                document.getElementById('mapsLink').value =
                    `https://maps.google.com/?q=${userLat},${userLng}`;
            }
        },
        () => {
            status.textContent = '❌ Gagal mendapatkan lokasi. Paste link Google Maps manual.';
            status.className = 'location-status error';
        }
    );
}

// Hitung jarak Haversine (km)
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371, dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function rad(d) { return d * Math.PI / 180; }

// ---- Panel ----
function toggleCart() {
    document.getElementById('cartPanel').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function closeAllPanel() {
    document.getElementById('cartPanel').classList.remove('active');
    document.getElementById('qrisModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function closeQris() {
    document.getElementById('qrisModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// ---- Validasi & Kirim WA ----
function sendToWhatsApp() {
    if (cart.length === 0) { alert('Keranjang masih kosong!'); return; }

    const nama     = document.getElementById('customerName').value.trim();
    const delivery = document.querySelector('input[name="delivery"]:checked').value;
    const payment  = document.querySelector('input[name="payment"]:checked').value;
    const catatan  = document.getElementById('orderNotes').value.trim();
    const mapsLink = document.getElementById('mapsLink').value.trim();

    if (!nama) {
        alert('Mohon isi nama pemesan!');
        document.getElementById('customerName').focus();
        return;
    }

    if (delivery === 'antar') {
        // Validasi lokasi
        if (!mapsLink) {
            alert('Mohon dapatkan lokasi atau paste link Google Maps kamu!');
            return;
        }
        // Jika tidak pakai geolocation tapi ada link manual, tetap lanjut
        // (validasi radius hanya jika pakai geolocation)
        if (userLat === null && !mapsLink.includes('maps')) {
            alert('Link lokasi tidak valid!');
            return;
        }
    }

    let subtotal = 0, pesanItems = '';
    cart.forEach((item, i) => {
        const s = item.price * item.qty;
        subtotal += s;
        pesanItems += `${i+1}. ${item.name} ${item.qty}× (${item.unit}) = Rp ${s.toLocaleString('id-ID')}\n`;
    });

    const isAntar  = delivery === 'antar';
    const grand    = subtotal + (isAntar ? ONGKIR : 0);

    let pesan =
`🛍️ *PESANAN HA BIBI STORE*

👤 Nama      : ${nama}
🚚 Pengiriman: ${isAntar ? 'Antar ke Rumah' : 'Ambil Sendiri'}
💳 Pembayaran: ${payment}

📦 *Detail Pesanan:*
${pesanItems}`;

    if (isAntar) {
        pesan += `🛵 Ongkir      : Rp ${ONGKIR.toLocaleString('id-ID')}\n`;
        pesan += `📍 Lokasi      : ${mapsLink}\n`;
    }

    pesan += `\n💰 *Total Bayar: Rp ${grand.toLocaleString('id-ID')}*`;

    if (catatan) pesan += `\n\n📝 Catatan: ${catatan}`;

    pendingWAMessage = pesan;

    // Jika QRIS → tampilkan modal QRIS dulu
    if (payment === 'QRIS') {
        document.getElementById('qrisAmount').textContent = 'Rp ' + grand.toLocaleString('id-ID');
        document.getElementById('qrisModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
        // Tutup panel keranjang
        document.getElementById('cartPanel').classList.remove('active');
    } else {
        doSendWA();
    }
}

function doSendWA() {
    const url = `https://wa.me/${NOMOR_WA}?text=${encodeURIComponent(pendingWAMessage)}`;
    window.open(url, '_blank');
    closeQris();
}