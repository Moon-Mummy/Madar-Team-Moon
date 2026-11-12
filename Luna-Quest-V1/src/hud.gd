extends CanvasLayer
## All the interface, built in code. Two energy readouts sit next to each other on purpose:
## YOUR ENERGY (the player's stamina) on the left, BASE POWER (the habitat's electricity) under it.
## The rest is a prompt line, subtitles for the recorded crew voices, the task board and a day report.

const CARD := Color(0.05, 0.07, 0.10, 0.82)
const LINE := Color(0.32, 0.55, 0.62, 0.55)
const TEXT := Color(0.90, 0.95, 1.0)
const DIM := Color(0.62, 0.72, 0.80)
const GOOD := Color(0.35, 0.85, 0.55)
const WARN := Color(0.95, 0.75, 0.25)
const BAD := Color(0.92, 0.35, 0.32)
const POWER := Color(0.35, 0.7, 1.0)

var game = null
var lang := "en"
var theme: Theme

var root: Control
var lbl_title: Label
var lbl_sub: Label
var lbl_energy_cap: Label
var lbl_energy_val: Label
var bar_energy: ProgressBar
var lbl_energy_note: Label
var lbl_power_cap: Label
var lbl_power_val: Label
var bar_power: ProgressBar
var lbl_power_det: Label
var lbl_tasks_cap: Label
var task_list: VBoxContainer
var lbl_status: Label

var prompt_center: CenterContainer
var prompt_panel: PanelContainer
var lbl_prompt: Label
var caption_center: CenterContainer
var caption_panel: PanelContainer
var lbl_caption: Label
var toast_center: CenterContainer
var lbl_toast: Label
var lbl_hint: Label

var board_wrap: Control
var board_panel: PanelContainer
var lbl_board_title: Label
var lbl_board_intro: Label
var board_rows: VBoxContainer
var lbl_board_footer: Label

var report_wrap: Control
var lbl_report_title: Label
var lbl_report_body: Label
var fade_rect: ColorRect

var _toast_tween: Tween
var _caption_tween: Tween
var _state := {}


func setup(g) -> void:
	game = g
	lang = game.lang
	layer = 2
	theme = _make_theme()
	_build()
	apply_language(lang)


# ---------------------------------------------------------------------------------------------
# Theme / fonts. The Arabic face is bundled so the RTL text is real shaping, not tofu boxes.
# ---------------------------------------------------------------------------------------------
func _make_theme() -> Theme:
	var t := Theme.new()
	var f: Font = null
	if ResourceLoader.exists("res://fonts/noto-sans-arabic.woff"):
		f = load("res://fonts/noto-sans-arabic.woff") as Font
		var latin: Font = null
		if ResourceLoader.exists("res://fonts/noto-sans-latin.woff"):
			latin = load("res://fonts/noto-sans-latin.woff") as Font
		if f is FontFile:
			# the Arabic face covers Arabic, the latin subset covers ASCII; the engine fallback
			# catches stray punctuation in either language
			var fallbacks: Array[Font] = []
			if latin != null:
				fallbacks.append(latin)
			if ThemeDB.fallback_font != null:
				fallbacks.append(ThemeDB.fallback_font)
			(f as FontFile).fallbacks = fallbacks
	if f != null:
		t.default_font = f
	t.default_font_size = 18
	var panel := StyleBoxFlat.new()
	panel.bg_color = CARD
	panel.border_color = LINE
	panel.set_border_width_all(1)
	panel.set_corner_radius_all(6)
	panel.set_content_margin_all(12)
	t.set_stylebox("panel", "PanelContainer", panel)
	var btn := StyleBoxFlat.new()
	btn.bg_color = Color(0.10, 0.14, 0.19, 0.95)
	btn.set_corner_radius_all(4)
	btn.set_content_margin_all(10)
	btn.border_color = LINE
	btn.set_border_width_all(1)
	t.set_stylebox("normal", "Button", btn)
	var btn_hover := btn.duplicate() as StyleBoxFlat
	btn_hover.bg_color = Color(0.16, 0.23, 0.30, 0.98)
	t.set_stylebox("hover", "Button", btn_hover)
	var btn_down := btn.duplicate() as StyleBoxFlat
	btn_down.bg_color = Color(0.22, 0.32, 0.40, 1.0)
	t.set_stylebox("pressed", "Button", btn_down)
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_color("font_color", "Label", TEXT)
	return t


