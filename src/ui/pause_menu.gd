extends CanvasLayer

func _unhandled_input(event):
	if event.is_action_pressed("pause"):
		toggle()

func toggle():
	visible = not visible
	get_tree().paused = visible
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE if visible else Input.MOUSE_MODE_CAPTURED)

func _on_resume():
	visible = false
	get_tree().paused = false
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _on_restart():
	get_tree().paused = false
	get_tree().reload_current_scene()

func _on_quit():
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/main.tscn")
