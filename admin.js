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

// DOM References - Foto de Cabecera (Banner)
const bannerPreviewImg = document.getElementById("banner-preview-img");
const bannerFileInput = document.getElementById("banner-file-input");
const chooseBannerBtn = document.getElementById("choose-banner-btn");
const saveBannerBtn = document.getElementById("save-banner-btn");
const bannerStatusText = document.getElementById("banner-status-text");
let selectedBannerFile = null;

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

// DOM References - Gestor de Fotos Guardadas
const manageMomentFilter = document.getElementById("manage-moment-filter");
const manageCountBadge = document.getElementById("manage-count-badge");
const selectAllPhotosBtn = document.getElementById("select-all-photos-btn");
const deselectAllPhotosBtn = document.getElementById("deselect-all-photos-btn");
const deleteSelectedPhotosBtn = document.getElementById("delete-selected-photos-btn");
const managePhotosGrid = document.getElementById("manage-photos-grid");

let savedPhotosList = [];
let selectedPhotoIdsToDelete = new Set();

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

  // URL del archivo original sin compresión para descargas en máxima calidad (48MP)
  const originalUrl = (data.data.image && data.data.image.url) || data.data.url;

  // URL optimizada en Web HD para visualización rápida en celulares sin saturar la memoria RAM
  const displayUrl = (data.data.medium && data.data.medium.url) || data.data.display_url || originalUrl;

  // Miniatura ligera para previsualizaciones rápidas
  const thumbUrl = (data.data.thumb && data.data.thumb.url) || displayUrl;

  return { originalUrl, displayUrl, thumbUrl };
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
    const imgData = await uploadToImgBB(selectedCoverFile);
    const coverUrl = imgData.displayUrl || imgData.originalUrl;
    console.log("Portada subida a ImgBB:", coverUrl);

    // 2. Guardar en Firestore
    const settingsDoc = doc(db, "meta", "settings");
    await setDoc(settingsDoc, { coverUrl: coverUrl, coverOriginalUrl: imgData.originalUrl }, { merge: true });

    // 3. Respaldo en localStorage
    localStorage.setItem("boda_cover_url", coverUrl);
    coverPreviewImg.src = coverUrl;

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
// 2.1 GESTIÓN DE LA FOTO DE CABECERA (BANNER DESENFOCADO)
// ========================================================
if (chooseBannerBtn && bannerFileInput) {
  chooseBannerBtn.addEventListener("click", () => bannerFileInput.click());

  bannerFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    selectedBannerFile = file;
    const previewUrl = URL.createObjectURL(file);
    if (bannerPreviewImg) bannerPreviewImg.src = previewUrl;
    if (saveBannerBtn) saveBannerBtn.disabled = false;
    if (bannerStatusText) {
      bannerStatusText.innerHTML = `Foto seleccionada: <strong>${file.name}</strong>. Haz clic en <strong>"Guardar Foto de Cabecera"</strong>.`;
    }
  });
}

