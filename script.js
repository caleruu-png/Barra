// CONFIGURACIÓN SUPABASE - COMPLETA CON TUS DATOS
const SUPABASE_URL = "https://yfhzogdtiubkbzrxbugu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4s7OZ9kj2QvNUOJDGkaPyw_vn9BWIeR";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPin = "";
let currentRole = "";
let selectedMesaId = null;
let currentTotal = 0;
let cashReceived = 0;
let history = [];

// --- NAVEGACIÓN Y LOGIN ---
function addPin(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        document.getElementById('pin-input').value = "*".repeat(currentPin.length);
    }
}

function clearPin() {
    currentPin = "";
    document.getElementById('pin-input').value = "";
}

function login() {
    if (currentPin === "1234") { currentRole = "admin"; showView('admin-screen'); loadStats(); }
    else if (currentPin === "0000") { currentRole = "barra"; showView('mesa-grid-screen'); loadMesas(); }
    else if (currentPin === "1111") { currentRole = "tickets"; openTickets(); }
    else { alert("PIN Incorrecto"); clearPin(); }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function logout() {
    currentPin = "";
    clearPin();
    showView('login-screen');
}

// --- LÓGICA DE MESAS ---
async function loadMesas(showInactiva = false) {
    const { data } = await _supabase.from('mesas').select('*').eq('activa', !showInactiva);
    const container = document.getElementById('mesas-container');
    container.innerHTML = "";
    data.forEach(mesa => {
        const div = document.createElement('div');
        div.className = `mesa-card ${!mesa.activa ? 'inactive' : ''}`;
        div.innerHTML = `<h3>${mesa.nombre}</h3><p>${mesa.total}€</p>`;
        div.onclick = () => selectMesa(mesa);
        container.appendChild(div);
    });
}

function showInactivas() {
    loadMesas(true);
}

async function selectMesa(mesa) {
    selectedMesaId = mesa.id;
    currentTotal = parseFloat(mesa.total);
    document.getElementById('pos-title').innerText = mesa.nombre;
    updatePOSDisplay();
    showView('pos-screen');
    
    // Suscribirse a cambios en tiempo real para esta mesa
    _supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `id=eq.${mesa.id}` }, payload => {
        currentTotal = payload.new.total;
        updatePOSDisplay();
    }).subscribe();
}

function openTickets() {
    selectedMesaId = null;
    currentTotal = 0;
    document.getElementById('pos-title').innerText = "Venta Directa";
    updatePOSDisplay();
    showView('pos-screen');
}

// --- LÓGICA DE COBRO ---
async function addToAccount(price) {
    currentTotal += price;
    history.push(price);
    updatePOSDisplay();
    if (selectedMesaId) {
        await _supabase.from('mesas').update({ total: currentTotal }).eq('id', selectedMesaId);
    }
}

async function undoLast() {
    if (history.length > 0) {
        const lastPrice = history.pop();
        currentTotal -= lastPrice;
        updatePOSDisplay();
        if (selectedMesaId) {
            await _supabase.from('mesas').update({ total: currentTotal }).eq('id', selectedMesaId);
        }
    }
}

function updatePOSDisplay() {
    document.getElementById('total-amount').innerText = currentTotal.toFixed(2);
    // Limpiar contadores visuales (simplificado)
    const counts = [1, 1.5, 2, 2.5, 4, 8];
    counts.forEach(c => {
        const el = document.getElementById(`count-${c.toString().replace('.','-')}`);
        if(el) el.innerText = history.filter(x => x === c).length;
    });
}

// --- MÓDULO DE EFECTIVO ---
function openCashModal() {
    cashReceived = 0;
    document.getElementById('cash-input-display').innerText = "0€";
    document.getElementById('change-amount').innerText = "0.00";
    document.getElementById('cash-modal').style.display = 'flex';
}

function addCash(amount) {
    cashReceived += amount;
    document.getElementById('cash-input-display').innerText = cashReceived + "€";
    const change = cashReceived - currentTotal;
    document.getElementById('change-amount').innerText = (change > 0 ? change : 0).toFixed(2);
}

async function finalizePayment() {
    // 1. Registrar Venta
    await _supabase.from('ventas').insert([{ monto: currentTotal }]);
    
    // 2. Si es mesa, desactivar y limpiar
    if (selectedMesaId) {
        await _supabase.from('mesas').update({ total: 0, activa: false }).eq('id', selectedMesaId);
    }
    
    closeModal();
    alert("Pago finalizado con éxito");
    history = [];
    backToMain();
}

function closeModal() { document.getElementById('cash-modal').style.display = 'none'; }

function backToMain() {
    if (currentRole === 'tickets') logout();
    else { loadMesas(); showView('mesa-grid-screen'); }
}

async function loadStats() {
    const { data } = await _supabase.from('ventas').select('monto');
    const total = data.reduce((acc, v) => acc + parseFloat(v.monto), 0);
    document.getElementById('total-ventas-val').innerText = total.toFixed(2) + "€";
}