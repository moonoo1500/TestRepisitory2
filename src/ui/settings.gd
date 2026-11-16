extends Control

@onready var lang_btn: OptionButton = $VBoxContainer/Language
@onready var quality_btn: OptionButton = $VBoxContainer/Quality
@onready var sens_slider: HSlider = $VBoxContainer/Sensitivity
@onready var haptics_check: CheckBox = $VBoxContainer/Haptics

func _ready():
	_build_ui()
	load_values()

func _build_ui():
	if lang_btn == null:
		# create simple fallback
		var v := VBoxContainer.new()
		v.name = "VBoxContainer"
		add_child(v)
		lang_btn = OptionButton.new()
		lang_btn.name = "Language"
		v.add_child(lang_btn)
		quality_btn = OptionButton.new()
		quality_btn.name = "Quality"
		v.add_child(quality_btn)
		sens_slider = HSlider.new()
		sens_slider.name = "Sensitivity"
		v.add_child(sens_slider)
		haptics_check = CheckBox.new()
		haptics_check.name = "Haptics"
		v.add_child(haptics_check)
		var back := Button.new()
		back.text = "Back"
		back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/main.tscn"))
		v.add_child(back)
	lang_btn.clear()
	lang_btn.add_item("Русский", 0)
	lang_btn.add_item("English", 1)
	lang_btn.item_selected.connect(_on_lang)
	quality_btn.clear()
	for q in ["Low","Medium","High","Auto"]:
		quality_btn.add_item(q)
	quality_btn.item_selected.connect(_on_quality)
	if sens_slider:
		sens_slider.min_value = 0.2
		sens_slider.max_value = 2.0
		sens_slider.step = 0.1
		sens_slider.value_changed.connect(_on_sens)
	if haptics_check:
		haptics_check.toggled.connect(_on_haptics)

func load_values():
	var lang: String = GameState.settings.get("language", "ru")
	lang_btn.selected = 0 if lang == "ru" else 1
	var q: String = GameState.settings.get("quality", "Auto")
	var idx := ["Low","Medium","High","Auto"].find(q)
	if idx >=0: quality_btn.selected = idx
	if sens_slider:
		sens_slider.value = GameState.settings.get("sensitivity", 1.0)
	if haptics_check:
		haptics_check.button_pressed = GameState.settings.get("haptics", true)

func _on_lang(index: int):
	var lang := "ru" if index == 0 else "en"
	GameState.set_language(lang)

func _on_quality(index: int):
	var q := ["Low","Medium","High","Auto"][index]
	GameState.set_quality(q)

func _on_sens(v: float):
	GameState.settings["sensitivity"] = v
	SaveSystem.save_settings(GameState.settings)

func _on_haptics(b: bool):
	GameState.settings["haptics"] = b
	SaveSystem.save_settings(GameState.settings)
