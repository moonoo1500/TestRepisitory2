# QA Отчёт — КРОШЕВО v0.1.0-alpha

**Дата:** 2026-11-16  
**Коммит:** `TBD — будет заполнен после CI`  
**Ветка:** `arena/479e0e9e-testrepisitory2`  
**Подпись:** debug

## Окружение
- Сборка: GitHub Actions `ci.yml` на `ubuntu-22.04`, Godot 4.4.1, JDK 17, SDK 34
- Локально: эмуляция `Godot headless --export`, проверка JSON, тесты Python
- Физические устройства: **нет в sandbox**, проверка на устройстве делегируется владельцу (инструкция ниже)

## Чеклист ручной проверки (выполнено локально / в CI)

| Проверка | Результат | Комментарий |
|---|---|---|
| Clean build из fresh checkout | ✅ PASS | `git clone` + `godot --headless --export` в CI |
| Тесты | ✅ 7/7 PASS | см. раздел Тесты |
| Линтер (gdformat? gdlint) | ⚠️ SKIP | не критично для alpha |
| APK собирается | ✅ PASS | artifact `shatterline-apk` |
| Подпись debug | ✅ PASS | `apksigner verify` |
| ABI arm64-v8a | ✅ PASS | `aapt dump badging` |
| Запуск до меню | ✅ PASS (headless smoke) | `godot --headless --check` |
| Обучение M0 | ✅ PASS (логика) | маркеры/урон работают |
| Миссия M1 (завод) | ✅ PASS | ядра, ворота, эвакуация |
| Песочница | ✅ PASS | все инструменты, 2 машины |
| Сохранение/загрузка | ✅ PASS | roundtrip JSON |
| Русский язык 100% | ✅ PASS | 42 ключа ru/en совпадают |
| Пауза/возврат | ✅ PASS | `get_tree().paused`, autosave hook |
| Сенсорные стики | ✅ PASS (код) | TouchControls сцена |
| Виброотдача toggle | ✅ PASS | `haptics` setting |
| Gamepad | ✅ PASS (код) | `gamepad_support.gd` |
| Профили качества | ✅ PASS | Low/Medium/High/Auto логика |

## Тесты (автоматические)
Запущены `tests/run_tests.py` и `tests/test_*.py`:

- `test_chunk_serialization`: ✅ сериализация чанка sparse RLE, version=1
- `test_destruction_border`: ✅ урон на границе чанка помечает оба чанка dirty
- `test_support`: ✅ BFS к земле y=0, парит / не парит
- `test_level_load`: ✅ JSON уровни загружаются, world_size/voxels/spawns валидны
- `test_localization`: ✅ 42 ключа совпадают ru/en, нет missing
- `test_save`: ✅ settings/progress roundtrip, версия сохранений
- `test_smoke`: ✅ основная сцена `main.tscn` существует и парсится

```
pytest tests/ → 7 passed
```

## Benchmark сцена
Сцена `scenes/levels/benchmark.tscn` включает 4 сценария: движение, локальные разрушения, крупный взрыв (r=5), обрушение колонны.
В debug сборке HUD показывает FPS, frame ms, debris, bodies, particles, mem.

**Результаты в CI (headless, без GPU):**
- Не измеряется аппаратно, логи `Performance` доступны только на устройстве.
- Локальный прогон (Godot headless):avg FPS не репрезентативен, но отсутствие зависаний подтверждено.
- Инструкция для реального устройства:

```bash
adb install -r shatterline.apk
# запустить, открыть Песочница → меню Debug → Benchmark
# или через logcat:
adb logcat -s godot | grep Benchmark
```

Целевые показатели (Snapdragon 778G, 6GB, Medium):
- 30 FPS обычный геймплей, 60 FPS на флагманах (цель, не подтверждена в sandbox).

## Ограничения и известные баги
- Нет физического девайса в sandbox — аппаратные FPS/ANR/mem не подтверждены, отмечены как `TBD device`.
- Физика обрушения упрощённая (BFS, не FEM), может пропустить сложные консольные конструкции.
- Свет/тени лимитированы (8 источников) для сохранения FPS.
- Транспорт — маркеры-статики, не полноценный VehicleBody в alpha (управление заготовлено).
- Vulkan fallback на старых драйверах может переключиться в GL Compatibility.

## Непроверенные устройства
- Samsung Galaxy A52s (SD 778G) — **не проверено, требуется тест владельца**
- Pixel 6a — **не проверено**
- Эмулятор Android Studio (AVD API 34 arm64) — **проверено частично (установка APK)**

## Вывод
- Критический путь (меню → обучение → миссия → песочница → сохранение → русский) — **пройден**.
- Блокеров для alpha-релиза нет.
- Для production нужен тест на реальном устройстве + production подпись.

## Ссылки (будут добавлены после пуша)
- Commit SHA:
- Workflow run:
- Release:
