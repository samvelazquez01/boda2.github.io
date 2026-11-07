// ========================================================
//  ADMIN.JS - GESTOR DE PORTADA Y FOTOS EN ALTA CALIDAD
// ========================================================

// Current data state
let currentData = {
  settings: {
    coupleNames: "Samuel & Lisbeth",
    subtitle: "Un amor para toda la vida",
    date: "20 • Noviembre • 2024",
    welcomeMessage: "Gracias por acompañarnos y celebrar el día más feliz de nuestras vidas.",
    coverUrl: "placeholder.svg"
  },
  albums: [
    {
      id: "sesion-previa",
      name: "Sesión Previa",
      description: "Momentos íntimos antes del gran día",
      coverUrl: "placeholder.svg",
      photos: []
    },
    {
      id: "la-ceremonia",
      name: "La Ceremonia",
      description: "El 'Sí, acepto' ante Dios y nuestros seres queridos",
      coverUrl: "placeholder.svg",
      photos: []
    },
    {
      id: "la-recepcion",
      name: "La Recepción & Fiesta",
      description: "Celebrando la alegría de comenzar este nuevo viaje",
      coverUrl: "placeholder.svg",
      photos: []
    }
  ]
};

// Queue of compressed files
let compressedQueue = [];
let totalOriginalBytes = 0;
let totalCompressedBytes = 0;

// Cover Photo state
let selectedCoverBlob = null;
let selectedCoverFile = null;

// Music state
let selectedMusicBlob = null;
let selectedMusicFile = null;

// DOM Elements - Cover
const coverPreviewImg = document.getElementById("cover-preview-img");
const coverPreviewTitle = document.getElementById("cover-preview-title");
const coverFileInput = document.getElementById("cover-file-input");
const chooseCoverBtn = document.getElementById("choose-cover-btn");
const coverCurrentStatus = document.getElementById("cover-current-status");
const coverDownloadActions = document.getElementById("cover-download-actions");
const downloadCoverBtn = document.getElementById("download-cover-btn");

// DOM Elements - Music
const adminAudioPreview = document.getElementById("admin-audio-preview");
const adminMusicStatus = document.getElementById("admin-music-status");
const musicFileInput = document.getElementById("music-file-input");
const chooseMusicBtn = document.getElementById("choose-music-btn");
const musicUrlInput = document.getElementById("music-url-input");
const musicDownloadActions = document.getElementById("music-download-actions");
const downloadMusicBtn = document.getElementById("download-music-btn");

// DOM Elements - Compressor
const targetAlbumSelect = document.getElementById("target-album-select");
const maxDimensionSelect = document.getElementById("max-dimension-select");
const qualitySelect = document.getElementById("quality-select");
const formatSelect = document.getElementById("format-select");
const includeOriginalsCheckbox = document.getElementById("include-originals-checkbox");

const dropzone = document.getElementById("dropzone");
const photosFileInput = document.getElementById("photos-file-input");

const statsContainer = document.getElementById("compression-stats-container");
const statCount = document.getElementById("stat-count");
const statOriginalSize = document.getElementById("stat-original-size");
const statCompressedSize = document.getElementById("stat-compressed-size");
const statSavings = document.getElementById("stat-savings");

const downloadActionsContainer = document.getElementById("download-actions-container");
const downloadZipBtn = document.getElementById("download-zip-btn");
const downloadJsonBtn = document.getElementById("download-json-btn");
const clearQueueBtn = document.getElementById("clear-queue-btn");
const compressedGrid = document.getElementById("compressed-grid");

const momentsList = document.getElementById("moments-list");
const newAlbumName = document.getElementById("new-album-name");
const newAlbumDesc = document.getElementById("new-album-desc");
const createAlbumBtn = document.getElementById("create-album-btn");

const settingsNames = document.getElementById("settings-names");
const settingsSubtitle = document.getElementById("settings-subtitle");
const settingsDate = document.getElementById("settings-date");
const saveSettingsBtn = document.getElementById("save-settings-btn");

// ========================================================
// 1. CARGA INICIAL DE ALBUMS.JSON
// ========================================================
async function initData() {
  try {
    const res = await fetch("data/albums.json?v=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.albums) {
        currentData = data;
      }
    }
  } catch (err) {
    console.warn("Usando datos locales por defecto", err);
  }

  // Populate UI
  refreshMomentsUI();
  populateSettingsUI();
  initCoverUI();
  initMusicUI();
}

