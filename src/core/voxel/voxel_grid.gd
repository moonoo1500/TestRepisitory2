extends Node3D
class_name VoxelGrid

const CHUNK_SIZE := 16

var chunks: Dictionary = {} # Vector3i -> VoxelChunk
var dirty_queue: Array[Vector3i] = []
var max_rebuilds_per_frame := 2

var support_graph_dirty: bool = false
var fire_cells: Dictionary = {} # Vector3i world pos -> ticks remaining

signal chunk_changed(pos: Vector3i)
signal voxel_destroyed(world_pos: Vector3i, mat: int)

func _ready():
	# Process for deferred rebuild
	set_process(true)

func _process(_delta):
	var count := 0
	while count < max_rebuilds_per_frame and dirty_queue.size() > 0:
		var pos: Vector3i = dirty_queue.pop_front()
		var ch: VoxelChunk = chunks.get(pos)
		if ch:
			ch.rebuild_mesh()
			count += 1
	# fire tick
	if fire_cells.size() > 0:
		_tick_fire()

func chunk_key_for_world(world: Vector3i) -> Vector3i:
	# floor div for negatives
	return Vector3i(
		floordi(float(world.x), float(CHUNK_SIZE)),
		floordi(float(world.y), float(CHUNK_SIZE)),
		floordi(float(world.z), float(CHUNK_SIZE))
	)

func local_in_chunk(world: Vector3i) -> Vector3i:
	var ck := chunk_key_for_world(world)
	return Vector3i(world.x - ck.x * CHUNK_SIZE, world.y - ck.y * CHUNK_SIZE, world.z - ck.z * CHUNK_SIZE)

func get_or_create_chunk(ck: Vector3i) -> VoxelChunk:
	if chunks.has(ck):
		return chunks[ck]
	var chunk := VoxelChunk.new(ck)
	chunk.position = Vector3(ck * CHUNK_SIZE)
	add_child(chunk)
	chunks[ck] = chunk
	return chunk

func get_voxel(world: Vector3i) -> int:
	var ck := chunk_key_for_world(world)
	var ch: VoxelChunk = chunks.get(ck)
	if ch == null:
		return VoxelMaterial.Type.AIR
	return ch.get_voxel(local_in_chunk(world))

func set_voxel(world: Vector3i, mat: int) -> void:
	var ck := chunk_key_for_world(world)
	var ch := get_or_create_chunk(ck)
	ch.set_voxel(local_in_chunk(world), mat)
	_mark_dirty(ck)
	# also neighbor chunks if on border
	var local := local_in_chunk(world)
	if local.x == 0:
		_mark_dirty(ck + Vector3i(-1,0,0))
	if local.x == CHUNK_SIZE - 1:
		_mark_dirty(ck + Vector3i(1,0,0))
	if local.y == 0:
		_mark_dirty(ck + Vector3i(0,-1,0))
	if local.y == CHUNK_SIZE - 1:
		_mark_dirty(ck + Vector3i(0,1,0))
	if local.z == 0:
		_mark_dirty(ck + Vector3i(0,0,-1))
	if local.z == CHUNK_SIZE - 1:
		_mark_dirty(ck + Vector3i(0,0,1))

func damage_voxel(world: Vector3i, dmg: int) -> bool:
	var ck := chunk_key_for_world(world)
	var ch: VoxelChunk = chunks.get(ck)
	if ch == null:
		return false
	var local := local_in_chunk(world)
	var before := ch.get_voxel(local)
	if before == VoxelMaterial.Type.AIR:
		return false
	var destroyed := ch.damage_voxel(local, dmg)
	if destroyed:
		_mark_dirty(ck)
		# border propagation
		if local.x == 0:
			_mark_dirty(ck + Vector3i(-1,0,0))
		if local.x == CHUNK_SIZE - 1:
			_mark_dirty(ck + Vector3i(1,0,0))
		if local.y == 0:
			_mark_dirty(ck + Vector3i(0,-1,0))
		if local.y == CHUNK_SIZE - 1:
			_mark_dirty(ck + Vector3i(0,1,0))
		if local.z == 0:
			_mark_dirty(ck + Vector3i(0,0,-1))
		if local.z == CHUNK_SIZE - 1:
			_mark_dirty(ck + Vector3i(0,0,1))
		emit_signal("voxel_destroyed", world, before)
		support_graph_dirty = true
	return destroyed

