extends RefCounted
class_name ToolBase

var id: String
var name_ru: String
var name_en: String
var damage: int
var range: float
var cooldown: float
var last_use: float = -999.0

func _init(p_id: String, p_ru: String, p_en: String, p_dmg: int, p_range: float, p_cd: float):
	id = p_id
	name_ru = p_ru
	name_en = p_en
	damage = p_dmg
	range = p_range
	cooldown = p_cd

func can_use() -> bool:
	return (Time.get_ticks_msec() / 1000.0 - last_use) >= cooldown

func use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	if not can_use():
		return false
	last_use = Time.get_ticks_msec() / 1000.0
	return _do_use(origin, dir, grid, destruction)

func _do_use(_origin: Vector3, _dir: Vector3, _grid: VoxelGrid, _destruction: DestructionSystem) -> bool:
	return false

func get_display_name() -> String:
	var lang: String = GameState.settings.get("language", "ru")
	if lang == "ru":
		return name_ru
	return name_en
