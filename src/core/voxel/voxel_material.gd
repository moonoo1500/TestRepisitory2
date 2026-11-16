extends RefCounted
class_name VoxelMaterial

enum Type {
	AIR = 0,
	CONCRETE = 1,
	METAL = 2,
	WOOD = 3,
	GLASS = 4,
	ROCK = 5,
	BRICK = 6,
	STEEL_BEAM = 7,
}

const PROPS := {
	Type.AIR: {"hp": 0, "name_ru": "Воздух", "name_en": "Air", "flammable": false, "density": 0.0},
	Type.CONCRETE: {"hp": 120, "name_ru": "Бетон", "name_en": "Concrete", "flammable": false, "density": 2.4},
	Type.METAL: {"hp": 180, "name_ru": "Металл", "name_en": "Metal", "flammable": false, "density": 7.8},
	Type.WOOD: {"hp": 60, "name_ru": "Дерево", "name_en": "Wood", "flammable": true, "density": 0.7},
	Type.GLASS: {"hp": 20, "name_ru": "Стекло", "name_en": "Glass", "flammable": false, "density": 2.5},
	Type.ROCK: {"hp": 100, "name_ru": "Камень", "name_en": "Rock", "flammable": false, "density": 2.6},
	Type.BRICK: {"hp": 80, "name_ru": "Кирпич", "name_en": "Brick", "flammable": false, "density": 1.8},
	Type.STEEL_BEAM: {"hp": 250, "name_ru": "Балка", "name_en": "Beam", "flammable": false, "density": 7.85},
}

static func get_hp(t: int) -> int:
	return PROPS.get(t, {"hp": 0})["hp"]

static func is_flammable(t: int) -> bool:
	return PROPS.get(t, {"flammable": false})["flammable"]

static func get_name_ru(t: int) -> String:
	return PROPS.get(t, {"name_ru": "Неизвестно"})["name_ru"]

static func get_name_en(t: int) -> String:
	return PROPS.get(t, {"name_en": "Unknown"})["name_en"]

static func color_for(t: int) -> Color:
	match t:
		Type.CONCRETE: return Color(0.62, 0.62, 0.63)
		Type.METAL: return Color(0.55, 0.58, 0.62)
		Type.WOOD: return Color(0.55, 0.38, 0.2)
		Type.GLASS: return Color(0.7, 0.85, 0.95, 0.35)
		Type.ROCK: return Color(0.45, 0.44, 0.42)
		Type.BRICK: return Color(0.65, 0.28, 0.22)
		Type.STEEL_BEAM: return Color(0.35, 0.38, 0.42)
		_: return Color.TRANSPARENT
