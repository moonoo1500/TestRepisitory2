extends Node3D

# Benchmark scene controller: performs reproducible scenarios and logs metrics

var voxel_grid: VoxelGrid
var results: Array[Dictionary] = []

func setup(grid: VoxelGrid):
	voxel_grid = grid

func run_all() -> void:
	print("[Benchmark] Starting...")
	await run_scenario("movement", func(): await _scenario_movement())
	await run_scenario("local_destruction", func(): await _scenario_local())
	await run_scenario("large_explosion", func(): await _scenario_explosion())
	await run_scenario("collapse", func(): await _scenario_collapse())
	print("[Benchmark] Done. Results:")
	for r in results:
		print("%s: avg_fps=%d min_fps=%d frame_ms=%.1f tris=%d bodies=%d particles=%d mem=%dMB" % [r["name"], r["avg_fps"], r["min_fps"], r["frame_ms"], r["tris"], r["bodies"], r["particles"], r["mem"]])

func run_scenario(name: String, callable: Callable) -> void:
	var start_fps: Array[int] = []
	var start := Time.get_ticks_msec()
	var min_fps := 999
	var total_fps := 0
	var samples := 0
	await callable.call()
	# sample for 2 sec
	var t := 0.0
	while t < 2.0:
		await get_tree().process_frame
		var fps := Engine.get_frames_per_second()
		min_fps = mini(min_fps, fps)
		total_fps += fps
		samples += 1
		t += get_process_delta_time()
	var avg := total_fps / maxi(1, samples)
	results.append({
		"name": name,
		"avg_fps": avg,
		"min_fps": min_fps,
		"frame_ms": 1000.0 / max(1, avg),
		"tris": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"bodies": PerformanceBudget.active_bodies,
		"particles": PerformanceBudget.active_particles,
		"mem": OS.get_static_memory_usage() / (1024*1024),
		"elapsed_ms": Time.get_ticks_msec() - start,
	})

func _scenario_movement():
	# move camera in circle
	var cam := get_viewport().get_camera_3d()
	if cam == null: return
	for i in 30:
		cam.position += Vector3(0.5,0,0)
		await get_tree().process_frame

func _scenario_local():
	for i in 5:
		voxel_grid.damage_voxel(Vector3i(10+i,1,10), 999)
		await get_tree().process_frame

func _scenario_explosion():
	voxel_grid.explosion(Vector3i(20,5,20), 5, 150)
	await get_tree().process_frame

func _scenario_collapse():
	var pillar := Vector3i(20,1,20)
	for y in 5:
		voxel_grid.set_voxel(pillar + Vector3i(0, y, 0), VoxelMaterial.Type.CONCRETE)
	await get_tree().process_frame
	for y in 3:
		voxel_grid.damage_voxel(pillar + Vector3i(0,y,0), 999)
		await get_tree().process_frame
