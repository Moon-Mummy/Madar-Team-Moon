extends Node3D
## Luna-Quest-V1 — game root.
##
## The whole game hangs off this script: it builds the surface and the habitat interior, places the
## player and the crew, runs the clock and the base power model, and handles every interaction.
##
## Two separate budgets, and keeping them separate is the design:
##   * stamina  — the player's own energy. Tasks and walking spend it, food and sleep restore it.
##   * battery  — the base's electricity. Solar arrays fill it, habitat loads empty it. It never pays
##                for a task; it only gates the lab when the sun is down.

const DAY := 1440.0
const MINUTES_PER_SEC := 2.0
const START_MINUTES := 8.0 * 60.0
const FOOD_ENERGY := 22.0
const MEALS_PER_SOL := 3
const CORE_PROMPT := {
	"hatch": "enter_base",
	"hatch_int": "exit_base",
	"rover": "drive",
	"board": "board",
	"power": "power",
	"bed": "bed",
	"galley": "galley",
	"comms_desk": "comms",
	"store": "store",
	"lab_bench": "lab",
	"crew_water": "water",
}


const BATTERY_MAX := 120.0
const ARRAY_KW := 30.0
const LOAD_KW := 9.6
const LOAD_SHED_KW := 4.2

var world
var interior
var player
var hud
var voice

var lang := "en"
var sol := 1
var minutes := START_MINUTES
var stamina := 100.0
var data_points := 0
var skills := {}
var meals := MEALS_PER_SOL
var offered: Array = []
var accepted: Array = []
var done: Array = []
var energy_spent := 0.0
var lifetime_data := 0

var battery := BATTERY_MAX
var solar_kw := 0.0
var load_kw := LOAD_KW
var shed := false

var spot: Node3D = null
var near_npc = null
var spot_id := ""
var ui_open := false
var transitioning := false
var last_safe := Vector3.ZERO
var talked := 0

var _ui_timer := 0.0
var _night_warned := false
var _talk_keys := {}


func _ready() -> void:
	offered = Tasks.offer(sol)
	_build_world()
	_build_player()
	_place_crew()
	_build_hud()
	voice = load("res://src/voice.gd").new()
	voice.name = "Voice"
	add_child(voice)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_refresh_markers()
	_update_board()
	_build_speech_keys()
	toast("Sol 1 · the board in HAB-1 lists today's work")


func _build_world() -> void:
	world = load("res://src/world.gd").new()
	world.name = "World"
	world.build(self)
	add_child(world)
	interior = load("res://src/interior.gd").new()
	interior.build(self)
	add_child(interior)


func _build_player() -> void:
	player = load("res://src/player.gd").new()
	player.setup(self)
	add_child(player)
	player.place(Vector3(0, 0.4, 22.0), 0.0, false)
	last_safe = player.global_position


func _place_crew() -> void:
	var npc_script = load("res://src/npc.gd")
	# inside HAB-1
	_interior_npc(npc_script, "Sofia", "medic", Vector3(-4.6, 0, 0.9), 1.57,
		Color(0.92, 0.90, 0.86), Color(0.25, 0.85, 0.8))
	_interior_npc(npc_script, "Omar", "engineer", Vector3(3.9, 0, 1.4), -1.4,
		Color(0.86, 0.84, 0.80), Color(0.95, 0.55, 0.2))
	# out on the surface
	_world_npc(npc_script, "Maya", "commander", Vector3(-7.5, 0, 10.5), 1.9,
		Color(0.85, 0.87, 0.92), Color(0.35, 0.6, 1.0))
	_world_npc(npc_script, "Amina", "biologist", Vector3(14.2, 0, -10.2), -0.8,
		Color(0.88, 0.90, 0.86), Color(0.35, 0.9, 0.45))
	_world_npc(npc_script, "Leo", "driver", Vector3(16.2, 0, 13.6), 3.4,
		Color(0.86, 0.86, 0.88), Color(0.95, 0.3, 0.3))


func _interior_npc(s, who: String, job: String, pos: Vector3, face: float, suit: Color, trim: Color) -> void:
	var n = s.new()
	n.name = who
	interior.add_child(n)
	n.build(self, who, job, pos, face, suit, trim)


func _world_npc(s, who: String, job: String, pos: Vector3, face: float, suit: Color, trim: Color) -> void:
	var n = s.new()
	n.name = who
	world.add_child(n)
	n.build(self, who, job, pos, face, suit, trim)


