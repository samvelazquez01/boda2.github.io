// ========================================================
//  NUESTRO ÁLBUM DE BODA - APP.JS
//  Carga fluida, desplazamiento continuo y descarga en calidad original
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Global state
let albumData = {
  settings: {
    coupleNames: "Samuel & Lisbeth",
    subtitle: "Un amor para toda la vida",
    date: "20 • Noviembre • 2024",
    welcomeMessage: "Gracias por acompañarnos y celebrar el día más feliz de nuestras vidas. Desliza hacia abajo para revivir cada instante con nosotros.",
    coverUrl: ""
  },
  albums: []
};

let currentFilter = "all";
let currentDisplayedPhotos = [];
let currentPhotoIndex = 0;
let likedPhotos = new Set();

// Load liked photos from localStorage
try {
  const savedLikes = localStorage.getItem("boda_liked_photos");
  if (savedLikes) likedPhotos = new Set(JSON.parse(savedLikes));
} catch (e) {
  console.warn("No localStorage access", e);
}

// DOM References
const landingSection = document.getElementById("landing-section");
const viewAlbumBtn = document.getElementById("view-album-btn");
const mainContent = document.getElementById("main-content");

const heroTitle = document.getElementById("hero-title");
const heroSubtitle = document.getElementById("hero-subtitle");
const heroDate = document.getElementById("hero-date");
const headerDesc = document.getElementById("header-desc");

const filterPillsContainer = document.getElementById("filter-pills");
const albumsGrid = document.getElementById("albums-grid");

const gallerySection = document.getElementById("gallery-section");
const galleryGrid = document.getElementById("gallery-grid");
const galleryTitle = document.getElementById("gallery-title");
const gallerySubtitle = document.getElementById("gallery-subtitle");
const galleryDesc = document.getElementById("gallery-desc");

// Lightbox DOM
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxCounter = document.getElementById("lightbox-counter");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");
const lightboxDownload = document.getElementById("lightbox-download");
const lightboxShare = document.getElementById("lightbox-share");
const lightboxFilmstrip = document.getElementById("lightbox-filmstrip");

// Music Player
const musicToggleBtn = document.getElementById("music-toggle-btn");
const weddingAudio = document.getElementById("wedding-audio");
let isAudioPlaying = false;

// ========================================================
// 1. PARTICLE CANVAS (PARTÍCULAS DORADAS FLOTANTES)
// ========================================================
function initParticles() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = Math.min(Math.floor(width / 35), 45);

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.5 + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.6 - 0.2,
      opacity: Math.random() * 0.6 + 0.2,
      fadeSpeed: (Math.random() * 0.01 + 0.005) * (Math.random() > 0.5 ? 1 : -1)
    });
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.opacity += p.fadeSpeed;

      if (p.opacity > 0.85 || p.opacity < 0.15) {
        p.fadeSpeed = -p.fadeSpeed;
      }

      if (p.y < 0) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(247, 231, 180, ${Math.max(0, p.opacity)})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#d4af37";
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// ========================================================
// 2. AUDIO PLAYER
// ========================================================
function initAudio() {
  if (!musicToggleBtn || !weddingAudio) return;

  weddingAudio.volume = 0.35;

  musicToggleBtn.addEventListener("click", () => {
    if (!isAudioPlaying) {
      weddingAudio.play().then(() => {
        isAudioPlaying = true;
        musicToggleBtn.classList.add("playing");
        musicToggleBtn.querySelector(".music-label").textContent = "Pausar";
      }).catch(err => {
        console.log("Audio play blocked by browser:", err);
      });
    } else {
      weddingAudio.pause();
      isAudioPlaying = false;
      musicToggleBtn.classList.remove("playing");
      musicToggleBtn.querySelector(".music-label").textContent = "Música";
    }
  });
}

