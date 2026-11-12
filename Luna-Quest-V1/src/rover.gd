extends Node3D
## The pressurised lunar rover. Kinematic on purpose: it follows the terrain height, so it can never
## get stuck in a crater wall or jitter on the triangle mesh, which is what kills the fun in a low-g
## driving game. Wheels are 81.8 cm, the real Apollo LRV size, and top speed is 18 km/h (5 m/s).

const MAX_SPEED := 5.0
const REV_SPEED := 2.2
const ACCEL := 3.2
const WHEEL_R := 0.41
const SLOPE_WARN := 16.0

var game = null
var world = null
var driven := false
var speed := 0.0
var yaw := 0.0
var wheel_spin := 0.0
var _mounts: Array[Node3D] = []
var _warn_cd := 0.0


func build(w, pos: Vector3, g) -> void:
	world = w
	game = g
	position = pos
	_build_meshes()
	set_process(true)


func _build_meshes() -> void:
	var chassis := Color(0.86, 0.87, 0.89)
	var dark := Color(0.2, 0.21, 0.23)
	# main body: a flat deck with a small pressurised cab at the front
	Build.box(self, Vector3(1.9, 0.28, 3.15), Vector3(0, 0.62, 0), chassis)
	Build.box(self, Vector3(1.7, 0.6, 1.5), Vector3(0, 1.0, 0.55), chassis)
	Build.box(self, Vector3(1.55, 0.5, 0.08), Vector3(0, 1.05, 1.32), Color(0.1, 0.16, 0.24))
	Build.box(self, Vector3(1.65, 0.08, 1.2), Vector3(0, 1.33, 0.6), chassis)
	# cargo rack and sample bins
	for i in 3:
		Build.box(self, Vector3(0.5, 0.32, 0.4), Vector3(-0.55 + i * 0.55, 0.92, -1.05), Color(0.55, 0.56, 0.58))
	# seats and console, visible from outside
	Build.box(self, Vector3(0.5, 0.5, 0.5), Vector3(-0.42, 1.02, 0.1), dark)
	Build.box(self, Vector3(0.5, 0.5, 0.5), Vector3(0.42, 1.02, 0.1), dark)
	# fenders
	for side in [-1.0, 1.0]:
		Build.box(self, Vector3(0.1, 0.05, 2.9), Vector3(side * 0.95, 0.86, 0), chassis)
	# wheels: 81.8 cm wire-mesh, real LRV spec
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			var mount := Node3D.new()
			mount.position = Vector3(sx * 1.05, WHEEL_R, sz * 1.05)
			add_child(mount)
			var wheel := CylinderMesh.new()
			wheel.top_radius = WHEEL_R
			wheel.bottom_radius = WHEEL_R
			wheel.height = 0.26
			wheel.radial_segments = 20
			var mi := MeshInstance3D.new()
			mi.mesh = wheel
			mi.material_override = Build.mat(Color(0.62, 0.63, 0.65), 0.55, 0.45)
			mi.rotation = Vector3(0, 0, PI * 0.5)
			mount.add_child(mi)
			for i in 8:
				var a := TAU * i / 8.0
				var spoke_pos := Vector3(0, cos(a) * WHEEL_R * 0.55, sin(a) * WHEEL_R * 0.55)
				var spoke := Build.box(mount, Vector3(0.28, 0.05, 0.05), spoke_pos, Color(0.3, 0.31, 0.32))
				(spoke as MeshInstance3D).rotation = Vector3(a, 0, 0)
			_mounts.append(mount)
	# whip antenna + headlights
	Build.cyl(self, 0.02, 2.4, Vector3(-0.7, 1.9, -0.9), Color(0.85, 0.85, 0.88), Vector3.ZERO, 6)
	for sx in [-0.55, 0.55]:
		var lamp := Build.box(self, Vector3(0.34, 0.16, 0.08), Vector3(sx, 0.78, 1.62), Color(1.0, 0.95, 0.8))
		(lamp as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.94, 0.75), 2.0)
	var light := SpotLight3D.new()
	light.position = Vector3(0, 1.1, 1.7)
	light.rotation = Vector3(deg_to_rad(-8.0), 0, 0)
	light.light_energy = 2.0
	light.spot_range = 34.0
	light.spot_angle = 40.0
	add_child(light)
	Build.label(self, "ROVER", Vector3(0, 2.3, 0), 28, Color(0.85, 0.9, 1.0))


