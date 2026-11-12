extends Node3D
## The lunar surface: Shackleton rim site, the outpost you work out of, and the EVA work sites.
## Built entirely from primitives so there are no model files to lose.

const ROCK := Color(0.44, 0.43, 0.41)
const HULL := Color(0.82, 0.83, 0.85)
const HULL_2 := Color(0.66, 0.68, 0.72)
const ACCENT := Color(0.95, 0.72, 0.22)
const SIGNAL := Color(0.35, 0.95, 0.9)

var game = null
var sun: DirectionalLight3D
var rover = null
var markers := {}          # spot id -> Node3D beacon
var spots := {}            # spot id -> Node3D anchor


func build(g) -> void:
	game = g
	name = "World"
	_environment()
	Build.terrain(self)
	Build.rubble(self, 260, 150.0)
	Build.stars(self, 700)
	Build.earth(self)
	_habitat()
	_solar_field()
	_power_module()
	_greenhouse()
	_workshop()
	_comms_mast()
	_landing_pad()
	_paths()
	_berms()
	_build_rover()
	_spots()


func _solid(parent: Node3D, size: Vector3, pos: Vector3, rot := Vector3.ZERO) -> void:
	var b := StaticBody3D.new()
	b.position = pos
	b.rotation = rot
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	b.add_child(cs)
	parent.add_child(b)


func _environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.004, 0.005, 0.012)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.30, 0.34, 0.46)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.glow_enabled = true
	env.glow_intensity = 0.35
	env.glow_bloom = 0.05
	env.fog_enabled = false
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_energy = 2.1
	sun.light_color = Color(1.0, 0.98, 0.94)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0
	sun.rotation = Vector3(deg_to_rad(-16.0), deg_to_rad(38.0), 0.0)
	add_child(sun)

	var fill := DirectionalLight3D.new()
	fill.light_energy = 0.22
	fill.light_color = Color(0.55, 0.65, 1.0)
	fill.rotation = Vector3(deg_to_rad(-40.0), deg_to_rad(-140.0), 0.0)
	add_child(fill)


## Called by main every frame: the sun sits low on the rim, so elevation drives the solar array.
func set_sun_elevation(elev_deg: float) -> void:
	if sun == null:
		return
	var e := clampf(elev_deg, -12.0, 60.0)
	sun.rotation = Vector3(deg_to_rad(-maxf(e, 0.5)), deg_to_rad(38.0), 0.0)
	sun.light_energy = lerpf(0.15, 2.1, clampf(e / 18.0, 0.0, 1.0))


