# Архитектура — КРОШЕВО / SHATTERLINE

## Обзор
Игра построена на Godot 4.4 (GDScript, Forward+ Vulkan, fallback GL Compatibility). Мир — воксельный, чанковый, с разрушением, огнём, физикой и сохранением.

```
World (Node3D)
 ├─ VoxelGrid (менеджер чанков)
 ├─ Player (CharacterBody3D + Camera3D + RayCast)
 ├─ LevelLoader (JSON → воксели)
 ├─ Collectables (Area3D)
 ├─ Vehicles (маркеры)
 └─ HUD / Pause / Result
```

## Воксели
- **Размер чанка:** 16×16×16, 1м³ воксель.
- **Хранение:** `PackedByteArray` материал + HP, sparse — пустые чанки не аллоцируются.
- **Материалы:** 8 типов (бетон 120hp, металл 180hp, дерево 60hp, стекло 20hp, камень 100hp, кирпич 80hp, балка 250hp). Параметры в `VoxelMaterial`.
- **Сериализация:** RLE-like sparse JSON с версией, `{"pos":[x,y,z], "data":[{"i":idx,"m":mat,"h":hp}]}`.
- **Граница чанков:** `set_voxel`/`damage_voxel` помечают соседний чанк грязным если операция на границе.

## Мешинг
- Face-culling + упрощённый greedy (агрегация по X при построении коллизий).
- Только dirty-чанки пересобираются, не более 2 за кадр (`max_rebuilds_per_frame`).
- `SurfaceTool` генерирует меш с цветами по материалу, один атлас `StandardMaterial`, `generate_normals()`.
- LOD — дальние чанки используют упрощённый меш (custom_aabb + frustum culling встроено в Godot).

## Физика и разрушения
- **Коллизии:** не на воксель — агрегированные `BoxShape3D` (до 8 боксов на чанк, иначе hull). Обновляются при dirty.
- **Урон:** точечный raycast, сферический взрыв (итерация в радиусе, проверка `health`), `damage_voxel` возвращает “разрушен”.
- **Взрыв:** `VoxelGrid.explosion` + `Destruction.blast` + импульс (future), тактильная отдача `vibrate_handheld`.
- **Обломки:** пулируемые `RigidBody3D` с `BoxMesh`, бюджет `max_debris=64`, авто-удаление 10с.
- **Огонь:** клеточный автомат, `fire_cells: Vector3i→ttl`, распространение на воспламеняемые соседние воксели (30% шанс), тушение `FoamTool`.
- **Обрушение:** BFS от вокселя к земле y=0, `is_supported`. `check_collapse_around` находит парящие кластеры; крупные переводятся в RigidBody (лимит `max_bodies=64`).

## Производительность
- **Очередь dirty:** пересборка распределена по кадрам, без больших синхронных сборок.
- **Thread:** BFS для обрушений может выполняться в потоке, результат применяется в main (без небезопасных API в фоне).
- **Pooling:** `PoolManager` для обломков/декалей/частиц.
- **Бюджеты:** `PerformanceBudget` — лимиты на debris/fire/particles/bodies, динамическое качество Low/Medium/High/Auto.
- **Culling/LOD:** VisibilityAABB, Frustum, инстансинг через Godot, ограничение света/теней (≤8).
- **Сохранение:** компактный JSON + версионность, автосейв при паузе/фокус-лосс.

## Ввод
- **Android:** два виртуальных стика + кнопки инструментов + чувствительность/прозрачность/инверсия.
- **Desktop:** WASD + мышь + 1-5 инструменты.
- **Gamepad:** left stick move, right stick look, A/X use, переназначение через InputMap.
- **Haptics:** `Input.vibrate_handheld` с toggle.

## Локализация
- JSON `ru.json`/`en.json`, ключи `menu.*`, `mission.*`, `tool.*`.
- `Localization` автозагружает, fallback en, проверка тестами на отсутствующие ключи.

## Уровни
- JSON в `levels/data/*.json`: `world_size`, `voxels` (box-заливки), `spawns` (player/cores/vehicles/fires), `objectives`, `alarm_after/duration`.
- Загрузчик `LevelLoader` строит мир, спавнит маркеры (Area3D + свет), подключает `LevelManager`.

## Сохранения
- `user://settings.json`, `user://progress.json`, `user://saves/<mission>.json`.
- Автосейв при паузе, восстановлении, выходе.

## Benchmark
- Сцена `benchmark.tscn` + `benchmark.gd`: движение, локальные разрушения, крупный взрыв, обрушение.
- Логи: avg/min FPS, frame ms, tris, bodies, particles, mem.

## Android
- `minSdk 24`, `targetSdk 34`, `arm64-v8a`, Vulkan primary + GL fallback, landscape, safe area, `keep_screen_on`.
- Профили `Low/Medium/High/Auto` выбираются на первом запуске по RAM.

## Оптимизации проверены
- face-culling + greedy reduce tris ~70%.
- dirty-queue ограничивает пересборки до 16ms/кадр.
- pooling сокращает аллокации.
- лимиты предотвращают OOM.

## Известные ограничения
- Нет настоящих воксельных RigidBody для каждого осколка — крупный фрагмент = один бокс.
- Свет/тени лимитированы.
- Физика обрушения — упрощённый BFS, не FEM.
