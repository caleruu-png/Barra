// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://nxlvjryyqjchvjlwzayg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZqcnl5cWpjaHZqbHd6YXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0MTAyNDIsImV4cCI6MjA2OTk4NjI0Mn0.5275f53113002311798170471501568026655182504177242144587790695941";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPin = "";
let currentRole = "";
let selectedMesaId = null;
let currentTotal = 0;
let cashReceived = 0;
let historyItems = [];
let showingInactivas = false;

// --- LOGIN ---
window.addPin = (num) => {
    if (currentPin.length < 4) {
        currentPin += num;
        document.getElementById('pin-input').value = "*".repeat(currentPin.length);
    }
};
window.clearPin = () => {
    currentPin = "";
    document.getElementById('pin-input').value = "";
};
window.login = () => {
    if (currentPin === "1234") { currentRole = "admin"; showView('admin-screen'); loadStats(); }
    else if (currentPin === "0000") { currentRole = "barra"; showView('mesa-grid-screen'); loadMesas(false); }
    else if (currentPin === "1111") { currentRole = "tickets"; openTickets(); }
    else { alert("PIN Incorrecto"); clearPin(); }
};
window.logout = () => { currentPin = ""; clearPin(); showView('login-screen'); };

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- GESTIÓN DE MESAS ---
window.loadMesas = async (inactivas = false) => {
    const { data } = await supabaseClient.from('mesas').select('*').eq('activa', !inactivas).order('id', { ascending: false });
    const container = document.getElementById('mesas-container');
    container.innerHTML = "";
    data?.forEach(mesa => {
        const div = document.createElement('div');
        div.className = `mesa-card ${!mesa.activa ? 'inactive' : ''}`;
        div.innerHTML = `<h3>${mesa.nombre}</h3><p>${mesa.total}€</p>`;
        div.onclick = () => selectMesa(mesa);
        container.appendChild(div);
    });
};

window.toggleMesasView = () => {
    showingInactivas = !showingInactivas;
    document.getElementById('btn-toggle-mesas').innerText = showingInactivas ? "Ver Activas" : "Reactivar Mesa";
    loadMesas(showingInactivas);
};

// NUEVAS FUNCIONES DE CREACIÓN
window.openMesaModal = () => {
    document.getElementById('new-mesa-name').value = "";
    document.getElementById('create-mesa-modal').style.display = 'flex';
};
window.closeMesaModal = () => {
    document.getElementById('create-mesa-modal').style.display = 'none';
};
window.createNewMesa = async () => {
    const name = document.getElementById('new-mesa-name').value;
    if (!name) return alert("Escribe un nombre para la mesa");
    
    const { error } = await supabaseClient.from('mesas').insert([{ nombre: name, total: 0, activa: true }]);
    if (error) alert("Error al crear mesa");
    else {
        closeMesaModal();
        loadMesas(false);
    }
};

async function selectMesa(mesa) {
    if (!mesa.activa) {
        if (confirm("¿Reactivar mesa?")) {
            await supabaseClient.from('mesas').update({ activa: true }).eq('id', mesa.id);
            loadMesas(false);
        }
        return;
    }
    selectedMesaId = mesa.id;
    currentTotal = parseFloat(mesa.total) || 0;
    historyItems = [];
    document.getElementById('pos-title').innerText = mesa.nombre;
    updatePOSDisplay();
    showView('pos-screen');
}

window.openTickets = () => {
    selectedMesaId = null;
    currentTotal = 0;
    historyItems = [];
    document.getElementById('pos-title').innerText = "Venta Directa";
    updatePOSDisplay();
    showView('pos-screen');
};

// --- CALCULADORA ---
window.addToAccount = async (price) => {
    currentTotal += price;
    historyItems.push(price);
    updatePOSDisplay();
    if (selectedMesaId) await supabaseClient.from('mesas').update({ total: currentTotal }).eq('id', selectedMesaId);
};
window.undoLast = async () => {
    if (historyItems.length > 0) {
        currentTotal -= historyItems.pop();
        if (currentTotal < 0) currentTotal = 0;
        updatePOSDisplay();
        if (selectedMesaId) await supabaseClient.from('mesas').update({ total: currentTotal }).eq('id', selectedMesaId);
    }
};
function updatePOSDisplay() {
    document.getElementById('total-amount').innerText = currentTotal.toFixed(2);
    [1, 1.5, 2, 2.5, 4, 8].forEach(p => {
        const id = `badge-${p.toString().replace('.', '-')}`;
        const count = historyItems.filter(x => x === p).length;
        const el = document.getElementById(id);
        if (el) { el.innerText = count; el.style.display = count > 0 ? "flex" : "none"; }
    });
}

// --- COBRO ---
window.openCashModal = () => {
    cashReceived = 0;
    document.getElementById('cash-input-display').innerText = "0€";
    document.getElementById('change-amount').innerText = "0.00";
    document.getElementById('cash-modal').style.display = 'flex';
};
window.addCash = (amount) => {
    cashReceived += amount;
    document.getElementById('cash-input-display').innerText = cashReceived + "€";
    document.getElementById('change-amount').innerText = Math.max(0, cashReceived - currentTotal).toFixed(2);
};
window.finalizePayment = async () => {
    if (currentTotal === 0) return;
    await supabaseClient.from('ventas').insert([{ monto: currentTotal }]);
    if (selectedMesaId) await supabaseClient.from('mesas').update({ total: 0, activa: false }).eq('id', selectedMesaId);
    document.getElementById('cash-modal').style.display = 'none';
    backToMain();
};
window.backToMain = () => {
    if (currentRole === 'tickets') logout();
    else { loadMesas(false); showView('mesa-grid-screen'); }
};

async function loadStats() {
    const { data } = await supabaseClient.from('ventas').select('monto');
    const total = data?.reduce((acc, v) => acc + parseFloat(v.monto), 0) || 0;
    document.getElementById('total-ventas-val').innerText = total.toFixed(2) + "€";
}