# ---------------------------------------------------------------------------------------------
# The habitat you can walk into. Exterior shell only; the interior is a separate room.
# ---------------------------------------------------------------------------------------------
func _habitat() -> void:
	var h := Node3D.new()
	h.name = "Habitat"
	h.position = Vector3(0, 0, 6)
	add_child(h)

	# pressure cylinder lying along Z, with domed ends
	var body := Build.cyl(h, 2.2, 7.2, Vector3(0, 2.3, 0), HULL, Vector3(PI * 0.5, 0, 0), 32)
	body.name = "Cylinder"
	var rib_mat := Build.mat(HULL_2, 0.7, 0.2)
	for i in 5:
		var torus := TorusMesh.new()
		torus.inner_radius = 2.16
		torus.outer_radius = 2.30
		torus.rings = 28
		torus.ring_segments = 8
		Build.mesh_node(h, torus, rib_mat, Vector3(0, 2.3, -3.0 + i * 1.5), Vector3(PI * 0.5, 0, 0))
	var cap := SphereMesh.new()
	cap.radius = 2.2
	cap.height = 4.4
	cap.is_hemisphere = true
	for z in [-3.6, 3.6]:
		var dome := Build.mesh_node(h, cap, Build.mat(HULL), Vector3(0, 2.3, z), Vector3(0, 0, 0 if z > 0 else PI))
		dome.scale = Vector3(1, 1, 1)

	# windows: small emissive rectangles along the side
	for i in 3:
		var w := Build.box(h, Vector3(0.02, 0.55, 0.45), Vector3(2.23, 2.55, -1.6 + i * 1.7), Color(1.0, 0.86, 0.6))
		(w as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.82, 0.5), 1.6)

	# airlock porch on the +Z end
	Build.box(h, Vector3(3.4, 2.7, 2.0), Vector3(0, 1.35, 4.4), HULL_2)
	Build.box(h, Vector3(3.6, 0.18, 2.2), Vector3(0, 2.78, 4.4), HULL)
	Build.box(h, Vector3(1.05, 1.95, 0.12), Vector3(0, 1.05, 5.42), Color(0.36, 0.42, 0.5))
	var rim := Build.box(h, Vector3(1.35, 2.2, 0.06), Vector3(0, 1.07, 5.47), SIGNAL)
	rim.material_override = Build.glow(SIGNAL, 1.4)
	Build.box(h, Vector3(0.3, 0.3, 0.12), Vector3(0.72, 1.65, 5.44), ACCENT)  # hatch wheel
	# steps
	for i in 3:
		Build.box(h, Vector3(1.6, 0.12, 0.34), Vector3(0, 0.06 + i * 0.16, 5.75 + (2 - i) * 0.3), HULL_2)

	# radiators on the shadow side
	for i in 2:
		var r := Build.box(h, Vector3(0.06, 1.5, 2.4), Vector3(-3.0, 2.9, -1.2 + i * 2.4), Color(0.92, 0.93, 0.95))
		(r as MeshInstance3D).rotation = Vector3(0, 0, 0.35)

	# collision so you cannot walk through the pressure hull
	_solid(h, Vector3(4.4, 3.6, 8.0), Vector3(0, 1.8, 0))
	_solid(h, Vector3(3.4, 2.7, 2.2), Vector3(0, 1.35, 4.5))
	Build.label(h, "LUNA ACADEMY  ·  SHACKLETON RIM", Vector3(0, 3.6, 5.5), 40, Color(0.75, 0.95, 1.0))
	Build.label(h, "HAB-1", Vector3(-2.4, 2.9, 5.35), 32, Color(0.9, 0.78, 0.45))


func _solar_field() -> void:
	var f := Node3D.new()
	f.name = "SolarField"
	add_child(f)
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.09, 0.16, 0.36)
	glass.metallic = 0.55
	glass.roughness = 0.18
	var cell := Color(0.14, 0.2, 0.42)
	var idx := 0
	for row in 3:
		for col in 2:
			var x := -22.0 + col * 5.4
			var z := -1.0 + row * 4.6
			Build.cyl(f, 0.09, 1.5, Vector3(x, 0.75, z), HULL_2, Vector3.ZERO, 10)
			var panel := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(4.4, 0.07, 2.6)
			panel.mesh = bm
			panel.material_override = glass
			panel.position = Vector3(x, 1.68, z)
			panel.rotation = Vector3(deg_to_rad(-22.0), 0, 0)
			f.add_child(panel)
			for i in 4:
				var line := Build.box(f, Vector3(4.3, 0.075, 0.02), Vector3(x, 1.68 + 0.005, z - 1.0 + i * 0.66), cell)
				(line as MeshInstance3D).rotation = panel.rotation
			Build.label(f, "A1%d" % (idx + 1), Vector3(x, 2.1, z + 1.3), 22, Color(0.6, 0.85, 1.0))
			idx += 1
	Build.label(f, "SOLAR ARRAY A", Vector3(-19.0, 3.4, 9.4), 34, Color(0.6, 0.9, 1.0))


