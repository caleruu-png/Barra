/* ═══════════════════════════════════════════════════════════════════════════
   TPV — script.js
   ─ Pega tus credenciales de Supabase en las constantes de abajo ─
═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://yfhzogdtiubkbzrxbugu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4s7OZ9kj2QvNUOJDGkaPyw_vn9BWIeR';

/* ── Cliente Supabase ─────────────────────────────────────────────────── */
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Estado global ────────────────────────────────────────────────────── */
let todosLosProductos = [];
let carrito            = [];
let inventarioData     = [];
let categoriaActual    = 'todos';
let cobrando           = false;
let pantallaActual     = 'menu';

/* ══════════════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════════════ */
(function init() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
})();

/* ── Reloj ────────────────────────────────────────────────────────────── */
function actualizarReloj() {
  const t = new Date().toLocaleTimeString('es-ES');
  const el1 = document.getElementById('clock');
  const el2 = document.getElementById('menu-clock');
  if (el1) el1.textContent = t;
  if (el2) el2.textContent = t;
}

/* ══════════════════════════════════════════════════════════════════════
   NAVEGACIÓN ENTRE PANTALLAS
══════════════════════════════════════════════════════════════════════ */
window.irA = function (destino) {
  if (destino === pantallaActual) return;

  const actual  = document.getElementById(`pantalla-${pantallaActual}`);
  const siguiente = document.getElementById(`pantalla-${destino}`);
  if (!siguiente) return;

  // Salida de la pantalla actual
  actual.classList.remove('activa');
  actual.classList.add('saliendo');
  setTimeout(() => actual.classList.remove('saliendo'), 380);

  // Entrada de la nueva pantalla
  siguiente.classList.add('activa');
  pantallaActual = destino;

  // Acciones al entrar a cada sección
  if (destino === 'cobro')        cargarProductos();
  if (destino === 'inventario')   cargarInventario();
  if (destino === 'estadisticas') cargarEstadisticas();
};

/* ══════════════════════════════════════════════════════════════════════
   ▌ MÓDULO: COBRO
══════════════════════════════════════════════════════════════════════ */
async function cargarProductos() {
  const grid = document.getElementById('productos-grid');
  grid.innerHTML = '<div class="skeleton-loader">Cargando productos…</div>';

  const { data, error } = await db.from('productos').select('*').order('nombre');
  if (error) {
    grid.innerHTML = '<div class="skeleton-loader">Error al cargar productos.</div>';
    toast('Error al conectar con Supabase', 'error');
    return;
  }
  todosLosProductos = data || [];
  renderProductos();
}

function renderProductos() {
  const query = document.getElementById('buscador').value.trim().toLowerCase();
  const grid  = document.getElementById('productos-grid');
  let lista   = todosLosProductos;

  if (categoriaActual !== 'todos') {
    lista = lista.filter(p => (p.categoria || '').toLowerCase() === categoriaActual);
  }
  if (query) {
    lista = lista.filter(p => (p.nombre || '').toLowerCase().includes(query));
  }
  if (!lista.length) {
    grid.innerHTML = '<div class="skeleton-loader">Sin resultados.</div>';
    return;
  }

  grid.innerHTML = lista.map(p => `
    <div class="producto-card${p.stock <= 0 ? ' sin-stock' : ''}"
         id="card-${p.id}"
         onclick="window.añadirAlCarrito(${p.id})"
         title="${escapeHtml(p.nombre)}">
      <div class="card-nombre">${escapeHtml(p.nombre)}</div>
      <div class="card-precio">${formatEur(p.precio)}</div>
      <div class="card-stock">Stock: <span>${p.stock ?? '∞'}</span></div>
    </div>
  `).join('');
}

window.filtrar = () => renderProductos();

window.setCategoria = function (btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  categoriaActual = btn.dataset.cat;
  renderProductos();
};

/* ── Carrito ─────────────────────────────────────────────────────────── */
window.añadirAlCarrito = function (id) {
  const producto = todosLosProductos.find(p => p.id === id);
  if (!producto || producto.stock <= 0) return;

  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.classList.remove('adding');
    void card.offsetWidth;
    card.classList.add('adding');
    card.addEventListener('animationend', () => card.classList.remove('adding'), { once: true });
  }

  const existente = carrito.find(c => c.producto.id === id);
  if (existente) {
    if (existente.cantidad >= producto.stock) { toast(`Stock máximo: ${producto.stock}`, 'error'); return; }
    existente.cantidad++;
  } else {
    carrito.push({ producto, cantidad: 1 });
  }
  toast(`✓ ${producto.nombre} añadido`);
  renderTicket();
};

