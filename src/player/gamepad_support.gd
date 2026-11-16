extends Node

# Maps gamepad axes to player movement and look. Supports Bluetooth gamepad.

var player: Node

func setup(p: Node):
	player = p

func _process(delta):
	if player == null: return
	# Right stick look
	var look_x := Input.get_joy_axis(0, 2)
	var look_y := Input.get_joy_axis(0, 3)
	if abs(look_x) > 0.2 or abs(look_y) > 0.2:
		player.set_touch_look(Vector2(look_x, look_y) * 60 * delta)
	# Left stick move handled via InputMap directly; nothing else needed
	# Button mapping: X/A for use
	if Input.is_joy_button_pressed(0, 2):
		if player.has_method("try_use_tool"):
			player.try_use_tool()
