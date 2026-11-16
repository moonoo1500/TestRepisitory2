extends Node

# Generic object pool for debris, decals, particles

var debris_pool: Array[Node] = []
var decal_pool: Array[Node] = []

func get_debris() -> Node:
	if debris_pool.size() > 0:
		return debris_pool.pop_back()
	return null

func return_debris(node: Node):
	if debris_pool.size() < 32:
		node.get_parent().remove_child(node)
		debris_pool.append(node)
	else:
		node.queue_free()

func get_decal() -> Node:
	if decal_pool.size() > 0:
		return decal_pool.pop_back()
	return null

func return_decal(node: Node):
	if decal_pool.size() < 32:
		decal_pool.append(node)
	else:
		node.queue_free()
