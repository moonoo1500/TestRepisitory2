extends ToolBase
class_name HammerTool

func _init():
	super("hammer", "Кувалда «Удар-5»", "Hammer «Strike-5»", 60, 4.0, 0.35)

func _do_use(origin: Vector3, dir: Vector3, grid: VoxelGrid, destruction: DestructionSystem) -> bool:
	return destruction.ray_destroy(origin, dir, range, damage)
