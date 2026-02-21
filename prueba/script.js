// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = 'https://nkkfubxupzaybipxutoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pJciTEAK6vL2aQ6GTATxXg_RtLUUlGN';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = '';
let mesaActivaId = null;

// --- GESTIÓN DE VISTAS Y LOGIN ---
function addPin(num) { document.getElementById('pin-display').value += num; }
function clearPin() { document.getElementById('pin-display').value = ''; }

function checkLogin() {
    const pin = document.getElementById('pin-display').value;
    if (pin === '1234') { userRole = 'admin'; cambiarVista('view-admin'); cargarAdmin(); }
    else if (pin === '0000') { userRole = 'barra'; cambiarVista('view-barra'); escucharMesas(); }
    else if (pin === '1111') { userRole = 'tickets'; abrirModoTicketDirecto(); }
    else { alert("PIN Incorrecto"); clearPin(); }
}

function cambiarVista(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- FUNCIONES DE BASE DE DATOS ---

async function escucharMesas() {
    // Carga inicial
    const { data } = await supabase.from('mesas').select('*').eq('activa', true);
    renderMesas(data);

    // Tiempo real: Si alguien cambia algo en la DB, se actualiza solo
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, payload => {
        escucharMesas();
    }).subscribe();
}

async function dbCrearMesa() {
    const nombre = document.getElementById('input-mesa').value;
    if (!nombre) return;
    await supabase.from('mesas').insert([{ nombre, total: 0 }]);
    document.getElementById('input-mesa').value = '';
}

async function dbSumar(cant) {
    if (!mesaActivaId) return;
    // Obtener total actual e incrementar
    const { data } = await supabase.from('mesas').select('total').eq('id', mesaActivaId).single();
    await supabase.from('mesas').update({ total: parseFloat(data.total) + cant }).eq('id', mesaActivaId);
    actualizarPantallaCobro(parseFloat(data.total) + cant);
}

async function dbFinalizarVenta() {
    const total = parseFloat(document.getElementById('total-display').innerText);
    if (total <= 0) return;

    if (confirm("¿Confirmar cobro?")) {
        // Guardar en historial de ventas
        await supabase.from('ventas').insert([{ monto: total }]);
        // Desactivar mesa (o resetear si es modo ticket)
        if (userRole !== 'tickets') {
            await supabase.from('mesas').update({ activa: false }).eq('id', mesaActivaId);
            cambiarVista('view-barra');
        } else {
            document.getElementById('total-display').innerText = "0.00";
        }
    }
}

// --- AUXILIARES ---
function renderMesas(mesas) {
    const grid = document.getElementById('grid-mesas');
    grid.innerHTML = '';
    mesas.forEach(m => {
        const div = document.createElement('div');
        div.className = 'card-mesa';
        div.innerHTML = `<h3>${m.nombre}</h3><p>${m.total}€</p>`;
        div.onclick = () => { 
            mesaActivaId = m.id; 
            document.getElementById('mesa-titulo').innerText = m.nombre;
            actualizarPantallaCobro(m.total);
            cambiarVista('view-cobro');
        };
        grid.appendChild(div);
    });
}

function actualizarPantallaCobro(val) {
    document.getElementById('total-display').innerText = val.toFixed(2);
}

function logout() { location.reload(); }