window.cambiarCantidad = function (id, delta) {
  const idx = carrito.findIndex(c => c.producto.id === id);
  if (idx === -1) return;
  const item = carrito[idx];
  const prod = todosLosProductos.find(p => p.id === id);
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito.splice(idx, 1);
  } else if (prod && item.cantidad > prod.stock) {
    item.cantidad = prod.stock;
    toast(`Stock máximo: ${prod.stock}`, 'error');
  }
  renderTicket();
};

window.limpiarCarrito = function () {
  if (!carrito.length) return;
  carrito = [];
  renderTicket();
};

function renderTicket() {
  const container  = document.getElementById('ticket-items');
  const btnCobrar  = document.getElementById('btn-cobrar');
  const btnConsumo = document.getElementById('btn-consumo');

  if (!carrito.length) {
    container.innerHTML = `<div class="ticket-vacio"><span class="vacio-icon">◈</span><p>Sin productos</p></div>`;
    actualizarTotales(0);
    btnCobrar.disabled  = true;
    btnConsumo.disabled = true;
    return;
  }

  container.innerHTML = carrito.map(({ producto, cantidad }) => {
    const sub = producto.precio * cantidad;
    return `
      <div class="ticket-item">
        <span class="item-nombre">${escapeHtml(producto.nombre)}</span>
        <div class="item-controles">
          <button class="item-btn minus" onclick="window.cambiarCantidad(${producto.id},-1)">−</button>
          <span class="item-qty">${cantidad}</span>
          <button class="item-btn"       onclick="window.cambiarCantidad(${producto.id},+1)">+</button>
        </div>
        <span class="item-subtotal">${formatEur(sub)}</span>
      </div>`;
  }).join('');

  const total = carrito.reduce((s, c) => s + c.producto.precio * c.cantidad, 0);
  actualizarTotales(total);
  btnCobrar.disabled  = false;
  btnConsumo.disabled = false;
}

function actualizarTotales(total) {
  document.getElementById('total').textContent = formatEur(total);
}

/* ── Cobrar ──────────────────────────────────────────────────────────── */
window.cobrar = async function () {
  if (!carrito.length || cobrando) return;
  cobrando = true;
  const btn = document.getElementById('btn-cobrar');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span>⟳</span> Procesando…';
  btn.disabled  = true;

  try {
    const totalBruto = carrito.reduce((s, c) => s + c.producto.precio * c.cantidad, 0);
    const payload    = { total: +totalBruto.toFixed(2) };

    // PASO 1 — insertar venta
    console.log('[COBRO] Paso 1 — payload ventas:', payload);
    const respVenta = await db.from('ventas').insert(payload).select();
    console.log('[COBRO] Paso 1 — respuesta:', JSON.stringify(respVenta));

    if (respVenta.error) {
      toast(`Error ventas: ${respVenta.error.message} | código: ${respVenta.error.code}`, 'error');
      throw respVenta.error;
    }
    if (!respVenta.data?.length) {
      toast('Error: la tabla "ventas" no devolvió datos. Revisa el nombre de columnas o RLS.', 'error');
      throw new Error('ventas insert returned no data');
    }

    const ventaId = respVenta.data[0].id;
    console.log('[COBRO] ventaId:', ventaId);

    // PASO 2 — insertar detalles
    const detalles = carrito.map(({ producto, cantidad }) => ({
      venta_id:        ventaId,
      producto_id:     producto.id,
      cantidad,
      precio_unitario: producto.precio,
    }));
    console.log('[COBRO] Paso 2 — payload venta_detalles:', JSON.stringify(detalles));
    const respDet = await db.from('venta_detalles').insert(detalles).select();
    console.log('[COBRO] Paso 2 — respuesta:', JSON.stringify(respDet));

    if (respDet.error) {
      toast(`Error venta_detalles: ${respDet.error.message} | código: ${respDet.error.code}`, 'error');
      throw respDet.error;
    }

    toast(`✓ Venta #${ventaId} registrada`);
    carrito = [];
    renderTicket();
    await cargarProductos();

  } catch (err) {
    console.error('[COBRO] Error completo:', err);
  } finally {
    cobrando = false;
    btn.innerHTML = orig;
    btn.disabled  = !carrito.length;
  }
};

window.consumoPropio = async function () {
  if (!carrito.length || cobrando) return;
  cobrando = true;

  const btn = document.getElementById('btn-consumo');
  const orig = btn.innerHTML;
  btn.innerHTML = '⟳ Descontando…';
  btn.disabled  = true;
  document.getElementById('btn-cobrar').disabled = true;

  try {
    // Descontar stock de cada producto directamente en Supabase
    // Se hace con llamadas individuales (rpc sería ideal, pero esto no requiere cambios en el schema)
    for (const { producto, cantidad } of carrito) {
      const nuevoStock = Math.max(0, (producto.stock || 0) - cantidad);
      const { error } = await db
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', producto.id);
      if (error) throw error;
    }

    const resumen = carrito.map(c => `${c.cantidad}× ${c.producto.nombre}`).join(', ');
    toast(`⬡ Consumo propio: ${resumen}`);
    carrito = [];
    renderTicket();
    await cargarProductos();

  } catch (err) {
    console.error(err);
    toast('Error al descontar stock', 'error');
  } finally {
    cobrando = false;
    btn.innerHTML = orig;
  }
};

