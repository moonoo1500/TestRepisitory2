extends Control

@onready var list: VBoxContainer = $ScrollContainer/VBoxContainer
@onready var title: Label = $Title

var missions := ["tutorial", "m1_factory", "m2_port", "m3_dome", "m4_final"]

func _ready():
	update_text()
	_build_list()
	if GameState.has_signal("language_changed"):
		GameState.language_changed.connect(func(_l): update_text())

func update_text():
	if title:
		title.text = Localization.tr_key("menu.missions")

func _build_list():
	if list == null: return
	for c in list.get_children():
		c.queue_free()
	await get_tree().process_frame
	for mid in missions:
		var def_path := "res://levels/data/%s.json" % mid
		if not FileAccess.file_exists(def_path): continue
		var f := FileAccess.open(def_path, FileAccess.READ)
		var parsed = JSON.parse_string(f.get_as_text())
		f.close()
		var t_ru: String = parsed.get("title_ru", mid)
		var t_en: String = parsed.get("title_en", mid)
		var display := t_ru if GameState.settings["language"] == "ru" else t_en
		var btn := Button.new()
		btn.text = display
		btn.custom_minimum_size = Vector2(0, 64)
		var unlocked := GameState.is_mission_unlocked(mid)
		btn.disabled = not unlocked
		if not unlocked:
			btn.text += " (🔒)"
		else:
			var prog: Dictionary = GameState.progress.get(mid, {})
			if prog.has("stars"):
				btn.text += "  ★%d" % prog["stars"]
		btn.pressed.connect(func(): _start_mission(mid))
		list.add_child(btn)
	var back := Button.new()
	back.text = Localization.tr_key("pause.quit")
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/main.tscn"))
	list.add_child(back)

func _start_mission(mid: String):
	LevelManager.load_level_def(mid)
	GameState.current_mode = GameState.GameMode.MISSION if mid != "tutorial" else GameState.GameMode.TUTORIAL
	GameState.current_mission = mid
	var scene_map := {
		"tutorial": "res://scenes/levels/tutorial.tscn",
		"m1_factory": "res://scenes/levels/level_01_factory.tscn",
		"m2_port": "res://scenes/levels/level_02_port.tscn",
		"m3_dome": "res://scenes/levels/level_03_dome.tscn",
		"m4_final": "res://scenes/levels/level_04_final.tscn",
	}
	var path: String = scene_map.get(mid, "res://scenes/levels/sandbox.tscn")
	if ResourceLoader.exists(path):
		get_tree().change_scene_to_file(path)
	else:
		get_tree().change_scene_to_file("res://scenes/levels/sandbox.tscn")
