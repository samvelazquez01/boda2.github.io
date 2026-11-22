// ========================================================
//  NUESTRO ÁLBUM DE BODA - APP.JS
//  Sincronización en tiempo real con Firebase y Almacenamiento
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// Estado global
let albumSettings = {
  coupleNames: "Samuel & Lisbeth",
  subtitle: "Nuestra Boda • Un Amor Para Siempre",
  date: "20 • Noviembre • 2024",
  welcomeMessage: "Gracias por acompañarnos y celebrar el día más feliz de nuestras vidas.",
  coverUrl: "placeholder.svg"
};

let albumsMap = new Map();
let allPhotosList = [];
let activeMomentId = null;
let currentDisplayedPhotos = [];
let currentPhotoIndex = 0;
let likedPhotos = new Set();

// Cargar "Me gusta" guardados
try {
  const savedLikes = localStorage.getItem("boda_liked_photos");
  if (savedLikes) likedPhotos = new Set(JSON.parse(savedLikes));
} catch (_) {}

// DOM References
const landingSection = document.getElementById("landing-section");
const viewAlbumBtn = document.getElementById("view-album-btn");
const mainContent = document.getElementById("main-content");
const returnLandingBtn = document.getElementById("return-landing-btn");
const footerReturnBtn = document.getElementById("footer-return-btn");

const heroTitle = document.getElementById("hero-title");
const heroSubtitle = document.getElementById("hero-subtitle");
const heroDate = document.getElementById("hero-date");
const headerDesc = document.getElementById("header-desc");

const albumsSection = document.getElementById("albums-section");
const albumsGrid = document.getElementById("albums-grid");

const momentDetailView = document.getElementById("moment-detail-view");
const backToMomentsBtn = document.getElementById("back-to-moments-btn");
const momentDetailTitle = document.getElementById("moment-detail-title");
const momentDetailDesc = document.getElementById("moment-detail-desc");
const momentDetailCount = document.getElementById("moment-detail-count");
const galleryGrid = document.getElementById("gallery-grid");

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

// ========================================================
// 1. PARTÍCULAS DORADAS DE FONDO
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
// 2. SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
// ========================================================
function initRealtimeData() {
  // Carga instantánea desde localStorage (0ms de espera)
  const localCover = localStorage.getItem("boda_cover_url");
  if (localCover) setLandingCover(localCover);

  const localBanner = localStorage.getItem("boda_banner_url") || localCover;
  if (localBanner) setHeaderBanner(localBanner);

  const localNames = localStorage.getItem("boda_names");
  if (localNames) {
    heroTitle.textContent = localNames;
    document.title = `Álbum de Boda • ${localNames}`;
  }

  // 1. Escuchar portada y nombres en tiempo real
  const settingsDoc = doc(db, "meta", "settings");
  onSnapshot(settingsDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.coverUrl) {
        albumSettings.coverUrl = data.coverUrl;
        try { localStorage.setItem("boda_cover_url", data.coverUrl); } catch (_) {}
        setLandingCover(data.coverUrl);
        if (!data.headerBannerUrl && !localStorage.getItem("boda_banner_url")) {
          setHeaderBanner(data.coverUrl);
        }
      }
      if (data.headerBannerUrl) {
        setHeaderBanner(data.headerBannerUrl);
        try { localStorage.setItem("boda_banner_url", data.headerBannerUrl); } catch (_) {}
      }
      if (data.coupleNames) {
        albumSettings.coupleNames = data.coupleNames;
        heroTitle.textContent = data.coupleNames;
        document.title = `Álbum de Boda • ${data.coupleNames}`;
        try { localStorage.setItem("boda_names", data.coupleNames); } catch (_) {}
      }
      if (data.subtitle) {
        albumSettings.subtitle = data.subtitle;
        heroSubtitle.textContent = data.subtitle;
      }
      if (data.date) {
        albumSettings.date = data.date;
        heroDate.textContent = data.date;
      }
      if (data.welcomeMessage) {
        headerDesc.textContent = data.welcomeMessage;
      }
    }
  });

  // 2. Escuchar momentos (álbumes) en tiempo real
  const albumsQuery = query(collection(db, "albums"), orderBy("createdAt", "desc"));
  onSnapshot(albumsQuery, (snap) => {
    if (!snap.empty) {
      albumsMap.clear();
      snap.forEach((docSnap) => {
        const a = docSnap.data();
        a.id = docSnap.id;
        a.photos = [];
        albumsMap.set(a.id, a);
      });

      renderMomentsCards();
    }
  });

  // 3. Escuchar fotos en tiempo real
  const photosQuery = query(collection(db, "photos"), orderBy("createdAt", "desc"));
  onSnapshot(photosQuery, (snap) => {
    if (!snap.empty) {
      allPhotosList = [];

      // Limpiar fotos dentro de cada momento
      albumsMap.forEach((alb) => { alb.photos = []; });

      snap.forEach((docSnap) => {
        const p = docSnap.data();
        p.id = docSnap.id;
        allPhotosList.push(p);

        if (albumsMap.has(p.albumId)) {
          albumsMap.get(p.albumId).photos.push(p);
        }
      });

      renderMomentsCards();
    }
  });

  // Cargar datos por defecto de data/albums.json si Firebase tarda
  loadLocalJsonFallback();
}

