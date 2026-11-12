extends Node3D
## Inside HAB-1. A pressurised room you can walk around in: task board, galley, lab bench, sleep pods,
## airlock hatch back to the surface, and the base power panel. The room sits 120 m above the surface
## so the two "worlds" never touch; the airlock moves the player between them.

const W := 11.2      # width  (x)
const D := 8.8       # depth  (z)
const H := 3.1       # ceiling
const WALL := Color(0.80, 0.79, 0.76)
const FLOOR := Color(0.34, 0.35, 0.37)
const TRIM := Color(0.52, 0.44, 0.33)
const SCREEN := Color(0.35, 0.95, 0.9)

var game = null
var spots := {}
var board_lines: Array[Label3D] = []
var power_label: Label3D
var clock_label: Label3D


func build(g) -> void:
	game = g
	name = "Interior"
	position = Vector3(0, 120, 0)
	_shell()
	_lights()
	_board()
	_galley()
	_lab()
	_pods()
	_comms_desk()
	_store()
	_airlock()
	_decor()
	_spots()


func _shell() -> void:
	Build.box(self, Vector3(W, 0.2, D), Vector3(0, -0.1, 0), FLOOR)
	Build.box(self, Vector3(W, 0.2, D), Vector3(0, H + 0.1, 0), Color(0.72, 0.72, 0.71))
	# walls
	Build.box(self, Vector3(W + 0.4, H, 0.2), Vector3(0, H * 0.5, -D * 0.5), WALL)
	Build.box(self, Vector3(W + 0.4, H, 0.2), Vector3(0, H * 0.5, D * 0.5), WALL)
	Build.box(self, Vector3(0.2, H, D), Vector3(-W * 0.5, H * 0.5, 0), WALL)
	Build.box(self, Vector3(0.2, H, D), Vector3(W * 0.5, H * 0.5, 0), WALL)
	# skirting and ceiling trim
	for z in [-D * 0.5 + 0.08, D * 0.5 - 0.08]:
		Build.box(self, Vector3(W, 0.16, 0.06), Vector3(0, 0.08, z), TRIM)
	for x in [-W * 0.5 + 0.08, W * 0.5 - 0.08]:
		Build.box(self, Vector3(0.06, 0.16, D), Vector3(x, 0.08, 0), TRIM)
	# ceiling light strips
	for i in 3:
		var strip := Build.box(self, Vector3(2.6, 0.05, 0.22), Vector3(-3.2 + i * 3.2, H - 0.04, 0), Color(1.0, 0.96, 0.86))
		(strip as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.95, 0.85), 1.4)

	# collision: floor, four walls, ceiling
	_collide(Vector3(W, 0.2, D), Vector3(0, -0.1, 0))
	_collide(Vector3(W + 0.4, H, 0.2), Vector3(0, H * 0.5, -D * 0.5))
	_collide(Vector3(W + 0.4, H, 0.2), Vector3(0, H * 0.5, D * 0.5))
	_collide(Vector3(0.2, H, D), Vector3(-W * 0.5, H * 0.5, 0))
	_collide(Vector3(0.2, H, D), Vector3(W * 0.5, H * 0.5, 0))
	_collide(Vector3(W, 0.2, D), Vector3(0, H + 0.1, 0))


func _collide(size: Vector3, pos: Vector3) -> StaticBody3D:
	var b := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	b.position = pos
	b.add_child(cs)
	add_child(b)
	return b


func _lights() -> void:
	for p in [Vector3(-3.2, 2.85, -1.6), Vector3(3.2, 2.85, -1.6), Vector3(0, 2.85, 2.6)]:
		var l := OmniLight3D.new()
		l.position = p
		l.light_color = Color(1.0, 0.93, 0.82)
		l.light_energy = 1.15
		l.omni_range = 8.0
		add_child(l)