func _panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.theme = theme
	return p


func _label(text: String, size := 18, color := TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.theme = theme
	return l


func _bar(color: Color, width := 300.0, height := 14.0) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(width, height)
	b.show_percentage = false
	b.max_value = 100.0
	b.value = 100.0
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.12, 0.15, 0.19, 0.95)
	bg.set_corner_radius_all(4)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(4)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fill)
	return b


# ---------------------------------------------------------------------------------------------
func _build() -> void:
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = theme
	add_child(root)

	# ---- top row: left column (title, your energy, base power) and right column (today's work) ----
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_bottom", 18)
	root.add_child(margin)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(top)
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(340, 0)
	left.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	left.add_theme_constant_override("separation", 8)
	top.add_child(left)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(spacer)
	var right := VBoxContainer.new()
	right.custom_minimum_size = Vector2(300, 0)
	right.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	right.add_theme_constant_override("separation", 8)
	top.add_child(right)

	var head := _panel()
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 2)
	lbl_title = _label("LUNA QUEST", 26, Color(0.75, 0.95, 1.0))
	lbl_sub = _label("", 14, DIM)
	hv.add_child(lbl_title)
	hv.add_child(lbl_sub)
	head.add_child(hv)
	left.add_child(head)

	var energy_card := _panel()
	var ev := VBoxContainer.new()
	ev.add_theme_constant_override("separation", 4)
	var eh := HBoxContainer.new()
	lbl_energy_cap = _label("YOUR ENERGY", 15, Color(0.75, 1.0, 0.85))
	lbl_energy_val = _label("100", 15, TEXT)
	lbl_energy_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	lbl_energy_val.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	eh.add_child(lbl_energy_cap)
	eh.add_child(lbl_energy_val)
	bar_energy = _bar(GOOD, 300, 16)
	lbl_energy_note = _label("", 12, DIM)
	lbl_energy_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ev.add_child(eh)
	ev.add_child(bar_energy)
	ev.add_child(lbl_energy_note)
	energy_card.add_child(ev)
	left.add_child(energy_card)

	var power_card := _panel()
	var pv := VBoxContainer.new()
	pv.add_theme_constant_override("separation", 4)
	var ph := HBoxContainer.new()
	lbl_power_cap = _label("BASE POWER", 15, Color(0.7, 0.85, 1.0))
	lbl_power_val = _label("100%", 15, TEXT)
	lbl_power_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	lbl_power_val.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ph.add_child(lbl_power_cap)
	ph.add_child(lbl_power_val)
	bar_power = _bar(POWER, 300, 10)
	lbl_power_det = _label("", 12, DIM)
	lbl_power_det.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pv.add_child(ph)
	pv.add_child(bar_power)
	pv.add_child(lbl_power_det)
	power_card.add_child(pv)
	left.add_child(power_card)

	lbl_status = _label("", 13, DIM)
	left.add_child(lbl_status)

	var tcard := _panel()
	var tv := VBoxContainer.new()
	tv.add_theme_constant_override("separation", 6)
	lbl_tasks_cap = _label("TODAY", 15, Color(1.0, 0.9, 0.65))
	task_list = VBoxContainer.new()
	task_list.add_theme_constant_override("separation", 6)
	tv.add_child(lbl_tasks_cap)
	tv.add_child(task_list)
	tcard.add_child(tv)
	right.add_child(tcard)

	# ---- prompt + subtitles ----
	prompt_center = CenterContainer.new()
	prompt_center.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	prompt_center.offset_top = -120
	prompt_center.offset_bottom = -74
	prompt_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(prompt_center)
	prompt_panel = _panel()
	var pp := StyleBoxFlat.new()
	pp.bg_color = Color(0.05, 0.09, 0.12, 0.9)
	pp.set_corner_radius_all(18)
	pp.set_content_margin_all(10)
	pp.border_color = Color(0.45, 0.95, 0.9, 0.6)
	pp.set_border_width_all(1)
	prompt_panel.add_theme_stylebox_override("panel", pp)
	lbl_prompt = _label("", 18, Color(0.8, 1.0, 1.0))
	prompt_panel.add_child(lbl_prompt)
	prompt_center.add_child(prompt_panel)

	caption_center = CenterContainer.new()
	caption_center.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	caption_center.offset_top = -206
	caption_center.offset_bottom = -130
	caption_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(caption_center)
	caption_panel = _panel()
	lbl_caption = _label("", 17, Color(1.0, 0.96, 0.86))
	lbl_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_caption.custom_minimum_size = Vector2(620, 0)
	lbl_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption_panel.add_child(lbl_caption)
	caption_center.add_child(caption_panel)
	caption_center.visible = false

	# ---- toast ----
	toast_center = CenterContainer.new()
	toast_center.set_anchors_preset(Control.PRESET_TOP_WIDE)
	toast_center.offset_top = 22
	toast_center.offset_bottom = 80
	toast_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(toast_center)
	lbl_toast = _label("", 18, Color(1.0, 0.94, 0.75))
	lbl_toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_toast.custom_minimum_size = Vector2(700, 0)
	lbl_toast.modulate = Color(1, 1, 1, 0)
	toast_center.add_child(lbl_toast)

	lbl_hint = _label("", 12, Color(0.6, 0.7, 0.78, 0.85))
	var hint_wrap := MarginContainer.new()
	hint_wrap.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	hint_wrap.offset_top = -46
	hint_wrap.offset_bottom = -14
	hint_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_wrap.add_theme_constant_override("margin_left", 22)
	hint_wrap.add_child(lbl_hint)
	root.add_child(hint_wrap)

	# ---- board overlay ----
	board_wrap = Control.new()
	board_wrap.set_anchors_preset(Control.PRESET_FULL_RECT)
	board_wrap.visible = false
	root.add_child(board_wrap)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	board_wrap.add_child(dim)
	var bc := CenterContainer.new()
	bc.set_anchors_preset(Control.PRESET_FULL_RECT)
	board_wrap.add_child(bc)
	board_panel = _panel()
	board_panel.custom_minimum_size = Vector2(760, 0)
	var bv := VBoxContainer.new()
	bv.add_theme_constant_override("separation", 10)
	lbl_board_title = _label("DAILY TASK BOARD", 24, Color(0.8, 1.0, 1.0))
	lbl_board_intro = _label("", 14, DIM)
	lbl_board_intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_board_intro.custom_minimum_size = Vector2(720, 0)
	board_rows = VBoxContainer.new()
	board_rows.add_theme_constant_override("separation", 8)
	lbl_board_footer = _label("", 13, Color(1.0, 0.9, 0.7))
	bv.add_child(lbl_board_title)
	bv.add_child(lbl_board_intro)
	bv.add_child(board_rows)
	bv.add_child(lbl_board_footer)
	board_panel.add_child(bv)
	bc.add_child(board_panel)

	# ---- day report ----
	report_wrap = Control.new()
	report_wrap.set_anchors_preset(Control.PRESET_FULL_RECT)
	report_wrap.visible = false
	root.add_child(report_wrap)
	var rdim := ColorRect.new()
	rdim.color = Color(0.01, 0.02, 0.03, 0.75)
	rdim.set_anchors_preset(Control.PRESET_FULL_RECT)
	report_wrap.add_child(rdim)
	var rc := CenterContainer.new()
	rc.set_anchors_preset(Control.PRESET_FULL_RECT)
	report_wrap.add_child(rc)
	var rpanel := _panel()
	rpanel.custom_minimum_size = Vector2(560, 0)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 10)
	lbl_report_title = _label("", 26, Color(0.8, 1.0, 1.0))
	lbl_report_body = _label("", 17, TEXT)
	lbl_report_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_report_body.custom_minimum_size = Vector2(520, 0)
	rv.add_child(lbl_report_title)
	rv.add_child(lbl_report_body)
	rpanel.add_child(rv)
	rc.add_child(rpanel)

	# ---- transition fade ----
	fade_rect = ColorRect.new()
	fade_rect.color = Color(0, 0, 0, 0)
	fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade_rect)