func _build_hud() -> void:
	hud = load("res://src/hud.gd").new()
	hud.name = "HUD"
	add_child(hud)
	hud.setup(self)
	push_state()


# ---------------------------------------------------------------------------------------------
# Player energy (the whole point)
# ---------------------------------------------------------------------------------------------
func drain(amount: float, _reason := "") -> void:
	if amount <= 0.0:
		return
	stamina = maxf(0.0, stamina - amount)
	energy_spent += amount
	if stamina <= 0.5 and not _night_warned:
		_night_warned = true
		hud.toast(I18n.t("out_of_energy", lang), 6.0)
		speak("inc.fatigue.npc", "Sofia", 6.0)
	elif stamina > 5.0:
		_night_warned = false


func speak(key: String, speaker := "", seconds := 7.0) -> void:
	if voice == null:
		return
	var line: String = voice.say(key)
	if line != "" and hud != null:
		hud.set_caption(speaker, line, seconds)


func recover_player() -> void:
	player.global_position = last_safe + Vector3(0, 0.6, 0)
	player.velocity = Vector3.ZERO


func get_stamina() -> float:
	return stamina


# ---------------------------------------------------------------------------------------------
# Time and base power
# ---------------------------------------------------------------------------------------------
func _process(delta: float) -> void:
	if player == null:
		return
	minutes += delta * MINUTES_PER_SEC
	if minutes >= DAY:
		minutes -= DAY
		toast("Past midnight. Sleep in the habitat to start a clean sol.")
	_update_power(delta)
	if not player.interior and player.is_on_floor() and player.current_spot == null:
		last_safe = player.global_position
	ui_open = hud.board_open() or hud.report_open()
	_ui_timer += delta
	if _ui_timer > 0.1:
		_ui_timer = 0.0
		push_state()


func _update_power(delta: float) -> void:
	var elev := 52.0 * sin(TAU * (minutes - 360.0) / DAY)
	world.set_sun_elevation(elev)
	var sun_frac := clampf(sin(deg_to_rad(elev)), 0.0, 1.0)
	solar_kw = ARRAY_KW * sun_frac
	load_kw = LOAD_SHED_KW if shed else LOAD_KW
	var hours := delta * MINUTES_PER_SEC / 60.0
	battery = clampf(battery + (solar_kw - load_kw) * hours, 0.0, BATTERY_MAX)
	if not shed and battery <= 5.0:
		shed = true
		toast("Battery low: lab and greenhouse loads shed. The habitat keeps the air going.")
	elif shed and battery >= 14.0:
		shed = false
		toast("Battery recovered: lab and greenhouse back on.")


func clock() -> String:
	return hud.clock_text(minutes) if hud != null else "08:00"


# ---------------------------------------------------------------------------------------------
# State for the HUD
# ---------------------------------------------------------------------------------------------
func push_state() -> void:
	if hud == null:
		return
	hud.update_state({
		"energy": stamina,
		"battery": battery / BATTERY_MAX * 100.0,
		"solar": solar_kw,
		"load": load_kw,
		"shed": shed,
		"sol": sol,
		"minutes": minutes,
		"data": data_points,
		"accepted": accepted,
		"energy_warning": I18n.t("out_of_energy", lang) if stamina <= 0.5 else "",
	})
	interior.set_power_text("%s\n%s" % [
		I18n.t("battery", lang) % int(round(battery / BATTERY_MAX * 100.0)),
		I18n.t("solar", lang) % [snappedf(solar_kw, 0.1), snappedf(load_kw, 0.1)]])
	_update_board()


func _update_board() -> void:
	if interior == null:
		return
	var lines := []
	for t in offered:
		var mark := "[x]" if _has(done, t["id"]) else ("[>]" if _has(accepted, t["id"]) else "[ ]")
		lines.append("%s  %s   -%d" % [mark, Tasks.title(t, lang), int(t["stamina"])])
	interior.set_board(I18n.t("board_title", lang) % str(sol), lines)


func _has(list: Array, id: String) -> bool:
	for t in list:
		if t.get("id", "") == id:
			return true
	return false


func toast(text: String, seconds := 4.0) -> void:
	if hud != null:
		hud.toast(text, seconds)


# ---------------------------------------------------------------------------------------------
# Spots and interaction
# ---------------------------------------------------------------------------------------------
func set_spot(node: Node3D, _dist: float) -> void:
	spot = node
	if node != null:
		near_npc = null
	spot_id = "" if node == null else str(node.get_meta("spot_id", ""))
	var text := _prompt_for(spot_id)
	if hud != null:
		hud.set_prompt(text, text != "")


