# Leonida FM contributor guide

Leonida FM is a browser radio built with the Next.js App Router and exported as a static site. The project uses official Spotify and YouTube embeds. The [README](README.md) lists setup, checks, and contribution steps. The [specification](docs/SPEC.md) describes product behavior and acceptance criteria.

## Where to work

- `src/components/radio-console.tsx` coordinates the cockpit, tuner, and station collection. `src/components/radio-player.tsx` owns provider playback.
- `src/hooks/use-stations.ts` manages selection and persistence. `src/lib/stations.ts` validates playlist URLs, saved data, and shared links. Station tests live in `tests/`.
- `src/components/scene/` holds the desktop 3D scenery. `public/car/car.webp` provides the transparent cockpit overlay.

## Behavior to preserve

- Keep Leonida Radio available as the built-in station and preserve compatibility with saved stations and shared links. Opening a shared link should leave the saved collection intact until the user makes an explicit change.
- Keep one iframe for the active station. Opening or closing the radio should preserve that iframe and playback.
- Show the radio while the 3D scene loads or is unavailable. Only show the cockpit once the scene and overlay are ready. Pausing the landscape should affect only the scene. Preserve keyboard navigation and focus when switching views.
- Keep the export static and use the official provider embeds for playback. Follow nearby code conventions and keep local configuration and build output out of version control.

## Checks and pull requests

- Use the commands in the README. Run the relevant checks for your change and verify the production build before opening a pull request with code changes.
- Add a focused regression test when fixing a bug. For an interface change, verify the affected behavior in a browser and include a screenshot in the pull request.
- Update the specification and checklist when product behavior or acceptance criteria change. Use a short imperative commit subject and describe what changed and how you verified it in the pull request.
