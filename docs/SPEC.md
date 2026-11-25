# Leonida FM · Especificación

Leonida FM · «Your World. Your Frequency.» es una radio web independiente y gratuita, inspirada en los diales de automóvil y las noches tropicales. Permite crear y compartir estaciones a partir de playlists o videos de YouTube. La aplicación se exporta como una página estática de Next.js con estado local en el navegador. [Referencias y créditos](RESEARCH.md)

## Forma de trabajo

El SPEC y la implementación avanzan juntos, un flujo a la vez. Antes de cambiar el código, documenta el comportamiento esperado y su criterio de aceptación. Si cambia una decisión de producto, regístrala en el SPEC antes de implementar el nuevo comportamiento. Después de cada cambio, verifica el criterio y actualiza [el checklist](TASKS.md) con la evidencia, la verificación pendiente y cualquier bloqueo.

## Flujos y requisitos

- **Entrar.** La primera visita selecciona Leonida Radio, una estación fija de Spotify con la playlist `37i9dQZF1DX6RSJAsEDz7H`. Se muestra siempre una sola vez y carece de acción de eliminación. Spotify muestra su título «Grand Theft Auto Official Playlist» en el embed. La app usa «Leonida Radio» y evita atribuirla a GTA VI como playlist oficial.
- **Cambiar de plataforma.** Al pasar de Spotify a YouTube o al revés, se conserva la emisora si el catálogo incluye una fuente para ambas plataformas. Si falta una fuente, el botón avisa «Sin esta emisora» y permite explorar la otra plataforma. Al explorar, se abre la última estación sintonizada allí durante la sesión, si sigue disponible, o la inicial de ese proveedor (Leonida Radio en Spotify y Cocoteo FM en YouTube). Un enlace compartido abre su plataforma directamente. Apple Music queda para una fase posterior.
- **Sintonizar.** Los controles anterior y siguiente recorren las estaciones del proveedor activo de forma circular. El catálogo sigue un orden común por familias musicales, con Leonida Radio como estación de bienvenida en Spotify y las emisoras especiales al final. Cada emisora del catálogo tiene una frecuencia decorativa fija y una etiqueta de género compartidas entre plataformas. El dial muestra la emisora activa y hasta ocho estaciones consecutivas, con el mismo número de opciones al inicio y al final. El contador lleva a «Mis estaciones», donde se puede elegir directamente entre todas las del proveedor activo y ver sus géneros. Las estaciones personales quedan al final. Solo se monta el iframe de la estación activa.
- **Desbloquear emisoras.** En Spotify, The Sniper of La Perle y The Vault Radio aparecen en el catálogo tras sintonizar cinco emisoras principales distintas de esa plataforma. El progreso se guarda en el navegador. Sus enlaces compartidos siguen disponibles como vista previa y el usuario puede guardar una de estas emisoras mediante su enlace.
- **Favoritas.** La estrella del dial y la del volante marcan o desmarcan la emisora activa. En «Mis estaciones», el filtro «Favoritas» muestra las disponibles en el proveedor activo. La marca se guarda en el navegador y se comparte entre las versiones de Spotify y YouTube de una misma emisora del catálogo.
- **Crear.** El formulario requiere un nombre de 1 a 60 caracteres, proveedor y enlace válido. Tras guardar, la nueva estación se selecciona y se añade al final de la colección. Las claves `provider:playlistId` y `youtube:video:videoId` impiden duplicados.
- **Renombrar.** El usuario puede editar el nombre de una estación personalizada sin cambiar su enlace ni detener el reproductor.
- **Eliminar.** Solo se pueden eliminar estaciones guardadas por el usuario. Se confirma la eliminación y, si estaba activa, se vuelve a una estación de la misma plataforma.
- **Compartir.** El botón copia un enlace con `?station=1&provider=…&playlist=…&name=…` para playlists o con `video` en lugar de `playlist` para mixes en video, construido con `URLSearchParams`. El enlace abre la estación en cualquier navegador. Si ya existe localmente, se usa su nombre guardado. Abrir un enlace solo cambia la selección de la sesión y deja intacto el almacenamiento hasta que el usuario realice un cambio. Una estación nueva se previsualiza y se incorpora mediante «Guardar estación». La vista temporal no altera la última estación persistida. El enlace conserva la estación al recargar. Al escoger otra estación, crear una distinta o eliminar la estación activa, se limpian los parámetros del enlace. Un enlace inválido muestra un aviso y usa la selección local.
- **Recargar.** Se restaura la última estación guardada si sigue disponible. La colección conserva su orden. Si el almacenamiento está bloqueado, la sesión en curso sigue funcionando y se muestra un aviso.

