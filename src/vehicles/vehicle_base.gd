extends VehicleBody3D
class_name VehicleBase

var max_steer := 0.5
var engine_force := 800.0

func _physics_process(delta):
	var input := Input.get_axis("move_left", "move_right") if InputMap.has_action("move_left") else 0.0
	var throttle := Input.get_axis("move_back", "move_forward") if InputMap.has_action("move_forward") else 0.0
	steering = input * max_steer
	engine_force = throttle * engine_force
