extends Control

@onready var title: Label = $CenterContainer/VBoxContainer/Title
@onready var time_label: Label = $CenterContainer/VBoxContainer/Time
@onready var stars_label: Label = $CenterContainer/VBoxContainer/Stars

func setup(mission_id: String, success: bool, time_sec: float):
	visible = true
	if title:
		title.text = Localization.tr_key("result.success") if success else Localization.tr_key("result.fail")
	if time_label:
		time_label.text = "%s: %02d:%02d" % [Localization.tr_key("result.time"), int(time_sec)/60, int(time_sec)%60]
	if stars_label:
		var stars := 3 if time_sec < 180 else (2 if time_sec < 300 else 1)
		if not success: stars = 0
		stars_label.text = "%s: %d" % [Localization.tr_key("result.stars"), stars]
	# buttons
	var btn_cont := $CenterContainer/VBoxContainer/Buttons if has_node("CenterContainer/VBoxContainer/Buttons") else null
	if btn_cont == null:
		btn_cont = HBoxContainer.new()
		btn_cont.name = "Buttons"
		$CenterContainer/VBoxContainer.add_child(btn_cont)
		var retry := Button.new()
		retry.text = Localization.tr_key("result.retry")
		retry.pressed.connect(func(): get_tree().reload_current_scene())
		btn_cont.add_child(retry)
		var cont := Button.new()
		cont.text = Localization.tr_key("result.continue")
		cont.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/ui/mission_select.tscn"))
		btn_cont.add_child(cont)
	get_tree().paused = true