// ========================================================
// 3. CARGA DE DATOS (LOCAL GITHUB JSON + FIREBASE FALLBACK)
// ========================================================
async function loadData() {
  let loadedFromLocal = false;

  // 1. Intentar cargar data/albums.json (almacenado en GitHub)
  try {
    const res = await fetch("data/albums.json?v=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.albums && data.albums.length > 0) {
        albumData = data;
        loadedFromLocal = true;
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar data/albums.json local, intentando Firebase...", err);
  }

  // 2. Intentar Firebase si no cargó o no hay momentos
  try {
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
    window.db = db;

    try {
      const settingsSnap = await getDoc(doc(db, "meta", "settings"));
      if (settingsSnap.exists() && settingsSnap.data().coverUrl) {
        albumData.settings.coverUrl = settingsSnap.data().coverUrl;
      }
    } catch (_) {}

    if (!loadedFromLocal || albumData.albums.length === 0) {
      const albumsSnap = await getDocs(query(collection(db, "albums"), orderBy("createdAt", "desc")));
      if (!albumsSnap.empty) {
        const photosSnap = await getDocs(query(collection(db, "photos"), orderBy("createdAt", "desc")));
        const fbAlbums = [];

        albumsSnap.forEach(docSnap => {
          const a = docSnap.data();
          const albId = docSnap.id;
          const photos = [];
          photosSnap.forEach(pSnap => {
            const p = pSnap.data();
            if (p.albumId === albId) {
              photos.push({
                id: pSnap.id,
                url: p.url,
                originalUrl: p.originalUrl || p.url,
                title: p.filename || "Momento especial",
                caption: p.caption || ""
              });
            }
          });

          fbAlbums.push({
            id: albId,
            name: a.name,
            description: a.description || `${photos.length} fotografías inolvidables`,
            coverUrl: a.coverUrl || (photos[0] ? photos[0].url : "placeholder.svg"),
            photos: photos
          });
        });

        if (fbAlbums.length > 0) {
          albumData.albums = fbAlbums;
        }
      }
    }
  } catch (err) {
    console.warn("Firebase no disponible. Usando datos locales.", err);
  }

  // Renderizar contenido
  applySettings(albumData.settings);
  renderFilterPills(albumData.albums);
  renderMomentsCards(albumData.albums);
  displayPhotos("all"); // Mostrar todas las fotos por defecto para visualización continua al deslizar
}

// ========================================================
// 4. APLICAR CONFIGURACIONES A HERO & HEADER
// ========================================================
function applySettings(settings) {
  if (!settings) return;

  if (settings.coupleNames) {
    heroTitle.textContent = settings.coupleNames;
    document.title = `Álbum de Boda • ${settings.coupleNames}`;
  }
  if (settings.subtitle) heroSubtitle.textContent = settings.subtitle;
  if (settings.date) heroDate.textContent = settings.date;
  if (settings.welcomeMessage) headerDesc.textContent = settings.welcomeMessage;

  // Imagen de Portada
  if (settings.coverUrl) {
    const busted = settings.coverUrl + (settings.coverUrl.includes("?") ? "&" : "?") + "v=" + Date.now();
    landingSection.style.backgroundImage = `url("${busted}")`;
  } else {
    landingSection.style.backgroundImage = `url("placeholder.svg")`;
  }

  // Canción de Boda (Audio)
  if (settings.musicUrl && weddingAudio) {
    const audioSrc = weddingAudio.querySelector("source");
    if (audioSrc) {
      audioSrc.src = settings.musicUrl;
      weddingAudio.load();
    } else {
      weddingAudio.src = settings.musicUrl;
    }
  }
}

// ========================================================
// 5. PESTAÑAS DE FILTRO (STICKY NAV)
// ========================================================
function renderFilterPills(albums) {
  if (!filterPillsContainer) return;
  filterPillsContainer.innerHTML = "";

  // Botón "Todas las Fotos"
  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill active";
  allBtn.textContent = "Todas las Fotos";
  allBtn.onclick = () => {
    setActivePill(allBtn);
    displayPhotos("all");
    gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  filterPillsContainer.appendChild(allBtn);

  // Botón por cada momento
  albums.forEach(album => {
    const pill = document.createElement("button");
    pill.className = "filter-pill";
    pill.textContent = album.name;
    pill.onclick = () => {
      setActivePill(pill);
      displayPhotos(album.id);
      gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    filterPillsContainer.appendChild(pill);
  });
}

function setActivePill(activeBtn) {
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  activeBtn.classList.add("active");
}

// ========================================================
// 6. RENDERIZAR TARJETAS DE MOMENTOS
// ========================================================
function renderMomentsCards(albums) {
  if (!albumsGrid) return;
  albumsGrid.innerHTML = "";

  if (!albums || albums.length === 0) {
    albumsGrid.innerHTML = `
      <div class="loading">
        <p>Aún no se han agregado momentos al álbum.</p>
        <p style="font-size: 0.95rem; margin-top: 0.5rem; opacity: 0.7;">
          Puedes agregar fotos desde el <a href="admin.html" style="color: var(--gold-dark); text-decoration: underline;">Panel de Administración</a>.
        </p>
      </div>`;
    return;
  }

  albums.forEach(album => {
    const count = (album.photos && album.photos.length) || 0;
    const cover = album.coverUrl || (album.photos && album.photos[0] ? album.photos[0].url : "placeholder.svg");

    const card = document.createElement("div");
    card.className = "album-card";
    card.innerHTML = `
      <img class="album-card-bg" src="${cover}" alt="${album.name}" loading="lazy" onerror="this.src='placeholder.svg'" />
      <div class="album-card-overlay">
        <span class="album-card-badge">${count} ${count === 1 ? 'Fotografía' : 'Fotografías'}</span>
        <h3 class="album-card-title">${album.name}</h3>
        <p class="album-card-desc">${album.description || ''}</p>
        <div class="album-card-footer">
          <span>Ver fotos de este momento</span>
          <span class="album-card-btn">Ver Fotos ↓</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      // Activar pill correspondiente
      document.querySelectorAll(".filter-pill").forEach(p => {
        if (p.textContent === album.name) setActivePill(p);
      });
      displayPhotos(album.id);
      gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    albumsGrid.appendChild(card);
  });
}

// ========================================================
// 7. DESPLIEGUE CONTINUO DE FOTOS (GALERÍA)
// ========================================================
function displayPhotos(albumFilterId = "all") {
  currentFilter = albumFilterId;
  galleryGrid.innerHTML = "";

  if (albumFilterId === "all") {
    // Combinar todas las fotos de todos los momentos
    const all = [];
    albumData.albums.forEach(alb => {
      if (alb.photos) {
        alb.photos.forEach(p => {
          all.push({ ...p, albumName: alb.name });
        });
      }
    });
    currentDisplayedPhotos = all;
    gallerySubtitle.textContent = "Recuerdos Inolvidables";
    galleryTitle.textContent = "Todas las Fotografías";
    galleryDesc.textContent = `Revive los ${all.length} momentos de nuestra boda. Toca cualquier foto para ampliarla o usa el botón ⬇ para descargarla en su calidad original.`;
  } else {
    // Filtrar fotos por momento
    const targetAlbum = albumData.albums.find(a => a.id === albumFilterId);
    if (targetAlbum) {
      currentDisplayedPhotos = (targetAlbum.photos || []).map(p => ({ ...p, albumName: targetAlbum.name }));
      gallerySubtitle.textContent = "Momento de Boda";
      galleryTitle.textContent = targetAlbum.name;
      galleryDesc.textContent = targetAlbum.description || `Colección de ${currentDisplayedPhotos.length} fotos de este momento especial.`;
    } else {
      currentDisplayedPhotos = [];
    }
  }

  if (currentDisplayedPhotos.length === 0) {
    galleryGrid.innerHTML = `<div class="loading">No hay fotografías disponibles en este momento.</div>`;
    return;
  }

  // Renderizar fotos en la cuadrícula
  currentDisplayedPhotos.forEach((photo, index) => {
    const isLiked = likedPhotos.has(photo.id || photo.url);
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.innerHTML = `
      <img class="gallery-item-img" src="${photo.url}" alt="${photo.title || 'Foto de boda'}" loading="lazy" onerror="this.src='placeholder.svg'" />
      <div class="gallery-item-overlay">
        <div class="gallery-item-title">${photo.title || 'Momento especial'}</div>
        <div class="gallery-item-caption">${photo.albumName ? photo.albumName + (photo.caption ? ' • ' + photo.caption : '') : (photo.caption || '')}</div>
      </div>
      <div class="gallery-item-actions">
        <button class="gallery-item-download" title="Descargar en calidad original">⬇</button>
        <button class="gallery-item-heart ${isLiked ? 'liked' : ''}" title="Me encanta">
          ${isLiked ? '❤️' : '🤍'}
        </button>
      </div>
    `;

    // Clic en la foto para abrir en Lightbox
    item.querySelector(".gallery-item-img").onclick = () => openLightbox(index);
    item.querySelector(".gallery-item-overlay").onclick = () => openLightbox(index);

    // Botón de Descarga Directa en Calidad Original
    const downloadBtn = item.querySelector(".gallery-item-download");
    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      downloadOriginalPhoto(photo, index);
    };

    // Botón de Corazón
    const heartBtn = item.querySelector(".gallery-item-heart");
    heartBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLike(photo.id || photo.url, heartBtn);
    };

    galleryGrid.appendChild(item);
  });
}

// ========================================================
// 8. DESCARGA EN CALIDAD ORIGINAL (BLOB DIRECT DOWNLOAD)
// ========================================================
async function downloadOriginalPhoto(photo, index = 0) {
  const targetUrl = photo.originalUrl || photo.url;
  const cleanTitle = (photo.title || `boda-samuel-lisbeth-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-");
  const filename = `${cleanTitle}-calidad-original.jpg`;

  showToast("Iniciando descarga en calidad original... ⏳");

  try {
    // Intentar descarga mediante Blob (fuerza descarga real en móvil y PC)
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error("Error en la respuesta de red");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    showToast("¡Foto descargada en su calidad original! ✅");
  } catch (err) {
    console.warn("Descarga directa de blob no permitida por CORS, abriendo enlace directo...", err);
    // Fallback: abrir y descargar directamente
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("¡Descarga iniciada! ✅");
  }
}

// ========================================================
// 9. SISTEMA DE CORAZONES (REACCIONES)
// ========================================================
function toggleLike(photoKey, btn) {
  if (likedPhotos.has(photoKey)) {
    likedPhotos.delete(photoKey);
    btn.classList.remove("liked");
    btn.textContent = "🤍";
  } else {
    likedPhotos.add(photoKey);
    btn.classList.add("liked");
    btn.textContent = "❤️";
    showToast("¡Te ha gustado esta foto! ❤️");
  }

  try {
    localStorage.setItem("boda_liked_photos", JSON.stringify([...likedPhotos]));
  } catch (_) {}
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2800);
}

// ========================================================
// 10. LIGHTBOX 2.0 (MODAL DE PANTALLA COMPLETA)
// ========================================================
function openLightbox(index) {
  if (!currentDisplayedPhotos || currentDisplayedPhotos.length === 0) return;
  currentPhotoIndex = index;
  updateLightboxContent();
  renderFilmstrip();
  lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  document.body.style.overflow = "";
}

function updateLightboxContent() {
  const photo = currentDisplayedPhotos[currentPhotoIndex];
  if (!photo) return;

  lightboxImg.src = photo.url;
  lightboxTitle.textContent = photo.title || "Momento de Boda";
  lightboxCounter.textContent = `${currentPhotoIndex + 1} de ${currentDisplayedPhotos.length}`;

  const thumbs = lightboxFilmstrip.querySelectorAll(".lightbox-thumb");
  thumbs.forEach((t, i) => {
    t.classList.toggle("active", i === currentPhotoIndex);
    if (i === currentPhotoIndex) {
      t.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  });
}

function renderFilmstrip() {
  lightboxFilmstrip.innerHTML = "";
  currentDisplayedPhotos.forEach((photo, i) => {
    const thumb = document.createElement("div");
    thumb.className = `lightbox-thumb ${i === currentPhotoIndex ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${photo.url}" alt="" loading="lazy" onerror="this.src='placeholder.svg'" />`;
    thumb.onclick = () => {
      currentPhotoIndex = i;
      updateLightboxContent();
    };
    lightboxFilmstrip.appendChild(thumb);
  });
}

function prevPhoto() {
  if (currentPhotoIndex > 0) {
    currentPhotoIndex--;
  } else {
    currentPhotoIndex = currentDisplayedPhotos.length - 1;
  }
  updateLightboxContent();
}

function nextPhoto() {
  if (currentPhotoIndex < currentDisplayedPhotos.length - 1) {
    currentPhotoIndex++;
  } else {
    currentPhotoIndex = 0;
  }
  updateLightboxContent();
}

// Botón de Descarga en el Lightbox (Calidad Original)
lightboxDownload.addEventListener("click", () => {
  const photo = currentDisplayedPhotos[currentPhotoIndex];
  if (photo) {
    downloadOriginalPhoto(photo, currentPhotoIndex);
  }
});

// Botón de Compartir
lightboxShare.addEventListener("click", async () => {
  const photo = currentDisplayedPhotos[currentPhotoIndex];
  if (!photo) return;

  const shareUrl = photo.originalUrl || photo.url;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Boda Samuel & Lisbeth",
        text: `Mira esta hermosa foto de la boda: ${photo.title || ''}`,
        url: shareUrl
      });
    } catch (_) {}
  } else {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Enlace copiado al portapapeles 📋");
    } catch (_) {
      showToast("Enlace: " + shareUrl);
    }
  }
});

