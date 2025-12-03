# Álbum de Boda (Bytescale + Firebase)

Galería de fotos con portada dinámica, álbumes y subida directa desde Bytescale.

## Tecnologías
- Bytescale UploadWidget (subida de imágenes sin backend)
- Firebase Firestore (álbumes, fotos y portada)
- HTML / CSS / JS

## Funciones
- Cambiar portada (se guarda en Firestore)
- Crear álbumes
- Subir fotos a cada álbum
- Eliminar fotos (borra registro en Firestore)
- Página pública sincronizada en tiempo real

## Notas
Si se migró desde otro sistema (Drive/Storage), borrar colecciones:
- `albums`
- `photos`
- Documento `meta/settings`

La portada y las fotos nuevas se reflejan al instante.
