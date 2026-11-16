extends Node

enum GameMode { TUTORIAL, SANDBOX, MISSION }

var current_mode: int = GameMode.TUTORIAL
var current_mission: String = ""
var completed_missions: Array[String] = []
var progress: Dictionary = {} # mission_id -> {"best_time": float, "stars": int}
var settings: Dictionary = {
	"language": "ru",
	"quality": "Auto",
	"sensitivity": 1.0,
	"invert_y": false,
	"haptics": true,
	"music_volume": 0.8,
	"sfx_volume": 0.9,
}

signal progress_updated
signal language_changed(lang: String)

func _ready():
	# auto language from OS
	var sys_locale := OS.get_locale().left(2)
	if sys_locale == "ru" or sys_locale == "en":
		settings["language"] = sys_locale
	else:
		settings["language"] = "ru"
	# load saved
	var loaded := SaveSystem.load_settings()
	if loaded.size() > 0:
		for k in loaded.keys():
			settings[k] = loaded[k]
	Localization.set_language(settings["language"])
	PerformanceBudget.set_quality(settings["quality"])
	# load progress
	var prog := SaveSystem.load_progress()
	if prog.has("completed"):
		completed_missions = prog["completed"]
	if prog.has("progress"):
		progress = prog["progress"]

func set_language(lang: String):
	settings["language"] = lang
	Localization.set_language(lang)
	SaveSystem.save_settings(settings)
	emit_signal("language_changed", lang)

func set_quality(q: String):
	settings["quality"] = q
	PerformanceBudget.set_quality(q)
	SaveSystem.save_settings(settings)

func mark_mission_complete(id: String, time_sec: float):
	if not id in completed_missions:
		completed_missions.append(id)
	var stars := 1
	if time_sec < 180: stars = 3
	elif time_sec < 300: stars = 2
	progress[id] = {"best_time": time_sec, "stars": stars, "completed_at": Time.get_unix_time_from_system()}
	SaveSystem.save_progress({"completed": completed_missions, "progress": progress})
	emit_signal("progress_updated")

func is_mission_unlocked(id: String) -> bool:
	# linear unlock
	var order := ["tutorial", "m1_factory", "m2_port", "m3_dome", "m4_final"]
	var idx := order.find(id)
	if idx <= 0: return true
	var prev: String = order[idx - 1]
	return prev in completed_missions

func can_play_sandbox() -> bool:
	return true
