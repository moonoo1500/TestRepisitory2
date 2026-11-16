extends ToolBase
class_name ExplosiveTool

var planted: Array[Vector3i] = []

func _init():
	super("explosive", "Заряд «Хлопок»", "Charge «Clap»", 0, 6.0, 1.0)

func _do_use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	var space := grid.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * range, 1)
	var res := space.intersect_ray(q)
	if res.is_empty():
		return false
	var pos: Vector3 = res["position"]
	var normal: Vector3 = res["normal"]
	var voxel_pos := Vector3i(floori(pos.x - normal.x * 0.05), floori(pos.y - normal.y * 0.05), floori(pos.z - normal.z * 0.05))
	# plant visual deferred
	planted.append(voxel_pos)
	# spawn timer bomb
	var bomb := preload("res://scenes/tools/explosive_charge.tscn").instantiate() if ResourceLoader.exists("res://scenes/tools/explosive_charge.tscn") else _create_fallback_bomb()
	bomb.position = Vector3(voxel_pos) + Vector3(0.5,0.5,0.5)
	grid.add_child(bomb)
	bomb.setup(voxel_pos, grid, destruction)
	return true

func _create_fallback_bomb() -> Node3D:
	var n := Node3D.new()
	n.set_script(load("res://src/tools/explosive_charge.gd"))
	return n