func _power_module() -> void:
	var p := Node3D.new()
	p.name = "PowerModule"
	p.position = Vector3(20, 0, 4)
	add_child(p)
	Build.box(p, Vector3(5.0, 2.9, 4.4), Vector3(0, 1.45, 0), HULL_2)
	Build.box(p, Vector3(5.3, 0.2, 4.7), Vector3(0, 2.95, 0), HULL)
	for i in 4:
		Build.box(p, Vector3(0.08, 1.5, 1.8), Vector3(2.6 + i * 0.32, 1.9, 0), Color(0.93, 0.94, 0.96))
	Build.box(p, Vector3(0.5, 2.2, 0.5), Vector3(-2.7, 1.1, 1.9), HULL)
	var led := Build.box(p, Vector3(0.5, 0.14, 0.06), Vector3(0, 2.6, 2.22), Color(0.4, 1.0, 0.5))
	led.material_override = Build.glow(Color(0.4, 1.0, 0.5), 2.0)
	_solid(p, Vector3(5.0, 2.9, 4.4), Vector3(0, 1.45, 0))
	Build.label(p, "POWER  ·  ECLSS", Vector3(0, 3.5, 1.2), 32, Color(0.7, 1.0, 0.8))
	Build.label(p, "120 kWh", Vector3(0, 3.05, 2.4), 26, Color(1.0, 0.9, 0.6))


func _greenhouse() -> void:
	var g := Node3D.new()
	g.name = "Greenhouse"
	g.position = Vector3(18, 0, -14)
	add_child(g)
	Build.cyl(g, 3.5, 1.0, Vector3(0, 0.5, 0), HULL_2, Vector3.ZERO, 32)
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.45, 0.85, 0.7, 0.32)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.roughness = 0.15
	glass.metallic = 0.1
	var dome := SphereMesh.new()
	dome.radius = 3.5
	dome.height = 3.5
	dome.is_hemisphere = true
	Build.mesh_node(g, dome, glass, Vector3(0, 1.0, 0))
	# trays and plants, catching the pink grow light
	for i in 6:
		var row := floorf(i / 3.0)
		var tray_pos := Vector3(-1.1 + (i % 3) * 1.1, 0.95 + row * 0.55, -0.4 + row * 0.9)
		var tray := Build.box(g, Vector3(1.5, 0.16, 0.6), tray_pos, Color(0.3, 0.32, 0.3))
		(tray as MeshInstance3D).name = "Tray%d" % i
		for j in 3:
			var leaf := Vector3(-1.5 + j * 0.35 + (i % 3) * 1.1, 1.07 + row * 0.55, -0.4 + row * 0.9)
			Build.sphere(g, 0.09, leaf, Color(0.28, 0.62, 0.26), 0.9)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.5, 0.8)
	lamp.light_energy = 1.6
	lamp.omni_range = 7.0
	lamp.position = Vector3(0, 2.6, 0)
	g.add_child(lamp)
	_solid(g, Vector3(7.0, 3.4, 7.0), Vector3(0, 1.7, 0))
	Build.label(g, "GREENHOUSE", Vector3(0, 3.9, 2.2), 32, Color(0.7, 1.0, 0.75))


func _workshop() -> void:
	var w := Node3D.new()
	w.name = "Workshop"
	w.position = Vector3(-18, 0, -16)
	add_child(w)
	Build.box(w, Vector3(6.4, 3.0, 5.6), Vector3(0, 1.5, 0), HULL_2)
	Build.box(w, Vector3(6.7, 0.22, 5.9), Vector3(0, 3.05, 0), HULL)
	Build.box(w, Vector3(3.4, 2.1, 0.1), Vector3(0.6, 1.1, 2.85), Color(0.34, 0.38, 0.44))
	for i in 3:
		Build.box(w, Vector3(3.2, 0.06, 0.02), Vector3(0.6, 0.5 + i * 0.6, 2.92), ACCENT)
	Build.box(w, Vector3(0.9, 0.9, 0.9), Vector3(-3.6, 0.45, 3.2), ROCK)
	_solid(w, Vector3(6.4, 3.0, 5.6), Vector3(0, 1.5, 0), Vector3(0, 0, 0))
	Build.label(w, "WORKSHOP", Vector3(0, 3.6, 2.9), 32, Color(0.95, 0.9, 0.7))


