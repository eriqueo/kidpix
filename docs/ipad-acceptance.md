# Physical iPad acceptance

This is the runnable checklist for behavior that Chromium cannot prove. Perform sections A–F
on the same iPad, then copy the report template at the bottom into a message to the maintainer.
For each numbered item, report **PASS**, **FAIL**, **BLOCKED**, or **OBSERVED** and add a short
note for anything unexpected.

Automated coverage already exercises touch-coordinate mapping, phone/tablet layouts, editable
`.kidpix` files, custom Hidden Pictures, offline assets, and service-worker replacement. Those
checks are evidence about Chromium, not a substitute for this physical-iPad run.

Live app: <https://eriqueo.github.io/kidpix/>

## Before you begin

- Record the iPad model and iPadOS version shown in **Settings → General → About**.
- Have one unmistakable test photo available in **Photos**. A high-contrast picture with a
  face, large letter, or simple shape is easiest to recognize after dithering.
- Do **not** clear Safari Website Data. That can erase the current drawing and locally stored
  Hidden Pictures.
- Use Safari itself, not an in-app browser opened from Mail, Messages, or another app.
- If Kid Pix is already on the Home Screen, keep it installed. Item 6 records whether the
  current installation opens as a web app; do not create a duplicate icon.
- Section F needs a second deployment. Run items 1–23 first, then tell the maintainer you are
  ready for the update test. Record both commit SHAs supplied by the maintainer.

## A. Safari tab

1. Open the live URL in Safari. **PASS** if Kid Pix finishes loading and the drawing canvas is
   visible. Record any stale feature or unexpected control by name.
2. With Silent Mode off and the iPad volume audible, draw a short Pencil stroke. **PASS** if
   the first stroke appears under your finger and its Pencil sound is audible; this is the
   Safari audio-unlock check.
3. Draw with a finger in portrait and landscape. **PASS** if ink follows the finger without an
   offset in both orientations.
4. With an Apple Pencil, draw a diagonal toward each canvas corner. **PASS** if every line
   follows the Pencil tip without an offset. Report **BLOCKED** if no Apple Pencil is available.
5. Draw a recognizable mark, rotate portrait → landscape → portrait, and inspect it after
   each rotation. **PASS** if the mark survives without stretching, cropping, or moving.
6. If Kid Pix is not installed, tap **Share → More → Add to Home Screen**, turn on
   **Open as Web App**, then tap **Add**. Launch the new icon. If it was already installed,
   launch the existing icon instead. **PASS** if it opens without Safari's address bar or tab
   controls. These labels follow Apple's current iPadOS installation flow.

## B. Home Screen web app and layout

7. Attempt to use the installed app in portrait and landscape. **PASS** only if it rotates and
   remains usable in both. If it stays locked to landscape, report **FAIL — landscape locked**;
   the current manifest requests landscape and this test determines what the target iPad
   actually enforces.
8. In every orientation the installed app permits, inspect all four edges. **PASS** if no
   toolbar, canvas area, or drawer control sits under the screen edge, camera area, or Home
   indicator.
9. If **Tools**, **Colors**, or **More actions** drawer buttons are visible, open each one,
   choose an item, and tap outside an open drawer once. **PASS** if each drawer is reachable,
   closes after a choice or outside tap, and the outside tap leaves no accidental canvas mark.
   If no drawer buttons appear at the iPad's width, report **OBSERVED — inline tablet layout**.
10. Confirm **Kids Mode**, **Print**, **Export PNG**, **Frame**, and **DrawMe** are visible and
    tappable, either in the status bar or under **More actions**. **PASS** if all five are
    reachable.
11. Use Control Center, or the side switch if the iPad has one, to test with Silent Mode off
    and then on. In each state, draw with Pencil, choose a Stamp, and erase briefly. Report
    **OBSERVED — audible** or
    **OBSERVED — silent** for each state; also report any delayed, stuck, or overlapping sound.
    Return Silent Mode to your preferred setting.

## C. Custom Hidden Pictures

12. Choose **Eraser → My Hidden Pictures**. **PASS** if a library opens with **Add Photo**,
    **Start Erasing**, and an empty state or previously added photo thumbnails.
13. Tap **Add Photo** and select the recognizable test photo from Photos or Camera. **PASS**
    if the library confirms that the picture was added and selected, shows its pixelated
    thumbnail, and the status says it is now one of the Hidden Pictures. Record if it says
    **this session only**. Files is not an acceptance path for this feature.
14. Tap **Start Erasing** and erase immediately. **PASS** if that selected photo is revealed
    in its black-and-white pixelated style without first choosing **Hidden Pictures**.
15. Reopen **My Hidden Pictures**, delete the test photo, and force-quit/relaunch. **PASS** if
    the deleted photo is absent after relaunch and bundled Hidden Pictures still reveal.

## D. Editable project and ordinary picture files

