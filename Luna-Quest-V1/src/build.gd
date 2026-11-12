class_name Build
extends RefCounted
## Small mesh factory. Everything in Luna-Quest-V1 is built from primitives in code, so there are no
## imported models to break and the whole project is a handful of readable scripts.

const GRAVITY := 1.62          # m/s^2, measured lunar surface gravity
const TERRAIN_SIZE := 400.0
const TERRAIN_RES := 128
const CRATERS := [
	{"x": 62.0, "z": 30.0, "r": 16.0, "d": 3.4},
	{"x": 44.0, "z": 6.0, "r": 6.0, "d": 1.5},
	{"x": -62.0, "z": -38.0, "r": 12.0, "d": 2.4},
	{"x": 30.0, "z": 40.0, "r": 7.0, "d": 1.6},
	{"x": -40.0, "z": 52.0, "r": 9.0, "d": 2.0},
]
static var _noise: FastNoiseLite


static func mat(color: Color, rough := 0.9, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


static func glow(color: Color, energy := 2.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	return m


static func mesh_node(parent: Node3D, mesh: Mesh, material: Material, pos: Vector3,
		rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = material
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi


static func box(parent: Node3D, size: Vector3, pos: Vector3, color: Color,
		rot := Vector3.ZERO, rough := 0.9, metal := 0.0) -> MeshInstance3D:
	var m := BoxMesh.new()
	m.size = size
	return mesh_node(parent, m, mat(color, rough, metal), pos, rot)


static func cyl(parent: Node3D, radius: float, height: float, pos: Vector3, color: Color,
		rot := Vector3.ZERO, sides := 24) -> MeshInstance3D:
	var m := CylinderMesh.new()
	m.top_radius = radius
	m.bottom_radius = radius
	m.height = height
	m.radial_segments = sides
	return mesh_node(parent, m, mat(color, 0.8, 0.1), pos, rot)


static func sphere(parent: Node3D, radius: float, pos: Vector3, color: Color, rough := 0.8, metal := 0.0) -> MeshInstance3D:
	var m := SphereMesh.new()
	m.radius = radius
	m.height = radius * 2.0
	m.radial_segments = 24
	m.rings = 12
	return mesh_node(parent, m, mat(color, rough, metal), pos)


static func capsule(parent: Node3D, radius: float, height: float, pos: Vector3, color: Color, rot := Vector3.ZERO) -> MeshInstance3D:
	var m := CapsuleMesh.new()
	m.radius = radius
	m.height = height
	m.radial_segments = 16
	m.rings = 8
	return mesh_node(parent, m, mat(color, 0.75, 0.05), pos, rot)


static func label(parent: Node3D, text: String, pos: Vector3, size := 48, color := Color(0.85, 0.95, 1.0)) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.position = pos
	l.font_size = size
	l.pixel_size = 0.008
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = false
	l.modulate = color
	l.outline_size = 6
	l.outline_modulate = Color(0, 0, 0, 0.75)
	parent.add_child(l)
	return l


# ---------------------------------------------------------------------------------------------
# Terrain. A 400 m sheet of regolith with gentle swells and a few craters, graded flat around the
# outpost the way a real site would be levelled before construction.
# ---------------------------------------------------------------------------------------------
static func _get_noise() -> FastNoiseLite:
	if _noise == null:
		_noise = FastNoiseLite.new()
		_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		_noise.frequency = 0.012
		_noise.fractal_octaves = 3
	return _noise


static func height_at(x: float, z: float) -> float:
	var d := sqrt(x * x + z * z)
	var h := _get_noise().get_noise_2d(x, z) * 3.0
	# Level the building apron: within 26 m of the outpost the ground is graded flat.
	var apron := clampf((d - 26.0) / 22.0, 0.0, 1.0)
	h *= apron
	for c in CRATERS:
		var dd: float = Vector2(x - c["x"], z - c["z"]).length() / c["r"]
		if dd < 2.2:
			var bowl: float = -c["d"] * (1.0 - smoothstep(0.0, 1.05, dd))
			var rim: float = c["d"] * 0.35 * exp(-pow((dd - 1.05) / 0.35, 2.0))
			h += (bowl + rim) * apron
	return h


static func terrain(parent: Node3D) -> StaticBody3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := TERRAIN_SIZE / float(TERRAIN_RES)
	var half := TERRAIN_SIZE * 0.5
	var light := Color(0.62, 0.61, 0.58)
	var dark := Color(0.30, 0.30, 0.30)
	for iz in TERRAIN_RES:
		for ix in TERRAIN_RES:
			var x0 := -half + ix * step
			var z0 := -half + iz * step
			var x1 := x0 + step
			var z1 := z0 + step
			var p00 := Vector3(x0, height_at(x0, z0), z0)
			var p10 := Vector3(x1, height_at(x1, z0), z0)
			var p01 := Vector3(x0, height_at(x0, z1), z1)
			var p11 := Vector3(x1, height_at(x1, z1), z1)
			_tri(st, p00, p10, p11, light, dark)
			_tri(st, p00, p11, p01, light, dark)
	st.generate_normals()
	var mesh := st.commit()
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 1.0
	mi.material_override = m
	parent.add_child(mi)

	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	shape.shape = mesh.create_trimesh_shape()
	body.add_child(shape)
	parent.add_child(body)
	return body


static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, light: Color, dark: Color) -> void:
	var n := (b - a).cross(c - a).normalized()
	var h := (a.y + b.y + c.y) / 3.0
	var shade := clampf(0.5 + h * 0.12, 0.0, 1.0)
	var col := dark.lerp(light, shade)
	for v in [a, b, c]:
		st.set_color(col)
		st.set_normal(n)
		st.add_vertex(v)


static func rubble(parent: Node3D, count := 220, radius := 150.0) -> void:
	var rock := SphereMesh.new()
	rock.radius = 1.0
	rock.height = 1.4
	rock.radial_segments = 6
	rock.rings = 4
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = rock
	mm.instance_count = count
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in count:
		var a := rng.randf() * TAU
		var r := 20.0 + pow(rng.randf(), 0.6) * radius
		var x := cos(a) * r
		var z := sin(a) * r
		var s := 0.25 + rng.randf() * 1.1
		var basis := Basis.from_euler(Vector3(rng.randf() * TAU, rng.randf() * TAU, rng.randf() * TAU)).scaled(Vector3(s, s * 0.7, s))
		mm.set_instance_transform(i, Transform3D(basis, Vector3(x, height_at(x, z) - 0.1, z)))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat(Color(0.42, 0.41, 0.39), 1.0)
	parent.add_child(mi)


# ---------------------------------------------------------------------------------------------
# Sky dressing: stars and Earth. The lunar sky is black in daylight, so the "sun" is only a lamp.
# ---------------------------------------------------------------------------------------------
static func stars(parent: Node3D, count := 900) -> void:
	var dot := SphereMesh.new()
	dot.radius = 0.9
	dot.height = 1.8
	dot.radial_segments = 4
	dot.rings = 2
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = dot
	mm.instance_count = count
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for i in count:
		var dir := Vector3(rng.randf_range(-1.0, 1.0), rng.randf_range(-0.15, 1.0), rng.randf_range(-1.0, 1.0)).normalized()
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * rng.randf_range(0.4, 1.4)), dir * 900.0))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = glow(Color(0.9, 0.94, 1.0), 2.4)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)


