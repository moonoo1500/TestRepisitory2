extends Node3D
class_name VoxelChunk

const CHUNK_SIZE := 16
const VOXEL_SIZE := 1.0

var chunk_pos: Vector3i
var voxels: PackedByteArray
var health: PackedByteArray
var dirty: bool = true
var mesh_instance: MeshInstance3D
var static_body: StaticBody3D
var collision_shape: CollisionShape3D

var _mesh_dirty: bool = true
var _physics_dirty: bool = true

func _init(pos: Vector3i = Vector3i.ZERO):
	chunk_pos = pos
	voxels = PackedByteArray()
	voxels.resize(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE)
	health = PackedByteArray()
	health.resize(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE)
	# init with air
	for i in voxels.size():
		voxels[i] = VoxelMaterial.Type.AIR
		health[i] = 0

func _ready():
	mesh_instance = MeshInstance3D.new()
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mesh_instance)
	static_body = StaticBody3D.new()
	static_body.collision_layer = 1
	static_body.collision_mask = 1
	add_child(static_body)
	collision_shape = CollisionShape3D.new()
	static_body.add_child(collision_shape)
	# initial mesh
	rebuild_mesh()

func idx(x: int, y: int, z: int) -> int:
	return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE

func set_voxel(local: Vector3i, mat: int) -> void:
	if local.x < 0 or local.x >= CHUNK_SIZE: return
	if local.y < 0 or local.y >= CHUNK_SIZE: return
	if local.z < 0 or local.z >= CHUNK_SIZE: return
	var id := idx(local.x, local.y, local.z)
	voxels[id] = mat
	health[id] = VoxelMaterial.get_hp(mat)
	mark_dirty()

func get_voxel(local: Vector3i) -> int:
	if local.x < 0 or local.x >= CHUNK_SIZE: return VoxelMaterial.Type.AIR
	if local.y < 0 or local.y >= CHUNK_SIZE: return VoxelMaterial.Type.AIR
	if local.z < 0 or local.z >= CHUNK_SIZE: return VoxelMaterial.Type.AIR
	return voxels[idx(local.x, local.y, local.z)]

func mark_dirty():
	dirty = true
	_mesh_dirty = true
	_physics_dirty = true

func damage_voxel(local: Vector3i, dmg: int) -> bool:
	if local.x < 0 or local.x >= CHUNK_SIZE: return false
	if local.y < 0 or local.y >= CHUNK_SIZE: return false
	if local.z < 0 or local.z >= CHUNK_SIZE: return false
	var id := idx(local.x, local.y, local.z)
	var mat: int = voxels[id]
	if mat == VoxelMaterial.Type.AIR:
		return false
	# reduce health or directly destroy for simplicity with threshold
	health[id] -= dmg
	if health[id] <= 0:
		voxels[id] = VoxelMaterial.Type.AIR
		health[id] = 0
		mark_dirty()
		return true
	return false

func fill_region(from: Vector3i, to: Vector3i, mat: int) -> void:
	for x in range(from.x, to.x + 1):
		for y in range(from.y, to.y + 1):
			for z in range(from.z, to.z + 1):
				set_voxel(Vector3i(x, y, z), mat)

func serialize() -> Dictionary:
	# sparse RLE-like: only store non-AIR
	var data: Array = []
	for i in voxels.size():
		if voxels[i] != VoxelMaterial.Type.AIR:
			data.append({"i": i, "m": voxels[i], "h": health[i]})
	return {"pos": [chunk_pos.x, chunk_pos.y, chunk_pos.z], "data": data, "v": 1}

func deserialize(d: Dictionary) -> void:
	var arr: Array = d.get("data", [])
	for e in arr:
		var i: int = e["i"]
		if i >= 0 and i < voxels.size():
			voxels[i] = e["m"]
			health[i] = e.get("h", VoxelMaterial.get_hp(e["m"]))
	mark_dirty()
	rebuild_mesh()

