# Game source and credits

This site uses the JavaScript reimplementation of the 1997 Pikachu Volleyball game by Kyutae Lee, from [gorisanson/pikachu-volleyball](https://github.com/gorisanson/pikachu-volleyball) at commit `6bc096ad9e25137ae27eb536a6eac1d056be7506`.

The reimplementation reverse engineers the original game's physics and AI and includes sprites and sounds extracted from it. The 1997 game credits are SACHI SOFT / SAWAYAKAN Programmers and Satoshi Takenouchi. The source package declares `UNLICENSED`; attribution here does not claim ownership or a new license for those materials.

Local changes add Chinese as the default entry point, automatic loading, and touch controls that send the original keyboard inputs. The core physics, AI, 432×304 field, sprites, sounds, menu, and 25 FPS game loop come from the upstream reimplementation.