# ---------------------------------------------------------------------------------------------
func apply_language(new_lang: String) -> void:
	lang = new_lang
	var rtl := lang == "ar"
	lbl_title.text = I18n.t("title", lang)
	lbl_energy_cap.text = I18n.t("yourenergy", lang)
	lbl_energy_note.text = I18n.t("yourenergy_note", lang)
	lbl_power_cap.text = I18n.t("basepower", lang)
	lbl_power_det.text = I18n.t("basepower_note", lang)
	lbl_tasks_cap.text = I18n.t("tasks", lang)
	lbl_hint.text = I18n.t("controls", lang)
	lbl_board_intro.text = I18n.t("board_intro", lang)
	lbl_board_footer.text = I18n.t("board_footer", lang)
	for n in [lbl_title, lbl_sub, lbl_energy_cap, lbl_energy_val, lbl_energy_note, lbl_power_cap, lbl_power_val,
			lbl_power_det, lbl_tasks_cap, lbl_status, lbl_prompt, lbl_caption, lbl_toast, lbl_hint,
			lbl_board_title, lbl_board_intro, lbl_board_footer, lbl_report_title, lbl_report_body]:
		(n as Label).horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if rtl else HORIZONTAL_ALIGNMENT_LEFT
	lbl_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_energy_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if rtl else HORIZONTAL_ALIGNMENT_RIGHT
	lbl_power_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if rtl else HORIZONTAL_ALIGNMENT_RIGHT
	lbl_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if rtl else HORIZONTAL_ALIGNMENT_LEFT
	if _state.size() > 0:
		update_state(_state)


