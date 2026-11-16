# Сборка Android — КРОШЕВО

## Требования
- JDK 17 (Eclipse Temurin)
- Android SDK 34 (build-tools 34.0.0, platform 34)
- Godot 4.4.1 stable + export templates
- Git LFS (если есть крупные ассеты)

## Версии (зафиксировано)
- Godot: 4.4.1-stable
- JDK: 17.0.11
- Android SDK: cmdline-tools 12.0, build-tools 34.0.0
- Gradle: 8.7 (через Godot в CI; локально не нужен, Godot собирает без gradle)
- minSdk: 24 (Android 7.0)
- targetSdk: 34
- ABI: arm64-v8a (основная), опционально armeabi-v7a
- Рендерер: Forward+ (Vulkan) + fallback Compatibility (OpenGL)

## Локальная сборка (Linux)

```bash
# 1. Клон
git clone https://github.com/moonoo1500/TestRepisitory2.git
cd TestRepisitory2
git checkout arena/479e0e9e-testrepisitory2

# 2. Скачать Godot headless
wget https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_linux.x86_64.zip
unzip Godot_v4.4.1-stable_linux.x86_64.zip
chmod +x Godot_v4.4.1-stable_linux.x86_64

# 3. Экспортные шаблоны
mkdir -p ~/.local/share/godot/export_templates/4.4.1.stable
wget https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_export_templates.tpz
unzip Godot_v4.4.1-stable_export_templates.tpz -d /tmp
cp -r /tmp/templates/* ~/.local/share/godot/export_templates/4.4.1.stable/

# 4. Android SDK (если нет)
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip -d $HOME/android-sdk
export ANDROID_HOME=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/bin
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 5. Создать debug keystore (если нет production)
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Debug, OU=Debug, O=Debug, L=Debug, S=Debug, C=US"
# указать путь в Editor → Export → Android → Release keystore, или оставить debug

# 6. Сборка APK (без gradle, через Godot)
./Godot_v4.4.1-stable_linux.x86_64 --headless --export-release Android build/android/shatterline.apk

# 7. Проверка
ls -lh build/android/*.apk
aapt dump badging build/android/shatterline.apk | grep -E "package|sdkVersion|native-code"
apksigner verify --print-certs build/android/shatterline.apk
sha256sum build/android/shatterline.apk
```

## CI Сборка (GitHub Actions)
- Workflow `.github/workflows/ci.yml` автоматически:
  - ставит JDK 17, Android SDK, Godot 4.4.1
  - кеширует шаблоны
  - запускает тесты `tests/run_tests.py`
  - собирает APK `build/android/shatterline.apk`
  - публикует artifact `shatterline-apk`
  - при теге `v*` создаёт Release с APK + SHA256

```bash
git tag v0.1.0-alpha && git push origin v0.1.0-alpha
# или создать Release вручную в GitHub UI
```

## Подпись
- Debug: `debug.keystore` (в комплекте Godot) — помечается как тестовый, устанавливается, но не для Play Store.
- Production: добавьте секреты в GitHub → Settings → Secrets:
  - `ANDROID_KEYSTORE_BASE64` — base64 от keystore
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
  Workflow подхватит их автоматически; без них соберётся debug.

## Установка на устройство
```bash
adb install -r build/android/shatterline.apk
adb logcat -s godot
```

## Профили качества
В игре: Настройки → Качество → Low/Medium/High/Auto. Auto выбирает Medium если RAM > 4GB, иначе Low.

## Известные нюансы
- Видео-воспроизведение и микрофон не требуются, разрешения минимальны.
- Игра офлайн, без рекламы/телеметрии.
- Пауза/фолд обрабатывается autosave.
