extends ToolBase
class_name BridgeTool

var temp_blocks: Array[Vector3i] = []

func _init():
	super("bridge", "Проектор «Пролет»", "Projector «Span»", 0, 8.0, 2.0)

func _do_use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	var space := grid.get_world_3d().direct_space_state
	var res := space.intersect_ray(PhysicsRayQueryParameters3D.create(origin, origin + dir * range, 1))
	if res.is_empty():
		return false
	var pos: Vector3 = res["position"]
	var normal: Vector3 = res["normal"]
	var voxel_pos := Vector3i(floori(pos.x + normal.x * 0.6), floori(pos.y + normal.y * 0.6), floori(pos.z + normal.z * 0.6))
	# build 3x1x4 bridge in direction of view projected onto XZ
	var fwd := Vector3(dir.x, 0, dir.z).normalized()
	if fwd.length() < 0.1:
		fwd = Vector3(1,0,0)
	var right := fwd.cross(Vector3.UP).normalized()
	for w in range(4): # forward
		for s in range(-1,2): # width
			var p := voxel_pos + Vector3i(roundi(fwd.x * w + right.x * s), 0, roundi(fwd.z * w + right.z * s))
			if grid.get_voxel(p) == VoxelMaterial.Type.AIR:
				grid.set_voxel(p, VoxelMaterial.Type.METAL)
				temp_blocks.append(p)
	# schedule removal after 30s
	var timer := Timer.new()
	timer.wait_time = 30.0
	timer.one_shot = true
	timer.timeout.connect(func():
		for b in temp_blocks:
			if grid.get_voxel(b) == VoxelMaterial.Type.METAL:
				grid.set_voxel(b, VoxelMaterial.Type.AIR)
		temp_blocks.clear()
		timer.queue_free()
	)
	grid.add_child(timer)
	timer.start()
	return true
