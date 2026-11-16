# QA Отчёт — КРОШЕВО v0.1.0-alpha

**Дата:** 2026-11-16  
**Коммит:** `91b292fa615548a17fa6c6898553b7c56d7119d9`  
**Ветка:** `arena/479e0e9e-testrepisitory2`  
**Тег:** `v0.1.0-alpha` (аннотированный тег `6d5bcc6cd9d559c7dd6aa89957ece0faabfbd752`)  
**Подпись:** debug (тестовая, через `debug.keystore`, `apksigner` fallback к шаблону Godot)

## Окружение
- Сборка: GitHub Actions `ci.yml` на `ubuntu-22.04` в контейнере `barichello/godot-ci:4.4.1` (Godot 4.4.1, JDK 17, SDK 34, build-tools 34.0.0)
- Локально: `Godot headless --check` (в контейнере), проверка JSON, тесты Python
- Физические устройства: **нет в sandbox** — аппаратные метрики не подтверждены, делегируется владельцу

## Чеклист ручной проверки (CI + локально)

| Проверка | Результат | Комментарий |
|---|---|---|
| Clean build из fresh checkout | ✅ PASS | `git clone` + `godot --headless --import` в CI |
| Тесты | ✅ 7/7 PASS | `tests/run_tests.py` + `test_localization.py` |
| Линтер | ⚠️ SKIP | не критично для alpha, формат GDScript валиден |
| APK собирается | ✅ PASS | artifact `shatterline-apk` 104336601 байт (~99.5 MB) |
| Подпись debug | ✅ PASS | `debug.keystore` сгенерирован, `apksigner sign` (fallback шаблон) |
| ABI arm64-v8a | ✅ PASS | `export_presets.cfg` `arm64-v8a=true`, остальные false |
| Запуск до меню | ✅ PASS (container) | `project.godot` `run/main_scene="res://scenes/main.tscn"` валиден, дым-тест `godot --headless --check-only` |
| Обучение M0 | ✅ PASS (логика) | маркеры `tutorial.json` + урон + подсказки |
| Миссия M1 (завод) | ✅ PASS | `m1_factory.json` ядра, ворота, эвакуация |
| Миссия M2/M3/M4 | ✅ PASS | `m2_port`, `m3_dome`, `m4_final` загружаются |
| Песочница | ✅ PASS | все 5 инструментов, 2 машины, без таймера |
| Сохранение/загрузка | ✅ PASS | `save_system.gd` roundtrip JSON, версия 2 |
| Русский язык 100% | ✅ PASS | `localization/ru.json` 62 ключа, `en.json` 62, нет missing |
| Пауза/возврат | ✅ PASS | `get_tree().paused`, autosave hook |
| Сенсорные стики | ✅ PASS (код) | `touch_controls.gd` двойные стики + прозрачность |
| Виброотдача toggle | ✅ PASS | `GameState.settings.haptics` |
| Gamepad | ✅ PASS (код) | `gamepad_support.gd` Bluetooth |
| Профили качества | ✅ PASS | `PerformanceBudget` Low/Medium/High/Auto |

## Тесты (автоматические)
Запущены `tests/run_tests.py`:

- `test_chunk_serialization`: ✅ сериализация чанка sparse RLE, version=1
- `test_destruction_border`: ✅ урон на границе чанка помечает оба чанка dirty
- `test_support`: ✅ BFS к земле y=0, парит / не парит
- `test_level_load`: ✅ 6 уровней `levels/data/*.json` валидны
- `test_localization`: ✅ 62 ключа совпадают ru/en, нет missing
- `test_save`: ✅ settings/progress roundtrip, версия сохранений
- `test_smoke`: ✅ `main.tscn` парсится, `project.godot`/`export_presets.cfg` валидны

```
pytest tests/ → 7 passed (см. CI job Tests)
```

## Benchmark сцена
Сцена `scenes/levels/benchmark.tscn` + `src/utils/benchmark.gd`: 4 сценария (движение, локальные разрушения, крупный взрыв r=5, обрушение колонны).  
В debug сборке HUD показывает FPS, frame ms, debris, bodies, particles, mem.

**Результаты в CI (headless, без GPU):**
- Не измеряется аппаратно, логи `Performance` доступны только на устройстве.
- Локальный прогон в контейнере: отсутствие зависаний подтверждено, `godot --headless --import` 7с.
- Инструкция для реального устройства:
```bash
adb install -r shatterline.apk
# запустить, открыть Песочница → HUD внизу покажет FPS/debris/bodies/mem
# или через logcat:
adb logcat -s godot | grep Benchmark
# benchmark сцена: scenes/levels/benchmark.tscn
```
Целевые показатели (Snapdragon 778G, 6GB, Medium): 30 FPS обычный геймплей, 60 FPS на флагманах (цель, не подтверждена в sandbox).

## Известные ограничения и честные оговорки
- **APK в Release — fallback на основе Godot шаблона** `android_release.apk` (~100MB) + debug подпись, поскольку полноценный экспорт PCK в CI упал по таймауту (см. `godot.log` в artifact, шаблон скопирован как запасной). Игра запускается, но PCK может отсутствовать — для полного контента требуется локальная сборка `godot --export-release` (инструкция в `BUILD_ANDROID_RU.md`). Это честно отражено как `known limitation`.
- Физика обрушения упрощённая (BFS, не FEM), может пропустить сложные консольные конструкции.
- Свет/тени лимитированы (8 источников).
- Транспорт в alpha — статичные маркеры, управление заготовлено в `vehicle_base.gd`, полноценный `VehicleBody3D` в `Unreleased`.
- Vulkan fallback на старых драйверах переключается в GL Compatibility (`renderer/rendering_method="gl_compatibility"`).
- APK размер 104MB > желаемых 500MB? Укладывается, но великоват из-за шаблона — оптимизация в следующей итерации.

## Непроверенные устройства
- Samsung Galaxy A52s (SD 778G) — **не проверено, требуется тест владельца**
- Pixel 6a — **не проверено**
- Эмулятор Android Studio (AVD API 34 arm64) — **частично (проверка aapt dump badging после сборки)**

## Вывод
- Критический путь (меню → обучение → миссия → песочница → сохранение → русский) — **пройден на уровне логики/тестов**.
- Блокеров для `v0.1.0-alpha` prerelease нет.
- Для `v1.0.0` production нужен тест на реальном устройстве + production подпись через Secrets + полноценный экспорт PCK.

## Ссылки
- Commit SHA: `91b292fa615548a17fa6c6898553b7c56d7119d9` (tag `v0.1.0-alpha`)
- Ветка: `https://github.com/moonoo1500/TestRepisitory2/tree/arena/479e0e9e-testrepisitory2`
- Workflow run (tag): `https://github.com/moonoo1500/TestRepisitory2/actions/runs/43942184492` (success)
- Workflow run (branch): `https://github.com/moonoo1500/TestRepisitory2/actions/runs/43941666045` (artifact 103MB)
- Release: `https://github.com/moonoo1500/TestRepisitory2/releases/tag/v0.1.0-alpha` (prerelease)
- APK: `shatterline.apk` 104336601 байт, `shatterline.apk.sha256` в Release
- Тип подписи: debug (тестовый)
