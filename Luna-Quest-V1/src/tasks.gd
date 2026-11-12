class_name Tasks
extends RefCounted
## The daily task board.
##
## Energy model, and this is the point of the whole game:
##   * The PLAYER has his own stamina pool (0-100). Every task on this board spends it, and so does
##     walking across the regolith. It only comes back from eating in the galley and sleeping.
##   * The BASE has a completely separate electrical budget (solar generation in kW against habitat,
##     ECLSS, lab and comms loads). Nothing here is paid for with base power; a task that needs a
##     socket says so as an operational limit, never as a currency.
## The two numbers are shown side by side in the HUD so the difference is visible while playing.

const TOTAL_STAMINA := 100

# stamina  : points of the player's own energy the task costs
# minutes  : clock time
# skill    : which skill earns progress
# data     : science data points banked
# risk     : 0..3, chance of a setback that costs a little extra energy
const TASKS := [
	{
		"id": "eva_antenna",
		"spot": "eva_antenna",
		"en": "Torque the antenna mast",
		"ar": "إحكام صواميل سارية الهوائي",
		"den": "Suit up, take the wrench out, and check every bolt on the comms mast. Get the suit dust off before you come back in.",
		"dar": "ارتدِ البدلة وخذ المفتاح وتفقّد كل مسمار في سارية الاتصالات. نظّف البدلة من الغبار قبل الدخول.",
		"group": "eva", "stamina": 14, "minutes": 25, "skill": "engineering", "data": 8, "risk": 1,
	},
	{
		"id": "eva_sample",
		"spot": "eva_sample",
		"en": "Bring in a soil sample",
		"ar": "إحضار عينة تربة",
		"den": "Walk to the scoop site, fill the sample bag, and log the coordinates on the way back. Every metre out is a metre back in a suit.",
		"dar": "امشِ إلى موقع الحفر واملأ كيس العينة وسجّل الإحداثيات في العودة. كل متر للخارج يعني مترًا للعودة داخل البدلة.",
		"group": "eva", "stamina": 18, "minutes": 30, "skill": "geology", "data": 12, "risk": 2,
	},
	{
		"id": "eva_transect",
		"spot": "eva_transect",
		"en": "Survey the crater transect",
		"ar": "مسح مقطع الفوهة",
		"den": "Six stakes, forty metres apart, down the crater wall. Long walk, long list, and the slope makes your legs pay for it.",
		"dar": "ستة أوتاد كل أربعين مترًا نزولًا في جدار الفوهة. مشي طويل وقائمة طويلة والمنحدر يأخذ من ساقيك.",
		"group": "eva", "stamina": 32, "minutes": 45, "skill": "geology", "data": 18, "risk": 3,
	},
	{
		"id": "eva_dust",
		"spot": "eva_dust",
		"en": "Brush the dust off the arrays",
		"ar": "إزالة الغبار عن الألواح",
		"den": "The solar field loses a little output every sol to dust. Ten minutes with the brush buys back the watts.",
		"dar": "حقل الطاقة الشمسية يفقد جزءًا من إنتاجه كل يوم بسبب الغبار. عشر دقائق بالفرشاة تستعيد الواط.",
		"group": "eva", "stamina": 12, "minutes": 20, "skill": "maintenance", "data": 4, "risk": 1,
	},
	{
		"id": "eva_stakes",
		"spot": "eva_stakes",
		"en": "Place the survey stakes",
		"ar": "تثبيت أوتاد المسح",
		"den": "Mark the safe walking lane to the airlock so nobody wanders into the rover ruts at night.",
		"dar": "علّم ممر المشي الآمن إلى غرفة الضغط حتى لا يدخل أحد في آثار العجلات ليلًا.",
		"group": "eva", "stamina": 22, "minutes": 35, "skill": "navigation", "data": 10, "risk": 2,
	},

	{
		"id": "lab_sieve",
		"spot": "lab_bench",
		"en": "Sieve and log the grains",
		"ar": "نخل الحبيبات وتسجيلها",
		"den": "Dry shake, three mesh sizes, and a photo of every fraction. Slow hands, clean data.",
		"dar": "نخل جاف، ثلاث مقاسات، وصورة لكل كسر. أيدٍ هادئة وبيانات نظيفة.",
		"group": "lab", "stamina": 9, "minutes": 35, "skill": "analysis", "data": 14, "risk": 0,
	},
	{
		"id": "lab_ice",
		"spot": "lab_bench",
		"en": "Bake the sample dry",
		"ar": "تسخين العينة حتى الجفاف",
		"den": "Oven up to 120 degrees, weigh every hour, and watch for the water line. This is the signal that matters.",
		"dar": "ارفع الفرن إلى 120 درجة، زِن كل ساعة، وراقب خط الماء. هذه هي الإشارة المهمة.",
		"group": "lab", "stamina": 8, "minutes": 40, "skill": "chemistry", "data": 22, "risk": 0,
	},
	{
		"id": "lab_spectra",
		"spot": "lab_bench",
		"en": "Run three spectra",
		"ar": "تشغيل ثلاثة أطياف",
		"den": "Three samples, one spectrometer, one dark frame each. Compare them and write down what does not match.",
		"dar": "ثلاث عينات، مطياف واحد، وصورة معتمة لكل عينة. قارن بينها واكتب ما لا يتطابق.",
		"group": "lab", "stamina": 10, "minutes": 30, "skill": "analysis", "data": 20, "risk": 0,
	},
	{
		"id": "lab_rover",
		"spot": "lab_bench",
		"en": "Download the rover log",
		"ar": "تنزيل سجل المركبة",
		"den": "Wheel torque, battery current, slope history. Data from a machine that already did the work for you.",
		"dar": "عزم العجلات وتيار البطارية وسجل المنحدرات. بيانات من آلة سبقتك بالعمل.",
		"group": "lab", "stamina": 7, "minutes": 25, "skill": "engineering", "data": 12, "risk": 0,
	},

	{
		"id": "crew_water",
		"spot": "crew_water",
		"en": "Water the greenhouse trays",
		"ar": "سقاية صواني الدفيئة",
		"den": "Six litres from the recycling loop, one tray at a time. Sofia will tell you if you are overwatering again.",
		"dar": "ستة لترات من دورة إعادة التدوير، صينية بعد صينية. ستخبرك صوفيا إذا أفرطت بالماء مرة أخرى.",
		"group": "crew", "stamina": 10, "minutes": 25, "skill": "botany", "data": 9, "risk": 0,
	},
	{
		"id": "crew_comms",
		"spot": "comms_desk",
		"en": "Radio check with Earth",
		"ar": "فحص الاتصال بالأرض",
		"den": "Catch the Earth window before the terminator rolls over the site. One-way delay is about 1.3 seconds.",
		"dar": "أدرك نافذة الاتصال قبل أن يدخل ظل الأرض على الموقع. تأخير الاتجاه الواحد نحو 1.3 ثانية.",
		"group": "crew", "stamina": 5, "minutes": 15, "skill": "comms", "data": 7, "trust": 1, "risk": 0,
	},
	{
		"id": "crew_inventory",
		"spot": "store",
		"en": "Count the spares bin",
		"ar": "جرد صندوق قطع الغيار",
		"den": "Bolts, seals, hose clamps, filters. Boring, and the sol you skip it is the sol you find nothing you need.",
		"dar": "مسامير وحلقات ومشابك ومرشحات. ممل، واليوم الذي تتغاضاه هو اليوم الذي لن تجد فيه ما تحتاجه.",
		"group": "crew", "stamina": 8, "minutes": 30, "skill": "logistics", "data": 11, "risk": 0,
	},
	{
		"id": "crew_lesson",
		"spot": "lab_bench",
		"en": "Teach the drill sequence",
		"ar": "تدريب الرحلة على تسلسل الحفر",
		"den": "Omar has the sequence wrong again. Sit with him at the mock-up until his hands know it.",
		"dar": "عمر يخطئ في التسلسل مرة أخرى. اجلس معه عند النموذج حتى تتقنه يداه.",
		"group": "crew", "stamina": 6, "minutes": 20, "skill": "crew", "data": 6, "trust": 2, "risk": 0,
	},
	{
		"id": "crew_meal",
		"spot": "galley",
		"en": "Cook and eat with the crew",
		"ar": "الطهي والأكل مع الطاقم",
		"den": "A real meal off the ration printer, at a real table. Costs a little energy now and gives back more later.",
		"dar": "وجبة حقيقية بدلًا من طابعة الحصص، على طاولة حقيقية. تكلّف طاقة قليلة الآن وتعيد أكثر لاحقًا.",
		"group": "crew", "stamina": 4, "minutes": 20, "skill": "crew", "data": 5, "trust": 2, "restore": 14, "risk": 0,
	},
]

