extends Node
class_name PhysicsProps

# Poolable debris prop
var is_pooled: bool = false

static func spawn_debris(pos: Vector3, mat: int, grid_parent: Node):
	if not PerformanceBudget.can_spawn_body():
		return
	var body := RigidBody3D.new()
	body.position = pos + Vector3(0.5,0.5,0.5)
	body.mass = 2.0
	body.linear_damp = 0.3
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.8,0.8,0.8)
	mesh.mesh = box
	var m := StandardMaterial3D.new()
	m.albedo_color = VoxelMaterial.color_for(mat)
	mesh.material_override = m
	body.add_child(mesh)
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(0.8,0.8,0.8)
	shape.shape = box_shape
	body.add_child(shape)
	grid_parent.add_child(body)
	PerformanceBudget.register_body()
	PerformanceBudget.register_debris()
	# auto cleanup after 10s
	body.set_meta("spawn_time", Time.get_ticks_msec())
	# use timer to free
	var timer := Timer.new()
	timer.wait_time = 10.0
	timer.one_shot = true
	timer.timeout.connect(func(): 
		if is_instance_valid(body):
			body.queue_free()
			PerformanceBudget.unregister_body()
			PerformanceBudget.unregister_debris()
		timer.queue_free())
	body.add_child(timer)
	timer.start()