func rebuild_mesh() -> void:
	if not _mesh_dirty: return
	_mesh_dirty = false
	# Build mesh via greedy meshing simplified: face culling
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Use simple per-face quads, culling invisible faces against self (and neighbor check will be done by grid)
	# neighbor lookup deferred to VoxelGrid for border; here only internal culling
	for x in CHUNK_SIZE:
		for y in CHUNK_SIZE:
			for z in CHUNK_SIZE:
				var mat := get_voxel(Vector3i(x, y, z))
				if mat == VoxelMaterial.Type.AIR: continue
				# check 6 neighbors, skip if neighbor solid within chunk
				var world_offset := Vector3(chunk_pos * CHUNK_SIZE) + Vector3(x, y, z)
				var base := Vector3(x, y, z) * VOXEL_SIZE
				# For each face, if neighbor is air, add quad
				# +X
				if get_voxel(Vector3i(x + 1, y, z)) == VoxelMaterial.Type.AIR:
					_add_face(st, base + Vector3(1,0,0), Vector3(0,0,0), Vector3(0,1,0), Vector3(0,0,1), mat)
				# -X
				if get_voxel(Vector3i(x - 1, y, z)) == VoxelMaterial.Type.AIR:
					_add_face(st, base, Vector3(0,0,1), Vector3(0,1,0), Vector3(0,0,0), mat)
				# +Y
				if get_voxel(Vector3i(x, y + 1, z)) == VoxelMaterial.Type.AIR:
					_add_face(st, base + Vector3(0,1,0), Vector3(1,0,0), Vector3(0,0,0), Vector3(0,0,1), mat)
				# -Y
				if get_voxel(Vector3i(x, y - 1, z)) == VoxelMaterial.Type.AIR:
					_add_face(st, base, Vector3(1,0,0), Vector3(0,0,1), Vector3(0,0,0), mat)
				# +Z
				if get_voxel(Vector3i(x, y, z + 1)) == VoxelMaterial.Type.AIR:
					_add_face(st, base + Vector3(0,0,1), Vector3(0,0,0), Vector3(1,0,0), Vector3(0,1,0), mat)
				# -Z
				if get_voxel(Vector3i(x, y, z - 1)) == VoxelMaterial.Type.AIR:
					_add_face(st, base, Vector3(1,0,0), Vector3(0,1,0), Vector3(0,0,0), mat)
	st.generate_normals()
	var mesh := st.commit()
	if mesh:
		mesh_instance.mesh = mesh
		# update AABB for culling
		mesh_instance.custom_aabb = AABB(Vector3.ZERO, Vector3.ONE * CHUNK_SIZE)
		# physics: rebuild aggregated shapes if needed
		if _physics_dirty:
			_rebuild_collisions()
	else:
		mesh_instance.mesh = null
		if collision_shape:
			collision_shape.shape = null
	dirty = false

func _add_face(st: SurfaceTool, origin: Vector3, u: Vector3, v: Vector3, normal: Vector3, mat: int):
	var col := VoxelMaterial.color_for(mat)
	st.set_color(col)
	st.set_normal(normal)
	# two triangles
	st.add_vertex(origin)
	st.add_vertex(origin + u)
	st.add_vertex(origin + u + v)
	st.add_vertex(origin)
	st.add_vertex(origin + u + v)
	st.add_vertex(origin + v)
	# UV placeholder
	# Note: SurfaceTool handles UV via set_uv

func _rebuild_collisions() -> void:
	_physics_dirty = false
	# Aggregated boxes: create one box per solid run along X (simple)
	# For performance, create single ConcavePolygonShape for now via boxes
	# We'll generate Boxes and combine into array for Convex
	# Simplified: use BoxShape per cluster budget-limited, otherwise use AABB hull
	var shapes: Array[Shape3D] = []
	# Simple clustering: group adjacent voxels into large AABBs (naive scan)
	var visited := PackedByteArray()
	visited.resize(voxels.size())
	visited.fill(0)
	for x in CHUNK_SIZE:
		for y in CHUNK_SIZE:
			for z in CHUNK_SIZE:
				var id := idx(x, y, z)
				if visited[id] == 1: continue
				if voxels[id] == VoxelMaterial.Type.AIR: continue
				# flood expand X
				var sx := x
				var ex := x
				while ex + 1 < CHUNK_SIZE and get_voxel(Vector3i(ex + 1, y, z)) != VoxelMaterial.Type.AIR and visited[idx(ex + 1, y, z)] == 0:
					ex += 1
				# mark visited for this span
				for cx in range(sx, ex + 1):
					visited[idx(cx, y, z)] = 1
				var size := Vector3(ex - sx + 1, 1, 1)
				var center := Vector3(sx + size.x / 2.0, y + 0.5, z + 0.5)
				var box := BoxShape3D.new()
				box.size = size
				# will be used via multiple collision shapes; for now create single box covering chunk bounds if too many
				shapes.append(box)
				if shapes.size() > 16:
					break
			if shapes.size() > 16: break
		if shapes.size() > 16: break
	# If many shapes, collapse to one big hull to stay within budget
	if shapes.size() > 8:
		var hull := BoxShape3D.new()
		hull.size = Vector3(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE)
		collision_shape.shape = hull
		collision_shape.position = Vector3(CHUNK_SIZE / 2.0, CHUNK_SIZE / 2.0, CHUNK_SIZE / 2.0)
	else:
		# For simplicity, first shape only (Godot allows multiple via adding children, but we keep one)
		if shapes.size() > 0:
			# create compound via adding multiple CollisionShape nodes dynamically
			# remove old extras
			for c in static_body.get_children():
				if c != collision_shape:
					c.queue_free()
			collision_shape.shape = shapes[0]
			collision_shape.position = Vector3.ZERO # origin relative; shape center handled via position
			# add rest as separate shapes
			for i in range(1, shapes.size()):
				var cs := CollisionShape3D.new()
				cs.shape = shapes[i]
				# compute position from earlier loop approximated; simplistic center
				# we already consumed positions via size only, place at origin for demo
				static_body.add_child(cs)
		else:
			collision_shape.shape = null