if (saveBannerBtn) {
  saveBannerBtn.addEventListener("click", async () => {
    if (!selectedBannerFile) return;

    saveBannerBtn.disabled = true;
    saveBannerBtn.innerHTML = "<span>⏳ Subiendo a ImgBB...</span>";
    if (bannerStatusText) {
      bannerStatusText.textContent = "Subiendo imagen horizontal a ImgBB en alta resolución...";
    }

    try {
      // 1. Subir a ImgBB
      const imgData = await uploadToImgBB(selectedBannerFile);
      const bannerUrl = imgData.displayUrl || imgData.originalUrl;
      console.log("Cabecera subida a ImgBB:", bannerUrl);

      // 2. Guardar en Firestore
      const settingsDoc = doc(db, "meta", "settings");
      await setDoc(settingsDoc, { headerBannerUrl: bannerUrl, headerBannerOriginalUrl: imgData.originalUrl }, { merge: true });

      // 3. Respaldo en localStorage
      localStorage.setItem("boda_banner_url", bannerUrl);
      if (bannerPreviewImg) bannerPreviewImg.src = bannerUrl;

      if (bannerStatusText) {
        bannerStatusText.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Foto de cabecera guardada en ImgBB con éxito! Ya se ve con desenfoque de fondo en tu web.</span>`;
      }
      showToast("¡Foto de cabecera guardada con éxito! 🌄");
    } catch (err) {
      console.error("Error al guardar cabecera:", err);
      if (bannerStatusText) {
        bannerStatusText.innerHTML = `<span style="color: #dc3545; font-weight: 600;">Error: ${err.message}</span>`;
      }
      alert("Error al subir cabecera: " + err.message);
    } finally {
      saveBannerBtn.disabled = false;
      saveBannerBtn.innerHTML = "<span>💾 Guardar Foto de Cabecera</span>";
    }
  });
}

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
      const imgData = await uploadToImgBB(file);

      // 2. Guardar registro en Firestore (Web HD para navegación fluida + Original para descarga 48MP)
      await addDoc(collection(db, "photos"), {
        albumId: selectedAlbumId,
        url: imgData.displayUrl || imgData.originalUrl,
        originalUrl: imgData.originalUrl,
        thumbUrl: imgData.thumbUrl || imgData.displayUrl || imgData.originalUrl,
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
// 3. GESTIÓN Y ORDEN DE MOMENTOS
// ========================================================
async function moveMomentUp(index) {
  if (index <= 0) return;
  const current = albumsData[index];
  const previous = albumsData[index - 1];

  const currentOrder = typeof current.order === "number" ? current.order : index;
  const prevOrder = typeof previous.order === "number" ? previous.order : (index - 1);

  const newCurrentOrder = prevOrder;
  const newPrevOrder = currentOrder === prevOrder ? currentOrder + 1 : currentOrder;

  try {
    await Promise.all([
      setDoc(doc(db, "albums", current.id), { order: newCurrentOrder }, { merge: true }),
      setDoc(doc(db, "albums", previous.id), { order: newPrevOrder }, { merge: true })
    ]);
    showToast("¡Orden de momentos actualizado! ✨");
  } catch (err) {
    console.error("Error al reordenar momentos:", err);
  }
}

async function moveMomentDown(index) {
  if (index >= albumsData.length - 1) return;
  const current = albumsData[index];
  const next = albumsData[index + 1];

  const currentOrder = typeof current.order === "number" ? current.order : index;
  const nextOrder = typeof next.order === "number" ? next.order : (index + 1);

  const newCurrentOrder = nextOrder;
  const newNextOrder = currentOrder === nextOrder ? currentOrder - 1 : currentOrder;

  try {
    await Promise.all([
      setDoc(doc(db, "albums", current.id), { order: newCurrentOrder }, { merge: true }),
      setDoc(doc(db, "albums", next.id), { order: newNextOrder }, { merge: true })
    ]);
    showToast("¡Orden de momentos actualizado! ✨");
  } catch (err) {
    console.error("Error al reordenar momentos:", err);
  }
}

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
      order: albumsData.length + 1,
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
// 4. GESTOR DE FOTOS GUARDADAS (ELIMINAR INDIVIDUAL O EN LOTE)
// ========================================================
function renderManagePhotos() {
  if (!managePhotosGrid) return;

  const currentFilter = manageMomentFilter ? manageMomentFilter.value : "all";
  const filteredPhotos = currentFilter === "all"
    ? savedPhotosList
    : savedPhotosList.filter(p => p.albumId === currentFilter);

  if (manageCountBadge) {
    manageCountBadge.textContent = `${filteredPhotos.length} Fotos`;
  }

  managePhotosGrid.innerHTML = "";
  updateDeleteSelectedBtn();

  if (filteredPhotos.length === 0) {
    managePhotosGrid.innerHTML = `
      <div class="loading" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
        No hay fotos guardadas en este momento.
      </div>
    `;
    return;
  }

  filteredPhotos.forEach((photo) => {
    const isSelected = selectedPhotoIdsToDelete.has(photo.id);
    const card = document.createElement("div");
    card.className = `manage-photo-card ${isSelected ? 'selected' : ''}`;

    const albumObj = albumsData.find(a => a.id === photo.albumId);
    const albumName = albumObj ? albumObj.name : (photo.albumId || "General");
    const imgUrl = photo.thumbUrl || photo.url || photo.originalUrl;

    card.innerHTML = `
      <input type="checkbox" class="manage-photo-checkbox" ${isSelected ? 'checked' : ''} />
      <button class="manage-photo-single-del" title="Eliminar esta foto permanentemente">🗑️</button>
      <img src="${imgUrl}" alt="${photo.filename || ''}" loading="lazy" decoding="async" onerror="this.src='placeholder.svg'" />
      <div class="manage-photo-card-info">
        <div class="manage-photo-name" title="${photo.filename || ''}">${photo.filename || 'Foto de Boda'}</div>
        <div class="manage-photo-moment">${albumName}</div>
      </div>
    `;

    // Toggle selección con checkbox
    const chk = card.querySelector(".manage-photo-checkbox");
    chk.onclick = (e) => {
      e.stopPropagation();
      if (chk.checked) {
        selectedPhotoIdsToDelete.add(photo.id);
        card.classList.add("selected");
      } else {
        selectedPhotoIdsToDelete.delete(photo.id);
        card.classList.remove("selected");
      }
      updateDeleteSelectedBtn();
    };

    // Toggle selección tocando la tarjeta
    card.onclick = () => {
      if (selectedPhotoIdsToDelete.has(photo.id)) {
        selectedPhotoIdsToDelete.delete(photo.id);
        chk.checked = false;
        card.classList.remove("selected");
      } else {
        selectedPhotoIdsToDelete.add(photo.id);
        chk.checked = true;
        card.classList.add("selected");
      }
      updateDeleteSelectedBtn();
    };

    // Botón individual de eliminar
    const delBtn = card.querySelector(".manage-photo-single-del");
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar la foto "${photo.filename || 'esta foto'}" permanentemente?`)) {
        try {
          await deleteDoc(doc(db, "photos", photo.id));
          selectedPhotoIdsToDelete.delete(photo.id);
          showToast("Foto eliminada con éxito ✅");
        } catch (err) {
          alert("Error al eliminar foto: " + err.message);
        }
      }
    };

    managePhotosGrid.appendChild(card);
  });
}

