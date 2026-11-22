// ========================================================
//  ADMIN.JS - SUBIDA DIRECTA A IMGBB Y FIREBASE
//  Imágenes en alta calidad alojadas en ImgBB sin restricciones
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAzyFSpQSlo5ZrV-OioFxvgyPMsRLvELKQ",
  authDomain: "boda-725be.firebaseapp.com",
  projectId: "boda-725be",
  storageBucket: "boda-725be.firebasestorage.app",
  messagingSenderId: "970840545058",
  appId: "1:970840545058:web:a49837df3e80f0a8cdf77b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// API KEY DE IMGBB DEL USUARIO
const IMGBB_API_KEY = "70ffbcc38118461dd539888b1716a0aa";

// Estado local
let selectedCoverFile = null;
let selectedPhotosFiles = [];
let albumsData = [];

// DOM References - Portada
const coverPreviewImg = document.getElementById("cover-preview-img");
const coverPreviewNames = document.getElementById("cover-preview-names");
const coverFileInput = document.getElementById("cover-file-input");
const chooseCoverBtn = document.getElementById("choose-cover-btn");
const saveCoverBtn = document.getElementById("save-cover-btn");
const coverStatusText = document.getElementById("cover-status-text");

// DOM References - Fotos
const targetAlbumSelect = document.getElementById("target-album-select");
const choosePhotosBtn = document.getElementById("choose-photos-btn");
const photosFileInput = document.getElementById("photos-file-input");
const uploadProgressContainer = document.getElementById("upload-progress-container");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressLabel = document.getElementById("upload-progress-label");
const uploadActionsContainer = document.getElementById("upload-actions-container");
const savePhotosBtn = document.getElementById("save-photos-btn");
const queueCountBadge = document.getElementById("queue-count-badge");
const clearQueueBtn = document.getElementById("clear-queue-btn");
const compressedGrid = document.getElementById("compressed-grid");

// DOM References - Momentos & Nombres
const momentsList = document.getElementById("moments-list");
const newAlbumName = document.getElementById("new-album-name");
const newAlbumDesc = document.getElementById("new-album-desc");
const createAlbumBtn = document.getElementById("create-album-btn");

const settingsNames = document.getElementById("settings-names");
const settingsSubtitle = document.getElementById("settings-subtitle");
const settingsDate = document.getElementById("settings-date");
const saveSettingsBtn = document.getElementById("save-settings-btn");

// ========================================================
// 1. SUBIDA DIRECTA A IMGBB (FOTOS)
// ========================================================
async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error ImgBB (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error?.message || "No se pudo obtener la URL de ImgBB");
  }

  // URL directa permanente del archivo ORIGINAL en máxima resolución (sin compresión de ImgBB)
  const fullQualityUrl = (data.data.image && data.data.image.url) || data.data.url || data.data.display_url;
  return fullQualityUrl;
}

// ========================================================
// 2. GESTIÓN DE LA PORTADA
// ========================================================
chooseCoverBtn.addEventListener("click", () => coverFileInput.click());

coverFileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  selectedCoverFile = file;
  const previewUrl = URL.createObjectURL(file);
  coverPreviewImg.src = previewUrl;
  saveCoverBtn.disabled = false;
  coverStatusText.innerHTML = `Foto seleccionada: <strong>${file.name}</strong>. Haz clic en <strong>"Guardar Portada"</strong>.`;
});

