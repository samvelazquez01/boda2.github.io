// ========================================================
//  ADMIN.JS - GESTOR DIRECTO DE FOTOS, PORTADA Y MÚSICA
//  Guarda directamente en la base de datos y almacenamiento
//  sin necesidad de descargar carpetas ni tokens manuales.
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Configuración de Firebase del proyecto
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
const storage = getStorage(app);

// Estado local
let selectedCoverFile = null;
let selectedPhotosFiles = [];
let selectedMusicFile = null;
let currentPlaylist = [];
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

// DOM References - Música
const chooseMusicBtn = document.getElementById("choose-music-btn");
const saveMusicBtn = document.getElementById("save-music-btn");
const musicFileInput = document.getElementById("music-file-input");
const musicUploadStatus = document.getElementById("music-upload-status");
const playlistContainer = document.getElementById("playlist-container");

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
// 1. SERVICIO DE SUBIDA DIRECTA EN LA NUBE
// ========================================================
async function uploadDirectFile(file, pathFolder = "photos") {
  // 1. Intentar Firebase Storage
  try {
    const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileRef = ref(storage, `${pathFolder}/${cleanName}`);
    const snapshot = await uploadBytes(fileRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (firebaseErr) {
    console.warn("Firebase Storage no disponible o con reglas bloqueadas, usando almacenamiento directo alternativo...", firebaseErr);
  }

  // 2. Fallback Directo de Alta Calidad (Cloudinary Unsigned / ImgBB)
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "wedding_unsigned");
    
    // Intento con Cloudinary
    const res = await fetch("https://api.cloudinary.com/v1_1/du1e7bvxu/auto/upload", {
      method: "POST",
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      return data.secure_url;
    }
  } catch (_) {}

  // 3. Fallback ImgBB (para fotos de alta resolución)
  if (file.type.startsWith("image/")) {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("https://api.imgbb.com/1/upload?key=6d207e02198a847aa5ad3a9a6f40e4e6", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        return data.data.url;
      }
    } catch (_) {}
  }

  // 4. Último recurso: Data URL en Base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
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
  coverStatusText.innerHTML = `Foto seleccionada: <strong>${file.name}</strong>. Haz clic en <strong>"Guardar Portada"</strong> para aplicarla.`;
});

saveCoverBtn.addEventListener("click", async () => {
  if (!selectedCoverFile) return;

  saveCoverBtn.disabled = true;
  saveCoverBtn.innerHTML = "<span>⏳ Guardando Portada...</span>";
  coverStatusText.textContent = "Subiendo y guardando portada en alta calidad...";

  try {
    const downloadUrl = await uploadDirectFile(selectedCoverFile, "covers");

    // Guardar en Firestore meta/settings
    const settingsDoc = doc(db, "meta", "settings");
    await setDoc(settingsDoc, { coverUrl: downloadUrl }, { merge: true });

    // También guardar en localStorage para respaldo instantáneo
    localStorage.setItem("boda_cover_url", downloadUrl);

    coverStatusText.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Foto de portada guardada con éxito! Ya se ve en tu web.</span>`;
    showToast("¡Foto de portada guardada con éxito! 🎉");
  } catch (err) {
    console.error(err);
    coverStatusText.innerHTML = `<span style="color: #dc3545; font-weight: 600;">Error al guardar: ${err.message}</span>`;
  } finally {
    saveCoverBtn.disabled = false;
    saveCoverBtn.innerHTML = "<span>💾 Guardar Portada</span>";
  }
});

// ========================================================
// 3. SUBIDA DIRECTA DE FOTOS A MOMENTOS
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
        <div style="font-size: 0.75rem; color: var(--gold-dark); font-weight: 600;">Lista para guardar</div>
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
    uploadProgressLabel.textContent = `Guardando foto ${i + 1} de ${total}... (${pct}%)`;

    try {
      // Subir archivo a la nube en alta calidad
      const photoUrl = await uploadDirectFile(file, "photos");

      // Guardar registro en Firestore
      await addDoc(collection(db, "photos"), {
        albumId: selectedAlbumId,
        url: photoUrl,
        filename: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        createdAt: serverTimestamp()
      });

      uploadedCount++;
    } catch (err) {
      console.error(`Error guardando ${file.name}:`, err);
    }
  }

  uploadProgressBar.style.width = "100%";
  uploadProgressLabel.innerHTML = `✅ ¡${uploadedCount} fotos guardadas exitosamente en el álbum!`;
  showToast(`¡${uploadedCount} fotos guardadas en el álbum! 🎉`);
  
  selectedPhotosFiles = [];
  uploadActionsContainer.classList.add("hidden");
  savePhotosBtn.disabled = false;
});

// ========================================================
// 4. GESTIÓN DE MÚSICA (VARIAS CANCIONES / PLAYLIST)
// ========================================================
chooseMusicBtn.addEventListener("click", () => musicFileInput.click());

musicFileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  selectedMusicFile = file;
  saveMusicBtn.disabled = false;
  musicUploadStatus.innerHTML = `Canción seleccionada: <strong>${file.name}</strong>. Haz clic en <strong>"Guardar Canción en el Álbum"</strong>.`;
});

saveMusicBtn.addEventListener("click", async () => {
  if (!selectedMusicFile) return;

  saveMusicBtn.disabled = true;
  saveMusicBtn.innerHTML = "<span>⏳ Guardando Canción...</span>";
  musicUploadStatus.textContent = "Subiendo archivo de música en alta calidad...";

  try {
    const audioUrl = await uploadDirectFile(selectedMusicFile, "music");
    const cleanTitle = selectedMusicFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

    // Agregar canción a la lista
    const newSong = {
      id: `song_${Date.now()}`,
      title: cleanTitle,
      url: audioUrl
    };

    currentPlaylist.push(newSong);

    // Guardar playlist completa en Firestore
    const settingsDoc = doc(db, "meta", "settings");
    await setDoc(settingsDoc, { 
      playlist: currentPlaylist,
      musicUrl: currentPlaylist[0].url // Primera canción por defecto
    }, { merge: true });

    musicUploadStatus.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Canción "${cleanTitle}" guardada con éxito!</span>`;
    showToast("¡Canción guardada en el álbum! 🎵");
    selectedMusicFile = null;
    saveMusicBtn.disabled = true;
  } catch (err) {
    console.error(err);
    musicUploadStatus.innerHTML = `<span style="color: #dc3545; font-weight: 600;">Error al guardar canción: ${err.message}</span>`;
  } finally {
    saveMusicBtn.disabled = false;
    saveMusicBtn.innerHTML = "<span>💾 Guardar Canción en el Álbum</span>";
  }
});

