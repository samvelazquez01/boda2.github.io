// ===============================
//  ADMIN.JS FINAL CORREGIDO
// ===============================

// Firebase imports (modular)
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Bytescale config
const BYTESCALE_API_KEY = "public_W23MTTM2dP5F5CY6XxYF4PbqaZDg";
const BYTESCALE_WIDGET_URL = "https://js.bytescale.com/upload-widget/v4";

// Firebase DB
const db = window.db;
if (!db) alert("Firebase no está inicializado correctamente.");

// UI elements
const albumNameInput = document.getElementById("album-name-input");
const createAlbumBtn = document.getElementById("create-album-btn");
const albumsList = document.getElementById("albums-list");
const albumSelect = document.getElementById("album-select");
const filterAlbumSelect = document.getElementById("filter-album-select");
const photosList = document.getElementById("photos-list");
const uploadArea = document.getElementById("upload-area");
const coverPreview = document.getElementById("cover-preview");
const deleteCoverBtn = document.getElementById("delete-cover-btn");
const uploadProgress = document.getElementById("upload-progress");
const progressFill = document.querySelector(".progress-fill");
const progressText = document.querySelector(".progress-text");


// =======================================================
//   UTILIDADES
// =======================================================

function showProgress(percent, text) {
  uploadProgress.classList.remove("hidden");
  progressFill.style.width = percent + "%";
  progressText.textContent = text || percent + "%";

  if (percent >= 100) {
    setTimeout(() => uploadProgress.classList.add("hidden"), 600);
  }
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function logError(tag, err) {
  console.error(`[${tag}]`, err);
  alert(err.message || "Error desconocido");
}


// =======================================================
//   BYTESCALE WIDGET
// =======================================================

function loadBytescaleWidget() {
  return new Promise((resolve, reject) => {
    if (window.Bytescale && window.Bytescale.UploadWidget) {
      return resolve();
    }

    const script = document.createElement("script");
    script.src = BYTESCALE_WIDGET_URL;
    script.onload = () => {
      if (window.Bytescale && window.Bytescale.UploadWidget) resolve();
      else reject("Bytescale no cargó correctamente.");
    };
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function openBytescaleUpload({ multi = false } = {}) {
  await loadBytescaleWidget();

  return await window.Bytescale.UploadWidget.open({
    apiKey: BYTESCALE_API_KEY,
    multi,
    maxFileSizeBytes: 500 * 1024 * 1024, // 500MB
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/x-sony-arw",      // RAW Sony
      "application/octet-stream" // RAW genérico
    ]
  });
}


// =======================================================
//   PORTADA
// =======================================================

const settingsDoc = doc(db, "meta", "settings");

async function loadCover() {
  const snap = await getDoc(settingsDoc);
  const data = snap.exists() ? snap.data() : {};

  renderCover(data.coverUrl || "");
}

function renderCover(url) {
  clearElement(coverPreview);

  if (!url) {
    const span = document.createElement("span");
    span.textContent = "Sin portada";
    span.className = "cover-placeholder";
    coverPreview.appendChild(span);
    deleteCoverBtn.classList.add("hidden");
    return;
  }

  const img = document.createElement("img");
  img.src = url + "?v=" + Date.now();
  coverPreview.appendChild(img);

  deleteCoverBtn.classList.remove("hidden");
}

// Subir portada
document
  .querySelector("label[for='cover-input']")
  .addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      const files = await openBytescaleUpload({ multi: false });
      if (!files.length) return;

      const f = files[0];

      const url = f.fileUrl;

      await setDoc(
        settingsDoc,
        { coverUrl: url },
        { merge: true }
      );

      renderCover(url);

      alert("Portada actualizada.");
    } catch (err) {
      logError("SUBIR PORTADA", err);
    }
  });

// Borrar portada
deleteCoverBtn.onclick = async () => {
  if (!confirm("¿Eliminar portada?")) return;

  try {
    await updateDoc(settingsDoc, { coverUrl: "" });
    renderCover("");
  } catch (err) {
    logError("BORRAR PORTADA", err);
  }
};


// =======================================================
//   CREAR ÁLBUM
// =======================================================

createAlbumBtn.addEventListener("click", async () => {
  const name = albumNameInput.value.trim();
  if (!name) return alert("Escribe un nombre para el momento.");

  try {
    await addDoc(collection(db, "albums"), {
      name,
      createdAt: serverTimestamp(),
      count: 0
    });

    albumNameInput.value = "";
  } catch (err) {
    logError("CREAR ALBUM", err);
  }
});


// =======================================================
//   SUBIR FOTOS
// =======================================================