const SPOT_NAMES := {
	"eva_antenna": {"en": "comms mast, north of HAB-1", "ar": "سارية الاتصالات شمال المبنى"},
	"eva_sample": {"en": "scoop site, 50 m out", "ar": "موقع الحفر على 50 م"},
	"eva_transect": {"en": "crater rim, 55 m north-east", "ar": "حافة الفوهة، 55 م شمال شرق"},
	"eva_dust": {"en": "solar field, west", "ar": "حقل الطاقة الشمسية غربًا"},
	"eva_stakes": {"en": "stake lane, by the airlock", "ar": "ممر الأوتاد قرب غرفة الضغط"},
	"lab_bench": {"en": "lab bench, inside HAB-1", "ar": "طاولة المختبر داخل المبنى"},
	"crew_water": {"en": "greenhouse trays", "ar": "صواني الدفيئة"},
	"comms_desk": {"en": "comms desk, inside HAB-1", "ar": "مكتب الاتصالات داخل المبنى"},
	"store": {"en": "spares bin, inside HAB-1", "ar": "صندوق قطع الغيار داخل المبنى"},
	"galley": {"en": "galley table, inside HAB-1", "ar": "طاولة المطبخ داخل المبنى"},
}

const GROUPS := ["eva", "lab", "crew"]
const GROUP_EN := {"eva": "Outside", "lab": "Laboratory", "crew": "Crew"}
const GROUP_AR := {"eva": "خارج القاعدة", "lab": "المختبر", "crew": "الطاقم"}


