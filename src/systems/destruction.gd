extends Node
class_name DestructionSystem

# Handles raycasts and applies destruction to voxel grid

var grid: VoxelGrid
var camera: Camera3D

func setup(p_grid: VoxelGrid, p_cam: Camera3D):
	grid = p_grid
	camera = p_cam

func ray_destroy(origin: Vector3, dir: Vector3, range: float, dmg: int) -> bool:
	if grid == null: return false
	var space := grid.get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(origin, origin + dir * range, 1)
	var res := space.intersect_ray(query)
	if res.is_empty():
		return false
	var pos: Vector3 = res["position"]
	var normal: Vector3 = res["normal"]
	# convert to voxel world
	var voxel_pos := Vector3i(floori(pos.x - normal.x * 0.1), floori(pos.y - normal.y * 0.1), floori(pos.z - normal.z * 0.1))
	var ok := grid.damage_voxel(voxel_pos, dmg)
	if ok and GameState.settings.get("haptics", true):
		Input.vibrate_handheld(50)
	return ok

func blast(pos: Vector3i, radius: int, damage: int) -> int:
	if grid == null: return 0
	var count := grid.explosion(pos, radius, damage)
	if count > 0 and GameState.settings.get("haptics", true):
		Input.vibrate_handheld(120)
	# fire chance
	if randf() < 0.3:
		grid.set_fire(pos, 10)
	return count