## Formatos aceptados

Solo se permiten URLs HTTPS sin credenciales, puerto personalizado ni dominios ajenos al proveedor.

| Proveedor | Formatos | Identificador |
| --- | --- | --- |
| Spotify | `open.spotify.com/playlist/ID` y rutas equivalentes con prefijo de idioma `intl-xx` | 22 caracteres alfanuméricos |
| YouTube | `youtube.com/watch?v=ID`, `youtu.be/ID` y `youtube.com/playlist?list=ID`; si el enlace incluye una playlist compatible, se usa la playlist | Video de 11 caracteres o playlist explícita `PL…` o `OLAK5uy_…` |

La validación es sintáctica. Se rechazan álbumes de Spotify, listas personalizadas de YouTube y enlaces abreviados de Spotify que necesiten redirección. La publicación, el permiso de incrustación y la disponibilidad por región se comprueban al reproducir. El enlace compartido expone únicamente el nombre, proveedor e ID de playlist o video. El acceso a una playlist privada depende del proveedor.

## Arquitectura y datos

- `src/app/` contiene la página, layout, metadatos Open Graph, favicon y estilos con Tailwind CSS.
- `src/components/` contiene la consola de radio, formularios, lista y reproductor.
- `src/hooks/use-stations.ts` administra la colección, selección y persistencia.
- `src/lib/stations.ts` valida URL, datos persistidos y enlaces compartidos. `src/types/station.ts` define los contratos.
- `public/` contiene arte original y metadatos gráficos. `tests/` contiene pruebas unitarias con el runner de Node.

`Station` contiene el proveedor, el nombre y un identificador de playlist o video. Las estaciones incluidas se definen en código. Si una estación incluida coincide con una que ya se guardó, prevalece la estación personalizada. La clave `leonida-fm:stations` guarda `{ version: 1, stations, selectedKey }` y, cuando existen, las favoritas y el progreso de desbloqueo. Se descartan entradas inválidas y duplicadas, se recupera el esquema inicial sin versión y se conservan datos de versiones futuras hasta que el usuario haga un cambio explícito.

Define `NEXT_PUBLIC_SITE_URL` con la URL pública antes de compilar para que los metadatos y la tarjeta social usen el dominio correcto.

## Reproducción y riesgos