/* ── Cierre de caja ──────────────────────────────────────────────────── */
window.abrirCierre = async function () {
  const overlay = document.getElementById('modal-cierre');
  overlay.classList.add('visible');

  const hoy = new Date();
  document.getElementById('modal-fecha').textContent =
    hoy.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  ['cierre-num-ventas','cierre-total'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );

  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const fin    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString();

  const { data, error } = await db.from('ventas').select('total')
    .gte('created_at', inicio).lt('created_at', fin);
  if (error) { toast('Error al leer ventas', 'error'); return; }

  const totalDia  = data.reduce((s,v) => s + Number(v.total||0), 0);

  document.getElementById('cierre-num-ventas').textContent = data.length;
  document.getElementById('cierre-total').textContent      = formatEur(totalDia);
};

window.cerrarCierre = () => document.getElementById('modal-cierre').classList.remove('visible');

/* ══════════════════════════════════════════════════════════════════════
   ▌ MÓDULO: INVENTARIO
══════════════════════════════════════════════════════════════════════ */
window.cargarInventario = async function () {
  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="skeleton-loader">Cargando…</td></tr>';

  const { data, error } = await db.from('productos').select('*').order('nombre');
  if (error) { toast('Error al cargar inventario', 'error'); return; }
  inventarioData = data || [];
  renderInventario();
};

window.filtrarInventario = function () {
  renderInventario();
};

function renderInventario() {
  const query = document.getElementById('inv-buscador').value.trim().toLowerCase();
  const tbody = document.getElementById('inv-tbody');
  const lista = query
    ? inventarioData.filter(p => (p.nombre || '').toLowerCase().includes(query))
    : inventarioData;

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="skeleton-loader">Sin resultados.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const stockClass = p.stock <= 0 ? 'agotado' : p.stock < 5 ? 'bajo' : '';
    return `
      <tr>
        <td><strong>${escapeHtml(p.nombre)}</strong></td>
        <td><span class="badge-cat">${escapeHtml(p.categoria || '—')}</span></td>
        <td class="td-precio">${formatEur(p.precio)}</td>
        <td class="td-stock ${stockClass}">${p.stock ?? '∞'}</td>
        <td><div class="td-acciones">
          <button class="btn-accion" onclick="window.abrirModalProducto(${p.id})">Editar</button>
          <button class="btn-accion danger" onclick="window.eliminarProducto(${p.id})">Eliminar</button>
        </div></td>
      </tr>`;
  }).join('');
}

window.abrirModalProducto = function (id) {
  const modal = document.getElementById('modal-producto');
  const titulo = document.getElementById('modal-prod-titulo');

  if (id === null) {
    // Nuevo producto
    titulo.textContent = 'Nuevo Producto';
    document.getElementById('prod-id').value       = '';
    document.getElementById('prod-nombre').value   = '';
    document.getElementById('prod-categoria').value = 'todos';
    document.getElementById('prod-precio').value   = '';
    document.getElementById('prod-stock').value    = '';
  } else {
    const p = inventarioData.find(x => x.id === id);
    if (!p) return;
    titulo.textContent = 'Editar Producto';
    document.getElementById('prod-id').value       = p.id;
    document.getElementById('prod-nombre').value   = p.nombre;
    document.getElementById('prod-categoria').value = p.categoria || 'todos';
    document.getElementById('prod-precio').value   = p.precio;
    document.getElementById('prod-stock').value    = p.stock;
  }
  modal.classList.add('visible');
};

window.cerrarModalProducto = () =>
  document.getElementById('modal-producto').classList.remove('visible');

window.guardarProducto = async function () {
  const id       = document.getElementById('prod-id').value;
  const nombre   = document.getElementById('prod-nombre').value.trim();
  const categoria = document.getElementById('prod-categoria').value;
  const precio   = parseFloat(document.getElementById('prod-precio').value);
  const stock    = parseInt(document.getElementById('prod-stock').value, 10);

  if (!nombre || isNaN(precio) || isNaN(stock)) {
    toast('Completa todos los campos correctamente', 'error');
    return;
  }

  const payload = { nombre, categoria, precio, stock };
  let error;

  if (id) {
    ({ error } = await db.from('productos').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('productos').insert(payload));
  }

  if (error) { toast('Error al guardar producto', 'error'); console.error(error); return; }

  toast(`✓ Producto ${id ? 'actualizado' : 'creado'} correctamente`);
  window.cerrarModalProducto();
  window.cargarInventario();
};

