let db, editId = null;
const $ = (s) => document.querySelector(s);
const ORDEN = { alta: 0, media: 1, baja: 2 };
const ETIQ = { alta: "🔴 Alta", media: "🟡 Media", baja: "🟢 Baja" };

// ---------- IndexedDB ----------
const solicitud = indexedDB.open("AgendaUniversitaria", 1);
solicitud.onupgradeneeded = (e) => {
  const tareas = e.target.result.createObjectStore("tareas", { keyPath: "id", autoIncrement: true });
  tareas.createIndex("asignatura", "asignatura", { unique: false });
};
solicitud.onsuccess = (e) => { db = e.target.result; render(); };
solicitud.onerror = () => console.error("Error al abrir la base de datos");

const almacen = (modo) => db.transaction(["tareas"], modo).objectStore("tareas");

function guardar(tarea) {
  const a = almacen("readwrite");
  (tarea.id ? a.put(tarea) : a.add(tarea)).onsuccess = render;
}
function alternar(id) {
  const a = almacen("readwrite");
  a.get(id).onsuccess = (e) => {
    const t = e.target.result;
    t.completada = !t.completada;
    a.put(t).onsuccess = render;
  };
}
function eliminar(id) { almacen("readwrite").delete(id).onsuccess = render; }

function borrarCompletadas() {
  if (!confirm("¿Borrar todas las tareas completadas?")) return;
  const a = almacen("readwrite");
  a.getAll().onsuccess = (e) => {
    e.target.result.filter((t) => t.completada).forEach((t) => a.delete(t.id));
    setTimeout(render, 150);
  };
}

// ---------- Interfaz ----------
const hoy = () => new Date().toLocaleDateString("en-CA");
const fmt = (f) => new Date(f + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });

function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto) n.textContent = texto;
  return n;
}

function estadisticas(todas) {
  const hechas = todas.filter((t) => t.completada).length;
  const total = todas.length, pend = total - hechas;
  $("#sTotal").textContent = total;
  $("#sPend").textContent = pend;
  $("#sHechas").textContent = hechas;
  $("#progreso").style.width = total ? (hechas / total) * 100 + "%" : "0";
  $("#mensaje").textContent = !total ? "Agrega tu primera tarea ✨"
    : pend === 0 ? "¡Todo listo, Yojana! 🎉"
    : `Te faltan ${pend} por hacer, ¡tú puedes! 💪`;
}

function opciones(todas) {
  const nombres = [...new Set(todas.map((t) => t.asignatura))].sort();
  const actual = $("#fAsig").value;
  $("#fAsig").innerHTML = '<option value="">Todas las asignaturas</option>';
  $("#asignaturas").innerHTML = "";
  nombres.forEach((n) => {
    const o = el("option", "", n); o.value = n;
    $("#fAsig").appendChild(o);
    const d = document.createElement("option"); d.value = n;
    $("#asignaturas").appendChild(d);
  });
  $("#fAsig").value = nombres.includes(actual) ? actual : "";
}

function tarjeta(t) {
  const prio = t.prioridad || "media";
  const vencida = t.fecha && !t.completada && t.fecha < hoy();
  const c = el("article", `tarjeta ${prio}` + (t.completada ? " hecha" : ""));
  c.appendChild(el("h3", "", t.titulo));
  const chips = el("div", "chips");
  chips.appendChild(el("span", "chip", "📚 " + t.asignatura));
  chips.appendChild(el("span", "chip", ETIQ[prio]));
  if (t.fecha) chips.appendChild(el("span", "chip" + (vencida ? " vencida" : ""), (vencida ? "⚠️ Vencida · " : "📅 ") + fmt(t.fecha)));
  c.appendChild(chips);

  const acc = el("div", "acciones");
  const ok = el("button", "", t.completada ? "↩️ Reabrir" : "✅ Listo"); ok.onclick = () => alternar(t.id);
  const ed = el("button", "suave", "✏️ Editar"); ed.onclick = () => editar(t);
  const del = el("button", "borrar", "🗑️"); del.onclick = () => eliminar(t.id);
  acc.append(ok, ed, del);
  c.appendChild(acc);
  return c;
}