- **Spotify.** La API oficial del iframe conserva los controles y permite cargar otra playlist en el mismo reproductor. Tras detectar el inicio de reproducción, la radio intenta reproducir la siguiente playlist cuando el usuario elige otra emisora de Spotify. La selección inicial se carga sin autoplay. Si la API falla, se usa el iframe estándar. Si el navegador bloquea el autoplay, el botón Play del reproductor queda disponible. Spotify puede ofrecer solo una vista previa en algunas sesiones. [API de Spotify](https://developer.spotify.com/documentation/embeds/references/iframe-api) · [Solución de problemas](https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting)
- **YouTube.** El iframe oficial usa `/embed/VIDEO_ID` para videos, y `listType=playlist` y `list` para playlists. Ambas variantes usan `enablejsapi=1` y el origen de la página. Las selecciones incluidas de videos usan `playlist` para reproducir varias pistas en un solo iframe. Si una pista está bloqueada se intenta la siguiente antes de cambiar de emisora. La API aporta estados de error, como videos privados o bloqueados para incrustación. Si la API se bloquea, permanece disponible el iframe estándar. Se conserva el encabezado de referencia en peticiones HTTPS y el reproductor tiene al menos 200 px de alto. [Parámetros del reproductor](https://developers.google.com/youtube/player_parameters) · [Referencia de la API](https://developers.google.com/youtube/iframe_api_reference)
- **Navegadores.** El usuario inicia la reproducción con los controles oficiales. El iframe de Spotify se conserva entre emisoras cuando su API está disponible. Al cambiar de proveedor o emisora de YouTube se desmonta el iframe anterior. Un tiempo de espera y los errores detectables muestran ayuda. YouTube incluye un enlace para abrir la emisora en el proveedor. La app no extrae, descarga ni redistribuye audio.

## Diseño y aceptación

El tablero presenta un dial circular, el reproductor y una colección de estaciones plegable. En escritorio, el dial y el reproductor se muestran en dos columnas y Spotify aprovecha el alto del panel del dial. En móvil se apilan sin desplazamiento horizontal. El enlace para abrir la emisora en YouTube va debajo del reproductor. Los controles admiten teclado, muestran el foco y respetan movimiento reducido. El pie identifica Leonida FM como un proyecto de fans independiente.

La entrega se acepta cuando la playlist inicial se muestra con el embed oficial, se pueden añadir estaciones de ambos proveedores, se conserva y restaura la selección, solo se pueden eliminar estaciones personalizadas, un enlace abre la estación en otro navegador y los errores tienen salida al proveedor. Deben pasar pruebas unitarias, TypeScript, ESLint y el build de producción. El README documenta la instalación, la ejecución local y las comprobaciones.

## P2 · Cortinilla de sintonización

Al cambiar de estación desde la radio, la aguja se desplaza a la nueva frecuencia. El sintonizador muestra la frecuencia y el nombre de la emisora junto a una frase editorial que aparece durante unos dos segundos. Ejemplo para la estación inicial.

> 88.1 FM · Leonida Radio · La ciudad sigue despierta

La cortinilla aparece al pasar a otra estación. La carga inicial, volver a pulsar la estación activa y el salto entre canciones mantienen la vista habitual. Si el usuario cambia de estación varias veces, solo se muestra el mensaje de la última. El texto conserva una posición estable en móvil y en escritorio. Con movimiento reducido, aparece sin animación. El lector de pantalla sigue anunciando el nombre de la estación activa mediante el aviso existente. La cortinilla queda fuera del iframe y no retrasa ni modifica la reproducción oficial.

Temas, sonido de sintonización y portadas personalizadas se dejan para iteraciones posteriores.

## P2 · Tablero y Modo Car

### Entrega 1 · Abrir la radio desde el asiento del conductor

La página muestra la radio al entrar. En un escritorio compatible pasa a Modo Car cuando el recorrido y la capa de cabina están listos, si todavía no se ha interactuado con la radio. Los enlaces a estaciones compartidas abren directamente el tablero de la radio. La vista de conducción sitúa la cámara a la altura de los ojos, con el aro del volante en el tercio inferior, la carretera centrada y la pantalla de la consola en la mitad inferior derecha. La cabina es grafito, con reflejos violeta y coral. El exterior tiene luz de atardecer. El turquesa identifica los controles del tablero.

La pantalla de la consola muestra a la izquierda la frecuencia y el nombre de la emisora activa, con el botón «Ver radio». A la derecha muestra el reproductor oficial a escala reducida. Para sintonizar otra emisora, se abre el tablero completo con «Ver radio». El botón tiene un área interactiva mínima de 44 × 44 px.

«Ver radio» revela el selector circular desde la posición de la consola. La radio muestra una frecuencia dominante. En escritorio, dial y reproductor quedan contiguos. En móvil, el reproductor va justo debajo del dial y la lista va después. «Volver al volante» devuelve el foco a «Ver radio». Al volante, el mismo iframe de Spotify o YouTube se ajusta a la pantalla del tablero sin interrumpir la reproducción.

#### Composición y controles

Usa `public/car/car.webp` como capa de cabina sobre la escena animada. Conserva su proporción 16:9. La pantalla negra está entre el 66 y el 94 % del ancho y el 60 y el 84 % del alto, medidos sobre la imagen visible. Centra el reproductor aproximadamente en el 80 % horizontal y el 72 % vertical. Posiciona el reproductor y «Ver radio» respecto de la imagen para que permanezcan alineados al ajustar la ventana o mover el punto de vista.

Mantén una etiqueta legible, un área táctil de 44 × 44 px como mínimo y un indicador de foco visible. El texto de «Ver radio» tiene un contraste de 4,5:1 sobre su propia superficie.

Entra a la radio con el foco en su encabezado y devuelve el foco a la consola al volver. Usa botones HTML con etiquetas visibles y conserva la navegación en orden de lectura. Para los controles, define estados de hover, foco y pulsación. Usa una transición CSS breve para el refinamiento de la pantalla abierta. La coreografía con GSAP pertenece a la segunda entrega.

#### Refinamiento · La pantalla se acerca

La vista abierta se presenta como la pantalla ampliada del mismo estéreo. Conserva la cabina alrededor de la interfaz, con el atardecer visible en el perímetro y un marco grafito que retoma el cristal negro y el bisel cobrizo de la referencia. Dentro del marco va solo la radio. La frase «Your World. Your Frequency.» queda fuera de esta vista. El borde iluminado turquesa del botón de entrada se convierte en un acento discreto del panel abierto.

- **Cabina.** Mantén el botón «Ver radio» ubicado sobre el cristal. Su pulsación activa la pantalla. El mismo fondo permanece durante la apertura y el regreso. Si hay desplazamiento de cámara por puntero, congélalo antes de abrir y conserva la posición hasta volver al volante.
- **Pantalla abierta en escritorio.** Amplía visualmente el marco del estéreo desde su posición en la consola. Dentro del marco, coloca una barra superior con «Volver al volante» y «Compartir». Debajo, dial, nombre de estación y sintonización a la izquierda, y el reproductor oficial a la derecha. La colección arranca cerrada. «Mis estaciones» o el contador del dial permiten abrir la lista sin interrumpir la reproducción. Si hay una estación compartida en vista previa, «Guardar estación» queda disponible en la barra superior. Mantén una sola frecuencia destacada.
- **Pantalla abierta en móvil.** Usa el ancho disponible con márgenes seguros. Presenta el dial y el reproductor debajo del encabezado, con la colección cerrada al inicio. Al abrir la colección, aparece debajo del reproductor. Permite desplazamiento vertical normal.
- **Continuidad.** La animación corta desplaza solo el marco y los controles propios, con origen en la pantalla física. El layout y el foco se actualizan aunque se cancele la animación. Con movimiento reducido, cambia de vista sin desplazamiento. Conserva el nodo del iframe y sus controles, y evita mover o tapar el reproductor durante la transición. «Volver al volante» devuelve el foco a «Ver radio». «Ocultar lista» y Escape cierran la colección y devuelven el foco al botón que la abrió. Con la colección cerrada, Escape vuelve al volante en escritorio.

La revisión visual compara dos capturas del mismo ancho antes y después de pulsar «Ver radio». En ambas se reconoce la misma cabina. En la vista abierta, los dos primeros elementos que deben poder localizarse son la radio activa y su control de reproducción. Comprueba esto a 1440 px con Spotify y YouTube. A 390 y 320 px, verifica el acceso directo al dial y al reproductor.

### Entrega 2 · Avenida 3D en tiempo real

El recorrido 3D se muestra en escritorio cuando el área de la página es al menos 1,501 veces más ancha que alta. En móvil se abre directamente la radio.

**Tecnología.** Usa **Three.js con React Three Fiber 9** para renderizar la calle en un único canvas WebGL compatible con React 19. Carga la escena de forma diferida cuando se muestre Modo Car en escritorio y el usuario permita el movimiento. Mantén la cabina, la miniatura, el dial y los reproductores oficiales como elementos HTML y CSS. La transición del tablero puede seguir su plan independiente con **GSAP 3 y `@gsap/react`**, con alcance local y cancelación al invertirla. [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction) · [GSAP para React](https://gsap.com/resources/React/)

**Composición.** Prepara una capa original de la cabina con el área del parabrisas transparente. Haz coincidir el punto de fuga y la línea del horizonte de la cámara 3D con el encuadre de la cabina. Superpone la cabina sobre el canvas para que el paisaje se vea a través de las zonas transparentes. El reproductor compacto se alinea con la pantalla del tablero.

**Dirección de arte.** Modela una avenida ficticia a partir de la relación entre Ocean Drive y Lummus Park. Desde el asiento del conductor, sitúa hoteles art déco de dos a cuatro pisos a la izquierda y deja el parque, las palmeras y una línea de mar a la derecha. Diseña dos fachadas originales con esquinas distintas, viseras horizontales, entradas retranqueadas y estuco marfil, menta o coral. La avenida 3D queda despejada de tráfico. Las puertas, los bordillos y los carriles dan escala a la calle. Evita que la calle se lea como un corredor de bloques repetidos. [Investigación de Miami y referencias técnicas](RESEARCH.md#referencias-para-la-avenida-3d-del-modo-car)

**Acabado del primer tramo.** Coloca una luz solar cálida y baja, relleno azul del cielo y una leve bruma en la distancia. Trabaja el pavimento con textura de grano y desgaste, y haz visibles las sombras de contacto bajo las palmeras. Reserva los reflejos suaves para los cristales. Limita el neón a algunos rótulos con nombres ficticios para que sigan dominando las fachadas y el atardecer. La cámara permanece a altura de conductor, con el horizonte estable y el punto de fuga alineado con la cabina. Los elementos cercanos cruzan el parabrisas más rápido que el horizonte. Registra la procedencia de cada modelo y textura.

**Tramos del recorrido.** La avenida recorre un distrito de hoteles art déco con terrazas, un paseo con bancos y palmeras a ambos lados y un tramo de playa más despejado con casetas de salvavidas. El trayecto empieza cerca del final de los hoteles para que el paseo entre pronto en el campo de visión. La calzada y las aceras se mantienen continuas al pasar de un tramo a otro y al volver a los hoteles.

**Recorrido continuo.** El trayecto avanza automáticamente a altura de conductor. El vehículo acelera y desacelera suavemente alrededor de la velocidad base, con cambios aleatorios entre 20 y 120 km/h. El control «Velocidad base» empieza en 65 km/h y permite ajustarla en pasos de 5 km/h. Al volver de la radio conserva el valor seleccionado. Los tramos de calle se reubican después de quedar detrás de la cámara, conservando la continuidad de carriles y aceras.

**Pausa y recuperación.** Comparte geometrías y materiales para palmeras, fachadas y otros elementos repetidos. Limita la resolución interna del canvas en pantallas de alta densidad. Incluye «Pausar paisaje» y «Reanudar paisaje» con efecto exclusivo sobre la escena. El recorrido sigue detrás de la radio mientras esté en marcha. Detén el render continuo cuando la pestaña deje de estar visible. Conserva la pausa manual al cambiar de vista. La radio se mantiene operativa durante la carga, con movimiento reducido o si WebGL o la capa de cabina fallan. [Canvas de React Three Fiber](https://r3f.docs.pmnd.rs/api/canvas) · [Render bajo demanda](https://r3f.docs.pmnd.rs/advanced/scaling-performance)

**Velocímetro.** En la vista del volante, la aguja y la cifra del tablero muestran la velocidad del recorrido en km/h. Al pausar el paisaje, la lectura baja a cero.

### Criterios de aceptación visual y funcional

- A 1440 × 900 se reconocen avenida, parabrisas y cabina. El tablero conserva una frecuencia dominante y el reproductor queda junto al dial. Comprueba también el encuadre a 1280 × 720 y 1920 × 1080.
- A 390 y 320 px en vertical se abre la radio sin pasar por la cabina. El dial, el reproductor y la colección se usan sin desplazamiento horizontal.
- Una captura tomada desde la cabina muestra los hoteles art déco de un lado y el parque abierto con palmeras del otro. Se distinguen la dirección del sol, las sombras de contacto y el pavimento sin depender de letreros para reconocer la inspiración en Miami.
- Durante al menos 30 segundos de avance, el horizonte se mantiene estable y los tramos se reciclan sin cortes ni saltos visibles. Los carriles quedan despejados durante todo el recorrido.
- «Pausar paisaje» detiene la escena mientras la música sigue. Al abrir y cerrar la radio se conserva la instancia del reproductor. Spotify y YouTube siguen operables al volver al volante.
- Con movimiento reducido, una ventana demasiado estrecha o un fallo de WebGL, la radio sigue visible y se conserva el reproductor activo.
- Valida el prototipo de un tramo en escritorio antes de añadir más modelos o efectos. Registra el equipo, navegador y configuración gráfica usados para medir el rendimiento.