# ---------------------------------------------------------------------------------------------
# Task board. Four lines, rewritten every morning by main.gd.
# ---------------------------------------------------------------------------------------------
func _board() -> void:
	var frame := Build.box(self, Vector3(4.0, 2.0, 0.12), Vector3(-1.2, 1.95, -D * 0.5 + 0.12), Color(0.16, 0.18, 0.2))
	(frame as MeshInstance3D).name = "BoardFrame"
	var screen := Build.box(self, Vector3(3.8, 1.8, 0.04), Vector3(-1.2, 1.95, -D * 0.5 + 0.2), Color(0.05, 0.1, 0.12))
	(screen as MeshInstance3D).material_override = Build.glow(Color(0.10, 0.22, 0.26), 0.6)

	var title := Build.label(self, "DAILY TASKS  ·  SOL 1", Vector3(-1.2, 2.68, -D * 0.5 + 0.24), 40, Color(0.75, 1.0, 1.0))
	title.name = "BoardTitle"
	for i in 4:
		var l := Build.label(self, "", Vector3(-2.85, 2.36 - i * 0.36, -D * 0.5 + 0.24), 30, Color(0.85, 0.95, 0.98))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		l.pixel_size = 0.0075
		l.name = "BoardLine%d" % i
		board_lines.append(l)

	# base power panel, next to the board: the OTHER energy, deliberately not mixed with yours
	var pf := Build.box(self, Vector3(2.0, 1.3, 0.1), Vector3(1.7, 1.7, -D * 0.5 + 0.12), Color(0.14, 0.16, 0.18))
	(pf as MeshInstance3D).name = "PowerFrame"
	var ps := Build.box(self, Vector3(1.86, 1.16, 0.04), Vector3(1.7, 1.7, -D * 0.5 + 0.19), Color(0.05, 0.08, 0.1))
	(ps as MeshInstance3D).material_override = Build.glow(Color(0.1, 0.18, 0.3), 0.5)
	var pt := Build.label(self, "BASE POWER", Vector3(1.7, 2.14, -D * 0.5 + 0.23), 34, Color(0.6, 0.85, 1.0))
	pt.name = "PowerTitle"
	power_label = Build.label(self, "", Vector3(1.7, 1.72, -D * 0.5 + 0.23), 28, Color(0.8, 0.92, 1.0))
	power_label.name = "PowerText"
	var pnote := Build.label(self, "the base's electricity\nnot your energy", Vector3(1.7, 1.3, -D * 0.5 + 0.23), 22, Color(0.55, 0.65, 0.75))
	pnote.name = "PowerNote"


func set_board(title_text: String, lines: Array) -> void:
	var t := get_node_or_null("BoardTitle")
	if t is Label3D and t.text != title_text:
		t.text = title_text
	for i in board_lines.size():
		var want: String = lines[i] if i < lines.size() else ""
		if board_lines[i].text != want:
			board_lines[i].text = want


func set_power_text(text: String) -> void:
	if power_label != null and power_label.text != text:
		power_label.text = text


# ---------------------------------------------------------------------------------------------
func _galley() -> void:
	var g := Node3D.new()
	g.name = "Galley"
	add_child(g)
	# counter along the left wall
	Build.box(g, Vector3(1.0, 0.9, 4.0), Vector3(-W * 0.5 + 0.6, 0.45, -1.0), Color(0.55, 0.56, 0.58))
	Build.box(g, Vector3(1.1, 0.07, 4.1), Vector3(-W * 0.5 + 0.6, 0.93, -1.0), Color(0.85, 0.85, 0.84))
	Build.box(g, Vector3(0.7, 0.06, 0.5), Vector3(-W * 0.5 + 0.6, 0.96, 0.2), Color(0.3, 0.42, 0.48))  # sink
	Build.cyl(g, 0.03, 0.35, Vector3(-W * 0.5 + 0.75, 1.1, 0.2), Color(0.8, 0.82, 0.85), Vector3.ZERO, 8)
	# food locker with warm porthole
	Build.box(g, Vector3(0.9, 2.0, 1.2), Vector3(-W * 0.5 + 0.6, 1.0, 2.7), Color(0.62, 0.64, 0.66))
	var port := Build.box(g, Vector3(0.06, 0.5, 0.5), Vector3(-W * 0.5 + 1.06, 1.4, 2.7), Color(1.0, 0.85, 0.55))
	(port as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.8, 0.5), 0.9)
	# table and stools
	var top := Build.cyl(g, 1.15, 0.08, Vector3(-3.4, 0.74, 0.2), Color(0.92, 0.9, 0.85), Vector3.ZERO, 32)
	(top as MeshInstance3D).name = "Table"
	Build.cyl(g, 0.12, 0.72, Vector3(-3.4, 0.36, 0.2), Color(0.6, 0.62, 0.64), Vector3.ZERO, 12)
	for i in 4:
		var a := TAU * i / 4.0 + 0.4
		var sx := -3.4 + cos(a) * 1.65
		var sz := 0.2 + sin(a) * 1.65
		Build.cyl(g, 0.24, 0.5, Vector3(sx, 0.25, sz), Color(0.72, 0.63, 0.5), Vector3.ZERO, 12)
	# mugs and a bowl, because a galley should look used
	Build.cyl(g, 0.055, 0.12, Vector3(-3.1, 0.85, 0.6), Color(0.95, 0.55, 0.3), Vector3.ZERO, 12)
	Build.cyl(g, 0.055, 0.12, Vector3(-3.75, 0.85, -0.2), Color(0.4, 0.7, 0.85), Vector3.ZERO, 12)
	Build.cyl(g, 0.2, 0.09, Vector3(-3.3, 0.83, -0.5), Color(0.9, 0.9, 0.88), Vector3.ZERO, 16)
	Build.label(g, "GALLEY", Vector3(-W * 0.5 + 0.75, 2.25, -1.2), 30, Color(1.0, 0.88, 0.65))