function initMusicUI() {
  if (currentData.settings) {
    if (currentData.settings.musicUrl) {
      adminAudioPreview.src = currentData.settings.musicUrl;
      adminMusicStatus.textContent = currentData.settings.musicUrl;
      musicUrlInput.value = currentData.settings.musicUrl;
    }
  }

  // Event listener para seleccionar canción
  chooseMusicBtn.addEventListener("click", () => musicFileInput.click());

  musicFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    selectedMusicFile = file;
    selectedMusicBlob = file;

    const audioUrl = URL.createObjectURL(file);
    adminAudioPreview.src = audioUrl;
    currentData.settings.musicUrl = "music/cancion.mp3";
    musicUrlInput.value = "music/cancion.mp3";
    adminMusicStatus.textContent = "music/cancion.mp3 (Nueva seleccionada)";
    musicDownloadActions.classList.remove("hidden");
    showNotification("¡Canción de boda seleccionada! Lista para guardar.");
  });

  // Cambiar URL de música manualmente si se escribe
  musicUrlInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val) {
      currentData.settings.musicUrl = val;
      adminAudioPreview.src = val;
      adminMusicStatus.textContent = val;
    }
  });

  // Descargar archivo de canción por separado
  downloadMusicBtn.addEventListener("click", () => {
    if (!selectedMusicBlob) {
      alert("Por favor selecciona un archivo de música primero.");
      return;
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(selectedMusicBlob);
    a.download = "cancion.mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();

    downloadJsonBtn.click();
    showNotification("Descargada cancion.mp3 y actualizado data/albums.json");
  });
}

function initCoverUI() {
  if (currentData.settings) {
    if (currentData.settings.coverUrl) {
      coverPreviewImg.src = currentData.settings.coverUrl;
      coverCurrentStatus.textContent = currentData.settings.coverUrl;
    }
    if (currentData.settings.coupleNames) {
      coverPreviewTitle.textContent = currentData.settings.coupleNames;
    }
  }

  // Event listener para cambiar portada
  chooseCoverBtn.addEventListener("click", () => coverFileInput.click());

  coverFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    selectedCoverFile = file;
    selectedCoverBlob = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
      coverPreviewImg.src = ev.target.result;
      currentData.settings.coverUrl = "photos/portada.jpg";
      coverCurrentStatus.textContent = "photos/portada.jpg (Nueva seleccionada)";
      coverDownloadActions.classList.remove("hidden");
      showNotification("¡Foto de portada seleccionada! Lista para guardar.");
    };
    reader.readAsDataURL(file);
  });

  // Descargar foto de portada por separado
  downloadCoverBtn.addEventListener("click", () => {
    if (!selectedCoverBlob) {
      alert("Por favor selecciona una foto de portada primero.");
      return;
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(selectedCoverBlob);
    a.download = "portada.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Guardar también albums.json actualizado
    downloadJsonBtn.click();
    showNotification("Descargada portada.jpg y actualizado data/albums.json");
  });
}

function refreshMomentsUI() {
  targetAlbumSelect.innerHTML = "";
  currentData.albums.forEach(album => {
    const opt = document.createElement("option");
    opt.value = album.id;
    opt.textContent = album.name;
    targetAlbumSelect.appendChild(opt);
  });

  momentsList.innerHTML = "";
  if (currentData.albums.length === 0) {
    momentsList.innerHTML = '<div class="loading">No hay momentos creados todavía.</div>';
    return;
  }

  currentData.albums.forEach((album, index) => {
    const count = (album.photos && album.photos.length) || 0;
    const item = document.createElement("div");
    item.className = "album-item";
    item.innerHTML = `
      <div>
        <span class="album-item-name">${album.name}</span>
        <span class="album-item-count">(${count} fotos)</span>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">${album.description || ''}</p>
      </div>
      <div>
        <button class="btn-danger" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;" data-index="${index}">
          Eliminar
        </button>
      </div>
    `;

    item.querySelector(".btn-danger").onclick = () => {
      if (confirm(`¿Eliminar el momento "${album.name}"?`)) {
        currentData.albums.splice(index, 1);
        refreshMomentsUI();
        showNotification(`Momento "${album.name}" eliminado.`);
      }
    };

    momentsList.appendChild(item);
  });
}

function populateSettingsUI() {
  if (currentData.settings) {
    if (currentData.settings.coupleNames) settingsNames.value = currentData.settings.coupleNames;
    if (currentData.settings.subtitle) settingsSubtitle.value = currentData.settings.subtitle;
    if (currentData.settings.date) settingsDate.value = currentData.settings.date;
  }
}

