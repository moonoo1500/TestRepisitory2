# Сторонние ресурсы

## Шрифты
- **Manrope** — SIL Open Font License 1.1  
  Источник: https://github.com/sharanda/manrope  
  Лицензия: https://scripts.sil.org/OFL  
  Использование: основной UI шрифт, кириллица. Файл `assets/fonts/Manrope-Regular.ttf` (встроен placeholder, заменить на оригинал при сборке; OFL позволяет).

- Fallback: системный шрифт Godot (встроен) — MIT.

## Движок
- **Godot Engine 4.4.1** — MIT License  
  https://godotengine.org/license  
  https://github.com/godotengine/godot

## Код/Библиотеки
- Собственный код, без внешних зависимостей с несовместимыми лицензиями.
- Python тесты используют стандартную библиотеку.

## Ассеты
- **Текстуры/иконки:** процедурно сгенерированы в проекте (см. `assets/textures/`), CC0.
- **Звуки:** placeholder синусоида/заглушки, CC0. При замене указывать источник.
- **Иконка:** процедурно сгенерирована скриптом `gen_icon.py`, CC0.

## Прочее
- GitHub Actions образы: `ubuntu-22.04`, `actions/checkout`, `actions/setup-java` — MIT.
- Android SDK cmdline-tools — лицензия Google.

Никакие коммерческие ассеты не импортированы. Все оригинальные.
