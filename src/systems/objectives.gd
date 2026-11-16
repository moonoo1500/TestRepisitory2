extends Node
class_name ObjectiveSystem

var collected: int = 0
var targets: Dictionary = {}

func register_target(id: String, pos: Vector3):
	targets[id] = {"pos": pos, "done": false}

func on_collected(id: String):
	if targets.has(id) and not targets[id]["done"]:
		targets[id]["done"] = true
		collected += 1
		LevelManager.update_objective("collect", 1)
		if GameState.settings.get("haptics", true):
			Input.vibrate_handheld(80)

func check_all_done() -> bool:
	for v in targets.values():
		if not v["done"]: return false
	return true