function renderPlaylistUI() {
  playlistContainer.innerHTML = "";
  if (!currentPlaylist || currentPlaylist.length === 0) {
    playlistContainer.innerHTML = '<div class="loading">No hay canciones agregadas aún. Puedes subir tus canciones arriba.</div>';
    return;
  }

  currentPlaylist.forEach((song, idx) => {
    const item = document.createElement("div");
    item.className = "album-item";
    item.innerHTML = `
      <div style="flex: 1;">
        <span class="album-item-name">🎵 ${song.title}</span>
        <audio controls src="${song.url}" style="margin-top: 0.5rem; width: 100%; max-width: 320px; height: 35px;"></audio>
      </div>
      <div>
        <button class="btn-danger" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;" data-id="${song.id}">
          Eliminar
        </button>
      </div>
    `;

    item.querySelector(".btn-danger").onclick = async () => {
      if (confirm(`¿Eliminar la canción "${song.title}"?`)) {
        currentPlaylist.splice(idx, 1);
        const settingsDoc = doc(db, "meta", "settings");
        await setDoc(settingsDoc, { 
          playlist: currentPlaylist,
          musicUrl: currentPlaylist[0] ? currentPlaylist[0].url : ""
        }, { merge: true });
        showToast("Canción eliminada");
      }
    };

    playlistContainer.appendChild(item);
  });
}

// ========================================================
// 5. GESTIÓN DE MOMENTOS Y NOMBRES
// ========================================================
createAlbumBtn.addEventListener("click", async () => {
  const name = newAlbumName.value.trim();
  const desc = newAlbumDesc.value.trim();

  if (!name) {
    alert("Ingresa un nombre para el momento.");
    return;
  }

  try {
    await addDoc(collection(db, "albums"), {
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

    showToast("¡Nombres y fecha guardados con éxito!");
  } catch (err) {
    console.error(err);
    alert("Error al guardar nombres: " + err.message);
  } finally {
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = "💾 Guardar Nombres";
  }
});

// ========================================================
// 6. SINCRONIZACIÓN EN TIEMPO REAL CON LA BASE DE DATOS
// ========================================================
function initRealtimeListeners() {
  // 1. Escuchar configuraciones de portada, nombres y música
  const settingsDoc = doc(db, "meta", "settings");
  onSnapshot(settingsDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.coverUrl) {
        coverPreviewImg.src = data.coverUrl;
      }
      if (data.coupleNames) {
        coverPreviewNames.textContent = data.coupleNames;
        settingsNames.value = data.coupleNames;
      }
      if (data.subtitle) settingsSubtitle.value = data.subtitle;
      if (data.date) settingsDate.value = data.date;
      if (data.playlist && Array.isArray(data.playlist)) {
        currentPlaylist = data.playlist;
        renderPlaylistUI();
      }
    }
  });

  // 2. Escuchar momentos (álbumes)
  const albumsQuery = query(collection(db, "albums"), orderBy("createdAt", "desc"));
  onSnapshot(albumsQuery, (snap) => {
    albumsData = [];
    targetAlbumSelect.innerHTML = "";
    momentsList.innerHTML = "";

    snap.forEach((docSnap) => {
      const a = docSnap.data();
      a.id = docSnap.id;
      albumsData.push(a);

      // Opción en el selector
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      targetAlbumSelect.appendChild(opt);

      // Elemento en la lista de momentos
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
      // Si está vacío, cargar momentos por defecto
      loadDefaultMomentsIfEmpty();
    }
  });
}

async function loadDefaultMomentsIfEmpty() {
  const defaults = [
    { name: "La Ceremonia", description: "El 'Sí, acepto' ante Dios y nuestros seres queridos" },
    { name: "La Recepción & Fiesta", description: "Celebrando la alegría de comenzar este nuevo viaje" },
    { name: "Sesión Previa", description: "Momentos íntimos antes del gran día" }
  ];

  for (let m of defaults) {
    try {
      await addDoc(collection(db, "albums"), {
        name: m.name,
        description: m.description,
        createdAt: serverTimestamp()
      });
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

// Inicializar en tiempo real
window.addEventListener("DOMContentLoaded", () => {
  initRealtimeListeners();
});
