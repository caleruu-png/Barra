let total = 0;
let historial = [];
const display = document.getElementById('total-display');

function sumar(cantidad) {
    historial.push(cantidad);
    total += cantidad;
    actualizar();
}

function deshacer() {
    if (historial.length > 0) {
        let ultimo = historial.pop();
        total -= ultimo;
        actualizar();
    }
}

function confirmarPago() {
    if (total > 0) {
        if (confirm("¿Cuenta pagada? El total volverá a 0.")) {
            total = 0;
            historial = [];
            actualizar();
        }
    }
}

function actualizar() {
    // Redondeo a 2 decimales para evitar errores raros de suma
    display.innerText = (Math.round(total * 100) / 100).toFixed(2);
}
