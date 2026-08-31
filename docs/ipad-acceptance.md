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
9. Kids Mode, Print, Export PNG, Frame, DrawMe are all reachable (status bar on iPad; More
    sheet on phone width).
10. Sounds play with the device muted-switch on and off as expected; Hidden Pictures and
    stamps load.

## C. Custom Hidden Pictures

11. Choose Eraser → **Add Picture Here**, then select a normal picture from Photos or Files.
    The button and status bar confirm that the processed picture joined Hidden Pictures.
12. Start erasing without selecting another option. The uploaded picture appears in the
    black-and-white pixelated style.
13. Force-quit and relaunch. Tap **Hidden Pictures** repeatedly and confirm the added picture
    remains in the reveal rotation. If storage was unavailable, the earlier confirmation
    must instead have said that the picture was for that session only.

## D. Editable file round-trip

14. Draw a distinct mark. Tap **Save Project**, choose **Save to Files**, and save the
    `.kidpix` file under **On My iPad**.
15. Change or clear the drawing. Tap **Open File**, choose that `.kidpix`, and confirm the
    exact old picture returns. Draw another stroke and confirm it commits normally.
16. Tap **Export PNG**, save it, then open that PNG through **Open File**. It imports as a
    flattened picture and remains drawable.

## E. Offline relaunch

17. Airplane Mode on. Force-quit. Relaunch from the home screen. It loads and draws.
18. Still offline, sounds still play (Range path, see [pwa.md](./pwa.md)).

## F. Update activation

19. Airplane Mode off. Draw a distinct mark, then leave the app open through a new deploy.
    The app does not reload itself; **Update Ready — Reload** appears.
20. Tap **Update Ready — Reload**. The new version loads and the distinct drawing is still
    there. If the starting deploy predates this update protocol, close every Kid Pix tab and
    home-screen instance, reopen once, and record that one-time crossover separately.

## Results

| Date | Device / iPadOS | Deploy | Pass | Fail (item: note) |
|---|---|---|---|---|
| | | | | |