func set_npc(n) -> void:
	near_npc = n
	if hud == null:
		return
	if n == null:
		hud.set_prompt("", false)
	else:
		hud.set_prompt(I18n.t("talk", lang) % n.crew_name, true)


func _task_at(id: String) -> Dictionary:
	for t in accepted:
		if Tasks.spot_of(t) == id:
			return t
	return {}


func _prompt_for(id: String) -> String:
	if id == "":
		return ""
	var t := _task_at(id)
	if not t.is_empty():
		if t["group"] == "lab" and shed:
			return Tasks.title(t, lang) + "  (lab needs power)"
		return Tasks.title(t, lang)
	if CORE_PROMPT.has(id):
		return I18n.t(CORE_PROMPT[id], lang)
	return ""


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var k: int = event.keycode
		if k == KEY_ESCAPE:
			if hud.board_open():
				close_board()
			else:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			return
		if k == KEY_L:
			toggle_language()
			return
		if k >= KEY_1 and k <= KEY_4 and hud.board_open():
			board_pick(k - KEY_1)
			return
		if event.is_action_pressed("interact"):
			try_interact()


func try_interact() -> void:
	if transitioning or hud.board_open() or hud.report_open():
		return
	if player.frozen:
		return  # the rover handles its own exit key
	if near_npc != null and spot_id == "":
		npc_talk(near_npc)
		return
	if spot_id == "":
		return
	use_spot(spot_id)


func use_spot(id: String) -> void:
	var t := _task_at(id)
	if not t.is_empty():
		_complete(t)
		return
	match id:
		"hatch":
			enter_base()
		"hatch_int":
			exit_base()
		"rover":
			if not player.interior:
				world.rover.enter(player)
		"board":
			open_board()
		"power":
			toast("%s  ·  %s" % [I18n.t("basepower", lang), I18n.t("closed", lang)], 6.0)
			speak("talk.leo.power", "Leo (radio)", 7.0)
		"bed":
			sleep_sol()
		"galley":
			eat()
		"comms_desk":
			if player.interior:
				speak("inc.comms.npc", "Maya", 7.0)
				toast("Earth window: one-way light time 1.3 s", 4.0)
		"store":
			toast("Seals, bolts, filters — enough for two more sols of repairs.", 4.0)
		"lab_bench":
			toast("Nothing on the bench for you today. Check the board.", 4.0)
		"crew_water":
			toast("Six litres of recycled water on the trays. Amina is watching the leaves.", 4.0)
		_:
			pass


# ---------------------------------------------------------------------------------------------
# Task board
# ---------------------------------------------------------------------------------------------
func open_board() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	hud.open_board(offered, accepted, done, sol)


func close_board() -> void:
	hud.close_board()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func board_pick(index: int) -> void:
	if index < 0 or index >= offered.size():
		return
	var t: Dictionary = offered[index]
	if _has(done, t["id"]) or _has(accepted, t["id"]):
		return
	if t["group"] == "lab" and shed:
		toast("The lab is on shed load. Wait for the sun, or free up power.", 5.0)
		return
	accepted.append(t)
	_refresh_markers()
	_update_board()
	push_state()
	hud.open_board(offered, accepted, done, sol)
	toast("Accepted: %s — costs %d of your energy" % [Tasks.title(t, lang), int(t["stamina"])], 4.0)
	if voice != null:
		voice.say("player.omw")


func _complete(t: Dictionary) -> void:
	var cost: int = int(t["stamina"])
	if stamina < cost:
		toast(I18n.t("not_enough", lang) % [str(cost), str(int(stamina))], 6.0)
		return
	if t["group"] == "lab" and shed:
		toast("The lab has no power right now. Base battery is the limit, not your energy.", 5.0)
		return
	drain(float(cost))
	minutes += float(t["minutes"])
	data_points += int(t["data"])
	lifetime_data += int(t["data"])
	skills[t["skill"]] = int(skills.get(t["skill"], 0)) + 1
	if t.has("restore"):
		stamina = minf(100.0, stamina + float(t["restore"]))
		meals = maxi(0, meals - 1)
	accepted.erase(t)
	done.append(t)
	_refresh_markers()
	_update_board()
	push_state()
	toast(I18n.t("done_task", lang) % [Tasks.title(t, lang), str(cost), str(int(t["data"]))], 5.0)
	if voice != null:
		voice.say("player.copy")
	if done.size() >= offered.size():
		toast("Board clear. Sleep to start the next sol.", 5.0)


