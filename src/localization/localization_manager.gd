extends Node

var current_lang: String = "ru"
var strings: Dictionary = {} # key -> {ru, en}

const FALLBACK := "en"

func _ready():
	load_locale("ru")
	load_locale("en")

func load_locale(lang: String):
	var path := "res://localization/%s.json" % lang
	if not FileAccess.file_exists(path):
		push_warning("Locale file missing: %s" % path)
		return
	var f := FileAccess.open(path, FileAccess.READ)
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if parsed is Dictionary:
		for k in parsed.keys():
			if not strings.has(k):
				strings[k] = {}
			strings[k][lang] = parsed[k]

func set_language(lang: String):
	current_lang = lang

func tr_key(key: String) -> String:
	if not strings.has(key):
		return key
	var entry: Dictionary = strings[key]
	if entry.has(current_lang):
		return entry[current_lang]
	if entry.has(FALLBACK):
		return entry[FALLBACK]
	return key

func get_available_languages() -> Array[String]:
	return ["ru", "en"]

func validate() -> Dictionary:
	var missing: Array[String] = []
	var mismatched: Array[String] = []
	var ru_keys: Array[String] = []
	var en_keys: Array[String] = []
	for k in strings.keys():
		if not strings[k].has("ru"):
			ru_keys.append(k)
		if not strings[k].has("en"):
			en_keys.append(k)
	return {"missing_ru": ru_keys, "missing_en": en_keys, "total": strings.size()}