uploadArea.addEventListener("click", async () => {
  const albumId = albumSelect.value;
  if (!albumId) return alert("Selecciona un momento primero.");

  try {
    const files = await openBytescaleUpload({ multi: true });
    if (!files.length) return;

    let i = 0;

    for (const f of files) {
      i++;

      const finalName =
        f.originalFileName ||
        f.fileName ||
        f.fileUrl.split("/").pop() ||
        "archivo";

      await addDoc(collection(db, "photos"), {
        albumId,
        url: f.fileUrl,
        filename: finalName,
        createdAt: serverTimestamp()
      });

      showProgress(10 + (i / files.length) * 80, `Subiendo ${i}/${files.length}`);
    }

    showProgress(100, "Completado");
    alert("Fotos subidas correctamente.");
  } catch (err) {
    logError("SUBIR FOTOS", err);
  }
});


// =======================================================
//   ELIMINAR FOTO
// =======================================================

async function deletePhoto(photoId) {
  if (!confirm("¿Eliminar esta foto? No se borra de Bytescale.")) return;

  try {
    await deleteDoc(doc(db, "photos", photoId));
  } catch (err) {
    logError("BORRAR FOTO", err);
  }
}


// =======================================================
//   REALTIME ALBUMS + PHOTOS
// =======================================================

function renderAlbums(albums) {
  clearElement(albumsList);
  clearElement(albumSelect);
  clearElement(filterAlbumSelect);

  const opt1 = document.createElement("option");
  opt1.value = "";
  opt1.textContent = "Selecciona un momento";
  albumSelect.appendChild(opt1);

  const opt2 = document.createElement("option");
  opt2.value = "";
  opt2.textContent = "Todos los momentos";
  filterAlbumSelect.appendChild(opt2);

  albums.forEach((a) => {
    // admin list
    const item = document.createElement("div");
    item.className = "album-item";

    item.innerHTML = `
      <div class="album-item-name">${a.name}</div>
      <div class="album-item-right">
        <span class="album-item-count">${a.count || 0} fotos</span>
        <button class="create-btn" data-id="${a.id}">Abrir</button>
      </div>
    `;

    item.querySelector("button").onclick = () => {
      filterAlbumSelect.value = a.id;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };

    albumsList.appendChild(item);

    // selects
    const o1 = document.createElement("option");
    o1.value = a.id;
    o1.textContent = a.name;
    albumSelect.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = a.id;
    o2.textContent = a.name;
    filterAlbumSelect.appendChild(o2);
  });
}

function renderPhotos(photos) {
  clearElement(photosList);

  if (!photos.length) {
    const d = document.createElement("div");
    d.className = "loading";
    d.textContent = "No hay fotos.";
    photosList.appendChild(d);
    return;
  }

  photos.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "photo-item";

    if (p.filename.match(/\.(arw|ARW)$/)) {
      wrap.innerHTML = `
        <a href="${p.url}" target="_blank" class="raw-download">
          Archivo RAW – Descargar
        </a>
      `;
    } else {
      const img = document.createElement("img");
      img.src = p.url + "?v=" + Date.now();
      wrap.appendChild(img);
    }

    const del = document.createElement("button");
    del.className = "photo-delete-btn";
    del.textContent = "Eliminar";
    del.onclick = () => deletePhoto(p.id);

    wrap.appendChild(del);
    photosList.appendChild(wrap);
  });
}

// Listen albums
onSnapshot(
  query(collection(db, "albums"), orderBy("createdAt", "desc")),
  (snap) => {
    const albums = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAlbums(albums);
  }
);

// Listen photos + auto-filter
onSnapshot(
  query(collection(db, "photos"), orderBy("createdAt", "desc")),
  (snap) => {
    const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const filterId = filterAlbumSelect.value;
    const filtered = filterId ? photos.filter((p) => p.albumId === filterId) : photos;

    renderPhotos(filtered);
    updateCounts(photos);
  }
);


// =======================================================
//   ACTUALIZAR CONTADOR DEL ÁLBUM
// =======================================================

async function updateCounts(allPhotos) {
  const counts = {};

  allPhotos.forEach((p) => {
    counts[p.albumId] = (counts[p.albumId] || 0) + 1;
  });

  const albumDocs = await getDocs(collection(db, "albums"));

  albumDocs.forEach((aDoc) => {
    const id = aDoc.id;
    const newCount = counts[id] || 0;

    if (aDoc.data().count !== newCount) {
      updateDoc(doc(db, "albums", id), { count: newCount });
    }
  });
}


// =======================================================
//   INIT
// =======================================================

loadCover();
console.log("[ADMIN] Listo.");