static func earth(parent: Node3D) -> void:
	var e := sphere(parent, 26.0, Vector3(-260, 150, -520), Color(0.25, 0.5, 0.95), 0.6, 0.0)
	var m := glow(Color(0.22, 0.45, 0.9), 0.9)
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	(e as MeshInstance3D).material_override = m
	label(parent, "Earth", Vector3(-260, 118, -520), 64, Color(0.6, 0.8, 1.0))


# ---------------------------------------------------------------------------------------------
# A suited astronaut, about 1.9 m tall, built from primitives. The visor is the readable part.
# ---------------------------------------------------------------------------------------------
static func astronaut(suit_color: Color, accent: Color) -> Node3D:
	var g := Node3D.new()
	g.name = "Astronaut"
	var suit := suit_color
	var dark := Color(0.22, 0.24, 0.27)
	# legs
	capsule(g, 0.11, 0.52, Vector3(-0.14, 0.34, 0), suit)
	capsule(g, 0.11, 0.52, Vector3(0.14, 0.34, 0), suit)
	box(g, Vector3(0.21, 0.14, 0.32), Vector3(-0.14, 0.07, 0.04), dark)
	box(g, Vector3(0.21, 0.14, 0.32), Vector3(0.14, 0.07, 0.04), dark)
	# torso
	capsule(g, 0.26, 0.62, Vector3(0, 0.92, 0), suit)
	box(g, Vector3(0.30, 0.18, 0.06), Vector3(0, 1.02, 0.25), Color(0.16, 0.19, 0.23))  # chest box
	box(g, Vector3(0.10, 0.05, 0.02), Vector3(-0.07, 1.04, 0.29), accent)
	box(g, Vector3(0.10, 0.05, 0.02), Vector3(0.07, 1.04, 0.29), Color(0.55, 0.9, 1.0))
	# arms
	capsule(g, 0.085, 0.56, Vector3(-0.34, 0.95, 0), suit, Vector3(0, 0, -0.12))
	capsule(g, 0.085, 0.56, Vector3(0.34, 0.95, 0), suit, Vector3(0, 0, 0.12))
	sphere(g, 0.095, Vector3(-0.37, 0.68, 0), Color(0.72, 0.75, 0.78))
	sphere(g, 0.095, Vector3(0.37, 0.68, 0), Color(0.72, 0.75, 0.78))
	# backpack
	box(g, Vector3(0.46, 0.52, 0.24), Vector3(0, 0.98, -0.30), Color(0.78, 0.81, 0.84))
	# helmet
	var helm := sphere(g, 0.24, Vector3(0, 1.40, 0), suit)
	helm.name = "Helmet"
	var visor := sphere(g, 0.20, Vector3(0, 1.39, 0.10), Color(0.95, 0.72, 0.25), 0.08, 0.6)
	(visor as MeshInstance3D).scale = Vector3(0.95, 0.8, 0.55)
	(visor as MeshInstance3D).name = "Visor"
	# crew colour band on the helmet
	var band := cyl(g, 0.245, 0.06, Vector3(0, 1.53, 0), accent)
	(band as MeshInstance3D).scale = Vector3(1.0, 1.0, 1.0)
	return g
