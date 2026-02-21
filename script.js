let mesas = JSON.parse(localStorage.getItem('mesas_bar')) || [];
let mesaActivaIndex = null;
let entregado = 0;
let modoCobro = false;

// Al iniciar, cargar mesas
renderizarMesas();

function crearMesa() {
    const input = document.getElementById('nombre-mesa');
    if (input.value.trim() === "") return;
    
    mesas.push({ nombre: input.value, total: 0 });
    input.value = "";
    guardarYRenderizar();
}

function renderizarMesas() {
    const grid = document.getElementById('grid-mesas');
    grid.innerHTML = "";
    mesas.forEach((mesa, index) => {
        grid.innerHTML += `
            <div class="card-mesa" onclick="abrirMesa(${index})">
                <h3>${mesa.nombre}</h3>
                <div class="monto">${mesa.total.toFixed(2)}€</div>
            </div>
        `;
    });
}

function abrirMesa(index) {
    mesaActivaIndex = index;
    document.getElementById('vista-mesas').classList.add('hidden');
    document.getElementById('vista-cobro').classList.remove('hidden');
    document.getElementById('titulo-mesa-activa').innerText = mesas[index].nombre;
    actualizarPantallaCobro();
}

function mostrarMesas() {
    document.getElementById('vista-mesas').classList.remove('hidden');
    document.getElementById('vista-cobro').classList.add('hidden');
    cancelarCobro(); // Resetear estados de billetes
    renderizarMesas();
}

function sumar(cant) {
    mesas[mesaActivaIndex].total += cant;
    guardarYRenderizar();
    actualizarPantallaCobro();
}

function gestionarFlujo() {
    if (!modoCobro && mesas[mesaActivaIndex].total > 0) {
        modoCobro = true;
        toggleTeclados(true);
    } else if (modoCobro) {
        // PAGO FINALIZADO: Eliminar mesa
        mesas.splice(mesaActivaIndex, 1);
        guardarYRenderizar();
        mostrarMesas();
    }
}

function entregarEfectivo(billete) {
    entregado += billete;
    actualizarPantallaCobro();
}

function cancelarCobro() {
    entregado = 0;
    modoCobro = false;
    toggleTeclados(false);
    actualizarPantallaCobro();
}

function toggleTeclados(cobrando) {
    document.getElementById('teclado-articulos').classList.toggle('hidden', cobrando);
    document.getElementById('teclado-efectivo').classList.toggle('hidden', !cobrando);
    document.getElementById('cambio-section').classList.toggle('hidden', !cobrando);
    const btn = document.getElementById('btn-accion-principal');
    btn.innerText = cobrando ? "FINALIZAR (BORRAR MESA)" : "COBRAR";
    btn.style.backgroundColor = cobrando ? "#ff9f43" : "#00ff88";
}

function actualizarPantallaCobro() {
    const mesa = mesas[mesaActivaIndex];
    if (!mesa) return;
    document.getElementById('total-display').innerText = mesa.total.toFixed(2);
    document.getElementById('recibido-display').innerText = entregado.toFixed(2);
    let cambio = entregado - mesa.total;
    document.getElementById('devolver-display').innerText = (cambio > 0 ? cambio : 0).toFixed(2);
}

function guardarYRenderizar() {
    localStorage.setItem('mesas_bar', JSON.stringify(mesas));
    renderizarMesas();
}