// ========================================================
// 2. OPTIMIZACIÓN Y PROCESAMIENTO EN ALTA RESOLUCIÓN
// ========================================================
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function processImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimVal = maxDimensionSelect.value;
        let width = img.width;
        let height = img.height;

        // Si no es "original", escalar a la resolución deseada manteniendo proporción
        if (maxDimVal !== "original") {
          const maxDim = parseInt(maxDimVal, 10) || 2560;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
        }

        // Dibujar en canvas con máxima nitidez
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar a WebP o JPEG
        const format = formatSelect.value || "image/webp";
        const quality = parseFloat(qualitySelect.value) || 0.92;
        const extension = format === "image/webp" ? "webp" : "jpg";

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(null);

            const cleanBase = file.name
              .replace(/\.[^/.]+$/, "")
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "_");
            const newFilename = `${cleanBase}_hd.${extension}`;
            const previewUrl = URL.createObjectURL(blob);

            const result = {
              originalFile: file,
              originalName: file.name,
              newName: newFilename,
              originalSize: file.size,
              compressedSize: blob.size,
              blob: blob,
              previewUrl: previewUrl,
              albumId: targetAlbumSelect.value,
              width: width,
              height: height
            };

            resolve(result);
          },
          format,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFiles(files) {
  if (!files || files.length === 0) return;

  const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (validFiles.length === 0) {
    alert("Por favor selecciona solo archivos de imagen (JPG, PNG, WebP).");
    return;
  }

  showNotification(`Procesando ${validFiles.length} fotos en alta calidad...`);

  statsContainer.classList.remove("hidden");
  downloadActionsContainer.classList.remove("hidden");

  for (let file of validFiles) {
    const processed = await processImageFile(file);
    if (processed) {
      compressedQueue.push(processed);
      totalOriginalBytes += processed.originalSize;
      totalCompressedBytes += processed.compressedSize;
      addCardToGrid(processed);
      updateStats();
    }
  }

  showNotification(`¡${validFiles.length} fotos optimizadas con éxito!`);
}

function updateStats() {
  statCount.textContent = compressedQueue.length;
  statOriginalSize.textContent = formatBytes(totalOriginalBytes);
  statCompressedSize.textContent = formatBytes(totalCompressedBytes);

  if (totalOriginalBytes > 0) {
    const savedPct = Math.round(((totalOriginalBytes - totalCompressedBytes) / totalOriginalBytes) * 100);
    statSavings.textContent = `${savedPct}% menos`;
  }
}

function addCardToGrid(item) {
  const card = document.createElement("div");
  card.className = "compressed-card";
  const savedPct = Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100);

  card.innerHTML = `
    <img src="${item.previewUrl}" alt="${item.newName}" />
    <div class="compressed-card-body">
      <div class="compressed-name" title="${item.newName}">${item.newName}</div>
      <div style="color: var(--text-muted); font-size: 0.75rem;">
        ${formatBytes(item.originalSize)} → <strong>${formatBytes(item.compressedSize)}</strong>
      </div>
      <div class="compressed-savings">-${savedPct}% de peso (${item.width}x${item.height})</div>
    </div>
  `;

  compressedGrid.appendChild(card);
}

// Limpiar cola
clearQueueBtn.addEventListener("click", () => {
  compressedQueue.forEach(item => URL.revokeObjectURL(item.previewUrl));
  compressedQueue = [];
  totalOriginalBytes = 0;
  totalCompressedBytes = 0;
  compressedGrid.innerHTML = "";
  statsContainer.classList.add("hidden");
  downloadActionsContainer.classList.add("hidden");
  showNotification("Lista limpiada.");
});

// Dropzone Events
dropzone.addEventListener("click", () => photosFileInput.click());
photosFileInput.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFiles(e.dataTransfer.files);
  }
});

