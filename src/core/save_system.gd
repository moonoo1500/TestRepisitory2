extends Node

var save_dir := "user://saves"
var settings_path := "user://settings.json"
var progress_path := "user://progress.json"

func _ensure_dir():
	if not DirAccess.dir_exists_absolute(save_dir):
		DirAccess.make_dir_recursive_absolute(save_dir)

func save_settings(data: Dictionary) -> void:
	var f := FileAccess.open(settings_path, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()

func load_settings() -> Dictionary:
	if not FileAccess.file_exists(settings_path):
		return {}
	var f := FileAccess.open(settings_path, FileAccess.READ)
	if not f: return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		return parsed
	return {}

func save_progress(data: Dictionary) -> void:
	var f := FileAccess.open(progress_path, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()

func load_progress() -> Dictionary:
	if not FileAccess.file_exists(progress_path):
		return {}
	var f := FileAccess.open(progress_path, FileAccess.READ)
	if not f: return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		return parsed
	return {}

func save_level(mission_id: String, grid_state: Dictionary) -> void:
	_ensure_dir()
	var path := "%s/%s.json" % [save_dir, mission_id]
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		grid_state["version"] = 2
		grid_state["saved_at"] = Time.get_unix_time_from_system()
		f.store_string(JSON.stringify(grid_state))
		f.close()

func load_level(mission_id: String) -> Dictionary:
	var path := "%s/%s.json" % [save_dir, mission_id]
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if not f: return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		return parsed
	return {}

func has_save(mission_id: String) -> bool:
	return FileAccess.file_exists("%s/%s.json" % [save_dir, mission_id])

func delete_save(mission_id: String) -> void:
	var path := "%s/%s.json" % [save_dir, mission_id]
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
