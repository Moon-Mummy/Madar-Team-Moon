extends Node3D
## A crew NPC. They stand where their job is, turn to look at you when you come close, and answer
## with a recorded line instead of a wall of text.

var game = null
var crew_name := "Crew"
var role := "crew"
var talk_key := ""
var suit := Color(0.88, 0.89, 0.92)
var accent := Color(0.95, 0.75, 0.2)
var faced := 0.0
var _t := 0.0
var _body: Node3D


func build(g, who: String, job: String, pos: Vector3, face_yaw: float, body_color: Color, trim: Color) -> void:
	game = g
	crew_name = who
	role = job
	suit = body_color
	accent = trim
	position = pos
	rotation.y = face_yaw
	faced = face_yaw
	talk_key = "crew.%s.greet" % who.to_lower()
	_body = Build.astronaut(suit, accent)
	add_child(_body)
	Build.label(self, who, Vector3(0, 2.25, 0), 30, Color(0.85, 0.95, 1.0))
	Build.label(self, job, Vector3(0, 2.02, 0), 20, Color(0.6, 0.75, 0.85))
	add_to_group("npc")
	set_process(true)


func _process(delta: float) -> void:
	if game == null:
		return
	_t += delta
	if _body != null:
		# breathing, and a slight sway so they do not look like statues
		_body.position.y = sin(_t * 1.6) * 0.012
		_body.rotation.z = sin(_t * 0.9) * 0.012
	var p = game.player
	if p == null:
		return
	var d: float = global_position.distance_to(p.global_position)
	var want := faced
	if d < 5.0:
		var to := p.global_position - global_position
		want = atan2(to.x, to.z)
	rotation.y = lerp_angle(rotation.y, want, clampf(delta * 2.5, 0.0, 1.0))


func greet() -> void:
	if game != null:
		game.npc_talk(self)