func _comms_mast() -> void:
	var m := Node3D.new()
	m.name = "CommsMast"
	m.position = Vector3(6, 0, -22)
	add_child(m)
	Build.cyl(m, 0.5, 0.3, Vector3(0, 0.15, 0), HULL_2, Vector3.ZERO, 16)
	Build.cyl(m, 0.11, 9.0, Vector3(0, 4.5, 0), HULL, Vector3.ZERO, 12)
	for i in 3:
		var a := TAU * i / 3.0
		var guy := Build.cyl(m, 0.015, 6.4, Vector3(cos(a) * 1.9, 3.2, sin(a) * 1.9), HULL_2, Vector3(deg_to_rad(17.0), -a, 0), 6)
		(guy as MeshInstance3D).rotation = Vector3(0, -a, deg_to_rad(17.0))
	var dish := SphereMesh.new()
	dish.radius = 1.5
	dish.height = 1.1
	dish.is_hemisphere = true
	var dish_pos := Vector3(0.4, 9.2, 0)
	var dish_rot := Vector3(deg_to_rad(-55.0), deg_to_rad(20.0), 0)
	Build.mesh_node(m, dish, Build.mat(Color(0.9, 0.91, 0.93), 0.4, 0.5), dish_pos, dish_rot)
	var beacon := Build.sphere(m, 0.12, Vector3(0, 9.55, 0), Color(1.0, 0.3, 0.25))
	(beacon as MeshInstance3D).material_override = Build.glow(Color(1.0, 0.25, 0.2), 3.0)
	_solid(m, Vector3(1.2, 0.6, 1.2), Vector3(0, 0.3, 0))
	Build.label(m, "COMMS", Vector3(0, 10.2, 0), 30, Color(1.0, 0.8, 0.7))


func _landing_pad() -> void:
	var p := Node3D.new()
	p.name = "LandingPad"
	p.position = Vector3(-34, 0, 24)
	add_child(p)
	Build.cyl(p, 8.0, 0.12, Vector3(0, 0.06, 0), Color(0.26, 0.26, 0.27), Vector3.ZERO, 40)
	Build.cyl(p, 3.2, 0.14, Vector3(0, 0.07, 0), Color(0.14, 0.13, 0.12), Vector3.ZERO, 32)
	for i in 4:
		var a := TAU * i / 4.0 + PI * 0.25
		var l := Build.box(p, Vector3(0.5, 0.35, 0.5), Vector3(cos(a) * 7.2, 0.2, sin(a) * 7.2), Color(0.15, 0.2, 0.2))
		(l as MeshInstance3D).material_override = Build.glow(Color(0.35, 0.7, 1.0), 1.2)
	Build.label(p, "PAD A", Vector3(0, 1.2, -7.8), 30, Color(0.7, 0.85, 1.0))
	# flag: a stiff plate on a pole, the way it behaves in vacuum
	Build.cyl(p, 0.04, 2.4, Vector3(2.6, 1.2, 2.4), Color(0.8, 0.8, 0.82), Vector3.ZERO, 8)
	Build.box(p, Vector3(0.02, 0.7, 1.05), Vector3(2.6, 2.1, 1.9), Color(0.16, 0.35, 0.7))


func _paths() -> void:
	for i in 6:
		var z := 12.0 + i * 1.6
		Build.box(self, Vector3(1.5, 0.03, 0.12), Vector3(0, 0.015, z), Color(0.33, 0.33, 0.32))
	for i in 7:
		Build.box(self, Vector3(1.2, 0.03, 0.12), Vector3(2.0 + i * 1.6, 0.015, 16.0), Color(0.33, 0.33, 0.32))
	# stake lane from the airlock out to the rover bay, the one the task asks you to mark
	for i in 8:
		Build.cyl(self, 0.05, 0.7, Vector3(-1.4, 0.35, 13.0 + i * 1.5), Color(0.9, 0.8, 0.35), Vector3.ZERO, 6)