func _lab() -> void:
	var l := Node3D.new()
	l.name = "Lab"
	add_child(l)
	# bench along the right wall
	Build.box(l, Vector3(1.4, 0.9, 4.4), Vector3(W * 0.5 - 0.7, 0.45, -1.4), Color(0.6, 0.61, 0.63))
	Build.box(l, Vector3(1.5, 0.07, 4.5), Vector3(W * 0.5 - 0.7, 0.94, -1.4), Color(0.9, 0.9, 0.88))
	# microscope-ish instrument
	Build.box(l, Vector3(0.32, 0.12, 0.32), Vector3(W * 0.5 - 0.7, 1.02, -2.6), Color(0.25, 0.26, 0.28))
	Build.cyl(l, 0.05, 0.45, Vector3(W * 0.5 - 0.7, 1.25, -2.6), Color(0.3, 0.32, 0.34), Vector3.ZERO, 10)
	Build.box(l, Vector3(0.1, 0.1, 0.5), Vector3(W * 0.5 - 0.7, 1.45, -2.45), Color(0.3, 0.32, 0.34))
	# sample oven
	Build.box(l, Vector3(0.8, 0.7, 0.7), Vector3(W * 0.5 - 0.9, 1.35, 1.2), Color(0.7, 0.71, 0.73))
	var win := Build.box(l, Vector3(0.02, 0.3, 0.34), Vector3(W * 0.5 - 1.31, 1.4, 1.2), Color(1.0, 0.5, 0.2))
	(win as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.45, 0.15), 1.2)
	Build.label(l, "120 C", Vector3(W * 0.5 - 1.33, 1.4, 1.2), 20, Color(1.0, 0.8, 0.6))
	# sample trays
	for i in 4:
		Build.box(l, Vector3(0.3, 0.06, 0.3), Vector3(W * 0.5 - 0.7, 1.0, -0.9 + i * 0.4), Color(0.36, 0.35, 0.33))
		Build.sphere(l, 0.07, Vector3(W * 0.5 - 0.7, 1.06, -0.9 + i * 0.4), Color(0.52, 0.51, 0.49), 1.0)
	# monitor arm and screen
	Build.cyl(l, 0.03, 1.0, Vector3(W * 0.5 - 1.5, 1.4, -3.6), Color(0.4, 0.42, 0.45), Vector3.ZERO, 8)
	var ms := Build.box(l, Vector3(0.08, 0.6, 1.0), Vector3(W * 0.5 - 1.55, 1.85, -3.4), Color(0.06, 0.1, 0.13))
	(ms as MeshInstance3D).material_override = Build.glow(Color(0.2, 0.5, 0.55), 0.8)
	# lab chair
	Build.cyl(l, 0.26, 0.5, Vector3(W * 0.5 - 1.9, 0.25, -1.2), Color(0.45, 0.47, 0.5), Vector3.ZERO, 12)
	Build.box(l, Vector3(0.5, 0.5, 0.08), Vector3(W * 0.5 - 1.9, 0.7, -1.5), Color(0.45, 0.47, 0.5))
	Build.label(l, "LAB BENCH", Vector3(W * 0.5 - 0.75, 2.15, -2.2), 28, Color(0.7, 0.95, 1.0))


