# Physical iPad acceptance

Chromium emulation ([../tests/e2e/mobile-acceptance.spec.ts](../tests/e2e/mobile-acceptance.spec.ts))
proves touch → `_x/_y` mapping, drawer behavior, and the phone More sheet only in headless
Chromium. The items below need a real iPad. Run them in Safari, then from the home-screen
install. Add a dated result row at the bottom; do not copy results into architecture docs.

Live app: https://eriqueo.github.io/kidpix/

## A. Safari tab (before installing)

1. Open the URL. Tap the canvas once. A sound plays on that first tap (audio unlock).
2. Draw with a finger in portrait and in landscape. Ink lands under the finger.
3. Apple Pencil: draw a diagonal to each corner. The line follows the tip with no offset.
4. Rotate portrait → landscape → portrait with a drawing on the canvas. The drawing survives
   undistorted.
5. Share → Add to Home Screen.

## B. Installed app (home screen)

6. Launch from the home screen. Full screen, no Safari chrome.
7. Safe areas: no toolbar or drawer toggle sits under the notch or home indicator in either
   orientation.
8. Drawers: Tools, Colors, and (phone-width only) More each open, close on an outside tap,
   and leave no mark on the canvas.
9. Kids Mode, Print, Project, Frame, DrawMe are all reachable (status bar on iPad; More
   sheet on phone width).
10. SlideShow: draw, Save; draw again, Save; open SlideShow — two pictures appear. Reorder
    with ▲/▼, Play, Close, reopen — same order and settings.
11. Sounds play with the device muted-switch on and off as expected; Hidden Pictures and
    stamps load.

## C. Offline relaunch

12. Airplane Mode on. Force-quit. Relaunch from the home screen. It loads and draws.
13. Still offline: open SlideShow. Saved pictures still appear. Sounds still play (Range
    path, see [pwa.md](./pwa.md)).

## D. Update activation

14. Airplane Mode off. Open the app and leave it open after a new deploy. Nothing reloads.
15. Force-quit. Relaunch. The new version is live and the current drawing is still there.

## Results

| Date | Device / iPadOS | Deploy | Pass | Fail (item: note) |
|---|---|---|---|---|
| | | | | |