// Eventos de Navegación del Lightbox
lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", prevPhoto);
lightboxNext.addEventListener("click", nextPhoto);

window.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") prevPhoto();
  if (e.key === "ArrowRight") nextPhoto();
});

// Gestos táctiles de deslizamiento (Swipe) en móvil
let touchStartX = 0;
let touchEndX = 0;

lightbox.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

lightbox.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchEndX - touchStartX;
  if (Math.abs(diff) > 50) {
    if (diff < 0) nextPhoto();
    else prevPhoto();
  }
}, { passive: true });

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox || e.target.classList.contains("lightbox-body")) {
    closeLightbox();
  }
});

// ========================================================
// 11. PANTALLA DE BIENVENIDA Y TRANSICIÓN AL ÁLBUM
// ========================================================
function showAlbum() {
  document.body.classList.remove("on-landing");
  landingSection.style.display = "none";
  mainContent.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLanding() {
  mainContent.classList.add("hidden");
  landingSection.style.display = "flex";
  document.body.classList.add("on-landing");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

viewAlbumBtn.addEventListener("click", showAlbum);

const returnLandingBtn = document.getElementById("return-landing-btn");
if (returnLandingBtn) returnLandingBtn.addEventListener("click", showLanding);

const footerReturnBtn = document.getElementById("footer-return-btn");
if (footerReturnBtn) footerReturnBtn.addEventListener("click", showLanding);

// ========================================================
// 12. INICIALIZACIÓN
// ========================================================
window.addEventListener("DOMContentLoaded", () => {
  // Asegurar que solo la portada está activa inicialmente
  showLanding();
  initParticles();
  initAudio();
  loadData();
});
