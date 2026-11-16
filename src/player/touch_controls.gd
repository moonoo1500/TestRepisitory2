extends CanvasLayer

@onready var joystick_move: Control = $MoveJoystick
@onready var joystick_look: Control = $LookJoystick
@onready var btn_use: Button = $BtnUse
@onready var btn_tools: Control = $ToolBar

var player: Node

func setup(p: Node):
	player = p
	if btn_use:
		btn_use.pressed.connect(func(): player.try_use_tool() if player.has_method("try_use_tool") else null)

func _ready():
	# Create simple UI programmatically if not in scene
	if not has_node("MoveJoystick"):
		_build_ui()

func _build_ui():
	var move := TouchScreenButton.new()
	move.name = "MoveJoystick"
	move.position = Vector2(40, 500)
	move.custom_minimum_size = Vector2(120,120)
	add_child(move)
	var look := TouchScreenButton.new()
	look.name = "LookJoystick"
	look.position = Vector2(1000, 500)
	look.custom_minimum_size = Vector2(120,120)
	add_child(look)
	var use := Button.new()
	use.name = "BtnUse"
	use.text = "◯"
	use.position = Vector2(900, 300)
	use.custom_minimum_size = Vector2(80,80)
	add_child(use)
	var bar := HBoxContainer.new()
	bar.name = "ToolBar"
	bar.position = Vector2(400, 640)
	add_child(bar)
	for i in 5:
		var b := Button.new()
		b.text = str(i+1)
		b.custom_minimum_size = Vector2(60,60)
		b.pressed.connect(func(): player.switch_tool(i) if player else null)
		bar.add_child(b)