func explosion(center: Vector3i, radius: int, damage: int) -> int:
	var destroyed := 0
	for x in range(-radius, radius + 1):
		for y in range(-radius, radius + 1):
			for z in range(-radius, radius + 1):
				if Vector3(x,y,z).length() > radius:
					continue
				var p := center + Vector3i(x,y,z)
				if damage_voxel(p, damage):
					destroyed += 1
					# spawn debris pooled
					PerformanceBudget.register_debris()
	# apply impulse to nearby RigidBodies deferred
	return destroyed

func fill_box(from: Vector3i, to: Vector3i, mat: int) -> void:
	var minx := mini(from.x, to.x)
	var maxx := maxi(from.x, to.x)
	var miny := mini(from.y, to.y)
	var maxy := maxi(from.y, to.y)
	var minz := mini(from.z, to.z)
	var maxz := maxi(from.z, to.z)
	for x in range(minx, maxx + 1):
		for y in range(miny, maxy + 1):
			for z in range(minz, maxz + 1):
				set_voxel(Vector3i(x,y,z), mat)

func _mark_dirty(ck: Vector3i):
	if not chunks.has(ck):
		return
	if ck in dirty_queue:
		return
	dirty_queue.append(ck)
	emit_signal("chunk_changed", ck)

func is_supported(world: Vector3i) -> bool:
	# BFS to ground y=0; simplified
	var visited := {}
	var queue: Array[Vector3i] = [world]
	visited[world] = true
	var steps := 0
	while queue.size() > 0 and steps < 512:
		var cur: Vector3i = queue.pop_front()
		steps += 1
		if cur.y <= 0:
			return true
		for dir in [Vector3i(1,0,0), Vector3i(-1,0,0), Vector3i(0,1,0), Vector3i(0,-1,0), Vector3i(0,0,1), Vector3i(0,0,-1)]:
			var nb := cur + dir
			if visited.has(nb): continue
			if get_voxel(nb) != VoxelMaterial.Type.AIR:
				visited[nb] = true
				queue.append(nb)
	return false

func check_collapse_around(center: Vector3i, radius: int = 5) -> Array[Vector3i]:
	var to_fall: Array[Vector3i] = []
	for x in range(-radius, radius+1):
		for y in range(-radius, radius+1):
			for z in range(-radius, radius+1):
				var p := center + Vector3i(x,y,z)
				if get_voxel(p) == VoxelMaterial.Type.AIR: continue
				if not is_supported(p):
					to_fall.append(p)
	return to_fall

func set_fire(origin: Vector3i, ttl: int = 10) -> void:
	if PerformanceBudget.can_spawn_fire():
		fire_cells[origin] = ttl
		PerformanceBudget.register_fire()

func _tick_fire():
	var to_remove: Array[Vector3i] = []
	var spread: Array[Vector3i] = []
	for pos in fire_cells.keys():
		var ticks: int = fire_cells[pos]
		ticks -= 1
		fire_cells[pos] = ticks
		if ticks <= 0:
			to_remove.append(pos)
		else:
			# chance to spread to flammable neighbors
			if randf() < 0.25:
				for dir in [Vector3i(1,0,0), Vector3i(-1,0,0), Vector3i(0,0,1), Vector3i(0,0,-1), Vector3i(0,1,0)]:
					var nb := pos + dir
					var mat := get_voxel(nb)
					if VoxelMaterial.is_flammable(mat):
						if not fire_cells.has(nb) and randf() < 0.4:
							spread.append(nb)
		# damage voxel
		if ticks % 2 == 0:
			damage_voxel(pos, 15)
	for p in to_remove:
		fire_cells.erase(p)
		PerformanceBudget.unregister_fire()
	for p in spread:
		set_fire(p, 8)

func save_state() -> Dictionary:
	var out := {}
	out["version"] = 1
	var chunks_data: Array = []
	for ck in chunks.keys():
		var ch: VoxelChunk = chunks[ck]
		chunks_data.append(ch.serialize())
	out["chunks"] = chunks_data
	return out

func load_state(data: Dictionary) -> void:
	# clear
	for ck in chunks.keys():
		var ch: VoxelChunk = chunks[ck]
		ch.queue_free()
	chunks.clear()
	dirty_queue.clear()
	var arr: Array = data.get("chunks", [])
	for d in arr:
		var pos_arr: Array = d.get("pos", [0,0,0])
		var ck := Vector3i(pos_arr[0], pos_arr[1], pos_arr[2])
		var ch := get_or_create_chunk(ck)
		ch.deserialize(d)
		_mark_dirty(ck)