func enter(player) -> void:
	driven = true
	speed = 0.0
	player.frozen = true
	player.third_person = true
	player.yaw = yaw
	player.global_position = global_position + Vector3(0, 0.75, 0)
	player.velocity = Vector3.ZERO
	game.toast("W/S throttle  ·  A/D steer  ·  E to get out")


func exit_rover(player) -> void:
	driven = false
	player.frozen = false
	var side := Basis(Vector3.UP, yaw) * Vector3(2.4, 0, 0)
	var p := global_position + side
	p.y = Build.height_at(p.x, p.z) + 0.1
	player.global_position = p
	player.velocity = Vector3.ZERO
	game.toast("On foot")


func _process(delta: float) -> void:
	_warn_cd = maxf(0.0, _warn_cd - delta)
	if game == null:
		return
	var player = game.player
	if driven and player != null:
		if Input.is_action_just_pressed("interact"):
			exit_rover(player)
		else:
			_drive(delta)
			player.global_position = global_position + Vector3(0, 0.75, 0)
			player.yaw = yaw
			player.pitch = -0.12
	# keep the interaction anchor on the rover wherever it is parked
	if world != null and world.spots.has("rover"):
		(world.spots["rover"] as Node3D).position = global_position


func _drive(delta: float) -> void:
	var throttle := 0.0
	if Input.is_action_pressed("move_forward"):
		throttle += 1.0
	if Input.is_action_pressed("move_back"):
		throttle -= 1.0
	var steer := 0.0
	if Input.is_action_pressed("move_left"):
		steer += 1.0
	if Input.is_action_pressed("move_right"):
		steer -= 1.0

	var target := (MAX_SPEED if throttle > 0.0 else REV_SPEED) * throttle
	speed = move_toward(speed, target, ACCEL * delta * (2.0 if throttle == 0.0 else 1.0))
	if abs(speed) < 0.02:
		speed = 0.0

	var pos := global_position
	var fwd := Basis(Vector3.UP, yaw) * Vector3(0, 0, 1)
	var ahead := pos + fwd * 2.0
	var slope := rad_to_deg(atan2(Build.height_at(ahead.x, ahead.z) - Build.height_at(pos.x, pos.z), 2.0))
	# slope is a warning and a speed penalty, never a lock: getting stuck is worse than sliding
	var grade := 1.0 - clampf((absf(slope) - SLOPE_WARN) / 22.0, 0.0, 0.55)
	if slope > SLOPE_WARN and speed > 0.1 and _warn_cd <= 0.0:
		_warn_cd = 6.0
		game.toast("Steep grade %.0f deg - slow down" % slope)

	var turn_rate := 1.35 * clampf(absf(speed) / 2.4, 0.0, 1.0) * grade
	yaw -= steer * turn_rate * delta * signf(speed if speed != 0.0 else 1.0)

	fwd = Basis(Vector3.UP, yaw) * Vector3(0, 0, 1)
	pos += fwd * speed * grade * delta
	pos.y = Build.height_at(pos.x, pos.z)
	global_position = pos

	# pitch and roll follow the ground under the four corners
	var right := Basis(Vector3.UP, yaw) * Vector3(1, 0, 0)
	var hf := Build.height_at(pos.x + fwd.x * 1.05, pos.z + fwd.z * 1.05)
	var hb := Build.height_at(pos.x - fwd.x * 1.05, pos.z - fwd.z * 1.05)
	var hr := Build.height_at(pos.x + right.x * 1.05, pos.z + right.z * 1.05)
	var hl := Build.height_at(pos.x - right.x * 1.05, pos.z - right.z * 1.05)
	var pitch := atan2(hb - hf, 2.1)
	var roll := atan2(hr - hl, 2.1)
	rotation = Vector3(pitch, yaw, roll)

	wheel_spin -= speed * delta / WHEEL_R
	for m in _mounts:
		m.rotation.x = wheel_spin
