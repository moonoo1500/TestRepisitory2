extends Node3D
class_name FireSmokeSystem

var voxel_grid: VoxelGrid

func _ready():
	# simple particles placeholder
	pass

func ignite(world: Vector3i):
	if voxel_grid:
		voxel_grid.set_fire(world, 12)
		_spawn_particles(Vector3(world))

func _spawn_particles(pos: Vector3):
	if not PerformanceBudget.can_spawn_debris(): return
	var p := GPUParticles3D.new()
	p.position = pos + Vector3(0.5,0.5,0.5)
	p.amount = 16
	p.lifetime = 1.5
	p.emitting = true
	var mat := ParticleProcessMaterial.new()
	mat.direction = Vector3(0,1,0)
	mat.initial_velocity_min = 0.5
	mat.initial_velocity_max = 1.5
	mat.gravity = Vector3(0,0.2,0)
	p.process_material = mat
	add_child(p)
	PerformanceBudget.register_debris()
	# auto free
	await get_tree().create_timer(2.0).timeout
	p.queue_free()
	PerformanceBudget.unregister_debris()
