extends RefCounted
class_name SupportGraph

# Lightweight incremental support solver: BFS from ground.
# Public API for tests
static func is_supported(grid, world: Vector3i) -> bool:
	return grid.is_supported(world)

static func find_floating_clusters(grid, center: Vector3i, radius: int) -> Array:
	return grid.check_collapse_around(center, radius)
