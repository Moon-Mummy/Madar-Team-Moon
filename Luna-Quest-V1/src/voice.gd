extends Node
## Recorded voice lines, reused from the earlier build. The pack is a plain JSON map of
## key -> { file, text }, so new lines can be dropped in without touching code. If a file is missing
## the line simply stays a subtitle; nothing breaks.

var pack := {}
var player: AudioStreamPlayer
var captions := {}
var muted := false
var last_key := ""
var _cache := {}


func _ready() -> void:
	player = AudioStreamPlayer.new()
	player.bus = "Master"
	player.volume_db = -2.0
	add_child(player)
	var txt := FileAccess.get_file_as_string("res://audio/voice/pack.json")
	if txt == "":
		push_warning("Voice pack not found: res://audio/voice/pack.json")
		return
	var d = JSON.parse_string(txt)
	if typeof(d) == TYPE_DICTIONARY:
		pack = d
		for k in pack.keys():
			if pack[k] is Dictionary and pack[k].has("text"):
				captions[k] = pack[k]["text"]


func has(key: String) -> bool:
	return pack.has(key)


func say(key: String) -> String:
	last_key = key
	var line: String = captions.get(key, "")
	if muted or not pack.has(key):
		return line
	var entry = pack[key]
	if not (entry is Dictionary) or not entry.has("file"):
		return line
	var path := "res://audio/voice/" + str(entry["file"])
	var stream: AudioStream = null
	if _cache.has(path):
		stream = _cache[path]
	else:
		if ResourceLoader.exists(path):
			stream = load(path) as AudioStream
		_cache[path] = stream
	if stream == null:
		return line
	player.stream = stream
	player.play()
	return line


func stop() -> void:
	player.stop()
