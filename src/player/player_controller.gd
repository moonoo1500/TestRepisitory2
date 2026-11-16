extends CharacterBody3D

@export var mouse_sensitivity: float = 0.3
@export var joystick_sensitivity: float = 2.5
@export var walk_speed: float = 5.0
@export var sprint_speed: float = 7.0
@export var jump_velocity: float = 7.0

var gravity: float = 20.0
var camera: Camera3D
var voxel_grid: VoxelGrid
var destruction: DestructionSystem

var current_tool_index: int = 0
var tools: Array[ToolBase] = []
var _touch_move: Vector2 = Vector2.ZERO
var _touch_look: Vector2 = Vector2.ZERO

signal tool_changed(idx: int, name: String)

func _ready():
	camera = $Camera3D
	tools = [
		HammerTool.new(),
		CutterTool.new(),
		ExplosiveTool.new(),
		FoamTool.new(),
		BridgeTool.new(),
	]
	_add_input_mappings()
	emit_signal("tool_changed", 0, tools[0].get_display_name())

func _add_input_mappings():
	# ensure actions exist handled in project.godot
	pass

func setup(grid: VoxelGrid):
	voxel_grid = grid
	destruction = DestructionSystem.new()
	destruction.setup(grid, camera)

func _unhandled_input(event):
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(deg_to_rad(-event.relative.x * mouse_sensitivity))
		camera.rotate_x(deg_to_rad(-event.relative.y * mouse_sensitivity))
		camera.rotation.x = clamp(camera.rotation.x, deg_to_rad(-85), deg_to_rad(85))
	elif event is InputEventScreenDrag:
		# mobile fallback
		pass
	elif event.is_action_pressed("tool_1"):
		switch_tool(0)
	elif event.is_action_pressed("tool_2"):
		switch_tool(1)
	elif event.is_action_pressed("tool_3"):
		switch_tool(2)
	elif event.is_action_pressed("tool_4"):
		switch_tool(3)
	elif event.is_action_pressed("tool_5"):
		switch_tool(4)
	elif event.is_action_pressed("pause"):
		get_tree().paused = not get_tree().paused

func switch_tool(idx: int):
	if idx < 0 or idx >= tools.size(): return
	current_tool_index = idx
	emit_signal("tool_changed", idx, tools[idx].get_display_name())

func _physics_process(delta):
	# movement from keyboard + virtual joystick
	var input_dir := Vector2.ZERO
	input_dir.x = Input.get_action_strength("move_right") - Input.get_action_strength("move_left")
	input_dir.y = Input.get_action_strength("move_forward") - Input.get_action_strength("move_back")
	# add touch
	input_dir += _touch_move
	input_dir = input_dir.limit_length(1.0)
	# look from touch
	if _touch_look.length() > 0.01:
		rotate_y(deg_to_rad(-_touch_look.x * joystick_sensitivity))
		camera.rotate_x(deg_to_rad(-_touch_look.y * joystick_sensitivity))
		camera.rotation.x = clamp(camera.rotation.x, deg_to_rad(-85), deg_to_rad(85))

	var is_sprinting := Input.is_action_pressed("jump") # shift remapped to jump for demo? Use shift if exists
	var speed := sprint_speed if is_sprinting else walk_speed

	var forward := -transform.basis.z
	var right := transform.basis.x
	forward.y = 0
	right.y = 0
	forward = forward.normalized()
	right = right.normalized()
	var direction := (forward * input_dir.y + right * input_dir.x)
	if direction.length() > 0.01:
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
	else:
		velocity.x = move_toward(velocity.x, 0, speed * 5 * delta)
		velocity.z = move_toward(velocity.z, 0, speed * 5 * delta)

	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		if Input.is_action_just_pressed("jump"):
			velocity.y = jump_velocity

	move_and_slide()

	# tool use
	if Input.is_action_pressed("action_primary"):
		try_use_tool()

func try_use_tool():
	if tools.is_empty(): return
	var tool: ToolBase = tools[current_tool_index]
	var origin := camera.global_position
	var dir := -camera.global_transform.basis.z
	tool.use(origin, dir, voxel_grid, destruction)

func set_touch_move(vec: Vector2):
	_touch_move = vec

func set_touch_look(vec: Vector2):
	_touch_look = vec

func apply_damage(_dmg: int):
	# placeholder health
	pass