func _pods() -> void:
	var p := Node3D.new()
	p.name = "Pods"
	add_child(p)
	for i in 2:
		var x := -3.9 if i == 0 else 4.0
		var z := 3.0
		Build.box(p, Vector3(1.15, 0.5, 2.1), Vector3(x, 0.25, z), Color(0.55, 0.57, 0.6))
		Build.box(p, Vector3(1.0, 0.18, 1.9), Vector3(x, 0.58, z), Color(0.82, 0.84, 0.88))
		Build.box(p, Vector3(0.7, 0.1, 0.4), Vector3(x, 0.7, z - 0.7), Color(0.95, 0.95, 0.93))  # pillow
		Build.box(p, Vector3(1.15, 0.05, 1.2), Vector3(x, 0.62, z + 0.35), Color(0.35, 0.45, 0.62))  # blanket
		Build.box(p, Vector3(0.06, 0.9, 2.0), Vector3(x + (0.62 if i == 0 else -0.62), 0.45, z), Color(0.6, 0.62, 0.66))
		Build.box(p, Vector3(0.5, 0.07, 0.5), Vector3(x, 2.55, z), Color(0.9, 0.9, 0.9))
	Build.label(p, "SLEEP  (end the sol)", Vector3(-3.9, 2.1, 3.0), 24, Color(0.75, 0.78, 1.0))


func _comms_desk() -> void:
	var c := Node3D.new()
	c.name = "CommsDesk"
	add_child(c)
	Build.box(c, Vector3(2.0, 0.78, 0.9), Vector3(2.4, 0.39, 3.6), Color(0.55, 0.57, 0.6))
	Build.box(c, Vector3(2.1, 0.07, 1.0), Vector3(2.4, 0.81, 3.6), Color(0.88, 0.88, 0.86))
	Build.box(c, Vector3(0.9, 0.55, 0.08), Vector3(2.2, 1.25, 3.15), Color(0.07, 0.1, 0.12))
	var sc := Build.box(c, Vector3(0.82, 0.47, 0.02), Vector3(2.2, 1.25, 3.09), Color(0.2, 0.6, 0.5))
	(sc as MeshInstance3D).material_override = Build.glow(Color(0.25, 0.75, 0.6), 0.9)
	Build.box(c, Vector3(2.2, 1.4, 0.06), Vector3(2.4, 1.9, 4.34), Color(0.2, 0.24, 0.28))
	Build.box(c, Vector3(0.1, 0.16, 0.16), Vector3(2.4, 0.9, 3.45), Color(0.2, 0.2, 0.22))  # mic
	Build.cyl(c, 0.26, 0.5, Vector3(2.4, 0.25, 2.95), Color(0.45, 0.47, 0.5), Vector3.ZERO, 12)
	Build.label(c, "COMMS  ·  EARTH", Vector3(2.4, 2.72, 4.2), 26, Color(0.6, 1.0, 0.85))
	# jaunty little Earth photo
	Build.box(c, Vector3(0.5, 0.5, 0.03), Vector3(3.6, 2.2, 4.3), Color(0.2, 0.45, 0.8))


func _store() -> void:
	var s := Node3D.new()
	s.name = "Storage"
	add_child(s)
	for i in 3:
		Build.box(s, Vector3(1.1, 1.0, 0.8), Vector3(4.2, 0.5 + i * 1.02, -3.7), Color(0.62, 0.58, 0.5))
		Build.box(s, Vector3(1.0, 0.06, 0.7), Vector3(4.2, 0.98 + i * 1.02, -3.7), Color(0.75, 0.7, 0.58))
		for j in 2:
			Build.box(s, Vector3(0.08, 0.3, 0.08), Vector3(4.2, 0.5 + i * 1.02, -3.32 + j * 0.4), Color(0.3, 0.3, 0.32))
	Build.label(s, "SPARES", Vector3(4.2, 3.0, -3.7), 26, Color(0.95, 0.88, 0.7))