func update_state(s: Dictionary) -> void:
	_state = s
	var e: float = s.get("energy", 100.0)
	bar_energy.value = e
	var key := "good"
	if e < 15.0:
		key = "bad"
	elif e < 40.0:
		key = "warn"
	if bar_energy.get_meta("fill", "") != key:
		bar_energy.set_meta("fill", key)
		bar_energy.add_theme_stylebox_override("fill", _fill_style(key))
	lbl_energy_val.text = "%d / 100" % int(round(e))
	var warning: String = s.get("energy_warning", "")
	lbl_energy_note.text = warning if warning != "" else I18n.t("yourenergy_note", lang)
	lbl_energy_note.add_theme_color_override("font_color", BAD if warning != "" else DIM)

	bar_power.value = s.get("battery", 100.0)
	lbl_power_val.text = I18n.t("battery", lang) % int(round(s.get("battery", 100.0)))
	lbl_power_det.text = I18n.t("solar", lang) % [snappedf(s.get("solar", 0.0), 0.1), snappedf(s.get("load", 0.0), 0.1)]
	if s.get("shed", false):
		lbl_power_det.text += "\n" + I18n.t("shed", lang)

	lbl_sub.text = I18n.t("subtitle", lang) % str(s.get("sol", 1))
	lbl_status.text = I18n.t("status", lang) % [clock_text(s.get("minutes", 480.0)), str(s.get("sol", 1)), str(s.get("data", 0))]
	_rebuild_task_list(s)


func _fill_style(key: String) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = BAD if key == "bad" else (WARN if key == "warn" else GOOD)
	sb.set_corner_radius_all(4)
	return sb


func clock_text(minutes: float) -> String:
	var m := int(minutes) % 1440
	return "%02d:%02d" % [int(m / 60.0), m % 60]


func _rebuild_task_list(s: Dictionary) -> void:
	var accepted: Array = s.get("accepted", [])
	var current := "\n".join(_accepted_lines(accepted))
	if task_list.get_meta("sig", "") == current:
		return
	task_list.set_meta("sig", current)
	clear_children(task_list)
	if accepted.is_empty():
		task_list.add_child(_label(I18n.t("task_none", lang), 13, DIM))
		return
	for t in accepted:
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 0)
		row.add_child(_label("• " + Tasks.title(t, lang), 14, Color(0.9, 1.0, 0.95)))
		var meta := "-%d %s  ·  %d %s  ·  %s" % [int(t.get("stamina", 0)), I18n.t("energy", lang),
			int(t.get("minutes", 0)), I18n.t("min", lang), Tasks.spot_name(t, lang)]
		row.add_child(_label("   " + meta, 12, DIM))
		task_list.add_child(row)


