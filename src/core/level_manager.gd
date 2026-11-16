extends Node

var current_level_id: String = ""
var level_data: Dictionary = {}
var objectives: Array[Dictionary] = []
var time_elapsed: float = 0.0
var alarm_active: bool = false
var alarm_time: float = 0.0

signal objective_updated(id: String, progress: float)
signal mission_completed(id: String, success: bool)
signal alarm_triggered

func load_level_def(id: String) -> Dictionary:
	var path := "res://levels/data/%s.json" % id
	if not FileAccess.file_exists(path):
		push_warning("Level not found: %s" % path)
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		level_data = parsed
		current_level_id = id
		_setup_objectives()
		return parsed
	return {}

func _setup_objectives():
	objectives.clear()
	var objs: Array = level_data.get("objectives", [])
	for o in objs:
		objectives.append({
			"id": o.get("id", ""),
			"title_ru": o.get("title_ru", ""),
			"title_en": o.get("title_en", ""),
			"target": o.get("target", 1),
			"current": 0,
			"done": false,
		})

func update_objective(id: String, delta: int = 1):
	for o in objectives:
		if o["id"] == id:
			o["current"] = mini(o["current"] + delta, o["target"])
			if o["current"] >= o["target"]:
				o["done"] = true
			emit_signal("objective_updated", id, float(o["current"])/float(o["target"]))
			_check_completion()

func _check_completion():
	var all_done := true
	for o in objectives:
		if not o["done"]:
			all_done = false
			break
	if all_done:
		complete_mission(true)

func trigger_alarm(duration: float = 180.0):
	if alarm_active: return
	alarm_active = true
	alarm_time = duration
	emit_signal("alarm_triggered")

func _process(delta):
	if current_level_id == "": return
	time_elapsed += delta
	if alarm_active:
		alarm_time -= delta
		if alarm_time <= 0:
			# fail if not completed
			complete_mission(false)

func complete_mission(success: bool):
	emit_signal("mission_completed", current_level_id, success)
	if success:
		GameState.mark_mission_complete(current_level_id, time_elapsed)

func reset():
	time_elapsed = 0.0
	alarm_active = false
	alarm_time = 0.0
	objectives.clear()