func _airlock() -> void:
	var a := Node3D.new()
	a.name = "Airlock"
	add_child(a)
	Build.box(a, Vector3(3.0, 2.5, 0.5), Vector3(0, 1.25, D * 0.5 - 0.2), Color(0.7, 0.71, 0.74))
	var hatch := Build.cyl(a, 0.85, 0.12, Vector3(0, 1.15, D * 0.5 - 0.46), Color(0.4, 0.45, 0.52), Vector3(PI * 0.5, 0, 0), 28)
	(hatch as MeshInstance3D).name = "Hatch"
	var ring := TorusMesh.new()
	ring.inner_radius = 0.88
	ring.outer_radius = 0.96
	ring.rings = 28
	ring.ring_segments = 6
	Build.mesh_node(a, ring, Build.glow(SCREEN, 1.8), Vector3(0, 1.15, D * 0.5 - 0.42), Vector3(PI * 0.5, 0, 0))
	Build.cyl(a, 0.22, 0.1, Vector3(0.45, 1.15, D * 0.5 - 0.54), Color(0.95, 0.75, 0.25), Vector3(PI * 0.5, 0, 0), 12)
	Build.label(a, "AIRLOCK  ·  SURFACE", Vector3(0, 2.35, D * 0.5 - 0.5), 26, Color(0.65, 1.0, 1.0))
	# hazard stripes
	for i in 5:
		var st := Build.box(a, Vector3(0.3, 0.1, 0.02), Vector3(-1.2 + i * 0.6, 0.2, D * 0.5 - 0.46), Color(0.95, 0.75, 0.2))
		(st as MeshInstance3D).rotation = Vector3(0, 0, 0.5)


func _decor() -> void:
	# rug in the middle, a couple of plants, crew photos
	Build.box(self, Vector3(3.2, 0.02, 2.2), Vector3(0.2, 0.02, 1.2), Color(0.28, 0.3, 0.4))
	Build.box(self, Vector3(2.6, 0.02, 1.7), Vector3(0.2, 0.03, 1.2), Color(0.42, 0.34, 0.3))
	for i in 2:
		var x := -1.4 + i * 2.9
		Build.cyl(self, 0.18, 0.3, Vector3(x, 0.15, 2.2), Color(0.55, 0.45, 0.35), Vector3.ZERO, 12)
		Build.sphere(self, 0.26, Vector3(x, 0.44, 2.2), Color(0.3, 0.6, 0.3), 0.9)
	# crew photos on the front wall
	for i in 5:
		Build.box(self, Vector3(0.34, 0.44, 0.02), Vector3(-2.4 + i * 0.55, 2.3, D * 0.5 - 0.12), Color(0.85, 0.85, 0.82))
		Build.box(self, Vector3(0.26, 0.34, 0.01), Vector3(-2.4 + i * 0.55, 2.33, D * 0.5 - 0.13), Color(0.2 + i * 0.08, 0.3, 0.45))
	# a worn sign over the board
	Build.label(self, "HAB-1  ·  PRESSURE 101.3 kPa  ·  O2 21%", Vector3(0, 2.95, D * 0.5 - 0.2), 22, Color(0.8, 0.85, 0.9))


func _spots() -> void:
	_spot("board", Vector3(-1.2, 0, -3.3), "Task board")
	_spot("power", Vector3(1.7, 0, -3.3), "Power panel")
	_spot("lab_bench", Vector3(W * 0.5 - 1.2, 0, -1.6), "Lab bench")
	_spot("galley", Vector3(-2.2, 0, -1.6), "Galley")
	_spot("bed", Vector3(-3.9, 0, 2.2), "Sleep")
	_spot("comms_desk", Vector3(2.4, 0, 2.8), "Comms desk")
	_spot("store", Vector3(4.0, 0, -2.9), "Spares bin")
	_spot("hatch_int", Vector3(0, 0, 3.7), "Go outside")


func _spot(id: String, pos: Vector3, text: String) -> void:
	var n := Node3D.new()
	n.name = "Spot_" + id
	n.position = pos
	n.set_meta("spot_id", id)
	n.set_meta("world", "interior")
	n.add_to_group("spot")
	add_child(n)
	var l := Build.label(n, text, Vector3(0, 1.9, 0), 28, Color(0.8, 1.0, 1.0))
	l.name = "Text"
	spots[id] = n
