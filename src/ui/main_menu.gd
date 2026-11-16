extends Control

@onready var title_label: Label = $CenterContainer/VBoxContainer/Title
@onready var play_btn: Button = $CenterContainer/VBoxContainer/Play
@onready var sandbox_btn: Button = $CenterContainer/VBoxContainer/Sandbox
@onready var settings_btn: Button = $CenterContainer/VBoxContainer/Settings
@onready var exit_btn: Button = $CenterContainer/VBoxContainer/Exit

func _ready():
	update_text()
	GameState.language_changed.connect(func(_l): update_text())
	play_btn.pressed.connect(_on_play)
	sandbox_btn.pressed.connect(_on_sandbox)
	settings_btn.pressed.connect(_on_settings)
	exit_btn.pressed.connect(func(): get_tree().quit())

func update_text():
	if title_label:
		title_label.text = Localization.tr_key("menu.title")
	if play_btn:
		play_btn.text = Localization.tr_key("menu.play")
	if sandbox_btn:
		sandbox_btn.text = Localization.tr_key("menu.sandbox")
	if settings_btn:
		settings_btn.text = Localization.tr_key("menu.settings")
	if exit_btn:
		exit_btn.text = Localization.tr_key("menu.exit")

func _on_play():
	get_tree().change_scene_to_file("res://scenes/ui/mission_select.tscn")

func _on_sandbox():
	LevelManager.load_level_def("sandbox")
	GameState.current_mode = GameState.GameMode.SANDBOX
	get_tree().change_scene_to_file("res://scenes/levels/sandbox.tscn")

func _on_settings():
	get_tree().change_scene_to_file("res://scenes/ui/settings.tscn")