16. Set the frame to **Rainbow**, draw a distinctive mark, tap **Save Project**, choose
    **Save to Files**, and save the `.kidpix` file under **On My iPad**. Record the exact
    filename. **PASS** if the file appears in Files with a `.kidpix` extension.
17. Change both the drawing and the frame. Tap **Open File**, choose the saved `.kidpix`, and
    **PASS** if the exact saved drawing and Rainbow frame return. Draw another Pencil stroke;
    **PASS** if it commits normally, proving the reopened file remains editable.
18. Force-quit and relaunch. **PASS** if the project restored in item 17, including the new
    post-open Pencil stroke, is still the current drawing.
19. Tap **Export PNG**, save it to Files, change or clear the drawing, then open that PNG through
    **Open File**. **PASS** if it returns as a flattened picture and accepts a new Pencil stroke.
20. Start another **Save Project**, close the share sheet without saving, and inspect Kid Pix.
    **PASS** if it does not silently create a second file and instead exposes the separate
    **Download instead** action. You do not need to tap that fallback.

## E. Offline relaunch

21. While online, turn Silent Mode off, set an audible volume, draw a new unmistakable mark,
    and wait one second. Turn on Airplane Mode, force-quit, and relaunch from the Home Screen.
    **PASS** if Kid Pix loads, the mark is still present, and a new Pencil stroke commits.
22. Still offline, use Pencil, a Stamp, and **Eraser → Hidden Pictures**. **PASS** if their
    sounds are audible and the Stamp and Hidden Picture artwork load. Report any missing image,
    silent Range-audio failure, or network error.
23. Turn Airplane Mode off and leave it off before starting the update test.

## F. Update activation without drawing loss

This section requires an already controlled installation and a later deployment whose built
files differ. Ask the maintainer for the **starting SHA**, **replacement SHA**, and one visible
change that identifies the replacement. Do not clear Website Data or reinstall between them.

24. On the starting deploy, draw a distinctive update-test mark. Record the starting SHA and
    leave Kid Pix installed. Tell the maintainer you are ready for the replacement deploy.
25. After the maintainer confirms that the replacement SHA is live, force-quit and reopen the
    Home Screen app once. This triggers the update check in the same installed-app storage
    context. **PASS** if the drawing remains visible, the page does not enter a reload loop,
    and **Update Ready — Reload** appears. Allow up to one minute on the live network.
26. Tap **Update Ready — Reload** once. **PASS** if the identifying replacement change appears,
    the update-test mark remains, and Kid Pix does not ask for a second reload.
27. Force-quit and relaunch once more. **PASS** if the replacement remains active and the
    update-test drawing still restores.

If the starting deploy predates the **Update Ready — Reload** protocol, close every Kid Pix
Safari tab and Home Screen instance, reopen once, and record **LEGACY CROSSOVER**. That is a
one-time migration observation, not the normal result for items 24–27.

## Recorded device run — 2026-08-31

Device model, iPadOS version, and deploy SHA were not supplied. These observations are the
authoritative physical-device evidence that triggered the next repair:

- Item 2: **OBSERVED** — Safari sound worked but lagged behind the Pencil stroke.
- Item 7: **FAIL** — the installed PWA was silent on its first launch; sound worked after a
  force-quit and second launch. Portrait and landscape both worked.
- Item 10: **FAIL (Print)** — all five actions were reachable and otherwise worked, but Print
  included toolbars and split the drawing across two pages, including in landscape.
- Item 11: **OBSERVED — silent** with Silent Mode both off and on during the initial PWA
  launch; sound worked after force-quitting.
- Items 12–15 (old Add Picture Here flow): Photos, camera, and Files additions were processed
  and persisted, but a newly added image did not reliably remain the next reveal. A second
  Files upload briefly froze the PWA. Product decision: provide one accessible custom-picture
  library with add/use/delete; support Photos/camera for acceptance and do not require Files.
- Item 17: **FAIL** — the `.kidpix` existed in Files but was disabled in the Open picker. The
  tester also observed a `.kidpix` file plus what appeared to be a text file; exact filenames
  were not captured.
- Item 19: **PASS** — PNG export, open, and continued drawing worked.

After the next deployment, rerun items 2, 7, 10–15, and 16–20. Record the exact names of every
file created by one **Save Project** action if more than one still appears.

## Report back

Copy this block into your reply and fill it in. Short notes are enough; attach screenshots for
visual failures when practical.

```text
Date:
Tester:
iPad model:
iPadOS version:

Starting deploy SHA:
Replacement deploy SHA (items 24-27 only):

Safari tab
1:
2:
3:
4:
5:
6:

Home Screen web app and layout
7:
8:
9:
10:
11: Silent Mode off = ; Silent Mode on =

Custom Hidden Pictures
12:
13:
14:
15:

Editable project and ordinary files
16: filename =
17:
18:
19:
20:

Offline relaunch
21:
22:
23:

Update activation
24:
25:
26:
27:

Anything else noticed:
```