func _accepted_lines(accepted: Array) -> Array:
	var out := [lang]
	for t in accepted:
		out.append("%s:%s:%s" % [t.get("id", ""), int(t.get("stamina", 0)), Tasks.title(t, lang)])
	return out


func set_prompt(text: String, show_it := true) -> void:
	lbl_prompt.text = ("[E]  " + text) if show_it and text != "" else text
	prompt_center.visible = show_it and text != ""


func set_caption(speaker: String, text: String, seconds := 7.0) -> void:
	if text == "":
		caption_center.visible = false
		return
	lbl_caption.text = text if speaker == "" else "%s: %s" % [speaker, text]
	caption_center.visible = true
	if _caption_tween != null and _caption_tween.is_valid():
		_caption_tween.kill()
	_caption_tween = create_tween()
	_caption_tween.tween_interval(seconds)
	_caption_tween.tween_callback(func(): caption_center.visible = false)


func toast(text: String, seconds := 4.0) -> void:
	lbl_toast.text = text
	lbl_toast.modulate = Color(1, 1, 1, 1)
	if _toast_tween != null and _toast_tween.is_valid():
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_interval(seconds)
	_toast_tween.tween_property(lbl_toast, "modulate:a", 0.0, 0.6)


func flash(hold := 0.12) -> void:
	var t := create_tween()
	t.tween_property(fade_rect, "color:a", 1.0, 0.12)
	t.tween_interval(hold)
	t.tween_property(fade_rect, "color:a", 0.0, 0.35)


# ---------------------------------------------------------------------------------------------
func open_board(offered: Array, accepted: Array, done: Array, sol: int) -> void:
	lbl_board_title.text = I18n.t("board_title", lang) % str(sol)
	clear_children(board_rows)
	var i := 0
	for t in offered:
		i += 1
		var state := ""
		if _has_id(done, t["id"]):
			state = I18n.t("done", lang)
		elif _has_id(accepted, t["id"]):
			state = I18n.t("accepted", lang)
		var head := "%d.  %s" % [i, Tasks.title(t, lang)]
		var meta := "%s: -%d %s  ·  %d %s  ·  +%d %s  ·  %s\n%s %s" % [
			Tasks.group_name(t["group"], lang), int(t["stamina"]), I18n.t("energy", lang),
			int(t["minutes"]), I18n.t("min", lang), int(t["data"]), I18n.t("data", lang),
			Tasks.risk_text(int(t["risk"]), lang), I18n.t("where", lang), Tasks.spot_name(t, lang)]
		var btn := Button.new()
		btn.text = head + "\n" + meta
		btn.alignment = HORIZONTAL_ALIGNMENT_RIGHT if lang == "ar" else HORIZONTAL_ALIGNMENT_LEFT
		btn.add_theme_font_size_override("font_size", 15)
		btn.custom_minimum_size = Vector2(700, 0)
		btn.tooltip_text = ""
		if state != "":
			btn.text = head + "   —   " + state + "\n" + meta
			btn.disabled = true
		var idx := i - 1
		btn.pressed.connect(func(): game.board_pick(idx))
		board_rows.add_child(btn)
	board_wrap.visible = true


func close_board() -> void:
	board_wrap.visible = false


func clear_children(node: Node) -> void:
	for c in node.get_children():
		node.remove_child(c)
		c.queue_free()


func board_open() -> bool:
	return board_wrap.visible


func _has_id(list: Array, id: String) -> bool:
	for t in list:
		if t.get("id", "") == id:
			return true
	return false


func show_report(sol: int, tasks_done: int, data: int, energy_spent: int) -> void:
	lbl_report_title.text = I18n.t("report_title", lang) % str(sol)
	lbl_report_body.text = I18n.t("report_body", lang) % [str(tasks_done), str(data), str(energy_spent)] + "\n\n" + I18n.t("closed", lang)
	report_wrap.visible = true
	var t := create_tween()
	t.tween_interval(6.0)
	t.tween_callback(func(): report_wrap.visible = false)


func report_open() -> bool:
	return report_wrap.visible
