# Leonida FM · Próximos pasos

## Verificación en el sitio público

- [ ] Comprobar que el crédito de autoría del pie de página abre el portafolio desde la radio y el volante.
- [ ] Probar la reproducción de Spotify y YouTube desde los controles oficiales.
- [ ] En Spotify, comprobar que al cargar la página haya que pulsar Play y que después se intente reproducir automáticamente al cambiar de emisora. Verificar que Play siga disponible si el navegador bloquea el arranque.
- [ ] Volver al volante con Spotify y YouTube. Comprobar que el mismo reproductor siga sonando dentro de la pantalla del tablero y que vuelva al tamaño completo al abrir la radio.
- [ ] Abrir una estación compartida en una ventana privada y comprobar la tarjeta social.
- [ ] Alternar Spotify y YouTube y comprobar que el dial, la colección y el reproductor correspondan al proveedor activo. Probar la nueva selección de Cocoteo FM, el salto de videos bloqueados y un enlace compartido de video.
- [ ] En una playlist de YouTube por ID y en una cola curada, comprobar el salto dentro de la emisora ante varios videos bloqueados y el aviso al agotarlos. Comprobar que el error 153 mantiene la emisora y que un cambio manual cancela la recuperación anterior.
- [ ] Abrir un enlace válido a una emisora de YouTube bloqueada y comprobar que conserva la URL y la última estación guardada. Cambiar de emisora manualmente y comprobar que se actualiza la selección guardada.
- [ ] Cambiar entre Spotify y YouTube desde CircoLoco para comprobar que se conserva la emisora. Desde V-Rock en Spotify, comprobar el aviso y el acceso al catálogo de YouTube.
- [ ] Comprobar que CircoLoco conserve 96.1 FM y «House y techno» al cambiar de proveedor. Verificar que «Mis estaciones» muestre el género y siga el orden del dial.
- [ ] En una sesión nueva, sintonizar cinco emisoras principales distintas en Spotify. Comprobar que las dos emisoras especiales aparezcan en el dial y sigan disponibles tras recargar.
- [ ] Comprobar que la lista arranque cerrada en escritorio y móvil, que el contador permita abrirla y que la rueda mantenga hasta ocho opciones al final del catálogo.
- [ ] Marcar una favorita, cambiar de proveedor y recargar. Comprobar que el filtro conserve la emisora cuando esté disponible y que se pueda quitar con el teclado.
- [ ] Subir «Velocidad base» a 180 km/h y comprobar que se aplique al instante, se conserve al volver de la radio y el trayecto mantenga la continuidad de los tramos.
- [ ] Comprobar que el vehículo acelere y desacelere suavemente desde el inicio del recorrido.
- [ ] Comprobar que el velocímetro siga la velocidad del recorrido y marque cero al pausar el paisaje.
- [ ] Recorrer los hoteles, el paseo y la playa. Comprobar la continuidad de los carriles y las aceras al volver a los hoteles.
- [ ] Desplazarse hasta el final de «Mis estaciones» y volver al volante. Comprobar que la cabina ocupe toda la ventana y se vea el encabezado.
- [ ] Abrir la radio con el paisaje en marcha y con el paisaje en pausa. Comprobar que conserve ese estado detrás del dial.

## Ideas para contribuir

- [ ] Probar el tablero con un lector de pantalla y medir el contraste de «Ver radio».
- [ ] Verificar la [cortinilla de sintonización](SPEC.md#p2--cortinilla-de-sintonización) al cambiar desde el dial y la lista, al cambiar rápido y con movimiento reducido. Comprobar que el reproductor siga cargando al seleccionar la emisora.
- [ ] Verificar el acceso directo a la radio, la colección y los enlaces compartidos en móvil y con el recorrido 3D desactivado.

## Verificación registrada

- **Radio.** En Chromium se verificaron el alta, la edición y la baja de estaciones, la persistencia, los enlaces compartidos y el manejo de errores con reproductores simulados. En local también se comprobó la reproducción completa de Leonida Radio con una sesión de Spotify iniciada.
- **Cabina y tablero.** En Chrome se verificaron el foco, la continuidad del iframe y la ausencia de desplazamiento horizontal a 1440, 390 y 320 px. Los tamaños móviles se probaron por emulación.
- **Recorrido 3D.** En Chrome sobre un Apple M4 se verificaron tres tamaños de escritorio, ocho reciclajes en 30 segundos, pausa, movimiento reducido y recuperación tras pérdida de WebGL.
- **Build.** Pasaron las nueve pruebas unitarias, TypeScript, ESLint y la exportación estática. Consulta los [comandos de verificación](../README.md#verificar-y-compilar).
