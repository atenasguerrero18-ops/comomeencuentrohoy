
// 1. Importaciones oficiales de Firebase mediante CDN compatible con navegador
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Credenciales oficiales de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyDR2P_E74_p134MphiUUktXGzVvKy4hn1Y",
  authDomain: "://firebaseapp.com", 
  projectId: "como-me-encuentro-hoy",
  storageBucket: "como-me-encuentro-hoy.firebasestorage.app",
  messagingSenderId: "541073995310",
  appId: "1:541073995310:web:5f0de7d89242b8606451bf"
};

// 3. Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Capturar elementos de la pantalla
const seccionIngreso = document.getElementById('seccion-ingreso');
const seccionFormulario = document.getElementById('seccion-formulario');
const seccionResultado = document.getElementById('seccion-resultado');
const btnIngresar = document.getElementById('btn-ingresar'); 
const formRegistro = document.getElementById('form-registro');

let empresaActiva = "";
let atletaActivo = "";

// 5. Acción al presionar el botón "Ingresar al Perfil"
btnIngresar.addEventListener('click', async () => {
  const codigoEmpresa = document.getElementById('codigo-empresa').value.trim().toUpperCase();
  const nombreAtleta = document.getElementById('nombre-atleta').value.trim();

  if (!codigoEmpresa || !nombreAtleta) {
    alert("Por favor, llena ambos campos.");
    return;
  }

  empresaActiva = codigoEmpresa;
  atletaActivo = nombreAtleta;

  try {
    const usuarioRef = doc(db, "empresas", empresaActiva, "usuarios", atletaActivo);
    const usuarioSnap = await getDoc(usuarioRef);

    if (!usuarioSnap.exists()) {
      await setDoc(usuarioRef, {
        nombre: atletaActivo,
        fechaCreacion: new Date().toISOString()
      });
      alert(`¡Perfil creado con éxito! Bienvenido/a, ${atletaActivo}.`);
    } else {
      alert(`¡Bienvenido/a de nuevo, ${atletaActivo}!`);
    }

    document.getElementById('nombre-bienvenida').innerText = atletaActivo;
    seccionIngreso.classList.add('id-oculto');
    seccionFormulario.classList.remove('id-oculto');
  } catch (error) {
    console.error("Error en Firestore:", error);
    alert("Error al conectar con la base de datos de Firebase.");
  }
});

// 6. Acción al guardar el formulario diario
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();

  const animo = parseInt(document.getElementById('dato-animo').value) || 0;
  const hrv = parseInt(document.getElementById('dato-hrv').value) || 0;
  const sueno = parseFloat(document.getElementById('dato-sueno').value) || 0;
  const cargaHoy = parseFloat(document.getElementById('carga-entreno').value) || 0;

  if (!animo || !cargaHoy) {
    alert("El ánimo y la carga de entrenamiento son obligatorios.");
    return;
  }

  const fechaHoy = new Date().toISOString().split('T')[0];

  try {
    const registroRef = doc(db, "empresas", empresaActiva, "usuarios", atletaActivo, "registros_diarios", fechaHoy);
    await setDoc(registroRef, {
      fecha: fechaHoy,
      animo: animo,
      hrv: hrv,
      sueno: sueno,
      cargaEntrenamiento: cargaHoy,
      fechaRegistro: new Date().toISOString()
    });

    alert("Registro guardado con éxito.");

    // Cálculos del Semáforo ACWR
    const registrosCol = collection(db, "empresas", empresaActiva, "usuarios", atletaActivo, "registros_diarios");
    const q = query(registrosCol, orderBy("fecha", "desc"), limit(28));
    const querySnapshot = await getDocs(q);

    let cargasSemanales = [];
    querySnapshot.forEach((doc) => {
      cargasSemanales.push(doc.data().cargaEntrenamiento || 0);
    });

    const ultimos7Dias = cargasSemanales.slice(0, 7);
    const sumaAguda = ultimos7Dias.reduce((a, b) => a + b, 0);
    const promedioAguda = sumaAguda / (ultimos7Dias.length || 1);

    const sumaCronica = cargasSemanales.reduce((a, b) => a + b, 0);
    const promedioCronica = sumaCronica / (cargasSemanales.length || 1);

    const acwr = promedioCronica > 0 ? (promedioAguda / promedioCronica) : 1.0;

    const elSemaforo = document.getElementById('semaforo-fisiologico');
    const txtAcwr = document.getElementById('valor-acwr');
    const txtMensaje = document.getElementById('mensaje-disponibilidad');

    elSemaforo.className = "circulo-semaforo";
    txtAcwr.innerText = acwr.toFixed(2);

    if (acwr >= 0.8 && acwr <= 1.3) {
      elSemaforo.classList.add('semaforo-verde');
      elSemaforo.innerText = "GO";
      txtMensaje.innerText = "¡Excelente balance! Estás en la zona óptima de rendimiento. Riesgo bajo de lesión.";
    } else if ((acwr >= 0.5 && acwr < 0.8) || (acwr > 1.3 && acwr <= 1.5)) {
      elSemaforo.classList.add('semaforo-amarillo');
      elSemaforo.innerText = "WARN";
      txtMensaje.innerText = "Atención: Tu carga se está desviando. Monitorea tu recuperación.";
    } else {
      elSemaforo.classList.add('semaforo-rojo');
      elSemaforo.innerText = "STOP";
      txtMensaje.innerText = "¡Peligro de sobreentrenamiento! Se recomienda disminuir cargas hoy.";
    }

    seccionResultado.classList.remove('id-oculto');
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Hubo un error al guardar tus datos.");
  }
});