func _refresh_markers() -> void:
	if world == null:
		return
	var on := {}
	for t in accepted:
		on[Tasks.spot_of(t)] = true
	for id in ["hatch", "rover"]:
		world.show_spot(id, true)
	for id in ["eva_antenna", "eva_sample", "eva_transect", "eva_dust", "eva_stakes", "crew_water"]:
		world.show_spot(id, on.has(id))


# ---------------------------------------------------------------------------------------------
# Inside / outside
# ---------------------------------------------------------------------------------------------
func enter_base() -> void:
	if transitioning:
		return
	transitioning = true
	hud.flash()
	await get_tree().create_timer(0.2).timeout
	player.interior = true
	player.third_person = false
	player.cam_distance = 2.2
	player.place(interior.global_position + Vector3(0, 0.3, 3.2), 0.0, true)
	last_safe = player.global_position
	await get_tree().create_timer(0.25).timeout
	transitioning = false
	toast("Inside HAB-1. Pressure 101.3 kPa. Your suit is off, so walking is free.", 5.0)
	speak("crew.sofia.greet", "Sofia", 8.0)


func exit_base() -> void:
	if transitioning:
		return
	transitioning = true
	hud.flash()
	await get_tree().create_timer(0.2).timeout
	player.interior = false
	player.third_person = true
	player.cam_distance = 4.4
	player.place(Vector3(2.2, 0.3, 15.0), PI, false)
	last_safe = player.global_position
	await get_tree().create_timer(0.25).timeout
	transitioning = false
	toast("On the surface. 1.62 m/s². Every step spends suit energy.", 4.0)
	speak("crew.omar.greet", "Omar", 7.0)


func recover_outside() -> void:
	player.place(Vector3(0, 0.4, 22.0), 0.0, false)


func eat() -> void:
	if meals <= 0:
		toast(I18n.t("no_meals", lang), 5.0)
		return
	meals -= 1
	var before := stamina
	stamina = minf(100.0, stamina + FOOD_ENERGY)
	minutes += 15.0
	push_state()
	toast(I18n.t("ate", lang) % str(int(stamina - before)), 4.0)
	speak("crew.sofia.greet", "Sofia", 6.0)


func sleep_sol() -> void:
	if transitioning:
		return
	transitioning = true
	hud.flash(0.35)
	var finished := done.size()
	var earned := data_points
	var spent := int(round(energy_spent))
	await get_tree().create_timer(0.45).timeout
	sol += 1
	minutes = 6.0 * 60.0
	stamina = 100.0
	meals = MEALS_PER_SOL
	energy_spent = 0.0
	data_points = 0
	accepted.clear()
	done.clear()
	offered = Tasks.offer(sol)
	_refresh_markers()
	_update_board()
	push_state()
	transitioning = false
	hud.show_report(sol - 1, finished, earned, spent)
	toast(I18n.t("sleeping", lang) % str(sol), 5.0)


# ---------------------------------------------------------------------------------------------
# Crew speech
# ---------------------------------------------------------------------------------------------
func _build_speech_keys() -> void:
	if voice == null:
		return
	for who in ["sofia", "omar", "maya", "amina", "leo"]:
		var keys := []
		for k in voice.pack.keys():
			if str(k).begins_with("talk.%s." % who):
				keys.append(k)
		keys.sort()
		_talk_keys[who] = keys


func npc_talk(npc) -> void:
	var who: String = npc.crew_name.to_lower()
	var keys: Array = _talk_keys.get(who, [])
	var key := "crew.%s.greet" % who
	if talked % 3 != 0 and not keys.is_empty():
		key = keys[(talked / 3) % keys.size()]
	talked += 1
	var line: String = voice.say(key)
	if line == "":
		line = "Pressure is good, water is good. Ask me again after the next check."
	hud.set_caption(npc.crew_name, line, 8.0)


# ---------------------------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------------------------
func toggle_language() -> void:
	set_language("ar" if lang == "en" else "en")


func set_language(new_lang: String) -> void:
	lang = new_lang
	hud.apply_language(lang)
	_update_board()
	if hud.board_open():
		hud.open_board(offered, accepted, done, sol)
	push_state()
	toast("العربية" if lang == "ar" else "English", 2.5)


func can_capture_mouse() -> bool:
	return not ui_open and not hud.board_open()
