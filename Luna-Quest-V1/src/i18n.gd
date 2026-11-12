class_name I18n
extends RefCounted
## Two languages, English and Arabic, kept in one table so nothing drifts. Numbers and the clock stay
## in Latin digits in both languages, the way mission displays usually do.

const STRINGS := {
	"title": {"en": "LUNA QUEST", "ar": "رحلة القمر"},
	"subtitle": {"en": "Shackleton rim  ·  Sol %s", "ar": "حافة شاكلتون  ·  اليوم %s"},
	"yourenergy": {"en": "YOUR ENERGY", "ar": "طاقتك"},
	"yourenergy_note": {"en": "body and suit — not the base", "ar": "جسمك وبدلتك — ليست طاقة القاعدة"},
	"basepower": {"en": "BASE POWER", "ar": "طاقة القاعدة"},
	"basepower_note": {"en": "solar, battery, loads", "ar": "الشمس والبطارية والأحمال"},
	"solar": {"en": "solar %s kW / load %s kW", "ar": "الشمس %s ك.و / الحمل %s ك.و"},
	"battery": {"en": "battery %s%%", "ar": "البطارية %s٪"},
	"shed": {"en": "load shed: lab and greenhouse off", "ar": "تخفيف الحمل: المختبر والدفيئة متوقفة"},
	"tasks": {"en": "TODAY", "ar": "مهام اليوم"},
	"datarow": {"en": "data %s  ·  %s", "ar": "بيانات %s  ·  %s"},
	"energy": {"en": "energy", "ar": "طاقة"},
	"min": {"en": "min", "ar": "دقيقة"},
	"where": {"en": "at", "ar": "في"},
	"no_tasks": {"en": "Board empty. Sleep to start the next sol.", "ar": "اللوحة فارغة. نم لبدء يوم جديد."},
	"press_e": {"en": "E", "ar": "E"},
	"board_title": {"en": "DAILY TASK BOARD  ·  SOL %s", "ar": "لوحة المهام اليومية  ·  اليوم %s"},
	"board_intro": {"en": "Every task spends YOUR energy. Pick what you can finish before you run out.", "ar": "كل مهمة تخصم من طاقتك. اختر ما يمكنك إنجازه قبل أن تنفد."},
	"accept": {"en": "Accept", "ar": "اقبل"},
	"accepted": {"en": "Accepted", "ar": "مقبولة"},
	"done": {"en": "Done", "ar": "تمت"},
	"need_energy": {"en": "needs %s energy", "ar": "تحتاج %s طاقة"},
	"board_footer": {"en": "1-4 accept  ·  Esc close  ·  every cost comes out of YOUR energy", "ar": "1-4 للقبول  ·  Esc للإغلاق  ·  كل تكلفة تُخصم من طاقتك"},
	"one_task": {"en": "Finish or drop the current task first.", "ar": "أنهِ المهمة الحالية أو اتركها أولًا."},
	"drop": {"en": "Dropped %s", "ar": "تم ترك %s"},
	"report_title": {"en": "SOL %s COMPLETE", "ar": "انتهى اليوم %s"},
	"report_body": {"en": "tasks %s  ·  data +%s  ·  energy spent %s", "ar": "المهام %s  ·  بيانات +%s  ·  الطاقة المستهلكة %s"},
	"closed": {"en": "Base power is separate: it is electricity, not your breakfast.", "ar": "طاقة القاعدة منفصلة: كهرباء، وليست فطورك."},
	"not_enough": {"en": "Not enough energy: %s needed, %s left. Eat in the galley or sleep.", "ar": "الطاقة غير كافية: تحتاج %s والمتبقي %s. كُل في المطبخ أو نم."},
	"done_task": {"en": "%s  ·  -%s energy  ·  +%s data", "ar": "%s  ·  -%s طاقة  ·  +%s بيانات"},
	"no_task_here": {"en": "No open task here. Check the board in HAB-1.", "ar": "لا مهمة مفتوحة هنا. راجع اللوحة في المبنى."},
	"wrong_spot": {"en": "This is not the place for %s.", "ar": "هذا ليس مكان %s."},
	"enter_base": {"en": "Enter HAB-1", "ar": "ادخل المبنى"},
	"exit_base": {"en": "Go back outside", "ar": "اخرج إلى السطح"},
	"drive": {"en": "Drive the rover", "ar": "قُد المركبة"},
	"board": {"en": "Read the task board", "ar": "اقرأ لوحة المهام"},
	"power": {"en": "Check base power", "ar": "افحص طاقة القاعدة"},
	"bed": {"en": "Sleep and end the sol", "ar": "نم وأنهِ اليوم"},
	"galley": {"en": "Eat something", "ar": "تناوَل طعامًا"},
	"comms": {"en": "Call Earth", "ar": "اتصل بالأرض"},
	"store": {"en": "Count the spares", "ar": "جرد قطع الغيار"},
	"talk": {"en": "Talk to %s", "ar": "تحدّث مع %s"},
	"lab": {"en": "Use the lab bench", "ar": "استخدم طاولة المختبر"},
	"water": {"en": "Water the trays", "ar": "اسقِ الصواني"},
	"status": {"en": "energy %s  ·  sol %s  ·  data %s", "ar": "طاقة %s  ·  اليوم %s  ·  بيانات %s"},
	"controls": {"en": "WASD move  ·  Shift run  ·  Space hop  ·  E use  ·  V view  ·  L language  ·  Tab free mouse",
		"ar": "WASD للحركة  ·  Shift للجري  ·  Space للقفز  ·  E للاستخدام  ·  V للعرض  ·  L للغة  ·  Tab للفأرة"},
	"out_of_energy": {"en": "Out of energy. Walk slowly back to the airlock.", "ar": "نفدت طاقتك. عُد ببطء إلى غرفة الضغط."},
	"ate": {"en": "+%s energy. The galley is the only refill before sleep.", "ar": "+%s طاقة. المطبخ هو المصدر الوحيد قبل النوم."},
	"no_meals": {"en": "The galley is empty for today. Sleep to restock.", "ar": "المطبخ فارغ لهذا اليوم. نم لتتجدد الحصص."},
	"sleeping": {"en": "Lights out. Sol %s starts in the morning.", "ar": "إطفاء الأنوار. يبدأ اليوم %s في الصباح."},
	"lang": {"en": "EN", "ar": "ع"},
	"data": {"en": "data", "ar": "بيانات"},
	"task_none": {"en": "No task accepted", "ar": "لا مهمة مقبولة"},
	"goal": {"en": "science goal", "ar": "هدف العلوم"},
}


static func t(key: String, lang: String) -> String:
	if not STRINGS.has(key):
		return key
	var row: Dictionary = STRINGS[key]
	return row.get(lang, row["en"])