async function loadLocalJsonFallback() {
  try {
    const res = await fetch("data/albums.json?v=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        const savedCover = localStorage.getItem("boda_cover_url");
        if (!savedCover && data.settings.coverUrl && data.settings.coverUrl !== "photos/portada.jpg") {
          setLandingCover(data.settings.coverUrl);
        }
        if (!localStorage.getItem("boda_names") && data.settings.coupleNames) {
          heroTitle.textContent = data.settings.coupleNames;
        }
        if (!localStorage.getItem("boda_banner_url")) {
          if (data.settings.headerBannerUrl) {
            setHeaderBanner(data.settings.headerBannerUrl);
          } else if (data.settings.coverUrl) {
            setHeaderBanner(data.settings.coverUrl);
          }
        }
      }

      // Si Firestore aún no tiene momentos ni fotos, cargar de albums.json
      if (albumsMap.size === 0 && Array.isArray(data.albums)) {
        data.albums.forEach((a) => {
          albumsMap.set(a.id, a);
          if (Array.isArray(a.photos)) {
            a.photos.forEach((p) => {
              p.albumId = a.id;
              allPhotosList.push(p);
            });
          }
        });
        renderMomentsCards();
      }
    }
  } catch (_) {}
}

function setHeaderBanner(url) {
  if (!url || url === "placeholder.svg") return;
  const headerBgImg = document.getElementById("header-bg-img");
  if (headerBgImg) {
    headerBgImg.src = url;
    headerBgImg.style.display = "block";
  }
}

function setLandingCover(url) {
  if (!url || url === "photos/portada.jpg" || url === "placeholder.svg") {
    const saved = localStorage.getItem("boda_cover_url");
    if (saved && saved !== url) {
      url = saved;
    } else {
      return;
    }
  }

  const coverImg = document.getElementById("landing-cover-img");
  if (coverImg) {
    coverImg.src = url;
    coverImg.style.display = "block";
  }

  if (landingSection) {
    landingSection.style.backgroundImage = `url("${url}")`;
    landingSection.style.backgroundSize = "cover";
    landingSection.style.backgroundPosition = "center center";
    landingSection.style.backgroundRepeat = "no-repeat";
  }
}

