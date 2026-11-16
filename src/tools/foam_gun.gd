extends ToolBase
class_name FoamTool

func _init():
	super("foam", "Распылитель «Ингибитор»", "Foam «Inhibitor»", 10, 5.0, 0.2)

func _do_use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	var space := grid.get_world_3d().direct_space_state
	var res := space.intersect_ray(PhysicsRayQueryParameters3D.create(origin, origin + dir * range, 1))
	if res.is_empty():
		return false
	var pos: Vector3 = res["position"]
	var voxel_pos := Vector3i(floori(pos.x), floori(pos.y), floori(pos.z))
	# extinguish fire
	if grid.fire_cells.has(voxel_pos):
		grid.fire_cells.erase(voxel_pos)
		PerformanceBudget.unregister_fire()
		return true
	# cool and weaken neighbors? For now just extinguish
	# also heal? No
	return false
