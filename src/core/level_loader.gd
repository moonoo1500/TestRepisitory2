extends Node

@export var level_id: String = "tutorial"

var voxel_grid: VoxelGrid
var player: Node3D

func _ready():
	voxel_grid = get_parent().get_node_or_null("VoxelGrid")
	if voxel_grid == null:
		voxel_grid = get_parent() as VoxelGrid
	player = get_parent().get_node_or_null("Player")
	if player == null:
		player = get_parent().get_parent().get_node_or_null("Player")
	_build_from_data()

func _build_from_data():
	var def := LevelManager.load_level_def(level_id)
	if def.is_empty():
		# fallback sandbox
		def = LevelManager.load_level_def("sandbox")
		level_id = "sandbox"
	# build voxels
	var voxels: Array = def.get("voxels", [])
	for v in voxels:
		var from_arr: Array = v.get("from", [0,0,0])
		var to_arr: Array = v.get("to", [0,0,0])
		var mat: int = int(v.get("mat", 1))
		var from := Vector3i(from_arr[0], from_arr[1], from_arr[2])
		var to := Vector3i(to_arr[0], to_arr[1], to_arr[2])
		voxel_grid.fill_box(from, to, mat)
	# player spawn
	var spawns: Dictionary = def.get("spawns", {})
	if spawns.has("player"):
		var p_arr: Array = spawns["player"]
		if player:
			player.position = Vector3(p_arr[0], p_arr[1], p_arr[2])
	# setup player grid
	if player and player.has_method("setup"):
		player.setup(voxel_grid)
	# collectables for demo: create markers
	if spawns.has("cores"):
		for c in spawns["cores"]:
			_spawn_marker(Vector3(c[0], c[1], c[2]), "core")
	if spawns.has("fragments"):
		for c in spawns["fragments"]:
			_spawn_marker(Vector3(c[0], c[1], c[2]), "fragment")
	if spawns.has("containers"):
		for c in spawns["containers"]:
			_spawn_marker(Vector3(c[0], c[1], c[2]), "container")
	if spawns.has("datas"):
		for c in spawns["datas"]:
			_spawn_marker(Vector3(c[0], c[1], c[2]), "data")
	# vehicles placeholder
	if spawns.has("vehicles"):
		for veh in spawns["vehicles"]:
			var pos_arr: Array = veh.get("pos", [0,0,0])
			_spawn_vehicle_marker(Vector3(pos_arr[0], pos_arr[1], pos_arr[2]), veh.get("type","ant"))
	# fires
	if spawns.has("fires"):
		for f in spawns["fires"]:
			voxel_grid.set_fire(Vector3i(f[0], f[1], f[2]), 15)
	# benchmark if requested
	if level_id == "benchmark" and has_node("../Benchmark"):
		var bm = get_node("../Benchmark")
		if bm.has_method("setup"):
			bm.setup(voxel_grid)

func _spawn_marker(pos: Vector3, kind: String):
	var area := Area3D.new()
	area.position = pos + Vector3(0.5,0.5,0.5)
	area.monitoring = true
	var col := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.8
	col.shape = sphere
	area.add_child(col)
	var mesh := MeshInstance3D.new()
	var s_m := SphereMesh.new()
	s_m.radius = 0.4
	s_m.height = 0.8
	mesh.mesh = s_m
	var mat := StandardMaterial3D.new()
	match kind:
		"core": mat.albedo_color = Color(0.2, 0.8, 1.0)
		"fragment": mat.albedo_color = Color(1, 0.85, 0.2)
		"container": mat.albedo_color = Color(0.8, 0.4, 0.1)
		"data": mat.albedo_color = Color(0.6, 0.2, 0.9)
		_: mat.albedo_color = Color(1,1,1)
	mesh.material_override = mat
	area.add_child(mesh)
	# light
	var light := OmniLight3D.new()
	light.omni_range = 3.0
	light.light_color = mat.albedo_color
	area.add_child(light)
	area.body_entered.connect(func(body):
		if body.name == "Player" or body.is_in_group("player"):
			LevelManager.update_objective(kind if kind != "fragment" else "collect", 1)
			area.queue_free()
	)
	get_parent().add_child(area)

func _spawn_vehicle_marker(pos: Vector3, type: String):
	var veh := Node3D.new()
	veh.position = pos + Vector3(0.5,0,0.5)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(2,1,3)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.9,0.9,0.2) if type == "ant" else Color(0.2,0.9,0.4)
	mesh.material_override = mat
	veh.add_child(mesh)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2,1,3)
	cs.shape = shape
	body.add_child(cs)
	veh.add_child(body)
	get_parent().add_child(veh)