func _berms() -> void:
	var bag := Color(0.36, 0.35, 0.33)
	for i in 22:
		var a := TAU * i / 22.0
		var r := 6.4
		var x := cos(a) * r
		var z := sin(a) * r + 6.0
		if abs(x) < 2.6 and z > 9.5:
			continue  # keep the door clear
		Build.box(self, Vector3(1.7, 1.0, 1.9), Vector3(x, 0.5, z), bag, Vector3(0, -a, 0.0))
		_solid(self, Vector3(1.7, 1.1, 1.9), Vector3(x, 0.55, z), Vector3(0, -a, 0.0))
		Build.box(self, Vector3(1.5, 0.55, 1.7), Vector3(x * 0.96, 1.15, z * 0.96 + 0.24), bag, Vector3(0, -a + 0.2, 0.0))


func _build_rover() -> void:
	rover = load("res://src/rover.gd").new()
	rover.name = "Rover"
	add_child(rover)
	rover.build(self, Vector3(12, 0, 18), game)


# ---------------------------------------------------------------------------------------------
# Interaction anchors. Each one is visible only when it matters (main toggles them per task).
# ---------------------------------------------------------------------------------------------
func _spot(id: String, pos: Vector3, text: String) -> Node3D:
	var n := Node3D.new()
	n.name = "Spot_" + id
	n.position = pos
	n.set_meta("spot_id", id)
	n.set_meta("world", "exterior")
	n.add_to_group("spot")
	add_child(n)
	var ring := TorusMesh.new()
	ring.inner_radius = 0.62
	ring.outer_radius = 0.78
	ring.rings = 24
	ring.ring_segments = 6
	var rm := MeshInstance3D.new()
	rm.mesh = ring
	rm.material_override = Build.glow(SIGNAL, 2.2)
	rm.position = Vector3(0, 0.06, 0)
	rm.name = "Ring"
	n.add_child(rm)
	var beam := Build.cyl(n, 0.03, 2.2, Vector3(0, 1.1, 0), Color(0.4, 1.0, 0.95))
	(beam as MeshInstance3D).material_override = Build.glow(SIGNAL, 1.2)
	(beam as MeshInstance3D).name = "Beam"
	var l := Build.label(n, text, Vector3(0, 2.5, 0), 34, Color(0.7, 1.0, 1.0))
	l.name = "Text"
	spots[id] = n
	markers[id] = n
	n.visible = false
	return n


func _spots() -> void:
	_spot("hatch", Vector3(0, 0, 12.6), "Enter HAB-1")
	_spot("rover", Vector3(12, 0, 18), "Drive the rover")
	_spot("eva_antenna", Vector3(6, 0, -21.0), "Torque the mast")
	_spot("eva_dust", Vector3(-22.0, 0, 5.0), "Brush the arrays")
	_spot("eva_transect", Vector3(46, Build.height_at(46, 30), 30), "Crater transect")
	_spot("eva_stakes", Vector3(0, 0, 16.0), "Survey stakes")
	_spot("eva_sample", Vector3(30, Build.height_at(30, 40), 40), "Scoop site")
	_spot("crew_water", Vector3(18, 0, -9.4), "Greenhouse trays")


func show_spot(id: String, on: bool) -> void:
	if markers.has(id):
		(markers[id] as Node3D).visible = on


func spot_label(id: String) -> String:
	if not spots.has(id):
		return ""
	var l := (spots[id] as Node3D).get_node_or_null("Text")
	return l.text if l is Label3D else ""


func set_spot_text(id: String, text: String) -> void:
	if not spots.has(id):
		return
	var l := (spots[id] as Node3D).get_node_or_null("Text")
	if l is Label3D:
		l.text = text
