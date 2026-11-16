# КРОШЕВО: Протокол Демонтажа — SHATTERLINE

**Жанр:** Физическая sandbox-головоломка, разрушаемый воксель, от 1-го лица  
**Движок:** Godot 4.4.1 (GDScript, Vulkan + GL fallback)  
**Платформа:** Android arm64-v8a (minSdk 24, targetSdk 34) + Linux  
**Языки:** Русский (основной), английский резерв

Оригинальная игра — без заимствованных ассетов или кода. Вдохновение — только общие жанровые идеи разрушаемого вокселя.

## Возможности
- Полностью разрушаемый воксельный мир (чанки 16³, greedy мешинг, бюджетированная физика)
- 5 инструментов: Кувалда «Удар-5», Терморез «Кромка», Заряд «Хлопок», Распылитель «Ингибитор», Проектор «Пролет»
- 2 машины: Кар «Муравей», Вездеход «Краб»
- 4 миссии + обучение + песочница, 3 локации (Завод, Порт, Купол)
- Огонь/дым, взрывы, обрушения (граф опор BFS), пулинг, LOD
- Сенсор: два стика, настройка чувствительности, вибрация, геймпад
- Профили качества Low/Medium/High/Auto
- Бенчмарк с воспроизводимыми сценариями

## Быстрый старт (десктоп)
```bash
git clone https://github.com/moonoo1500/TestRepisitory2.git
cd TestRepisitory2
git checkout arena/479e0e9e-testrepisitory2
# Открыть в Godot 4.4.1 и запустить scenes/main.tscn
```

## Установка на Android
1. Скачайте APK из GitHub Release `v0.1.0-alpha`
2. Включите «Установка неизвестных приложений» в Android
3. Установите: `adb install -r shatterline-v0.1.0-alpha.apk` или через файловый менеджер
4. Запуск — иконка «КРОШЕВО»

## Сборка
Подробно в [docs/BUILD_ANDROID_RU.md](docs/BUILD_ANDROID_RU.md)

## Документация
- [План реализации](docs/IMPLEMENTATION_PLAN_RU.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [Сборка Android](docs/BUILD_ANDROID_RU.md)
- [QA отчёт](docs/QA_REPORT_RU.md)

## Тесты
```bash
pytest tests/
python3 tests/run_tests.py
```

## Лицензия
MIT — см. [LICENSE](LICENSE). Сторонние ресурсы — [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
