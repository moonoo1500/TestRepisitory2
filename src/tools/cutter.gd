extends ToolBase
class_name CutterTool

func _init():
	super("cutter", "Терморез «Кромка»", "Cutter «Edge»", 35, 5.0, 0.12)

func _do_use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	# line trace with repeated damage
	var hit := destruction.ray_destroy(origin, dir, range, damage)
	# also do small radius for cutting beams
	if hit:
		# additional pierce for metal
		var space := grid.get_world_3d().direct_space_state
		var res := space.intersect_ray(PhysicsRayQueryParameters3D.create(origin, origin + dir * range, 1))
		if not res.is_empty():
			var pos: Vector3 = res["position"]
			var vp := Vector3i(floori(pos.x), floori(pos.y), floori(pos.z))
			# damage neighbors slightly
			for d in [Vector3i(1,0,0), Vector3i(-1,0,0), Vector3i(0,1,0), Vector3i(0,0,1)]:
				grid.damage_voxel(vp + d, int(damage * 0.5))
	return hit