window.eliminarProducto = async function (id) {
  if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
  const { error } = await db.from('productos').delete().eq('id', id);
  if (error) { toast('Error al eliminar producto', 'error'); return; }
  toast('✓ Producto eliminado');
  window.cargarInventario();
};

/* ══════════════════════════════════════════════════════════════════════
   ▌ MÓDULO: ESTADÍSTICAS
══════════════════════════════════════════════════════════════════════ */
window.cargarEstadisticas = async function () {
  const dias = parseInt(document.getElementById('stats-rango').value, 10);
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeISO = desde.toISOString();

  // Reset KPIs
  ['kpi-ventas','kpi-total','kpi-medio'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );
  document.getElementById('chart-dias').innerHTML = '<div class="skeleton-loader">Cargando…</div>';
  document.getElementById('stats-top-productos').innerHTML = '<div class="skeleton-loader">Cargando…</div>';

  // Obtener ventas
  const { data: ventas, error: eVentas } = await db
    .from('ventas').select('id, total, created_at').gte('created_at', desdeISO);
  if (eVentas) { toast('Error al cargar estadísticas', 'error'); return; }

  // Obtener detalles para top productos
  const { data: detalles, error: eDet } = await db
    .from('venta_detalles').select('producto_id, cantidad, productos(nombre)')
    .gte('created_at', desdeISO);

  // ── KPIs ──────────────────────────────────────────────────────────
  const numVentas  = ventas.length;
  const totalBruto = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
  const ticketMed  = numVentas ? totalBruto / numVentas : 0;

  document.getElementById('kpi-ventas').textContent = numVentas;
  document.getElementById('kpi-total').textContent  = formatEur(totalBruto);
  document.getElementById('kpi-medio').textContent  = formatEur(ticketMed);

  // ── Gráfico de barras por día ─────────────────────────────────────
  const ventasPorDia = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
    ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + Number(v.total || 0);
  });

  // Generar todos los días del rango
  const etiquetas = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    etiquetas.push(d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' }));
  }

  const valoresDia = etiquetas.map(e => ventasPorDia[e] || 0);
  const maxVal = Math.max(...valoresDia, 1);

  // Mostrar sólo últimas N etiquetas para no saturar
  const mostrar = dias <= 7 ? etiquetas : etiquetas.filter((_, i) => i % Math.ceil(dias / 14) === 0 || i === etiquetas.length - 1);

  const chartEl = document.getElementById('chart-dias');
  chartEl.innerHTML = '';
  etiquetas.forEach((etq, i) => {
    const pct = (valoresDia[i] / maxVal) * 100;
    const mostrarEtq = mostrar.includes(etq);
    const group = document.createElement('div');
    group.className = 'chart-bar-group';
    group.innerHTML = `
      <span class="chart-bar-val">${valoresDia[i] > 0 ? formatEur(valoresDia[i]).replace(' €','') : ''}</span>
      <div class="chart-bar" style="height:${Math.max(pct,1)}%" title="${etq}: ${formatEur(valoresDia[i])}"></div>
      <span class="chart-bar-label">${mostrarEtq ? etq : ''}</span>`;
    chartEl.appendChild(group);
  });

  // ── Top productos ─────────────────────────────────────────────────
  const topEl = document.getElementById('stats-top-productos');
  if (!detalles || eDet) {
    topEl.innerHTML = '<div class="skeleton-loader">No disponible</div>';
  } else {
    const agrupado = {};
    detalles.forEach(d => {
      const nombre = d.productos?.nombre || `Producto ${d.producto_id}`;
      agrupado[nombre] = (agrupado[nombre] || 0) + d.cantidad;
    });
    const sorted = Object.entries(agrupado).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maxQty = sorted[0]?.[1] || 1;

    const rankLabels = ['🥇', '🥈', '🥉'];
    const rankClasses = ['gold', 'silver', 'bronze'];

    topEl.innerHTML = sorted.length ? sorted.map(([nombre, qty], i) => `
      <div class="top-item">
        <span class="top-rank ${rankClasses[i] || ''}">${rankLabels[i] || `#${i+1}`}</span>
        <div class="top-bar-wrap">
          <div class="top-nombre">${escapeHtml(nombre)}</div>
          <div class="top-bar-bg">
            <div class="top-bar-fill" style="width:${(qty/maxQty)*100}%"></div>
          </div>
        </div>
        <span class="top-qty">${qty} uds</span>
      </div>`).join('')
      : '<div class="skeleton-loader">Sin datos</div>';
  }
};

/* ══════════════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════════════ */
function formatEur(n) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast${tipo === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('exit');
    el.addEventListener('animationend', () => el.remove());
  }, 2800);
}
