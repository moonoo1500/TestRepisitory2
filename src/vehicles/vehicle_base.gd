extends CharacterBody3D
class_name VehicleBase

var max_steer := 0.5
var engine_force := 800.0

func _physics_process(delta):
	var input := Input.get_axis("move_left", "move_right") if InputMap.has_action("move_left") else 0.0
	var throttle := Input.get_axis("move_back", "move_forward") if InputMap.has_action("move_forward") else 0.0
	# placeholder vehicle logic (no VehicleBody3D to avoid export issues)
	velocity.x = input * 5.0
	velocity.z = throttle * 8.0
	move_and_slide()