function updateDeleteSelectedBtn() {
  if (!deleteSelectedPhotosBtn) return;
  const count = selectedPhotoIdsToDelete.size;
  deleteSelectedPhotosBtn.disabled = count === 0;
  deleteSelectedPhotosBtn.innerHTML = `<span>🗑️ Eliminar Seleccionadas (${count})</span>`;

  if (deselectAllPhotosBtn) {
    if (count > 0) deselectAllPhotosBtn.classList.remove("hidden");
    else deselectAllPhotosBtn.classList.add("hidden");
  }
}

if (manageMomentFilter) {
  manageMomentFilter.onchange = () => {
    selectedPhotoIdsToDelete.clear();
    renderManagePhotos();
  };
}

if (selectAllPhotosBtn) {
  selectAllPhotosBtn.onclick = () => {
    const currentFilter = manageMomentFilter ? manageMomentFilter.value : "all";
    const filteredPhotos = currentFilter === "all"
      ? savedPhotosList
      : savedPhotosList.filter(p => p.albumId === currentFilter);

    filteredPhotos.forEach(p => selectedPhotoIdsToDelete.add(p.id));
    renderManagePhotos();
  };
}

if (deselectAllPhotosBtn) {
  deselectAllPhotosBtn.onclick = () => {
    selectedPhotoIdsToDelete.clear();
    renderManagePhotos();
  };
}

if (deleteSelectedPhotosBtn) {
  deleteSelectedPhotosBtn.onclick = async () => {
    const count = selectedPhotoIdsToDelete.size;
    if (count === 0) return;

    if (confirm(`¿Estás seguro de que deseas eliminar las ${count} fotos seleccionadas permanentemente?`)) {
      deleteSelectedPhotosBtn.disabled = true;
      deleteSelectedPhotosBtn.textContent = "Eliminando...";

      try {
        const idsToDelete = Array.from(selectedPhotoIdsToDelete);
        await Promise.all(idsToDelete.map(id => deleteDoc(doc(db, "photos", id))));
        selectedPhotoIdsToDelete.clear();
        showToast(`¡${count} fotos eliminadas con éxito! ✅`);
      } catch (err) {
        alert("Error al eliminar fotos: " + err.message);
      } finally {
        updateDeleteSelectedBtn();
      }
    }
  };
}

