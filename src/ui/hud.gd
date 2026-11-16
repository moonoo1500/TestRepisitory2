extends CanvasLayer

@onready var tool_label: Label = $TopBar/Tool
@onready var objective_label: Label = $TopBar/Objective
@onready var timer_label: Label = $TopBar/Timer
@onready var crosshair: ColorRect = $Crosshair
@onready var benchmark_label: Label = $BenchmarkLabel

var player: Node
var show_benchmark: bool = false

func setup(p: Node):
	player = p
	if player.has_signal("tool_changed"):
		player.tool_changed.connect(_on_tool_changed)

func _ready():
	LevelManager.objective_updated.connect(_on_obj)
	LevelManager.mission_completed.connect(_on_complete)
	show_benchmark = OS.is_debug_build()

func _on_tool_changed(_idx: int, name: String):
	if tool_label:
		tool_label.text = "%s: %s" % [Localization.tr_key("hud.tool"), name]

func _on_obj(id: String, prog: float):
	if objective_label:
		objective_label.text = "%s %s %.0f%%" % [Localization.tr_key("hud.objective"), id, prog*100]

func _on_complete(id: String, success: bool):
	var screen := preload("res://scenes/ui/result_screen.tscn").instantiate() if ResourceLoader.exists("res://scenes/ui/result_screen.tscn") else null
	if screen:
		add_child(screen)
		screen.setup(id, success, LevelManager.time_elapsed)
	else:
		# fallback label
		var l := Label.new()
		l.text = Localization.tr_key("result.success") if success else Localization.tr_key("result.fail")
		l.position = Vector2(400, 200)
		add_child(l)

func _process(delta):
	if timer_label:
		if LevelManager.alarm_active:
			timer_label.text = "%s: %02d:%02d" % [Localization.tr_key("hud.timer"), int(LevelManager.alarm_time)/60, int(LevelManager.alarm_time)%60]
			timer_label.modulate = Color(1,0.2,0.2) if int(LevelManager.alarm_time*2)%2==0 else Color(1,1,1)
		else:
			timer_label.text = ""
	if show_benchmark and benchmark_label:
		var stats := PerformanceBudget.get_debug_stats()
		benchmark_label.text = "FPS:%d MS:%.1f Debris:%d Bodies:%d Fires:%d Mem:%dMB Q:%s" % [stats["fps"], stats["frame_ms"], stats["debris"], stats["bodies"], stats["fires"], stats["mem_mb"], stats["quality"]]
