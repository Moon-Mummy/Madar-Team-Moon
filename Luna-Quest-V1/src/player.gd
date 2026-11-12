extends CharacterBody3D
## The player. A suited astronaut on 1.62 m/s^2, so walking feels light and every hop is long.
## Movement spends the astronaut's OWN stamina (never base power); inside the habitat the suit is
## docked and walking costs nothing.

const WALK := 3.0
const RUN := 5.4
const TIRED_SPEED := 2.0
const JUMP_V := 2.6
const GRAVITY := 1.62
const DRAIN_WALK := 0.35
const DRAIN_RUN := 0.9
const DRAIN_JUMP := 1.6
const INTERACT_RANGE := 3.2
const CREW_RANGE := 2.8

var game = null            # main.gd, untyped so the duck-typed calls stay readable
var camera: Camera3D = null
var interior := false
var frozen := false        # true while driving the rover or standing at a station
var yaw := 0.0
var pitch := -0.10
var third_person := true
var cam_distance := 4.4
var current_spot: Node3D = null
var current_npc = null

var _pivot: Node3D
var _suit: Node3D
var _bob := 0.0


func setup(g) -> void:
	game = g
	name = "Player"
	collision_layer = 2
	collision_mask = 1 | 4
	var col := CollisionShape3D.new()
	var caps := CapsuleShape3D.new()
	caps.radius = 0.34
	caps.height = 1.78
	col.shape = caps
	col.position = Vector3(0, 0.89, 0)
	add_child(col)

	_suit = Build.astronaut(Color(0.88, 0.89, 0.92), Color(0.95, 0.75, 0.2))
	_suit.name = "Suit"
	add_child(_suit)

	_pivot = Node3D.new()
	_pivot.position = Vector3(0, 1.5, 0)
	add_child(_pivot)

	camera = Camera3D.new()
	camera.fov = 72.0
	camera.near = 0.05
	camera.far = 1600.0
	_pivot.add_child(camera)
	camera.position = Vector3(0, 0.25, cam_distance)
	add_to_group("player")
	set_physics_process(true)


func place(pos: Vector3, look_yaw: float, inside: bool) -> void:
	global_position = pos
	velocity = Vector3.ZERO
	yaw = look_yaw
	pitch = -0.10
	interior = inside
	if _suit != null:
		_suit.visible = true
		_suit.rotation = Vector3(0, yaw + PI, 0)


func _unhandled_input(event: InputEvent) -> void:
	if game == null or game.ui_open:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * 0.0022
		pitch = clampf(pitch - event.relative.y * 0.0022, -1.2, 0.9)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and game.can_capture_mouse():
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_TAB:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
		elif event.keycode == KEY_V and not game.ui_open:
			third_person = not third_person
			game.toast("First person" if not third_person else "Third person", 2.0)


func _physics_process(delta: float) -> void:
	if game == null:
		return
	if frozen or game.ui_open:
		velocity = Vector3.ZERO
		_update_camera(delta)
		return

	var input := Vector2.ZERO
	if Input.is_action_pressed("move_forward"):
		input.y += 1.0
	if Input.is_action_pressed("move_back"):
		input.y -= 1.0
	if Input.is_action_pressed("move_left"):
		input.x -= 1.0
	if Input.is_action_pressed("move_right"):
		input.x += 1.0
	if Input.is_action_pressed("turn_left"):
		yaw += 1.8 * delta
	if Input.is_action_pressed("turn_right"):
		yaw -= 1.8 * delta
	input = input.limit_length(1.0)

	var tired: bool = game.stamina <= 1.0 and not interior
	var run := Input.is_action_pressed("run") and not tired and input.lengthSquared() > 0.1
	var speed := TIRED_SPEED if tired else (RUN if run else WALK)
	var basis := Basis(Vector3.UP, yaw)
	var dir := basis * Vector3(input.x, 0.0, -input.y)
	var accel := 26.0 if is_on_floor() else 6.0
	var target := dir * speed
	velocity.x = move_toward(velocity.x, target.x, accel * delta)
	velocity.z = move_toward(velocity.z, target.z, accel * delta)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_action_pressed("jump") and not tired:
		velocity.y = JUMP_V
		game.drain(DRAIN_JUMP, "jump")

	move_and_slide()

	# Suit energy: only spent out on the surface, and only while actually moving.
	var moved := Vector2(velocity.x, velocity.z).length()
	if not interior and moved > 0.4 and is_on_floor():
		game.drain((DRAIN_RUN if run else DRAIN_WALK) * delta * clampf(moved / speed, 0.4, 1.0), "walk")
	if global_position.y < -40.0:
		game.recover_player()

	# the suit turns to face the way you are walking
	if third_person and moved > 0.3:
		var want := atan2(velocity.x, velocity.z)
		_suit.rotation.y = lerp_angle(_suit.rotation.y, want, clampf(delta * 9.0, 0.0, 1.0))
	elif third_person:
		_suit.rotation.y = lerp_angle(_suit.rotation.y, yaw + PI, clampf(delta * 4.0, 0.0, 1.0))

	_update_camera(delta)
	_scan_spot()


func _update_camera(delta: float) -> void:
	_pivot.rotation = Vector3(pitch, yaw, 0.0)
	camera.rotation = Vector3.ZERO
	if third_person:
		var want := _pivot.to_global(Vector3(0, 0, cam_distance))
		var from := _pivot.global_position
		var space := get_world_3d().direct_space_state
		var q := PhysicsRayQueryParameters3D.create(from, want, 1)
		var hit := space.intersect_ray(q)
		if hit:
			var d: float = maxf(0.8, from.distance_to(hit["position"]) - 0.35)
			want = from + (want - from).normalized() * d
		camera.global_position = camera.global_position.lerp(want, clampf(delta * 11.0, 0.0, 1.0))
		if _suit != null:
			_suit.visible = true
	else:
		camera.position = Vector3(0, 0.1, 0)
		if _suit != null:
			_suit.visible = false
	# small head bob so the walk has weight
	var moving := Vector2(velocity.x, velocity.z).length() > 0.5
	_bob += delta * (7.0 if moving else 0.0)
	if not third_person:
		camera.position.y += sin(_bob) * 0.02


func _scan_spot() -> void:
	var best: Node3D = null
	var best_d := INTERACT_RANGE
	for n in get_tree().get_nodes_in_group("spot"):
		if not is_instance_valid(n):
			continue
		var w: String = n.get_meta("world", "exterior")
		if (w == "interior") != interior:
			continue  # spots in the other world (surface vs. interior) are ignored
		var d := global_position.distance_to((n as Node3D).global_position)
		if d < best_d:
			best_d = d
			best = n

	# crew members are focusable too, and the nearer of the two wins
	var npc = null
	var npc_d := CREW_RANGE
	for n in get_tree().get_nodes_in_group("npc"):
		if not is_instance_valid(n):
			continue
		var inside: bool = (n as Node3D).global_position.y > 60.0
		if inside != interior:
			continue
		var d: float = global_position.distance_to((n as Node3D).global_position)
		if d < npc_d:
			npc_d = d
			npc = n

	current_spot = best
	current_npc = npc
	if npc != null and (best == null or npc_d < best_d):
		game.set_spot(null, 0.0)
		game.set_npc(npc)
	else:
		game.set_npc(null)
		game.set_spot(best, best_d)