// ========================================================
// 5. SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
// ========================================================
function initRealtimeListeners() {
  const savedCover = localStorage.getItem("boda_cover_url");
  if (savedCover) coverPreviewImg.src = savedCover;

  const savedBanner = localStorage.getItem("boda_banner_url");
  if (savedBanner && bannerPreviewImg) bannerPreviewImg.src = savedBanner;

  // 1. Escuchar configuraciones de portada, cabecera y nombres en Firestore
  const settingsDoc = doc(db, "meta", "settings");
  onSnapshot(settingsDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.coverUrl) {
        coverPreviewImg.src = data.coverUrl;
        localStorage.setItem("boda_cover_url", data.coverUrl);
        if (!data.headerBannerUrl && !savedBanner && bannerPreviewImg) {
          bannerPreviewImg.src = data.coverUrl;
        }
      }
      if (data.headerBannerUrl) {
        if (bannerPreviewImg) bannerPreviewImg.src = data.headerBannerUrl;
        localStorage.setItem("boda_banner_url", data.headerBannerUrl);
      }
      if (data.coupleNames) {
        coverPreviewNames.textContent = data.coupleNames;
        settingsNames.value = data.coupleNames;
      }
      if (data.subtitle) settingsSubtitle.value = data.subtitle;
      if (data.date) settingsDate.value = data.date;
    }
  });

  // 2. Escuchar momentos en Firestore (ordenados por el campo order)
  const albumsQuery = query(collection(db, "albums"), orderBy("createdAt", "desc"));
  onSnapshot(albumsQuery, (snap) => {
    albumsData = [];
    snap.forEach((docSnap) => {
      const a = docSnap.data();
      a.id = docSnap.id;
      albumsData.push(a);
    });

    // Ordenar según el orden configurado por el usuario
    albumsData.sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : 999;
      const orderB = typeof b.order === "number" ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    targetAlbumSelect.innerHTML = "";
    if (manageMomentFilter) {
      const prevVal = manageMomentFilter.value;
      manageMomentFilter.innerHTML = '<option value="all">Todas las Fotos</option>';
      albumsData.forEach((a) => {
        const optFilter = document.createElement("option");
        optFilter.value = a.id;
        optFilter.textContent = a.name;
        manageMomentFilter.appendChild(optFilter);
      });
      manageMomentFilter.value = prevVal || "all";
    }

    momentsList.innerHTML = "";

    albumsData.forEach((a, index) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      targetAlbumSelect.appendChild(opt);

      const item = document.createElement("div");
      item.className = "album-item";
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1;">
          <span class="moment-order-badge">#${index + 1}</span>
          <div>
            <span class="album-item-name">${a.name}</span>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">${a.description || ''}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div class="order-btn-group">
            <button class="btn-order btn-order-up" title="Subir de posición" ${index === 0 ? 'disabled' : ''}>⬆</button>
            <button class="btn-order btn-order-down" title="Bajar de posición" ${index === albumsData.length - 1 ? 'disabled' : ''}>⬇</button>
          </div>
          <button class="btn-danger" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;" data-id="${a.id}">
            Eliminar
          </button>
        </div>
      `;

      item.querySelector(".btn-order-up").onclick = () => moveMomentUp(index);
      item.querySelector(".btn-order-down").onclick = () => moveMomentDown(index);

      item.querySelector(".btn-danger").onclick = async () => {
        if (confirm(`¿Eliminar el momento "${a.name}"? Esto no borrará las fotos subidas.`)) {
          await deleteDoc(doc(db, "albums", a.id));
          showToast(`Momento "${a.name}" eliminado`);
        }
      };

      momentsList.appendChild(item);
    });

    if (albumsData.length === 0) {
      loadDefaultMomentsIfEmpty();
    }

    // Refrescar nombres en las fotos si ya estaban cargadas
    renderManagePhotos();
  });

  // 3. Escuchar fotos guardadas en tiempo real para el Gestor de Eliminación
  const photosQuery = query(collection(db, "photos"), orderBy("createdAt", "desc"));
  onSnapshot(photosQuery, (snap) => {
    savedPhotosList = [];
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      p.id = docSnap.id;
      savedPhotosList.push(p);
    });

    renderManagePhotos();
  });
}

async function loadDefaultMomentsIfEmpty() {
  const defaults = [
    { id: "la-ceremonia", name: "La Ceremonia", description: "El 'Sí, acepto' ante Dios y nuestros seres queridos", order: 1 },
    { id: "la-recepcion", name: "La Recepción & Fiesta", description: "Celebrando la alegría de comenzar este nuevo viaje", order: 2 },
    { id: "sesion-previa", name: "Sesión Previa", description: "Momentos íntimos antes del gran día", order: 3 }
  ];

  for (let m of defaults) {
    try {
      await setDoc(doc(db, "albums", m.id), {
        name: m.name,
        description: m.description,
        order: m.order,
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
