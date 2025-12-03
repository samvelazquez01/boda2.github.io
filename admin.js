// ===============================
//  ADMIN.JS FINAL DEFINITIVO
// ===============================

// FIREBASE (versión modular)
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


// BYTESCALE
const BYTESCALE_API_KEY = "public_W23MTTM2dP5F5CY6XxYF4PbqaZDg";
const BYTESCALE_WIDGET_SRC = "https://js.bytescale.com/upload-widget/v4";


// FIREBASE DB (viene desde admin.html)
const db = window.db;
if (!db) alert("Firebase no está inicializado.");


// UI ELEMENTS
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


// ===================================================
//   UTILIDADES
// ===================================================

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

function logError(context, err) {
  console.error(`[${context}]`, err);
  alert(err?.message || "Error desconocido.");
}


// ===================================================
//   BYTESCALE WIDGET
// ===================================================

function loadBytescaleWidget() {
  return new Promise((resolve, reject) => {
    if (window.Bytescale && window.Bytescale.UploadWidget) {
      return resolve();
    }

    const s = document.createElement("script");
    s.src = BYTESCALE_WIDGET_SRC;
    s.onload = () => {
      if (window.Bytescale && window.Bytescale.UploadWidget) resolve();
      else reject("Bytescale no cargó correctamente.");
    };
    s.onerror = reject;
    document.head.appendChild(s);
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
      "image/x-sony-arw",         // RAW Sony
      "application/octet-stream"  // RAW genérico
    ]
  });
}


// ===================================================
//   PORTADA
// ===================================================

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
    span.className = "cover-placeholder";
    span.textContent = "Sin portada";
    coverPreview.appendChild(span);
    deleteCoverBtn.classList.add("hidden");
    return;
  }

  const img = document.createElement("img");
  img.src = url + "?v=" + Date.now();
  coverPreview.appendChild(img);

  deleteCoverBtn.classList.remove("hidden");
}


// seleccionar portada -> Bytescale
document
  .querySelector("label[for='cover-input']")
  .addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      const files = await openBytescaleUpload({ multi: false });
      if (!files.length) return;

      const f = files[0];
      const url = f.fileUrl;

      await setDoc(settingsDoc, { coverUrl: url }, { merge: true });

      renderCover(url);
      alert("Portada actualizada.");
    } catch (err) {
      logError("SUBIR PORTADA", err);
    }
  });


// borrar portada
deleteCoverBtn.onclick = async () => {
  if (!confirm("¿Eliminar portada?")) return;

  try {
    await updateDoc(settingsDoc, { coverUrl: "" });
    renderCover("");
  } catch (err) {
    logError("BORRAR PORTADA", err);
  }
};


// ===================================================
//   CREAR ÁLBUM
// ===================================================

createAlbumBtn.addEventListener("click", async () => {
  const name = albumNameInput.value.trim();
  if (!name) return alert("Escribe un nombre.");

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


// ===================================================
//   SUBIR FOTOS (FIJO FINAL)
// ===================================================

uploadArea.addEventListener("click", async () => {
  const albumId = albumSelect.value;
  if (!albumId) return alert("Selecciona un álbum.");

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

      showProgress(5 + (i / files.length) * 90, `Subiendo ${i}/${files.length}`);
    }

    showProgress(100, "Completado");
    alert("Fotos subidas correctamente.");
  } catch (err) {
    logError("SUBIR FOTOS", err);
  }
});


// ===================================================
//   BORRAR FOTO
// ===================================================

async function deletePhoto(photoId) {
  if (!confirm("¿Eliminar foto?")) return;

  try {
    await deleteDoc(doc(db, "photos", photoId));
  } catch (err) {
    logError("BORRAR FOTO", err);
  }
}


// ===================================================
//   RENDERING (ALBUMS + PHOTOS)
// ===================================================

function renderAlbums(albums) {
  clearElement(albumsList);
  clearElement(albumSelect);
  clearElement(filterAlbumSelect);

  // opciones iniciales
  const optA = document.createElement("option");
  optA.value = "";
  optA.textContent = "Selecciona un momento";
  albumSelect.appendChild(optA);

  const optB = document.createElement("option");
  optB.value = "";
  optB.textContent = "Todos los momentos";
  filterAlbumSelect.appendChild(optB);

  albums.forEach((a) => {
    // lista admin
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

    // PREVIEW RAW
    if (p.filename.toLowerCase().endsWith(".arw")) {
      wrap.innerHTML = `
        <a href="${p.url}" class="raw-download" target="_blank">
          Descargar RAW
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


// ===================================================
//   REALTIME FIRESTORE
// ===================================================

// Albums
onSnapshot(
  query(collection(db, "albums"), orderBy("createdAt", "desc")),
  (snap) => {
    const albums = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAlbums(albums);
  }
);

// Photos
onSnapshot(
  query(collection(db, "photos"), orderBy("createdAt", "desc")),
  (snap) => {
    const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const filterId = filterAlbumSelect.value;
    const filtered = filterId
      ? photos.filter((p) => p.albumId === filterId)
      : photos;

    renderPhotos(filtered);

    updateAlbumCounts(photos);
  }
);


// ===================================================
//   CONTADOR DE FOTOS POR ÁLBUM
// ===================================================

async function updateAlbumCounts(allPhotos) {
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


// ===================================================
//   INIT
// ===================================================

loadCover();
console.log("ADMIN listo.");