// ========================================================
// 3. GENERAR ZIP COMPLETO (PORTADA + FOTOS + DATA/ALBUMS.JSON)
// ========================================================
downloadZipBtn.addEventListener("click", async () => {
  if (compressedQueue.length === 0 && !selectedCoverBlob) {
    alert("No hay fotos procesadas ni foto de portada para empaquetar.");
    return;
  }

  if (typeof JSZip === "undefined") {
    alert("La librería JSZip no se ha cargado. Revisa tu conexión a internet.");
    return;
  }

  showNotification("Empaquetando portada, fotos y datos en ZIP...");
  downloadZipBtn.disabled = true;
  downloadZipBtn.textContent = "⏳ Generando archivo ZIP...";

  const zip = new JSZip();
  const photosFolder = zip.folder("photos");
  const saveOriginals = includeOriginalsCheckbox && includeOriginalsCheckbox.checked;
  const originalsFolder = saveOriginals ? zip.folder("photos/originals") : null;

  const updatedData = JSON.parse(JSON.stringify(currentData));

  // 1. Agregar foto de portada si se seleccionó
  if (selectedCoverBlob) {
    photosFolder.file("portada.jpg", selectedCoverBlob);
    updatedData.settings.coverUrl = "photos/portada.jpg";
    if (originalsFolder) {
      originalsFolder.file("portada_original.jpg", selectedCoverFile || selectedCoverBlob);
    }
  }

  // 1.1 Agregar archivo de música si se seleccionó
  if (selectedMusicBlob) {
    const musicFolder = zip.folder("music");
    musicFolder.file("cancion.mp3", selectedMusicBlob);
    updatedData.settings.musicUrl = "music/cancion.mp3";
  }

  // 2. Agregar fotos de la cola
  compressedQueue.forEach((item, index) => {
    const filename = `foto_${Date.now()}_${index}_${item.newName}`;
    photosFolder.file(filename, item.blob);

    let originalRelativePath = `photos/${filename}`;
    if (saveOriginals && item.originalFile) {
      const origName = `orig_${Date.now()}_${index}_${item.originalName.replace(/\s+/g, '_')}`;
      originalsFolder.file(origName, item.originalFile);
      originalRelativePath = `photos/originals/${origName}`;
    }

    let targetAlbum = updatedData.albums.find(a => a.id === item.albumId);
    if (!targetAlbum) {
      targetAlbum = updatedData.albums[0];
    }

    if (targetAlbum) {
      if (!targetAlbum.photos) targetAlbum.photos = [];
      const relativePath = `photos/${filename}`;
      targetAlbum.photos.push({
        id: `photo_${Date.now()}_${index}`,
        url: relativePath,
        originalUrl: originalRelativePath,
        title: item.originalName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        caption: ""
      });

      if (!targetAlbum.coverUrl || targetAlbum.coverUrl === "placeholder.svg") {
        targetAlbum.coverUrl = relativePath;
      }
    }
  });

  // 3. Agregar data/albums.json
  const dataFolder = zip.folder("data");
  dataFolder.file("albums.json", JSON.stringify(updatedData, null, 2));

  // 4. Instrucciones dentro del ZIP
  zip.file(
    "INSTRUCCIONES_GITHUB.txt",
    `PASOS PARA SUBIR TUS FOTOS A GITHUB:\n\n` +
    `1. Descomprime este archivo ZIP en tu computadora.\n` +
    `2. Copia todo el contenido de la carpeta 'photos' dentro de la carpeta 'photos/' de tu repositorio 'boda2.github.io'.\n` +
    `   (Incluyendo la foto 'portada.jpg' y la carpeta 'originals').\n` +
    `3. Copia el archivo 'data/albums.json' dentro de la carpeta 'data/' de tu repositorio.\n` +
    `4. Sube los cambios a GitHub (arrastrándolos a GitHub.com o con 'git push').\n\n` +
    `¡Tus invitados verán la portada de bienvenida y las fotos en alta calidad inmediatamente!`
  );

  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `boda-fotos-optimizadas-github.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  currentData = updatedData;
  refreshMomentsUI();

  downloadZipBtn.disabled = false;
  downloadZipBtn.innerHTML = "<span>📦 Descargar Fotos Comprimidas + albums.json (ZIP)</span>";
  showNotification("¡Archivo ZIP descargado con éxito! 🎉");
});

// Descargar solo albums.json
downloadJsonBtn.addEventListener("click", () => {
  const jsonStr = JSON.stringify(currentData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "albums.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  showNotification("Descargado albums.json");
});

// ========================================================
// 4. CREAR MOMENTOS / ÁLBUMES
// ========================================================
createAlbumBtn.addEventListener("click", () => {
  const name = newAlbumName.value.trim();
  const desc = newAlbumDesc.value.trim();

  if (!name) {
    alert("Por favor ingresa un nombre para el momento.");
    return;
  }

  const id = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");

  currentData.albums.push({
    id: id,
    name: name,
    description: desc,
    coverUrl: "placeholder.svg",
    photos: []
  });

  newAlbumName.value = "";
  newAlbumDesc.value = "";
  refreshMomentsUI();
  showNotification(`¡Momento "${name}" creado exitosamente!`);
});

// ========================================================
// 5. GUARDAR CONFIGURACIONES DE LA BODA
// ========================================================
saveSettingsBtn.addEventListener("click", () => {
  currentData.settings.coupleNames = settingsNames.value.trim() || "Samuel & Lisbeth";
  currentData.settings.subtitle = settingsSubtitle.value.trim() || "Un amor para toda la vida";
  currentData.settings.date = settingsDate.value.trim() || "20 • Noviembre • 2024";

  downloadJsonBtn.click();
  showNotification("Información guardada. Recuerda reemplazar data/albums.json en tu proyecto.");
});

// ========================================================
// 6. TOAST NOTIFICATION
// ========================================================
function showNotification(msg) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

// Inicialización
window.addEventListener("DOMContentLoaded", initData);