function render() {
  almacen("readonly").getAll().onsuccess = (e) => {
    const todas = e.target.result;
    estadisticas(todas);
    opciones(todas);
    const asig = $("#fAsig").value;
    const q = $("#buscar").value.toLowerCase().trim();
    const est = $("#fEstado").value;
    const s = almacen("readonly");
    const r = asig ? s.index("asignatura").getAll(asig) : s.getAll();
    r.onsuccess = () => {
      const lista = r.result
        .filter((t) => est === "todas" || (est === "hechas") === !!t.completada)
        .filter((t) => !q || (t.titulo + " " + t.asignatura).toLowerCase().includes(q))
        .sort((a, b) =>
          (a.completada - b.completada) ||
          ((a.fecha || "9999") > (b.fecha || "9999") ? 1 : -1) ||
          (ORDEN[a.prioridad || "media"] - ORDEN[b.prioridad || "media"]));
      const cont = $("#tareas");
      cont.innerHTML = "";
      lista.forEach((t) => cont.appendChild(tarjeta(t)));
      $("#vacio").hidden = lista.length > 0;
    };
  };
}

// ---------- Formulario ----------
function limpiarForm() {
  editId = null;
  ["#titulo", "#asignatura", "#fecha"].forEach((s) => ($(s).value = ""));
  $("#prioridad").value = "media";
  $("#formTitulo").textContent = "✨ Nueva tarea";
  $("#agregar").textContent = "💗 Agregar tarea";
  $("#cancelar").hidden = true;
}
function editar(t) {
  editId = t.id;
  $("#titulo").value = t.titulo;
  $("#asignatura").value = t.asignatura;
  $("#fecha").value = t.fecha || "";
  $("#prioridad").value = t.prioridad || "media";
  $("#formTitulo").textContent = "✏️ Editando tarea";
  $("#agregar").textContent = "💾 Guardar cambios";
  $("#cancelar").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#agregar").onclick = () => {
  const titulo = $("#titulo").value.trim(), asignatura = $("#asignatura").value.trim();
  if (!titulo || !asignatura) return alert("Completa el título y la asignatura 💕");
  const t = { titulo, asignatura, fecha: $("#fecha").value, prioridad: $("#prioridad").value, completada: false };
  if (editId) {
    almacen("readonly").get(editId).onsuccess = (e) => {
      guardar({ ...e.target.result, ...t, completada: e.target.result.completada, id: editId });
      limpiarForm();
    };
  } else { guardar(t); limpiarForm(); }
};
$("#cancelar").onclick = limpiarForm;
$("#limpiar").onclick = borrarCompletadas;
["#buscar", "#fEstado", "#fAsig"].forEach((s) => ($(s).oninput = render));

// ---------- Instalar la PWA ----------
let promptInstalacion = null;
const yaInstalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (yaInstalada()) $("#instalar").hidden = true;

addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptInstalacion = e;
});
addEventListener("appinstalled", () => {
  promptInstalacion = null;
  $("#instalar").hidden = true;
  alert("¡App instalada, Yojana! 🎉 Búscala en tus aplicaciones.");
});
$("#instalar").onclick = async () => {
  if (promptInstalacion) {
    promptInstalacion.prompt();
    await promptInstalacion.userChoice;
    promptInstalacion = null;
  } else {
    alert("Para instalarla:\n\n💻 Chrome/Edge en PC: ícono de instalar en la barra de direcciones, o menú ⋮ > Instalar Mi Agenda.\n🤖 Android: menú ⋮ > Instalar aplicación.\n🍎 iPhone (Safari): Compartir > Añadir a pantalla de inicio.");
  }
};

// ---------- Conexión y Service Worker ----------
function actualizarEstado() {
  const on = navigator.onLine;
  $("#estado").textContent = on ? "En línea" : "Sin conexión";
  $("#estado").classList.toggle("offline", !on);
}
addEventListener("online", actualizarEstado);
addEventListener("offline", actualizarEstado);
actualizarEstado();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}
