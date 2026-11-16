extends Node

# Global budget tracking for debris, fire, particles etc.

var active_debris: int = 0
var max_debris: int = 64
var active_fires: int = 0
var max_fires: int = 16
var active_particles: int = 0
var max_particles: int = 128
var active_bodies: int = 0
var max_bodies: int = 64

var quality: String = "Medium" # Low, Medium, High, Auto

var _frame_time_ms: float = 0.0
var _fps: int = 60

func _ready():
	_apply_auto_quality()

func _apply_auto_quality():
	var mem_mb := OS.get_static_memory_usage() / (1024*1024)
	# heuristic: if detected high mem, go Medium else Low
	if quality == "Auto":
		if mem_mb > 800:
			quality = "Medium"
		else:
			quality = "Low"
	_apply_quality_settings()

func _apply_quality_settings():
	match quality:
		"Low":
			max_debris = 32
			max_fires = 8
			max_particles = 64
			max_bodies = 32
		"Medium":
			max_debris = 64
			max_fires = 16
			max_particles = 128
			max_bodies = 64
		"High":
			max_debris = 96
			max_fires = 24
			max_particles = 256
			max_bodies = 96

func set_quality(q: String):
	quality = q
	_apply_quality_settings()

func can_spawn_debris() -> bool:
	return active_debris < max_debris

func register_debris():
	active_debris += 1

func unregister_debris():
	active_debris = maxi(0, active_debris - 1)

func can_spawn_fire() -> bool:
	return active_fires < max_fires

func register_fire():
	active_fires += 1

func unregister_fire():
	active_fires = maxi(0, active_fires - 1)

func can_spawn_body() -> bool:
	return active_bodies < max_bodies

func register_body():
	active_bodies += 1

func unregister_body():
	active_bodies = maxi(0, active_bodies - 1)

func get_debug_stats() -> Dictionary:
	return {
		"fps": Engine.get_frames_per_second(),
		"frame_ms": _frame_time_ms,
		"debris": active_debris,
		"bodies": active_bodies,
		"fires": active_fires,
		"particles": active_particles,
		"quality": quality,
		"mem_mb": OS.get_static_memory_usage() / (1024*1024),
	}
