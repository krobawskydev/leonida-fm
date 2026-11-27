# Leonida FM · Análisis de brechas

**Fecha:** 26 de noviembre de 2026

**Entorno público:** [Leonida FM](https://leonida-fm.vercel.app/)

**Base de revisión:** `main` en `242f646` y cambios locales de autoría. Pasaron las 16 pruebas unitarias, ESLint y TypeScript. La revisión usa código, pruebas existentes y el HTML público obtenido en la revisión previa. El QA visual y las sesiones con reproductores reales quedan a cargo del propietario.

Una brecha es una diferencia concreta entre el comportamiento esperado y el actual. El registro usa IDs propios para QA e ideas. Los IDs del análisis inicial se conservan junto a sus entradas para facilitar la consulta. **Open** indica trabajo o validación pendiente, **In Progress** indica trabajo iniciado, **Fixed** indica una corrección pendiente de verificación, **Verified** indica criterios comprobados y **Not Reproducible** requiere un intento documentado de reproducción.

## Recomendación para el lanzamiento

1. **Verificar GAP-001 y el salto desde enlaces compartidos de GAP-002.** Las correcciones locales tienen pruebas unitarias. Falta probar el flujo con el reproductor real antes de publicarlas.
2. **Pasar una ronda de QA de los flujos principales.** Usar el checklist de QA y las pruebas de regresión de GAP-001 a GAP-003 para cubrir dos proveedores, enlaces en otra sesión, fallos de reproducción, cambios rápidos, alta, persistencia, Safari iPhone y Chrome Android. Incluir al menos el navegador integrado de la red donde se vaya a publicar. En rendimiento, basta una medición inicial en móvil y comprobar que se puede sintonizar sin bloqueos. La reproducción continua en segundo plano y el soporte de Shorts pueden esperar si el comportamiento actual se comunica con claridad.
3. **Verificar que se encuentre «Añadir estación».** UX-002 afectó una acción principal durante la demo. Probar el recorrido de primera visita y el cierre desde el fondo de UX-001.
4. **Revisar el enlace que se va a publicar.** Confirmar en los canales elegidos la tarjeta social de QA-005, el crédito publicado y el aviso de proyecto independiente. Revisar que el texto de difusión atribuya correctamente el contenido de BACKLOG-003 y QA-008. La URL canónica y las etiquetas detalladas de procedencia pueden esperar a una revisión posterior.

**Después del lanzamiento:** los avisos intermedios de recuperación, el pulido visual móvil, las etiquetas de procedencia y las tres ideas de producto de la oficina. El alcance de esta revisión es diagnóstico y priorización.

## Brechas de reproducción y enlaces compartidos

### GAP-001 · Recuperación dentro de playlists de YouTube

- **Prioridad / estado.** P0 · Fixed.
- **Evidencia.** La corrección local aplica el mismo recorrido acotado a las colas curadas y las playlists por ID. Espera una vez si YouTube todavía no expone la lista y separa los bloqueos de contenido de errores del reproductor, incluido `153`. Al desmontar se cancela la recuperación pendiente. Los tests cubren la selección de pistas, el agotamiento y la clasificación de errores.
- **Archivos.** [radio-player.tsx](../src/components/radio-player.tsx), [radio-console.tsx](../src/components/radio-console.tsx), [youtube-recovery.ts](../src/lib/youtube-recovery.ts), [youtube-recovery.test.ts](../tests/youtube-recovery.test.ts).
- **Acción.** Verificar con el iframe real. El cambio automático entre emisoras sigue disponible en la vista radio. En el volante se recupera el contenido dentro de la misma playlist. [Referencia del IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- **Pruebas.** Simular primer track, track intermedio, último track con candidatos anteriores sin probar, bloqueos consecutivos, playlist agotada, lista aún no disponible, video individual, error `153` y cambio manual durante la recuperación o la cuenta regresiva. Repetir con una playlist por ID y una cola curada. Confirmar reproducción real y comportamiento en radio y volante.

### GAP-002 · Salto automático en una estación compartida

- **Prioridad / estado.** P0 · Fixed.
- **Evidencia.** Antes, el salto automático usaba el mismo flujo que un cambio manual y podía limpiar la URL y persistir otra estación. La corrección local comprueba el enlace tanto al anunciar como al ejecutar un salto. Mientras la URL contenga una estación compartida válida, la selección automática queda deshabilitada. Hay pruebas del formato compartido e IDs válidos del catálogo y personalizados.
- **Archivos.** [stations.ts](../src/lib/stations.ts), [use-stations.ts](../src/hooks/use-stations.ts), [radio-console.tsx](../src/components/radio-console.tsx), [stations.test.ts](../tests/stations.test.ts).
- **Acción.** Verificar el fallo de una estación compartida con datos limpios y con una colección existente. Comprobar que cambiar manualmente de emisora sigue funcionando.
- **Pruebas.** Copiar y abrir enlaces de Spotify, playlist de YouTube y video individual en incógnito y otro dispositivo. Comprobar estación seleccionada, recarga, aviso para enlaces inválidos o incompletos con `station`, y preservación de la colección y la sintonía persistidas hasta una acción explícita. Incluir un video compartido que falle.

### GAP-003 · Contenido privado, eliminado o restringido

- **Prioridad / estado.** P0 · Open.
- **Evidencia.** YouTube muestra avisos para errores `100`, `101` y `150`, y ofrece un enlace al proveedor. Al agregar contenido, el chequeo oEmbed es consultivo y permite guardar tras confirmar un aviso. Spotify vuelve a un iframe si falla la inicialización del controlador. El iframe avisa de fallo o demora de carga, pero esos eventos no identifican de forma fiable si la playlist está privada, eliminada o restringida. El panel de Spotify carece del enlace externo que sí ofrece YouTube.
- **Archivos.** [radio-player.tsx](../src/components/radio-player.tsx), [spotify-embed.tsx](../src/components/spotify-embed.tsx), [station-dialog.tsx](../src/components/station-dialog.tsx), [stations.ts](../src/lib/stations.ts).
- **Acción.** Pedir una playlist pública en la etiqueta del formulario de Spotify. La comprobación del enlace sigue siendo sintáctica. Verificar los casos con contenido no disponible y que se pueda sintonizar otra estación.
- **Pruebas.** Usar contenido público de control, privado, eliminado, con bloqueo de embed y con restricción regional cuando haya un caso disponible. Simular oEmbed inaccesible y timeout del reproductor. Comprobar salida al proveedor y sintonización posterior.

## Checklist de QA

### QA-001 · Cambios rápidos entre reproductores (GAP-004 original)

- **Prioridad / estado.** P0 · Open.
- **Evidencia.** YouTube se monta por clave de estación, invalida callbacks al desmontar y limpia su iframe. Spotify reutiliza un controlador entre playlists y lo destruye al cambiar de proveedor. Conviene probar el cambio de playlist antes de `ready`: la carga temprana puede salir sin controlador y el callback `ready` registra la URI inicial.
- **Archivos.** [radio-console.tsx](../src/components/radio-console.tsx), [radio-player.tsx](../src/components/radio-player.tsx), [spotify-embed.tsx](../src/components/spotify-embed.tsx).
- **Acción.** Ejercitar cambios rápidos con eventos fuera de orden. Corregir solo las carreras que reproduzca esa prueba.
- **Pruebas.** Cambiar Spotify → YouTube → Spotify y entre varias playlists de Spotify antes de `ready`. Inyectar errores y callbacks tardíos durante la recuperación de YouTube. Afirmar que solo queda un iframe activo, la última estación coincide con el dial y los avisos y temporizadores anteriores no cambian la selección. Confirmar con reproductores reales que el audio no se superpone.

### QA-002 · Navegadores móviles e integrados (GAP-005 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** El propietario confirmó la experiencia móvil y el checklist registra comprobaciones previas en Chrome con emulación. La elegibilidad de la escena 3D y la vista radio de respaldo se implementan con media queries. Falta evidencia de dispositivos físicos y navegadores integrados.
- **Archivos.** [radio-console.tsx](../src/components/radio-console.tsx), [car-scene-layer.tsx](../src/components/car-scene-layer.tsx), [globals.css](../src/app/globals.css), [TASKS.md](TASKS.md).
- **Acción.** Registrar navegador, sistema, proveedor y resultado por flujo en el sitio público.
- **Pruebas.** Safari en iPhone, Chrome en Android o escritorio, y enlaces abiertos desde TikTok e Instagram. Probar reproducción manual, cambio de estación, formularios, enlaces compartidos y restricciones de autoplay.

### QA-003 · Cambio de pestaña, bloqueo y regreso (GAP-006 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** La consola usa `visibilitychange` para controlar el paisaje. La continuidad del audio depende del reproductor, navegador y sistema. No hay una prueba registrada de reproducción y recuperación tras suspender la pestaña o la aplicación.
- **Archivos.** [radio-console.tsx](../src/components/radio-console.tsx), [radio-player.tsx](../src/components/radio-player.tsx), [spotify-embed.tsx](../src/components/spotify-embed.tsx).
- **Acción.** Registrar si se conserva la reproducción y si los controles permiten retomarla cuando el sistema la pausa.
- **Pruebas.** Para ambos proveedores, cambiar de pestaña, cambiar de app, bloquear y desbloquear móvil y regresar. Verificar Play, navegación, un solo iframe y reanudación de la escena si corresponde.

### QA-004 · URLs y duplicados (GAP-007 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** El parser tiene pruebas para playlists con parámetros, proveedores o tipos incorrectos, mixes, IDs ambiguos y videos. El guardado compara claves y muestra un mensaje de duplicado. Las rutas `/shorts/ID` quedan fuera del parser actual. Un ID inexistente con sintaxis válida puede llegar al proveedor. YouTube tiene la advertencia consultiva de GAP-003.
- **Archivos.** [stations.ts](../src/lib/stations.ts), [station-dialog.tsx](../src/components/station-dialog.tsx), [radio-console.tsx](../src/components/radio-console.tsx), [stations.test.ts](../tests/stations.test.ts).
- **Acción.** Decidir si Shorts se normaliza a un video de YouTube o recibe un mensaje específico de formato no admitido. Conservar la diferencia entre formato inválido y contenido no disponible.
- **Pruebas.** En el formulario, probar URL inválida o malformada, playlist repetida con parámetros distintos, playlist con parámetros válidos, video individual, Shorts, enlace de Spotify ajeno a playlists e ID bien formado pero inexistente. Comprobar mensaje, foco, colección sin duplicados y selección tras guardar.

### QA-005 · SEO y vista previa social (GAP-008 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** La revisión pública previa confirmó título, descripción, referencia al favicon, Open Graph, tarjeta grande de X y JPEG público de 1200 × 630. El HTML público revisado carece de URL canónica. La aclaración de proyecto fan está en el pie y el README, y la descripción de la vista previa aún no la incluye. La autoría en los metadatos forma parte de cambios locales.
- **Archivos.** [layout.tsx](../src/app/layout.tsx), [icon.svg](../src/app/icon.svg), [social-card.jpg](../public/social-card.jpg), [radio-console.tsx](../src/components/radio-console.tsx).
- **Acción.** Definir la portada como canónica si se quiere concentrar la indexación del sitio. Mantener los parámetros funcionales de los enlaces a emisoras. Revisar el texto de la tarjeta para identificar el proyecto como fan e independiente.
- **Pruebas.** Revisar el HTML desplegado de la portada y de un enlace de estación, la descarga del favicon y la tarjeta, y las vistas previas en WhatsApp, Discord y las redes donde se publicará.

### QA-006 · Rendimiento móvil y carga inicial (GAP-009 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** La escena se importa dinámicamente y solo se monta cuando el dispositivo es elegible. El reproductor activo carga un iframe. El catálogo local contiene 21 entradas iniciales de Spotify, incluida Leonida Radio, más dos desbloqueables. YouTube tiene ocho entradas.
- **Archivos.** [car-scene-layer.tsx](../src/components/car-scene-layer.tsx), [radio-console.tsx](../src/components/radio-console.tsx), [radio-player.tsx](../src/components/radio-player.tsx), [station-presets.ts](../src/lib/station-presets.ts).
- **Acción.** Medir antes de optimizar. Registrar dispositivo, red, caché y proveedor para poder repetir la medición.
- **Pruebas.** En móvil con caché fría y red limitada, medir LCP, recursos transferidos, tiempo hasta que el dial responde y tiempo hasta disponer de Play. Revisar tareas largas al abrir la colección o cambiar de estación y verificar la exclusión de WebGL en esa configuración.

### QA-007 · Persistencia y estación predeterminada (GAP-010 original)

- **Prioridad / estado.** P1 · Open.
- **Evidencia.** Leonida Radio usa `37i9dQZF1DX6RSJAsEDz7H`. Las pruebas cubren recuperación, orden, datos inválidos, duplicados de la estación fija y selección guardada. El hook elimina solo estaciones personalizadas, vuelve a una disponible del mismo proveedor si se elimina la activa y contempla storage bloqueado.
- **Archivos.** [station-presets.ts](../src/lib/station-presets.ts), [stations.ts](../src/lib/stations.ts), [use-stations.ts](../src/hooks/use-stations.ts), [stations.test.ts](../tests/stations.test.ts).
- **Acción.** Completar la comprobación integrada con estados de navegador nuevos, existentes y corruptos usando el comportamiento actual como referencia.
- **Pruebas.** Confirmar estación inicial e ID, intento de eliminar la fija, recarga sin duplicados, eliminación de una personalizada activa, restauración de selección válida, JSON corrupto y almacenamiento bloqueado. Comprobar que las demás estaciones siguen disponibles.

### QA-008 · Documentación y atribuciones (GAP-014 original)

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** README y pie identifican el sitio como fan e independiente de Rockstar y Take-Two. README incluye entorno y comandos de desarrollo y exportación. RESEARCH registra procedencia del arte y enlaces a fuentes de audio servidas por los embeds. La firma `krobawskydev` con enlace al portafolio está en el cambio local, pendiente de publicación. La procedencia registrada no acredita por sí sola los permisos de cada recurso.
- **Archivos.** [README.md](../README.md), [RESEARCH.md](RESEARCH.md), [SPEC.md](SPEC.md), [project-author.ts](../src/lib/project-author.ts), [layout.tsx](../src/app/layout.tsx), [radio-console.tsx](../src/components/radio-console.tsx).
- **Acción.** Publicar la atribución en el próximo despliegue y revisar las instrucciones de publicación estática, las fuentes y los créditos que correspondan a los recursos utilizados.
- **Pruebas.** Seguir el README hasta generar `out/`, verificar enlaces a proveedores y portafolio, confirmar aviso de independencia y contrastar inventario de recursos con los créditos documentados.

## Mejoras opcionales

### BACKLOG-001 · Mensajes de recuperación (GAP-011 original)

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** Ya existe aviso final con enlace externo, cuenta regresiva y opción «Quedarme aquí». Los intentos intermedios dentro de las colas curadas son silenciosos.
- **Archivos.** [radio-player.tsx](../src/components/radio-player.tsx).
- **Acción.** Después de GAP-001, evaluar un único aviso discreto por intento de recuperación de la estación y un mensaje final al agotarla.
- **Pruebas.** Simular varios bloqueos y verificar que el aviso no se multiplica, se limpia al recuperar la reproducción y distingue fallo final de recuperación en curso.

### BACKLOG-002 · Identidad visual móvil (GAP-012 original)

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** La radio ya muestra nombre, frecuencia y género. El dial incluye una cortinilla al cambiar de estación y el CSS contempla movimiento reducido.
- **Archivos.** [radio-console.tsx](../src/components/radio-console.tsx), [globals.css](../src/app/globals.css).
- **Acción.** Evaluar si hace falta ajustar legibilidad o transición a partir del QA móvil y las mediciones de QA-006.
- **Pruebas.** Revisar nombre y frecuencia en pantallas estrechas, cambios rápidos y movimiento reducido.

### BACKLOG-003 · Procedencia de emisoras y selecciones (GAP-013 original)

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** La documentación separa la playlist oficial de Grand Theft Auto, las recopilaciones de fans en Spotify y las selecciones de YouTube. El catálogo visible usa nombres, géneros y frecuencias, y el dial identifica las vistas previas de enlaces compartidos. El modelo carece de un campo explícito de procedencia para cada selección.
- **Archivos.** [RESEARCH.md](RESEARCH.md), [STATIONS.md](STATIONS.md), [station-presets.ts](../src/lib/station-presets.ts), [radio-console.tsx](../src/components/radio-console.tsx).
- **Acción.** Revisar el texto de difusión y la procedencia en la documentación. Si se incorpora una etiqueta en el sitio, distinguir el nombre de la emisora en el juego de la autoría de la playlist, y contemplar contenido personalizado o sin verificar.
- **Pruebas.** Contrastar ejemplos de cada procedencia con su fuente y verificar que el texto visible y el de difusión reflejan esa atribución.

## Feedback de la oficina

### UX-001 · Cerrar el panel de radio y los diálogos desde el fondo

- **Prioridad / estado.** P1 · Fixed.
- **Evidencia.** Los compañeros pulsaron fuera del panel ampliado intentando cerrarlo. El fondo de la escena usa el mismo cierre que «Volver al volante», conserva el iframe y devuelve el foco a «Ver radio». Los diálogos de añadir, renombrar y compartir también cierran desde el fondo si el gesto empieza y termina fuera y el formulario está limpio. El formulario comprueba que el diálogo siga abierto antes de guardar tras oEmbed.
- **Archivos.** [station-dialog.tsx](../src/components/station-dialog.tsx), [radio-console.tsx](../src/components/radio-console.tsx), [use-modal-dialog.ts](../src/hooks/use-modal-dialog.ts), [modal-dialog.test.ts](../tests/modal-dialog.test.ts).
- **Acción.** Verificar la interacción y la devolución del foco en navegador.
- **Pruebas.** Pulsar fuera del panel y volver al volante, conservando el iframe y el foco. Pulsar dentro del dial, el reproductor y la colección. Comprobar el modo de solo radio. En los diálogos, probar toque fuera, gesto entre interior y exterior, Escape, devolución de foco y cierre durante oEmbed.

### UX-002 · Encontrar cómo agregar una playlist

- **Prioridad / estado.** P1 · Fixed.
- **Evidencia.** Los compañeros no encontraron el `+` del dial. El recorrido de primera visita lo destaca y también explica las flechas, los proveedores y la lista completa. El `?` de la barra permite repetirlo. El cierre se guarda para ese navegador.
- **Archivos.** [radio-console.tsx](../src/components/radio-console.tsx), [radio-tour.tsx](../src/components/radio-tour.tsx), [globals.css](../src/app/globals.css).
- **Acción.** Validar el recorrido con alguien nuevo con «Mis estaciones» cerrada.
- **Pruebas.** Abrir el formulario desde el primer paso. Comprobar el orden, el cierre, la persistencia al recargar y la opción de repetir en móvil y con teclado.

### IDEA-001 · Patinadoras en la acera

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** Se propusieron personajes de trabajadoras sexuales en patines como detalle ambiental. La escena ya tiene aceras y tramos reciclables, con palmeras y mobiliario, y carece de esos personajes.
- **Archivos.** [street.ts](../src/components/scene/street.ts), [props.ts](../src/components/scene/props.ts), [driving-scene.tsx](../src/components/driving-scene.tsx).
- **Acción.** Decidir la representación artística y, si se aprueba, prototipar personajes originales en un tramo de la acera.
- **Pruebas.** Revisar trayectorias sobre la acera, recambio de tramos, escala, continuidad y coste de renderizado.

### IDEA-002 · Buscar en YouTube y usar el primer resultado

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** El formulario acepta URLs. La exportación es estática y carece de un endpoint de búsqueda. El IFrame API retiró `listType=search`. YouTube Data API ofrece búsqueda filtrada por videos que permiten embed y aplica una cuota de búsqueda. [IFrame API](https://developers.google.com/youtube/iframe_api_reference) · [Data API](https://developers.google.com/youtube/data/reference/rest/v3/search/list)
- **Archivos.** [station-dialog.tsx](../src/components/station-dialog.tsx), [stations.ts](../src/lib/stations.ts), [next.config.ts](../next.config.ts).
- **Acción.** Evaluar una función externa al export estático con gestión de clave y cuota. Mostrar título y canal del primer resultado embebible antes de guardarlo y ofrecer pegar la URL como alternativa.
- **Pruebas.** Coincidencia clara, resultado inesperado, cero resultados, cuota agotada, red caída, respuesta tardía y resultado impedido por restricciones de reproducción.

### IDEA-003 · Picture-in-Picture

- **Prioridad / estado.** P2 · Open.
- **Evidencia.** El iframe de YouTube declara permiso `picture-in-picture`. No hay un control de Leonida FM para abrir una miniatura ni acceso directo desde la página al elemento de video dentro del iframe. Document Picture-in-Picture admite contenido HTML con disponibilidad según navegador. [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- **Archivos.** [radio-player.tsx](../src/components/radio-player.tsx), [radio-console.tsx](../src/components/radio-console.tsx), [globals.css](../src/app/globals.css).
- **Acción.** Aclarar si la miniatura debe flotar dentro de Leonida FM o permanecer encima de otras pestañas y apps. Probar primero los controles que ofrezcan reproductor y navegador. Si se implementa una miniatura propia, verificar que conserva el reproductor activo.
- **Pruebas.** Abrir y cerrar, cambiar de estación, volver al dial, comprobar continuidad y un solo iframe, y probar el comportamiento en un navegador sin la capacidad.
