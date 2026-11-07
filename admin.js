// ========================================================
//  ADMIN.JS - SUBIDA DIRECTA A GITHUB (SIN DESCARGAS)
//  Comunica directamente con la API de GitHub para subir
//  portada, fotos y música al repositorio en tiempo real.
// ========================================================

// Estado de GitHub
let ghRepo = localStorage.getItem("boda_gh_repo") || "boda2/boda2.github.io";
let ghToken = localStorage.getItem("boda_gh_token") || "";

// Datos del álbum
let currentData = {
  settings: {
    coupleNames: "Samuel & Lisbeth",
    subtitle: "Nuestra Boda • Un Amor Para Siempre",
    date: "20 • Noviembre • 2024",
    welcomeMessage: "Gracias por acompañarnos y celebrar el día más feliz de nuestras vidas.",
    coverUrl: "photos/portada.jpg",
    musicUrl: "music/cancion.mp3"
  },
  albums: [
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
    },
    {
      id: "sesion-previa",
      name: "Sesión Previa",
      description: "Momentos íntimos antes del gran día",
      coverUrl: "placeholder.svg",
      photos: []
    }
  ]
};

// Cola de fotos seleccionadas para subir
let photosQueue = [];
let selectedCoverBlob = null;
let selectedMusicBlob = null;

// DOM - Conexión GitHub
const ghRepoInput = document.getElementById("gh-repo-input");
const ghTokenInput = document.getElementById("gh-token-input");
const ghConnectBtn = document.getElementById("gh-connect-btn");
const ghConnectionBadge = document.getElementById("github-connection-badge");
const ghStatusText = document.getElementById("github-status-text");

// DOM - Portada
const coverPreviewImg = document.getElementById("cover-preview-img");
const coverPreviewTitle = document.getElementById("cover-preview-title");
const coverFileInput = document.getElementById("cover-file-input");
const chooseCoverBtn = document.getElementById("choose-cover-btn");
const uploadCoverGhBtn = document.getElementById("upload-cover-gh-btn");
const coverStatusText = document.getElementById("cover-status-text");

// DOM - Fotos
const targetAlbumSelect = document.getElementById("target-album-select");
const photoQualitySelect = document.getElementById("photo-quality-select");
const dropzone = document.getElementById("dropzone");
const photosFileInput = document.getElementById("photos-file-input");
const uploadProgressContainer = document.getElementById("upload-progress-container");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressLabel = document.getElementById("upload-progress-label");
const uploadActionsContainer = document.getElementById("upload-actions-container");
const uploadPhotosGhBtn = document.getElementById("upload-photos-gh-btn");
const queueCountBadge = document.getElementById("queue-count-badge");
const clearQueueBtn = document.getElementById("clear-queue-btn");
const compressedGrid = document.getElementById("compressed-grid");

// DOM - Música
const adminAudioPreview = document.getElementById("admin-audio-preview");
const adminMusicStatus = document.getElementById("admin-music-status");
const musicFileInput = document.getElementById("music-file-input");
const chooseMusicBtn = document.getElementById("choose-music-btn");
const uploadMusicGhBtn = document.getElementById("upload-music-gh-btn");
const musicUploadStatus = document.getElementById("music-upload-status");

// DOM - Momentos
const momentsList = document.getElementById("moments-list");
const newAlbumName = document.getElementById("new-album-name");
const newAlbumDesc = document.getElementById("new-album-desc");
const createAlbumBtn = document.getElementById("create-album-btn");

// ========================================================
// 1. CONEXIÓN Y API DE GITHUB
// ========================================================
function initGitHubConnection() {
  ghRepoInput.value = ghRepo;
  if (ghToken) {
    ghTokenInput.value = ghToken;
    verifyGitHubToken(false);
  }

  ghConnectBtn.addEventListener("click", () => {
    ghRepo = ghRepoInput.value.trim();
    ghToken = ghTokenInput.value.trim();
    localStorage.setItem("boda_gh_repo", ghRepo);
    localStorage.setItem("boda_gh_token", ghToken);
    verifyGitHubToken(true);
  });
}

