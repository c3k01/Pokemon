# Game source and credits

This site uses the JavaScript reimplementation of the 1997 Pikachu Volleyball game by Kyutae Lee, from [gorisanson/pikachu-volleyball](https://github.com/gorisanson/pikachu-volleyball) at commit `6bc096ad9e25137ae27eb536a6eac1d056be7506`.

The reimplementation reverse engineers the original game's physics and AI and includes sprites and sounds extracted from it. The 1997 game credits are SACHI SOFT / SAWAYAKAN Programmers and Satoshi Takenouchi. The source package declares `UNLICENSED`; attribution here does not claim ownership or a new license for those materials.

Local changes add Chinese as the default entry point, automatic loading, and touch controls sampled alongside the original keyboard inputs. The core physics, AI, 432×304 field, sprites, sounds, menu, and 25 FPS game loop come from the upstream reimplementation.

## Touch controls

The left direction pad supports sliding and eight directions. The right buttons jump and power-hit/confirm; a finger can slide from jump to hit without lifting. Multiple fingers can combine directions and actions. Portrait places the controls below the field; landscape places them on either side, clear of the playfield and device safe areas.

Movement releases immediately. Jump and hit taps are retained until the next game frame so taps shorter than the 25 FPS frame interval are still read. Held hit does not auto-repeat, matching the original keyboard. Cancellation, focus loss, page hiding, menu interaction, and resizing clear touch state. Physical and touch inputs remain independent.

Run `npm test` for input regression checks and `npm run build` to regenerate the tracked `dist/` publication assets.
