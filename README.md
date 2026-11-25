# Leonida FM

**Your World. Your Frequency.**

Radio web personal y gratuita. Sintoniza **Leonida Radio** en Spotify o añade tus propias estaciones con playlists de Spotify o mixes, videos y playlists de YouTube. Las estaciones se guardan en el navegador y cada una tiene un enlace que puedes compartir.

> Unofficial fan-made project. Not affiliated with Rockstar Games or Take-Two Interactive.

## Ejecutar en local

Usa Node.js 22.13 o posterior de la rama 22, o Node.js 24 o superior. El proyecto incluye `.nvmrc` para usar Node.js 22 con `nvm`.

```sh
npm ci
npm run dev
```

Abre [localhost:3000](http://localhost:3000). Elige Spotify o YouTube encima del dial para ver las estaciones de esa plataforma. En «Mis estaciones» puedes añadir un enlace y guardar una estación personalizada. Usa los controles del reproductor para escucharla.

En pantallas compatibles, el recorrido costero aparece cuando la escena 3D está lista. Usa «Pausar paisaje» para detener la avenida y «Abrir radio» para desplegar el dial. Al volver al volante, el recorrido continúa desde la misma posición si estaba en marcha. La radio se abre directamente en móvil y cuando la escena 3D está cargando, no cabe o no se puede mostrar.

## Verificar y compilar

```sh
npm test           # Validación, enlaces compartidos y recuperación de datos
npm run typecheck  # TypeScript sin emitir archivos
npm run lint       # ESLint
npm run build      # Exportación estática de producción a out/
```

## Contribuir

Si quieres aportar a Leonida FM, haz un fork en GitHub, clónalo y crea una rama desde `main`. Cada PR puede resolver un problema concreto o sumar una mejora pequeña. Para un primer PR, puedes reproducir un fallo de teclado, añadir un caso de prueba para los enlaces de playlists o pulir un detalle visual del tablero en escritorio.

Antes de abrir el PR, ejecuta las comprobaciones de la sección anterior. En la descripción, cuenta qué cambiaste y cómo lo verificaste. Si cambia la interfaz, adjunta una captura. Si reportas un fallo, incluye los pasos para reproducirlo y el navegador que usaste.

## Enlaces compatibles

| Proveedor | Ejemplos |
| --- | --- |
| Spotify | `https://open.spotify.com/playlist/ID`, con prefijo regional opcional `/intl-es/` |
| YouTube | `https://www.youtube.com/watch?v=ID`, `https://youtu.be/ID` y `https://www.youtube.com/playlist?list=ID` |

Si Spotify solo ofrece una vista previa, inicia sesión en Spotify en el mismo navegador y recarga. En YouTube, la disponibilidad depende de la región y de los permisos de incrustación de cada video. Puedes abrir el contenido directamente en el proveedor desde el reproductor. [Ayuda de Spotify](https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting) · [Errores de YouTube](https://developers.google.com/youtube/iframe_api_reference#onError)

## Estructura

- `src/app/` contiene la página, estilos y metadatos de Next.js.
- `src/components/` contiene la consola, los formularios y las integraciones.
- `src/components/scene/` contiene los modelos, materiales y texturas procedurales del recorrido 3D.
- `src/hooks/`, `src/lib/` y `src/types/` contienen el estado local, la validación y los tipos.
- `public/` contiene la imagen de la cabina, el arte nocturno y la tarjeta para redes.
- `tests/` contiene las pruebas unitarias.
- `docs/` contiene la [especificación](docs/SPEC.md), las [referencias y créditos](docs/RESEARCH.md) y los [próximos pasos](docs/TASKS.md).