saveCoverBtn.addEventListener("click", async () => {
  if (!selectedCoverFile) return;

  saveCoverBtn.disabled = true;
  saveCoverBtn.innerHTML = "<span>⏳ Subiendo a ImgBB...</span>";
  coverStatusText.textContent = "Subiendo imagen a ImgBB en alta resolución...";

  try {
    // 1. Subir a ImgBB
    const imgbbUrl = await uploadToImgBB(selectedCoverFile);
    console.log("Portada subida a ImgBB:", imgbbUrl);

    // 2. Guardar en Firestore
    const settingsDoc = doc(db, "meta", "settings");
    await setDoc(settingsDoc, { coverUrl: imgbbUrl }, { merge: true });

    // 3. Respaldo en localStorage
    localStorage.setItem("boda_cover_url", imgbbUrl);
    coverPreviewImg.src = imgbbUrl;

    coverStatusText.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Foto de portada guardada en ImgBB con éxito! Ya se ve en tu web pública.</span>`;
    showToast("¡Foto de portada guardada con éxito en ImgBB! 🎉");
  } catch (err) {
    console.error("Error al guardar portada:", err);
    coverStatusText.innerHTML = `<span style="color: #dc3545; font-weight: 600;">Error: ${err.message}</span>`;
    alert("Error al subir portada: " + err.message);
  } finally {
    saveCoverBtn.disabled = false;
    saveCoverBtn.innerHTML = "<span>💾 Guardar Portada</span>";
  }
});

// ========================================================
// 3. SUBIDA DIRECTA DE FOTOS A MOMENTOS (IMGBB)
// ========================================================
choosePhotosBtn.addEventListener("click", () => photosFileInput.click());

photosFileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  selectedPhotosFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (selectedPhotosFiles.length === 0) {
    alert("Por favor selecciona solo archivos de imagen (JPG, PNG, WebP).");
    return;
  }

  queueCountBadge.textContent = selectedPhotosFiles.length;
  uploadActionsContainer.classList.remove("hidden");
  compressedGrid.innerHTML = "";

  selectedPhotosFiles.forEach((file) => {
    const card = document.createElement("div");
    card.className = "compressed-card";
    const previewUrl = URL.createObjectURL(file);
    card.innerHTML = `
      <img src="${previewUrl}" alt="${file.name}" />
      <div class="compressed-card-body">
        <div class="compressed-name" title="${file.name}">${file.name}</div>
        <div style="font-size: 0.75rem; color: var(--gold-dark); font-weight: 600;">Lista para subir a ImgBB</div>
      </div>
    `;
    compressedGrid.appendChild(card);
  });

  showToast(`¡${selectedPhotosFiles.length} fotos seleccionadas! Haz clic en "Guardar Fotos en el Álbum".`);
});

clearQueueBtn.addEventListener("click", () => {
  selectedPhotosFiles = [];
  compressedGrid.innerHTML = "";
  uploadActionsContainer.classList.add("hidden");
  uploadProgressContainer.classList.add("hidden");
});

savePhotosBtn.addEventListener("click", async () => {
  if (selectedPhotosFiles.length === 0) return;

  const selectedAlbumId = targetAlbumSelect.value;
  savePhotosBtn.disabled = true;
  uploadProgressContainer.classList.remove("hidden");

  let uploadedCount = 0;
  const total = selectedPhotosFiles.length;

  for (let i = 0; i < total; i++) {
    const file = selectedPhotosFiles[i];
    const pct = Math.round(((i + 1) / total) * 100);
    uploadProgressBar.style.width = `${pct}%`;
    uploadProgressLabel.textContent = `Subiendo foto ${i + 1} de ${total} a ImgBB... (${pct}%)`;

    try {
      // 1. Subir imagen a ImgBB
      const photoUrl = await uploadToImgBB(file);

      // 2. Guardar registro en Firestore
      await addDoc(collection(db, "photos"), {
        albumId: selectedAlbumId,
        url: photoUrl,
        originalUrl: photoUrl,
        filename: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        createdAt: serverTimestamp()
      });

      uploadedCount++;
    } catch (err) {
      console.error(`Error subiendo ${file.name}:`, err);
    }
  }

  uploadProgressBar.style.width = "100%";
  uploadProgressLabel.innerHTML = `✅ ¡${uploadedCount} fotos subidas a ImgBB y guardadas en el álbum!`;
  showToast(`¡${uploadedCount} fotos guardadas en el álbum! 🎉`);

  selectedPhotosFiles = [];
  uploadActionsContainer.classList.add("hidden");
  savePhotosBtn.disabled = false;
});

// ========================================================
// 3. GESTIÓN DE MOMENTOS Y NOMBRES
// ========================================================
createAlbumBtn.addEventListener("click", async () => {
  const name = newAlbumName.value.trim();
  const desc = newAlbumDesc.value.trim();

  if (!name) {
    alert("Ingresa un nombre para el momento.");
    return;
  }

  try {
    const slugId = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    await setDoc(doc(db, "albums", slugId), {
      name,
      description: desc,
      createdAt: serverTimestamp()
    });

    newAlbumName.value = "";
    newAlbumDesc.value = "";
    showToast(`¡Momento "${name}" creado con éxito!`);
  } catch (err) {
    console.error(err);
    alert("Error al crear momento: " + err.message);
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  const names = settingsNames.value.trim() || "Samuel & Lisbeth";
  const subtitle = settingsSubtitle.value.trim() || "Nuestra Boda • Un Amor Para Siempre";
  const date = settingsDate.value.trim() || "20 • Noviembre • 2024";

  saveSettingsBtn.disabled = true;
  saveSettingsBtn.textContent = "Guardando...";

  try {
    const settingsDoc = doc(db, "meta", "settings");
    await setDoc(settingsDoc, {
      coupleNames: names,
      subtitle: subtitle,
      date: date
    }, { merge: true });

    localStorage.setItem("boda_names", names);
    showToast("¡Nombres y fecha guardados con éxito!");
  } catch (err) {
    console.error(err);
    alert("Error al guardar: " + err.message);
  } finally {
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = "💾 Guardar Nombres";
  }
});

// ========================================================
// 4. SINCRONIZACIÓN EN TIEMPO REAL
// ========================================================
function initRealtimeListeners() {
  const savedCover = localStorage.getItem("boda_cover_url");
  if (savedCover) coverPreviewImg.src = savedCover;

  // 1. Escuchar configuraciones de portada y nombres en Firestore
  const settingsDoc = doc(db, "meta", "settings");
  onSnapshot(settingsDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.coverUrl) {
        coverPreviewImg.src = data.coverUrl;
        localStorage.setItem("boda_cover_url", data.coverUrl);
      }
      if (data.coupleNames) {
        coverPreviewNames.textContent = data.coupleNames;
        settingsNames.value = data.coupleNames;
      }
      if (data.subtitle) settingsSubtitle.value = data.subtitle;
      if (data.date) settingsDate.value = data.date;
    }
  });

  // 2. Escuchar momentos en Firestore
  const albumsQuery = query(collection(db, "albums"), orderBy("createdAt", "desc"));
  onSnapshot(albumsQuery, (snap) => {
    albumsData = [];
    targetAlbumSelect.innerHTML = "";
    momentsList.innerHTML = "";

    snap.forEach((docSnap) => {
      const a = docSnap.data();
      a.id = docSnap.id;
      albumsData.push(a);

      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      targetAlbumSelect.appendChild(opt);

      const item = document.createElement("div");
      item.className = "album-item";
      item.innerHTML = `
        <div>
          <span class="album-item-name">${a.name}</span>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">${a.description || ''}</p>
        </div>
        <div>
          <button class="btn-danger" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;" data-id="${a.id}">
            Eliminar
          </button>
        </div>
      `;

      item.querySelector(".btn-danger").onclick = async () => {
        if (confirm(`¿Eliminar el momento "${a.name}"?`)) {
          await deleteDoc(doc(db, "albums", a.id));
          showToast(`Momento "${a.name}" eliminado`);
        }
      };

      momentsList.appendChild(item);
    });

    if (albumsData.length === 0) {
      loadDefaultMomentsIfEmpty();
    }
  });
}

async function loadDefaultMomentsIfEmpty() {
  const defaults = [
    { id: "la-ceremonia", name: "La Ceremonia", description: "El 'Sí, acepto' ante Dios y nuestros seres queridos" },
    { id: "la-recepcion", name: "La Recepción & Fiesta", description: "Celebrando la alegría de comenzar este nuevo viaje" },
    { id: "sesion-previa", name: "Sesión Previa", description: "Momentos íntimos antes del gran día" }
  ];

  for (let m of defaults) {
    try {
      await setDoc(doc(db, "albums", m.id), {
        name: m.name,
        description: m.description,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (_) {}
  }
}

function showToast(msg) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

// Inicializar
window.addEventListener("DOMContentLoaded", () => {
  initRealtimeListeners();
});
