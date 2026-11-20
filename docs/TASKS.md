# Leonida FM · Próximos pasos

## Verificación en el sitio público

- [ ] Probar la reproducción de Spotify y YouTube desde los controles oficiales.
- [ ] Abrir una estación compartida en una ventana privada y comprobar la tarjeta social.

## Ideas para contribuir

- [ ] Probar el tablero con un lector de pantalla y medir el contraste de «Abrir radio».
- [ ] Implementar la [cortinilla de sintonización](SPEC.md#p2--cortinilla-de-sintonización). Verificar el cambio desde el dial y la lista, los cambios rápidos, el movimiento reducido y la continuidad del reproductor.
- [ ] Adaptar el recorrido 3D a móvil y medir su rendimiento con la radio activa en un teléfono físico. Consulta los [criterios del Modo Car](SPEC.md#entrega-2--avenida-3d-en-tiempo-real).

## Verificación registrada

- **Radio.** En Chromium se verificaron el alta, la edición y la baja de estaciones, la persistencia, los enlaces compartidos y el manejo de errores con reproductores simulados. En local también se comprobó la reproducción completa de Leonida Radio con una sesión de Spotify iniciada.
- **Cabina y tablero.** En Chrome se verificaron el foco, la continuidad del iframe y la ausencia de desplazamiento horizontal a 1440, 390 y 320 px. Los tamaños móviles se probaron por emulación.
- **Recorrido 3D.** En Chrome sobre un Apple M4 se verificaron tres tamaños de escritorio, ocho reciclajes en 30 segundos, pausa, movimiento reducido y recuperación tras pérdida de WebGL.
- **Build.** Pasaron las nueve pruebas unitarias, TypeScript, ESLint y la exportación estática. Consulta los [comandos de verificación](../README.md#verificar-y-compilar).
