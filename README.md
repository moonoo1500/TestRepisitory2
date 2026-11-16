# SHATTERLINE: Demolition Protocol — КРОШЕВО

**Genre:** Physics sandbox puzzle, destructible voxel, first-person  
**Engine:** Godot 4.4.1 (GDScript, Vulkan + GL fallback)  
**Platform:** Android arm64-v8a (minSdk 24, targetSdk 34) + Linux  
**Languages:** Russian (primary), English fallback

Original game — no borrowed assets or code. Inspired by generic destructible voxel sandbox ideas only.

## Features
- Fully destructible voxel world (chunked 16³, greedy meshing, budgeted physics)
- 5 tools: Hammer “Strike-5”, Cutter “Edge”, Charge “Clap”, Foam “Inhibitor”, Bridge “Span”
- 2 vehicles: Cart “Ant”, Rover “Crab”
- 4 missions + tutorial + free sandbox, 3 distinct locations (Factory, Port, Dome)
- Fire/smoke, explosions, collapses (BFS support graph), pooling, LOD
- Touch dual-sticks, haptics toggle, Bluetooth gamepad
- Quality profiles Low/Medium/High/Auto
- Benchmark scene with reproducible scenarios

## Quick Start (Desktop)
```bash
git clone https://github.com/moonoo1500/TestRepisitory2.git
cd TestRepisitory2
git checkout arena/479e0e9e-testrepisitory2
# Open in Godot 4.4.1 and run scenes/main.tscn
```

## Android Build
See [docs/BUILD_ANDROID_RU.md](docs/BUILD_ANDROID_RU.md) — clean build, CI, signing.

## Docs
- [Implementation Plan (RU)](docs/IMPLEMENTATION_PLAN_RU.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Build Android (RU)](docs/BUILD_ANDROID_RU.md)
- [QA Report (RU)](docs/QA_REPORT_RU.md)

## Tests
```bash
pytest tests/
python3 tests/run_tests.py
```

## Release
APK attached to GitHub Release `v0.1.0-alpha` (debug-signed). SHA256 in Release notes.

## License
MIT — see [LICENSE](LICENSE). Third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
