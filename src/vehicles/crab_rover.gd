extends "res://src/vehicles/vehicle_base.gd"

var has_cargo: bool = false

func _ready():
	mass = 1200.0
	max_steer = 0.45
	engine_force = 1600.0

func pickup():
	if has_cargo: return
	has_cargo = true

func drop():
	if not has_cargo: return
	has_cargo = false