static func get_task(id: String) -> Dictionary:
	for t in TASKS:
		if t["id"] == id:
			return t
	return {}


static func of_group(group: String) -> Array:
	var out := []
	for t in TASKS:
		if t["group"] == group:
			out.append(t)
	return out


## Deterministic offer for a sol, so the same sol always shows the same board.
## Four tasks: at least one from each group, the fourth rotates.
static func offer(sol: int) -> Array:
	var eva := of_group("eva")
	var lab := of_group("lab")
	var crew := of_group("crew")
	var picked := [
		eva[sol % eva.size()],
		lab[(sol * 2) % lab.size()],
		crew[(sol * 3) % crew.size()],
	]
	var extra_pool: Array = [eva, lab, crew][(sol * 5) % 3]
	var extra: Dictionary = extra_pool[(sol + 1) % extra_pool.size()]
	if not picked.has(extra):
		picked.append(extra)
	if picked.size() < 4:
		for t in eva:
			if not picked.has(t):
				picked.append(t)
				break
	return picked


static func title(t: Dictionary, lang: String) -> String:
	return t["ar"] if lang == "ar" else t["en"]


static func detail(t: Dictionary, lang: String) -> String:
	return t["dar"] if lang == "ar" else t["den"]


static func group_name(g: String, lang: String) -> String:
	return GROUP_AR.get(g, g) if lang == "ar" else GROUP_EN.get(g, g)


static func spot_of(t: Dictionary) -> String:
	return str(t.get("spot", ""))


static func spot_name(t: Dictionary, lang: String) -> String:
	var row: Dictionary = SPOT_NAMES.get(str(t.get("spot", "")), {})
	return str(row.get(lang, row.get("en", "")))


static func risk_text(r: int, lang: String) -> String:
	var en := ["No risk", "Low risk", "Some risk", "Hard on the suit"]
	var ar := ["بلا خطر", "خطر منخفض", "بعض الخطر", "مُتعب للبدلة"]
	return (ar if lang == "ar" else en)[clampi(r, 0, 3)]