async function verifyGitHubToken(showAlert = true) {
  if (!ghToken) {
    setConnectionStatus(false, "No conectado");
    if (showAlert) alert("Por favor ingresa tu token de GitHub.");
    return false;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${ghRepo}`, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (res.ok) {
      const data = await res.json();
      setConnectionStatus(true, `Conectado a ${data.full_name}`);
      if (showAlert) showToast("¡Conexión exitosa con GitHub! 🚀");
      return true;
    } else {
      setConnectionStatus(false, "Error de token o repo");
      if (showAlert) alert("No se pudo conectar a GitHub. Verifica que el nombre del repositorio y el token sean correctos.");
      return false;
    }
  } catch (err) {
    setConnectionStatus(false, "Error de conexión");
    return false;
  }
}

function setConnectionStatus(connected, text) {
  if (connected) {
    ghConnectionBadge.className = "status-indicator connected";
    ghStatusText.textContent = text;
  } else {
    ghConnectionBadge.className = "status-indicator disconnected";
    ghStatusText.textContent = text;
  }
}

// Subir un archivo directamente a GitHub vía REST API
async function uploadToGitHub(path, base64Content, commitMessage) {
  if (!ghToken) {
    throw new Error("No has configurado tu token de GitHub. Conéctate arriba primero.");
  }

  const url = `https://api.github.com/repos/${ghRepo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  };

  // 1. Verificar si el archivo ya existe para obtener su SHA
  let sha = null;
  try {
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch (_) {}

  // 2. Subir o actualizar archivo
  const body = {
    message: commitMessage,
    content: base64Content
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errData = await putRes.json();
    throw new Error(errData.message || "Error al subir a GitHub");
  }

  return await putRes.json();
}

// Convertir Blob a Base64 puro
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result;
      const base64 = res.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Guardar data/albums.json directamente en GitHub
async function saveAlbumsJsonToGitHub(customMessage = "Actualizar álbum de fotos") {
  const jsonStr = JSON.stringify(currentData, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
  return await uploadToGitHub("data/albums.json", base64, customMessage);
}

// ========================================================
// 2. CARGA DE DATOS LOCALES / GITHUB
// ========================================================
async function initData() {
  initGitHubConnection();

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

  refreshMomentsUI();
  initCoverUI();
  initMusicUI();
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

    item.querySelector(".btn-danger").onclick = async () => {
      if (confirm(`¿Eliminar el momento "${album.name}"?`)) {
        currentData.albums.splice(index, 1);
        refreshMomentsUI();
        if (ghToken) {
          try {
            await saveAlbumsJsonToGitHub(`Eliminar momento: ${album.name}`);
            showToast("Momento eliminado y actualizado en GitHub");
          } catch (_) {}
        }
      }
    };

    momentsList.appendChild(item);
  });
}

// ========================================================
// 3. FOTO DE PORTADA - SUBIDA DIRECTA A GITHUB
// ========================================================
function initCoverUI() {
  if (currentData.settings && currentData.settings.coverUrl) {
    coverPreviewImg.src = currentData.settings.coverUrl;
  }
  if (currentData.settings && currentData.settings.coupleNames) {
    coverPreviewTitle.textContent = currentData.settings.coupleNames;
  }

  chooseCoverBtn.addEventListener("click", () => coverFileInput.click());

  coverFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    selectedCoverBlob = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      coverPreviewImg.src = ev.target.result;
      uploadCoverGhBtn.disabled = false;
      coverStatusText.innerHTML = `Foto seleccionada: <strong>${file.name}</strong>. Toca el botón azul para subirla a GitHub.`;
    };
    reader.readAsDataURL(file);
  });

  uploadCoverGhBtn.addEventListener("click", async () => {
    if (!selectedCoverBlob) return;
    if (!ghToken) {
      alert("Por favor ingresa y conecta tu Token de GitHub en la sección superior primero.");
      return;
    }

    uploadCoverGhBtn.disabled = true;
    uploadCoverGhBtn.innerHTML = "<span>⏳ Subiendo a GitHub...</span>";
    coverStatusText.textContent = "Subiendo archivo a photos/portada.jpg en GitHub...";

    try {
      const base64 = await blobToBase64(selectedCoverBlob);
      await uploadToGitHub("photos/portada.jpg", base64, "Actualizar foto de portada de bienvenida");

      // Actualizar enlace en data/albums.json
      currentData.settings.coverUrl = "photos/portada.jpg";
      await saveAlbumsJsonToGitHub("Vincular photos/portada.jpg como portada principal");

      coverStatusText.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Portada subida y guardada en GitHub con éxito!</span>`;
      showToast("¡Foto de portada actualizada en GitHub! 🎉");
    } catch (err) {
      console.error(err);
      coverStatusText.innerHTML = `<span style="color: #dc3545; font-weight: 600;">❌ Error: ${err.message}</span>`;
      alert("Error al subir a GitHub: " + err.message);
    } finally {
      uploadCoverGhBtn.disabled = false;
      uploadCoverGhBtn.innerHTML = "<span>🚀 Subir Portada Directo a GitHub</span>";
    }
  });
}

// ========================================================
// 4. MÚSICA DE BODA - SUBIDA DIRECTA A GITHUB
// ========================================================
function initMusicUI() {
  if (currentData.settings && currentData.settings.musicUrl) {
    adminAudioPreview.src = currentData.settings.musicUrl;
    adminMusicStatus.textContent = currentData.settings.musicUrl;
  }

  chooseMusicBtn.addEventListener("click", () => musicFileInput.click());

  musicFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    selectedMusicBlob = file;
    adminAudioPreview.src = URL.createObjectURL(file);
    uploadMusicGhBtn.disabled = false;
    musicUploadStatus.innerHTML = `Canción seleccionada: <strong>${file.name}</strong>. Toca el botón azul para subirla a GitHub.`;
  });

  uploadMusicGhBtn.addEventListener("click", async () => {
    if (!selectedMusicBlob) return;
    if (!ghToken) {
      alert("Por favor ingresa y conecta tu Token de GitHub en la sección superior primero.");
      return;
    }

    uploadMusicGhBtn.disabled = true;
    uploadMusicGhBtn.innerHTML = "<span>⏳ Subiendo audio a GitHub...</span>";
    musicUploadStatus.textContent = "Subiendo music/cancion.mp3 a GitHub...";

    try {
      const base64 = await blobToBase64(selectedMusicBlob);
      await uploadToGitHub("music/cancion.mp3", base64, "Subir canción de boda music/cancion.mp3");

      currentData.settings.musicUrl = "music/cancion.mp3";
      await saveAlbumsJsonToGitHub("Vincular music/cancion.mp3 como canción oficial");

      adminMusicStatus.textContent = "music/cancion.mp3 (Guardado en GitHub)";
      musicUploadStatus.innerHTML = `<span style="color: #28a745; font-weight: 600;">✅ ¡Canción subida a GitHub con éxito!</span>`;
      showToast("¡Canción de boda guardada en GitHub! 🎵");
    } catch (err) {
      console.error(err);
      musicUploadStatus.innerHTML = `<span style="color: #dc3545; font-weight: 600;">❌ Error: ${err.message}</span>`;
      alert("Error al subir música: " + err.message);
    } finally {
      uploadMusicGhBtn.disabled = false;
      uploadMusicGhBtn.innerHTML = "<span>🚀 Subir Canción Directo a GitHub</span>";
    }
  });
}

// ========================================================
// 5. SUBIDA DIRECTA DE FOTOS EN ALTA CALIDAD A GITHUB
// ========================================================
dropzone.addEventListener("click", () => photosFileInput.click());
photosFileInput.addEventListener("change", (e) => handleFilesSelected(e.target.files));

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
    handleFilesSelected(e.dataTransfer.files);
  }
});

function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (validFiles.length === 0) {
    alert("Por favor selecciona solo archivos de imagen (JPG, PNG, WebP).");
    return;
  }

  photosQueue = validFiles;
  queueCountBadge.textContent = photosQueue.length;
  uploadActionsContainer.classList.remove("hidden");
  compressedGrid.innerHTML = "";

  // Renderizar previsualizaciones rápidas
  photosQueue.forEach((file, i) => {
    const card = document.createElement("div");
    card.className = "compressed-card";
    const previewUrl = URL.createObjectURL(file);
    card.innerHTML = `
      <img src="${previewUrl}" alt="${file.name}" />
      <div class="compressed-card-body">
        <div class="compressed-name" title="${file.name}">${file.name}</div>
        <div style="font-size: 0.75rem; color: var(--gold-dark); font-weight: 600;">Lista para subir a GitHub</div>
      </div>
    `;
    compressedGrid.appendChild(card);
  });

  showToast(`¡${photosQueue.length} fotos preparadas! Toca "Subir Fotos Directo a GitHub".`);
}

clearQueueBtn.addEventListener("click", () => {
  photosQueue = [];
  compressedGrid.innerHTML = "";
  uploadActionsContainer.classList.add("hidden");
  uploadProgressContainer.classList.add("hidden");
});

// Procesar foto para visualización en alta calidad (Ultra HD)
async function preparePhotoBlob(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const qualitySetting = photoQualitySelect.value;
        let width = img.width;
        let height = img.height;

        if (qualitySetting === "ultra_hd") {
          const maxDim = 2560; // 2K / Retina Ultra HD
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
        } else if (qualitySetting === "full_hd") {
          const maxDim = 1920;
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

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve({ blob: blob || file, width, height });
          },
          "image/jpeg",
          0.92
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// BOTÓN PRINCIPAL: SUBIR FOTOS DIRECTAMENTE A GITHUB
uploadPhotosGhBtn.addEventListener("click", async () => {
  if (photosQueue.length === 0) return;
  if (!ghToken) {
    alert("Por favor ingresa y conecta tu Token de GitHub en la sección superior primero.");
    return;
  }

  const selectedAlbumId = targetAlbumSelect.value;
  let targetAlbum = currentData.albums.find(a => a.id === selectedAlbumId);
  if (!targetAlbum) targetAlbum = currentData.albums[0];
  if (!targetAlbum.photos) targetAlbum.photos = [];

  uploadPhotosGhBtn.disabled = true;
  uploadProgressContainer.classList.remove("hidden");

  let uploadedCount = 0;
  const total = photosQueue.length;

  for (let i = 0; i < total; i++) {
    const file = photosQueue[i];
    const pct = Math.round(((i + 1) / total) * 100);
    uploadProgressBar.style.width = `${pct}%`;
    uploadProgressLabel.textContent = `Subiendo foto ${i + 1} de ${total} a GitHub... (${pct}%)`;

    try {
      // 1. Preparar imagen en alta calidad
      const processed = await preparePhotoBlob(file);
      const base64 = await blobToBase64(processed.blob);

      // 2. Nombre limpio para GitHub
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      const filename = `foto_${Date.now()}_${i}_${cleanName}.jpg`;
      const githubPath = `photos/${filename}`;

      // 3. Subir archivo binario a la carpeta photos/ en GitHub
      await uploadToGitHub(githubPath, base64, `Subir foto de boda: ${filename}`);

      // 4. Agregar a la lista de fotos del momento
      targetAlbum.photos.push({
        id: `photo_${Date.now()}_${i}`,
        url: githubPath,
        originalUrl: githubPath,
        title: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        caption: ""
      });

      if (!targetAlbum.coverUrl || targetAlbum.coverUrl === "placeholder.svg") {
        targetAlbum.coverUrl = githubPath;
      }

      uploadedCount++;
    } catch (err) {
      console.error(`Error subiendo ${file.name}:`, err);
    }
  }

  // 5. Guardar albums.json actualizado directamente en GitHub
  uploadProgressLabel.textContent = "Actualizando catálogo data/albums.json en GitHub...";
  try {
    await saveAlbumsJsonToGitHub(`Agregar ${uploadedCount} fotos a momento ${targetAlbum.name}`);
    uploadProgressBar.style.width = "100%";
    uploadProgressLabel.innerHTML = `✅ ¡${uploadedCount} fotos subidas exitosamente a la carpeta photos/ de GitHub!`;
    showToast(`¡${uploadedCount} fotos subidas a GitHub con éxito! 🎉`);
    photosQueue = [];
    refreshMomentsUI();
  } catch (err) {
    alert("Error al actualizar catálogo en GitHub: " + err.message);
  } finally {
    uploadPhotosGhBtn.disabled = false;
  }
});

// ========================================================
// 6. CREAR MOMENTO
// ========================================================
createAlbumBtn.addEventListener("click", async () => {
  const name = newAlbumName.value.trim();
  const desc = newAlbumDesc.value.trim();

  if (!name) {
    alert("Ingresa un nombre para el momento.");
    return;
  }

  const id = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");

  currentData.albums.push({
    id,
    name,
    description: desc,
    coverUrl: "placeholder.svg",
    photos: []
  });

  newAlbumName.value = "";
  newAlbumDesc.value = "";
  refreshMomentsUI();

  if (ghToken) {
    try {
      await saveAlbumsJsonToGitHub(`Crear nuevo momento: ${name}`);
      showToast(`¡Momento "${name}" creado y guardado en GitHub!`);
    } catch (_) {}
  } else {
    showToast(`¡Momento "${name}" creado localmente!`);
  }
});

// Notificaciones Toast
function showToast(msg) {
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