// ========================================================
// 4. COLECCIÓN DE MOMENTOS Y ÁLBUM DEDICADO
// ========================================================
function renderMomentsCards() {
  albumsGrid.innerHTML = "";

  if (albumsMap.size === 0) {
    albumsGrid.innerHTML = '<div class="loading">Cargando momentos inolvidables...</div>';
    return;
  }

  // Ordenar los momentos según la prioridad configurada en el Admin (campo order)
  const sortedAlbums = Array.from(albumsMap.values()).sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : 999;
    const orderB = typeof b.order === "number" ? b.order : 999;
    if (orderA !== orderB) return orderA - orderB;
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  sortedAlbums.forEach((album) => {
    const count = (album.photos && album.photos.length) || 0;
    const cover = (album.photos && album.photos[0] ? (album.photos[0].url || album.photos[0].originalUrl) : album.coverUrl) || "placeholder.svg";

    const card = document.createElement("div");
    card.className = "album-card";
    card.innerHTML = `
      <img class="album-card-bg" src="${cover}" alt="${album.name}" loading="lazy" decoding="async" onerror="this.src='placeholder.svg'" />
      <div class="album-card-overlay">
        <span class="album-card-badge">${count} ${count === 1 ? 'Fotografía' : 'Fotografías'}</span>
        <h3 class="album-card-title">${album.name}</h3>
        <p class="album-card-desc">${album.description || ''}</p>
        <div class="album-card-footer">
          <span>Ver este capítulo</span>
          <span class="album-card-btn">Abrir Momento ✨ →</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      openMoment(album.id);
    };

    albumsGrid.appendChild(card);
  });

  // Si hay un momento abierto actualmente, actualizar sus fotos en tiempo real
  if (activeMomentId && albumsMap.has(activeMomentId)) {
    const activeAlb = albumsMap.get(activeMomentId);
    momentDetailCount.textContent = `${activeAlb.photos ? activeAlb.photos.length : 0} Fotografías`;
    renderMomentPhotos(activeAlb.photos || []);
  }
}

// Abrir un Momento Dedicado (Experiencia Inmersiva)
function openMoment(albumId) {
  const album = albumsMap.get(albumId);
  if (!album) return;

  activeMomentId = albumId;
  const count = (album.photos && album.photos.length) || 0;

  momentDetailTitle.textContent = album.name;
  momentDetailDesc.textContent = album.description || "Colección especial de este momento.";
  momentDetailCount.textContent = `${count} ${count === 1 ? 'Fotografía' : 'Fotografías'}`;

  renderMomentPhotos(album.photos || []);

  albumsSection.classList.add("hidden");
  momentDetailView.classList.remove("hidden");
  momentDetailView.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Volver al Catálogo de Momentos
function closeMoment() {
  activeMomentId = null;
  momentDetailView.classList.add("hidden");
  albumsSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (backToMomentsBtn) {
  backToMomentsBtn.addEventListener("click", closeMoment);
}

// ========================================================
// 5. GALERÍA DE FOTOS DENTRO DEL MOMENTO (ALTA CALIDAD & DESCARGA)
// ========================================================
function renderMomentPhotos(photos) {
  galleryGrid.innerHTML = "";
  currentDisplayedPhotos = photos || [];

  if (currentDisplayedPhotos.length === 0) {
    galleryGrid.innerHTML = `
      <div class="loading" style="grid-column: 1 / -1; padding: 4rem 1rem;">
        ✨ Aún no se han añadido fotografías a este momento.
      </div>
    `;
    return;
  }

  currentDisplayedPhotos.forEach((photo, index) => {
    const isLiked = likedPhotos.has(photo.id || photo.url);
    const item = document.createElement("div");
    item.className = "gallery-item";
    const displayUrl = photo.url || photo.originalUrl;
    const downloadUrl = photo.originalUrl || photo.url;

    item.innerHTML = `
      <img class="gallery-item-img" src="${displayUrl}" alt="${photo.filename || 'Foto de boda'}" loading="lazy" decoding="async" onerror="this.src='placeholder.svg'" />
      <div class="gallery-item-overlay">
        <div class="gallery-item-title">${photo.filename || 'Momento especial'}</div>
      </div>
      <div class="gallery-item-actions">
        <button class="gallery-item-download" title="Descargar en calidad original">⬇</button>
        <button class="gallery-item-heart ${isLiked ? 'liked' : ''}" title="Me encanta">
          ${isLiked ? '❤️' : '🤍'}
        </button>
      </div>
    `;

    // Abrir visor de pantalla completa (navega por las fotos de este momento)
    item.querySelector(".gallery-item-img").onclick = () => openLightbox(index);
    item.querySelector(".gallery-item-overlay").onclick = () => openLightbox(index);

    // Botón de Descarga Directa en máxima calidad original (48MP)
    item.querySelector(".gallery-item-download").onclick = (e) => {
      e.stopPropagation();
      downloadPhoto(downloadUrl, photo.filename || `foto-boda-${index + 1}`);
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

// Descarga en Alta Calidad
async function downloadPhoto(url, name = "foto-boda") {
  showToast("Iniciando descarga en alta calidad... ⏳");
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${name}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    showToast("¡Foto descargada en alta calidad! ✅");
  } catch (_) {
    // Fallback directo
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("¡Descarga iniciada! ✅");
  }
}

// Reacciones
function toggleLike(key, btn) {
  if (likedPhotos.has(key)) {
    likedPhotos.delete(key);
    btn.classList.remove("liked");
    btn.textContent = "🤍";
  } else {
    likedPhotos.add(key);
    btn.classList.add("liked");
    btn.textContent = "❤️";
    showToast("¡Te ha gustado esta foto! ❤️");
  }

  try {
    localStorage.setItem("boda_liked_photos", JSON.stringify([...likedPhotos]));
  } catch (_) {}
}

// ========================================================
// 6. LIGHTBOX 2.0 (MODAL DE PANTALLA COMPLETA)
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

  lightboxImg.decoding = "async";
  lightboxImg.src = photo.url || photo.originalUrl;
  lightboxTitle.textContent = photo.filename || "Momento de Boda";
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
    const thumbUrl = photo.thumbUrl || photo.url || photo.originalUrl;
    thumb.innerHTML = `<img src="${thumbUrl}" alt="" loading="lazy" decoding="async" onerror="this.src='placeholder.svg'" />`;
    thumb.onclick = () => {
      currentPhotoIndex = i;
      updateLightboxContent();
    };
    lightboxFilmstrip.appendChild(thumb);
  });
}

function prevPhoto() {
  if (currentPhotoIndex > 0) currentPhotoIndex--;
  else currentPhotoIndex = currentDisplayedPhotos.length - 1;
  updateLightboxContent();
}

function nextPhoto() {
  if (currentPhotoIndex < currentDisplayedPhotos.length - 1) currentPhotoIndex++;
  else currentPhotoIndex = 0;
  updateLightboxContent();
}

lightboxDownload.addEventListener("click", () => {
  const photo = currentDisplayedPhotos[currentPhotoIndex];
  if (photo) {
    downloadPhoto(photo.originalUrl || photo.url, photo.filename || `foto-boda-${currentPhotoIndex + 1}`);
  }
});

lightboxShare.addEventListener("click", async () => {
  const photo = currentDisplayedPhotos[currentPhotoIndex];
  if (!photo) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Boda Samuel & Lisbeth",
        text: `Mira esta foto de la boda: ${photo.filename || ''}`,
        url: photo.url
      });
    } catch (_) {}
  } else {
    try {
      await navigator.clipboard.writeText(photo.url);
      showToast("Enlace copiado al portapapeles 📋");
    } catch (_) {}
  }
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", prevPhoto);
lightboxNext.addEventListener("click", nextPhoto);

window.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") prevPhoto();
  if (e.key === "ArrowRight") nextPhoto();
});

// Deslizamiento táctil en celular
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
// 7. BLOQUEO DE PORTADA Y TRANSICIÓN
// ========================================================
function showAlbum() {
  document.body.classList.remove("on-landing");
  landingSection.style.display = "none";
  mainContent.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLanding() {
  closeMoment();
  mainContent.classList.add("hidden");
  landingSection.style.display = "flex";
  document.body.classList.add("on-landing");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

viewAlbumBtn.addEventListener("click", showAlbum);
if (returnLandingBtn) returnLandingBtn.addEventListener("click", showLanding);
if (footerReturnBtn) footerReturnBtn.addEventListener("click", showLanding);

function showToast(msg) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2800);
}

// Inicialización
window.addEventListener("DOMContentLoaded", () => {
  showLanding();
  initParticles();
  initRealtimeData();
});
