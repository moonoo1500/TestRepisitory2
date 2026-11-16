extends Node3D

var voxel_pos: Vector3i
var grid: VoxelGrid
var destruction: DestructionSystem
var timer: float = 3.0
var exploded: bool = false

func setup(pos: Vector3i, p_grid: VoxelGrid, p_dest: DestructionSystem):
	voxel_pos = pos
	grid = p_grid
	destruction = p_dest
	var mesh := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = Vector3(0.4,0.25,0.2)
	mesh.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.9,0.2,0.15)
	mesh.material_override = mat
	add_child(mesh)
	var light := OmniLight3D.new()
	light.light_color = Color(1,0.3,0.1)
	light.omni_range = 2.0
	add_child(light)
	# blinking timer
	var t := Timer.new()
	t.wait_time = timer
	t.one_shot = true
	t.timeout.connect(_explode)
	add_child(t)
	t.start()

func _explode():
	if exploded: return
	exploded = true
	if destruction:
		destruction.blast(voxel_pos, 4, 200)
		# spawn debris
		for i in 6:
			PhysicsProps.spawn_debris(Vector3(voxel_pos) + Vector3(randf(), randf(), randf())*0.5, VoxelMaterial.Type.CONCRETE, grid)
	queue_free()
