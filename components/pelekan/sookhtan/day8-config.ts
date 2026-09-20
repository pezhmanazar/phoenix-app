//phoenix-app\components\pelekan\sookhtan\Day8-config.ts
import { AUDIO_KEYS } from "@/constants/media";
import type { DayConfig } from "../daily/types";

export const sookhtanDay8Config: DayConfig = {
  dayCode: "sookhtan_day8",
  stageCode: "sookhtan",
  dayNumber: 8,
  titleFa: "روز هشتم سوختن",
  requiredTaskCodes: [
    "sookhtan_day8_feelings_log",
    "sookhtan_day8_morning_routine",
    "sookhtan_day8_daily_commitment",
    "sookhtan_day8_daily_meditation",
    "sookhtan_day8_torch",
    "sookhtan_day8_technique_1",
    "sookhtan_day8_no_contact_check",
    "sookhtan_day8_night_routine",
  ],
  tasks: [
    {
      code: "sookhtan_day8_feelings_log",
      titleFa: "ثبت حال و هیجانات ابتدای روز",
      template: "mood_checkin",
      required: true,
      completionRule: {
        type: "required_fields",
        fields: ["morningMoodScore"],
      },
      meta: {
        submitLabel: "ثبت حال امروز",
      },
    },
    {
      code: "sookhtan_day8_morning_routine",
      titleFa: "روتین صبحگاهی",
      template: "routine_flow",
      variant: "morning",
      required: true,
      completionRule: {
        type: "all_steps_completed",
      },
      steps: [
        {
          key: "morning_meditation",
          stepType: "conditional_audio",
          title: "مراقبه صبح",
          instruction:
            "چند دقیقه آروم بشین، فایل صوتی رو گوش بده و فقط اجازه بده بدنت از حالت آشفتگی صبحگاهی کمی فاصله بگیره.",
          required: true,
          sourceScoreKey: "score",
          sourceTaskCode: "sookhtan_day8_feelings_log",
          variants: [
            {
              min: 1,
              max: 5,
              audioKey: AUDIO_KEYS.sookhtan.day08.morningMeditationMood1To5,
              title: "مراقبه برای حال پایین",
            },
            {
              min: 6,
              max: 10,
              audioKey: AUDIO_KEYS.sookhtan.day08.morningMeditationMood6To10,
              title: "مراقبه برای حال بهتر",
            },
          ],
        },
        {
          key: "sunlight_breathing",
          stepType: "timer_audio",
          title: "نور صبح و تنفس",
          instruction:
            "به مدت فایل صوتی، جلوی نور آفتاب و هوای آزاد قرار بگیر و هم‌زمان نفس‌های عمیق و آروم بکش؛\nاگه هوا ابریه، باز در جایی قرار بگیر که اگه هوا ابری نبود نور آفتاب و هوای تازه بهت می‌خورد.",
          audioKey: AUDIO_KEYS.sookhtan.day08.sunMeditation,
          required: true,
        },
        {
          key: "morning_stretch",
          stepType: "timer_audio",
          title: "حرکات کششی صبحگاهی",
          instruction:
            "هم‌زمان با راهنمایی‌ صوتی، چند حرکت کششی آروم و سبک انجام بده.",
          audioKey: AUDIO_KEYS.sookhtan.day08.morningStretchMeditation,
          required: true,
        },
        {
          key: "positive_note",
          stepType: "checklist_text",
          title: "یک جمله حمایتی برای خودت",
          instruction:
            "اول چند یادآوری کوتاه رو تیک بزن، بعد جمله حمایتی امروزت رو برای خودت بنویس.",
          checklist: [
            {
              id: "reminder_no_complete_answer",
              label:
                "ممکنه برای بعضی از سؤال‌هام هیچ‌وقت جواب کاملی پیدا نکنم.",
            },
            {
              id: "reminder_answer_not_required",
              label:
                "برای ادامه دادن زندگی لازم نیست جواب همه «چرا»ها رو بدونم.",
            },
            {
              id: "reminder_uncertainty",
              label: "می‌تونم بعضی ابهام‌ها رو تحمل کنم و همچنان جلو برم.",
            },
          ],
          placeholder:
            "مثلاً: امروز لازم نیست همه‌چیز رو بفهمم تا بتونم یک قدم جلوتر برم.",
          multiline: true,
          required: true,
        },

        {
          key: "wash_or_shower",
          stepType: "info_checklist_action",
          title: "شستن صورت یا دوش کوتاه",
          instruction:
            "جاری شدن آب روی پوست می‌تونه حس سکون و سنگینی رو کمتر کنه، بدن رو هوشیارتر کنه و به سیستم عصبی کمک کنه کمی از حالت انجماد یا بی‌حسی بیرون بیاد. لازم نیست طولانی باشه؛ یک شست‌وشوی کوتاه هم کافیه.",
          checklist: [
            {
              id: "washed_face_or_shower",
              label:
                "صورت، دست‌ها و پاهام رو با آب سرد شستم یا یک دوش کوتاه گرفتم.",
            },
            {
              id: "calm_breaths",
              label: "در حین شستن و بعدش چند نفس آروم کشیدم.",
            },
            {
              id: "dried_and_tidied",
              label:
                "بعد از اون خودم رو خشک و مرتب کردم و توو آینه به خودم ده ثانیه با لبخند نگاه کردم.",
            },
          ],
          required: true,
        },
        {
          key: "self_care_breakfast",
          stepType: "info_checklist_action",
          title: "صبحانه و مراقبت کوچیک از بدن",
          instruction:
            "بدن تو برای ادامه این روز به سوخت و توجه نیاز داره؛ یک صبحانه ساده، نوشیدن آب، و یک رسیدگی کوچیک به بدن و ظاهرت می‌تونه به مغز پیام ثبات و مراقبت بده و شروع روز رو بهتر کنه.",
          checklist: [
            {
              id: "drank_water",
              label: "یک لیوان آب خوردم.",
            },
            {
              id: "ate_breakfast",
              label: "یک صبحانه سبک و مقوی خوردم.",
            },
            {
              id: "clean_clothes",
              label: "لباس راحت، تمیز و مورد علاقم رو پوشیدم.",
            },
            {
              id: "small_body_care",
              label:
                "یک رسیدگی کوچیک روی بدن یا ظاهرم انجام دادم مثلا کرم ضدآفتاب یا آرایش سبک.",
            },
          ],
          required: true,
        },
        {
          key: "day_planner_check",
          stepType: "info_navigation_action",
          title: "بررسی برنامه امروز",
          instruction:
            "برنامه‌ریزی، ذهن رو از آشفتگی به مسیر برمی‌گردونه؛ اگه هنوز برنامه امروزت رو ننوشتی، به تب روزنگار برو و برنامه امروزت رو بنویس .",
          route: "/Rooznegar",
          ctaLabel: "رفتن به روزنگار",
          checklist: [
            {
              id: "today_plan_written",
              label: "برنامه‌ امروزم رو نوشتم.",
            },
            {
              id: "today_priorities_set",
              label: "کارهای مهم‌ خودم رو مشخص کردم.",
            },
            {
              id: "today_enjoy_moment",
              label: "در کنار انجام کارها، سعی می‌کنم از روزم لذت ببرم.",
            },
            {
              id: "today_self_kindness",
              label: "اگه همه‌چیز کامل پیش نرفت، به خودم سخت‌ نمی‌گیرم.",
            },
          ],
          required: true,
        },
      ],
    },
    {
      code: "sookhtan_day8_daily_commitment",
      titleFa: "تعهد روزانه",
      template: "commitment",
      required: true,
      completionRule: {
        type: "commitment",
        requiredChecked: "all",
        requiredTypedConfirmations: [
          {
            key: "confirm_1",
            exactText: "امروز مجبور نیستم جواب همه چراها رو پیدا کنم",
          },
          {
            key: "confirm_2",
            exactText: "امروز بدون جواب کامل هم به مسیرم ادامه می‌دم",
          },
        ],
      },
      meta: {
        submitLabel: "ثبت تعهد امروز",
        commitments: [
          { id: "c1", text: "امروز بهش پیام نمی‌دم" },
          {
            id: "c2",
            text: "امروز سراغش رو نمی‌گیرم، صفحه‌اش رو چک نمی‌کنم و از دیگران درباره‌اش سؤال نمی‌کنم",
          },
          {
            id: "c3",
            text: "امروز همه تکنیک‌های ضروری روز خودم رو انجام می‌دم",
          },
          {
            id: "c4",
            text: "امروز هر کاری که کمتر از دو دقیقه طول می‌کشه رو عقب نمی‌اندازم؛ مثلا ظرف شستن یا گذاشتن لباس‌های بیرون سر جاش",
          },
          {
            id: "c5",
            text: "امروز حداقل ۷۰٪ برنامه‌های ثبت‌شده در روزنگار رو انجام می‌دم",
          },
          {
            id: "c6",
            text: "امروز تا جای ممکن از شبکه‌های اجتماعی و ویدیوهای کوتاه بی‌ارزش فاصله می‌گیرم",
          },
          {
            id: "c7",
            text: "امروز مجبور نیستم برای همه اتفاقات رابطه یک جواب قطعی پیدا کنم",
          },
          {
            id: "c8",
            text: "امروز وارد بازجویی ذهنیِ بی‌پایان درباره چراها و اگه‌ها نمی‌شم",
          },
          {
            id: "c9",
            text: "وقتی به سؤال بی‌جوابی می‌رسم، به خودم یادآوری می‌کنم که می‌تونم بدون جواب کامل هم ادامه بدم",
          },
        ],
      },
    },

    {
      code: "sookhtan_day8_safe_place",
      titleFa: "پناهگاه",
      template: "reminder",
      required: false,
      completionRule: { type: "manual" },
      meta: {
        submitLabel: "متوجه شدم",
      },
    },
    {
      code: "sookhtan_day8_daily_meditation",
      titleFa: "مراقبه اختصاصی روز",
      template: "audio_reflection",
      required: true,
      completionRule: {
        type: "required_fields_and_steps",
        requiredFields: ["meditationNotes"],
        requiredSteps: ["audio_completed", "breathing_completed"],
      },
      meta: {
        audioKey: AUDIO_KEYS.sookhtan.day08.specialMeditation,
        submitLabel: "ثبت مراقبه",
      },
    },
    {
      code: "sookhtan_day8_feel_good_task",
      titleFa: "کار حال خوب‌کن",
      template: "mood_boost",
      required: false,
      completionRule: {
        type: "selection_and_manual_or_timer",
        requireActivity: true,
        requireTimerCompletion: false,
      },
      meta: {
        submitLabel: "ثبت کار حال خوب‌کن",
        introTitle: "کار حال خوب‌کن",
        introText:
          "این چند روز ممکنه بخش زیادی از انرژی ذهنت صرف احساسات و خاطرات شده باشه. کار حال خوب‌کن امروز قراره برای مدتی کوتاه تو رو از فضای رابطه بیرون بیاره و دوباره با بدن، محیط و زندگی روزمره‌ات درگیر کنه. یک کار ساده انتخاب کن و واقعاً انجامش بده.",
        activityPlaceholder:
          "اگه کار حال خوب‌کن تو داخل لیست نیست، اینجا بنویس...",
        timerTitle: "برای انجام این کار، یک بازه زمانی تعیین کن",
        reminderTitle: "یادآوری‌های ادامه روز",
        activities: [
          "پیاده‌روی کمی طولانی‌تر از روزهای قبل",
          "گوش دادن به یک موسیقی پرانرژی یا حال خوب‌کن",
          "دیدن یک فیلم، سریال یا برنامه سرگرم‌کننده",
          "رفتن به یک کافه، پارک یا فضای موردعلاقه",
          "انجام یک فعالیت ورزشی سبک",
          "درست کردن یک غذا یا نوشیدنی که دوست دارم",
          "مرتب کردن یا تغییر دادن یک قسمت کوچک از اتاق",
          "خریدن یک چیز کوچک و موردنیاز برای خودم",
          "تماس یا دیدار کوتاه با یک دوست یا آدم امن",
          "انجام بخشی از کاری که مدتی عقب انداخته بودم",
          "خوندن چند صفحه کتاب یا مجله",
          "رسیدگی به گل، حیوان خانگی یا محیط زندگی",
          "انجام یک سرگرمی قدیمی که مدتی کنار گذاشته بودم",
          "یاد گرفتن یک چیز کوتاه و جالب",
          "انجام یک کار خلاقانه مثل نوشتن، طراحی، آشپزی یا عکاسی",
        ],
        reminders: [
          "بعد از تمرین‌های احساسی امروز، تمام روز رو صرف تحلیل رابطه نکن.",
          "اگه ذهنت دوباره سمت رابطه رفت، لازم نیست با فکرها بجنگی؛ متوجهشون شو و دوباره به کاری که داری انجام می‌دی برگرد.",
          "برای بهتر شدن حالت سراغ چک کردن زندگی اون نرو؛ این کار معمولاً فقط یک موج تازه ایجاد می‌کنه.",
          "حتی اگه انگیزه نداری، یک فعالیت کوتاه رو شروع کن و بعد درباره ادامه دادنش تصمیم بگیر.",
          "از عصر به بعد مصرف کافئین رو کمتر کن و برای خواب امشب آماده شو.",
          "قبل از خواب به ذهنت مسئله تازه‌ای برای حل کردن نده؛ امروز به اندازه کافی کار کرده.",
        ],
        minTimerSeconds: 300,
        maxTimerSeconds: 3600,
        defaultTimerSeconds: 1200,
      },
    },
    {
      code: "sookhtan_day8_torch",
      titleFa: "مشعل روز هشتم",
      template: "quiz_audio",
      required: true,
      completionRule: {
        type: "quiz_pass",
        passingScorePercent: 70,
        requireAudioCompleted: true,
      },
      meta: {
        audioKey: AUDIO_KEYS.mashaal.lesson08,
        submitLabel: "ثبت درس امروز",
        questions: [
          {
            id: "q1",
            type: "true_false",
            prompt:
              "وابسته شدن به یک نفر به‌خودی‌خود ناسالم نیست و نیاز به نزدیکی، حمایت و آرامش در رابطه می‌تونه طبیعی باشه.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "true",
          },
          {
            id: "q2",
            type: "true_false",
            prompt:
              "در یک رابطه سالم، برای شکل گرفتن «ما» باید بخش زیادی از علایق، روابط و زندگی شخصی خودت رو کنار بذاری.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "false",
          },
          {
            id: "q3",
            type: "true_false",
            prompt:
              "اگر تنها راه آرام شدنت حضور، پیام یا توجه طرف مقابل باشه، رابطه ممکنه به‌جای پناهگاه به یک مسکن فوری تبدیل شده باشه.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "true",
          },
          {
            id: "q4",
            type: "true_false",
            prompt:
              "در وابستگی سالم، داشتن خلوت، دوستان، علایق و تصمیم‌های شخصی نشونه کم شدن عشق به طرف مقابله.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "false",
          },
          {
            id: "q5",
            type: "multiple_choice",
            prompt: "کدوم گزینه بیشتر نشون‌دهنده وابستگی سالمه؟",
            options: [
              {
                id: "a",
                text: "برای حفظ رابطه از بیشتر علایق و دوست‌هام فاصله می‌گیرم",
              },
              {
                id: "b",
                text: "اگه چند ساعت جوابم رو نده، احساس می‌کنم همه‌چیز داره از بین می‌ره",
              },
              {
                id: "c",
                text: "رابطه برام مهمه، اما هنوز علایق، دوستان، خلوت و زندگی شخصی خودم رو دارم",
              },
              {
                id: "d",
                text: "همه برنامه‌هام رو طوری تنظیم می‌کنم که همیشه برای اون در دسترس باشم",
              },
            ],
            correctOptionId: "c",
          },
          {
            id: "q6",
            type: "multiple_choice",
            prompt: "«حذف زندگی شخصی» در وابستگی ناسالم بیشتر به چه معناست؟",
            options: [
              {
                id: "a",
                text: "کم‌کم کنار گذاشتن علایق، دوستان، برنامه‌ها و نیازهای شخصی برای حفظ رابطه",
              },
              {
                id: "b",
                text: "تغییر دادن بعضی برنامه‌ها با توافق دوطرفه",
              },
              {
                id: "c",
                text: "اختصاص دادن بخشی از زمان به رابطه",
              },
              {
                id: "d",
                text: "مشورت کردن با طرف مقابل درباره تصمیم‌های مشترک",
              },
            ],
            correctOptionId: "a",
          },
          {
            id: "q7",
            type: "multiple_choice",
            prompt: "تفاوت «ما»ی سالم با «ما»ی ناسالم چیه؟",
            options: [
              {
                id: "a",
                text: "در «ما»ی سالم دو نفر باید همیشه تصمیم‌های یکسانی داشته باشن",
              },
              {
                id: "b",
                text: "در «ما»ی سالم، «من» و «تو» همچنان وجود دارن؛ در «ما»ی ناسالم، فردیت کم‌کم حذف می‌شه",
              },
              {
                id: "c",
                text: "در «ما»ی ناسالم هر دو نفر حتماً زمان زیادی رو جدا از هم می‌گذرونن",
              },
              {
                id: "d",
                text: "در «ما»ی سالم هیچ‌کس نباید به دیگری نیاز عاطفی داشته باشه",
              },
            ],
            correctOptionId: "b",
          },
          {
            id: "q8",
            type: "multiple_choice",
            prompt: "چه زمانی رابطه بیشتر شبیه «مسکن فوری» عمل می‌کنه؟",
            options: [
              {
                id: "a",
                text: "وقتی رابطه در کنار منابع دیگه، یکی از منابع آرامش و حمایت توئه",
              },
              {
                id: "b",
                text: "وقتی دو نفر در کنار رابطه، زندگی شخصی خودشون رو هم حفظ می‌کنن",
              },
              {
                id: "c",
                text: "وقتی حضور طرف مقابل بهت کمک می‌کنه دوباره روی پای خودت بایستی",
              },
              {
                id: "d",
                text: "وقتی حضور و توجه طرف مقابل تبدیل به تنها راه خاموش کردن اضطراب، تنهایی یا احساس بی‌ارزشی می‌شه",
              },
            ],
            correctOptionId: "d",
          },
          {
            id: "q9",
            type: "multiple_choice",
            prompt: "کدوم مورد می‌تونه نشونه وابستگی ناسالم باشه؟",
            options: [
              {
                id: "a",
                text: "داشتن نظر متفاوت و بیان کردن اون در رابطه",
              },
              {
                id: "b",
                text: "چشم‌پوشی مداوم از نیازها و مرزهای خودت از ترس اینکه رابطه رو از دست بدی",
              },
              {
                id: "c",
                text: "دلتنگ شدن برای طرف مقابل وقتی مدتی از هم دور هستید",
              },
              {
                id: "d",
                text: "لذت بردن از حمایت عاطفی طرف مقابل",
              },
            ],
            correctOptionId: "b",
          },
          {
            id: "q10",
            type: "multiple_choice",
            prompt:
              "اگر متوجه بشی در رابطه بخش زیادی از «من» خودت رو از دست دادی، کدوم مسیر با این درس هماهنگ‌تره؟",
            options: [
              {
                id: "a",
                text: "کم‌کم علایق، روابط، مرزها و بخش‌های زندگی شخصی خودت رو دوباره برگردونی",
              },
              {
                id: "b",
                text: "برای جبران، تمام رابطه‌های عاطفی رو از زندگی خودت حذف کنی",
              },
              {
                id: "c",
                text: "سعی کنی کاملاً بی‌نیاز از دیگران بشی",
              },
              {
                id: "d",
                text: "زندگی شخصی خودت رو بیشتر کنار بذاری تا رابطه احساس امنیت بیشتری پیدا کنه",
              },
            ],
            correctOptionId: "a",
          },
        ],
      },
    },

    {
      code: "sookhtan_day8_technique_1",
      titleFa: "چراهایی که هنوز رهام نمی‌کنن",
      descriptionFa:
        "بعد از پایان رابطه، ذهن ممکنه بارها سراغ سؤال‌هایی بره که جواب روشنی ندارن: «چرا این کار رو کرد؟»، «واقعاً دوستم داشت؟» یا «کجای کار خراب شد؟». در این تمرین، سؤال‌های بی‌جوابت رو بررسی می‌کنی تا ببینی کدوم‌ها واقعاً به پاسخ نیاز دارن و کدوم‌ها فقط تو رو در گذشته نگه داشتن.",
      template: "routine_flow",
      required: true,
      completionRule: {
        type: "all_steps_completed",
      },
      meta: {
        submitLabel: "ثبت تمرین",
      },
      steps: [
        {
          key: "unanswered_questions",
          stepType: "text_input",
          title: "سؤال‌های بی‌جواب",
          instruction:
            "همه سؤال‌هایی رو که هنوز درباره رابطه یا پایانش در ذهنت تکرار می‌شن بنویس. لازم نیست الان بهشون جواب بدی.",
          placeholder:
            "مثلاً: چرا رفت؟ واقعاً دوستم داشت؟ چرا زودتر حقیقت رو نگفت؟ از کی تصمیمش رو گرفته بود؟ چرا برای رابطه بیشتر تلاش نکرد؟ الان درباره من چی فکر می‌کنه؟",
          multiline: true,
          required: true,
        },
        {
          key: "main_question",
          stepType: "text_input",
          title: "سؤالی که بیشتر گیرت انداخته",
          instruction:
            "از بین سؤال‌هایی که نوشتی، یکی رو انتخاب کن که بیشتر از بقیه در ذهنت تکرار می‌شه یا احساس می‌کنی برای ادامه دادن به جوابش احتیاج داری.",
          placeholder:
            "مثلاً: چیزی که بیشتر از همه ذهنم رو درگیر کرده اینه که چرا با وجود تمام حرف‌هایی که می‌زد، ناگهان تصمیم گرفت رابطه رو تموم کنه.",
          multiline: true,
          required: true,
        },
        {
          key: "known_facts",
          stepType: "text_input",
          title: "چی رو واقعاً می‌دونی؟",
          instruction:
            "فقط چیزهایی رو بنویس که درباره این سؤال واقعاً می‌دونی؛ چیزهایی که دیدی، شنیدی یا اتفاق افتادن. حدس، تفسیر و احتمال رو فعلاً کنار بذار.",
          placeholder:
            "مثلاً: می‌دونم در هفته‌های آخر فاصله گرفته بود، کمتر تماس می‌گرفت و در نهایت گفت نمی‌خواد رابطه ادامه پیدا کنه.",
          multiline: true,
          required: true,
        },
        {
          key: "unknown_parts",
          stepType: "text_input",
          title: "چی رو نمی‌دونی؟",
          instruction:
            "حالا مشخص کن کدوم بخش‌های سؤال واقعاً برای تو نامعلومه و ممکنه اطلاعات کافی برای جواب قطعی بهشون نداشته باشی.",
          placeholder:
            "مثلاً: نمی‌دونم دقیقاً از چه زمانی تصمیمش رو گرفته بود، تمام دلایلش چی بودن یا الان واقعاً چه احساسی درباره من داره.",
          multiline: true,
          required: true,
        },
        {
          key: "mind_answers",
          stepType: "text_input",
          title: "جواب‌هایی که ذهنت ساخته",
          instruction:
            "وقتی جواب قطعی نداری، ذهنت معمولاً جای خالی رو با حدس پر می‌کنه. چه جواب‌هایی برای این سؤال ساخته‌ای؟",
          placeholder:
            "مثلاً: حتماً هیچ‌وقت دوستم نداشت / حتماً یکی دیگه بوده / من براش کافی نبودم / همه حرف‌هاش دروغ بوده.",
          multiline: true,
          required: true,
        },
        {
          key: "answer_search_cost",
          stepType: "text_input",
          title: "هزینه دنبال کردن جواب",
          instruction:
            "برای پیدا کردن جواب این سؤال تا حالا چه کارهایی کردی یا ذهنت چه کارهایی ازت خواسته؟ این جست‌وجو چه اثری روی حالت داشته؟",
          placeholder:
            "مثلاً: پیام‌ها رو دوباره خوندم، رفتارهاش رو تحلیل کردم، از دیگران پرسیدم، پیجش رو چک کردم یا ساعت‌ها سناریوهای مختلف ساختم و در نهایت بیشتر درگیر شدم.",
          multiline: true,
          required: true,
        },
        {
          key: "can_answer_change_reality",
          stepType: "text_input",
          title: "اگه جواب رو پیدا کنی، چی تغییر می‌کنه؟",
          instruction:
            "فرض کن فردا جواب قطعی این سؤال رو پیدا کردی. چه چیزی واقعاً در زندگی امروزت تغییر می‌کنه و چه چیزی همچنان همون باقی می‌مونه؟",
          placeholder:
            "مثلاً: شاید بعضی ابهام‌ها کمتر بشن، اما رابطه همچنان تموم شده و من هنوز باید با فقدان و احساسات خودم روبه‌رو بشم.",
          multiline: true,
          required: true,
        },
        {
          key: "uncertainty_statement",
          stepType: "text_input",
          title: "چیزی که می‌تونی بی‌جواب بذاری",
          instruction:
            "یکی از سؤال‌هایی رو که فعلاً جواب قابل اعتمادی براش نداری انتخاب کن و جمله‌ای بنویس که اجازه بده بدون حل کردنش مسیرت رو ادامه بدی. قرار نیست بگی سؤال مهم نیست؛ فقط لازم نیست زندگی تو منتظر جوابش بمونه.",
          placeholder:
            "مثلاً: هنوز نمی‌دونم تمام دلایل رفتنش چی بود و شاید هیچ‌وقت هم کامل ندونم. این سؤال برای من مهمه، اما لازم نیست برای ادامه دادن زندگی‌ام جواب کاملش رو داشته باشم.",
          multiline: true,
          required: true,
        },
      ],
    },

    {
      code: "sookhtan_day8_technique_2",
      titleFa: "جوابی که شاید هیچ‌وقت نرسه",
      descriptionFa:
        "گاهی پشت یک سؤال بی‌جواب، فقط نیاز به اطلاعات نیست. ممکنه منتظر توضیح، آرامش، تأیید، عذرخواهی یا شنیدن چیزی باشیم که درد ما رو قابل فهم‌تر کنه. در این تمرین بررسی می‌کنی واقعاً از اون جواب چه چیزی می‌خواستی.",
      template: "routine_flow",
      required: false,
      completionRule: {
        type: "all_steps_completed",
      },
      meta: {
        submitLabel: "ثبت تمرین",
      },
      steps: [
        {
          key: "wanted_answer",
          stepType: "text_input",
          title: "منتظر چه جوابی هستی؟",
          instruction:
            "یکی از سؤال‌های بی‌جوابت رو انتخاب کن و صادقانه بنویس دوست داشتی چه جوابی از طرف مقابل بشنوی. این چیزی نیست که حتماً واقعیت داشته باشه؛ فقط جوابی رو بنویس که بخشی از تو آرزو داره بشنوه.",
          placeholder:
            "مثلاً: دوست داشتم بگه تقصیر تو نبود / واقعاً دوستت داشتم / اشتباه کردم / تو برای من مهم بودی / می‌فهمم که بهت آسیب زدم.",
          multiline: true,
          required: true,
        },
        {
          key: "need_behind_answer",
          stepType: "text_input",
          title: "این جواب قرار بود چی بهت بده؟",
          instruction:
            "اگه دقیقاً همون جواب رو می‌شنیدی، انتظار داشتی چه چیزی درونت تغییر کنه؟",
          placeholder:
            "مثلاً: احساس کنم کافی بودم، بفهمم همه‌چیز تقصیر من نبوده، مطمئن بشم رابطه واقعی بوده، احساس کنم دردم دیده شده یا کمتر خودم رو سرزنش کنم.",
          multiline: true,
          required: true,
        },
        {
          key: "dependent_on_other",
          stepType: "text_input",
          title: "کدوم بخش فقط دست اونه؟",
          instruction:
            "مشخص کن چه چیزی واقعاً فقط از طرف مقابل می‌تونه بیاد و تو کنترلی روی دریافت کردنش نداری.",
          placeholder:
            "مثلاً: اینکه عذرخواهی کنه، دلیل واقعی تصمیمش رو بگه، مسئولیت رفتارش رو قبول کنه یا درباره احساس خودش صادقانه توضیح بده.",
          multiline: true,
          required: true,
        },
        {
          key: "available_without_answer",
          stepType: "text_input",
          title: "کدوم بخش رو می‌تونی بدون اون جواب پیدا کنی؟",
          instruction:
            "حالا ببین آیا بخشی از چیزی که از اون جواب می‌خواستی، می‌تونه بدون همکاری طرف مقابل هم به‌مرور ساخته بشه.",
          placeholder:
            "مثلاً: برای معتبر دونستن دردم لازم نیست اون تأییدش کنه / می‌تونم سهم خودم رو منصفانه بررسی کنم / ارزشم رو فقط از قضاوت اون نگیرم.",
          multiline: true,
          required: true,
        },
        {
          key: "stop_waiting_statement",
          stepType: "text_input",
          title: "زندگیت رو منتظر جواب نذار",
          instruction:
            "در پایان جمله‌ای برای خودت بنویس که در اون هم اهمیت سؤال رو بپذیری و هم تصمیم بگیری ادامه مسیرت رو به رسیدن جواب وابسته نکنی.",
          placeholder:
            "مثلاً: هنوز دوست داشتم جواب این سؤال رو بدونم، اما نمی‌خوام خوب شدن و ادامه زندگی‌ام رو به جوابی وابسته کنم که شاید هیچ‌وقت دریافتش نکنم.",
          multiline: true,
          required: true,
        },
      ],
    },
    {
      code: "sookhtan_day8_no_contact_check",
      titleFa: "بررسی قاعده قطع تماس",
      template: "no_contact_check",
      required: true,
      completionRule: {
        type: "required_fields",
        fields: ["noContactEventType"],
      },
      meta: {
        submitLabel: "ثبت بررسی امروز",
        steps: [
          {
            key: "status",
            label: "وضعیت امروز",
            hint: "مشخص کن امروز از نظر ارتباط با اکست چطور بوده",
          },
          {
            key: "questions",
            label: "بررسی دقیق‌تر",
            hint: "به چند سوال کوتاه و صادقانه جواب بده",
          },
          {
            key: "guidance",
            label: "جمع‌بندی و توصیه",
            hint: "این بخش کمک می‌کنه دقیق‌تر مرزت رو نگه داری",
          },
          {
            key: "final",
            label: "ثبت نهایی",
            hint: "قبل از ثبت، چند تعهد کوتاه رو تأیید کن",
          },
        ],
        questionsByStatus: {
          no_contact: [
            {
              id: "urge_level",
              type: "single_select",
              title: "امروز چقدر وسوسه شدی با اکست ارتباط بگیری یا چکش کنی؟",
              required: true,
              options: [
                { value: "none", label: "اصلاً وسوسه نشدم" },
                {
                  value: "low_controlled",
                  label: "کمی وسوسه شدم ولی کنترلش کردم",
                },
                {
                  value: "high_not_done",
                  label: "زیاد وسوسه شدم ولی انجامش ندادم",
                },
                {
                  value: "almost_done",
                  label: "نزدیک بود انجام بدم اما جلوی خودم رو گرفتم",
                },
              ],
            },
            {
              id: "trigger_type",
              type: "single_select",
              title: "امروز بیشتر چه چیزی تو رو تحریک کرد؟",
              required: true,
              options: [
                { value: "missing", label: "دلتنگی" },
                { value: "loneliness", label: "تنهایی" },
                { value: "curiosity", label: "کنجکاوی" },
                { value: "anger", label: "خشم یا دلخوری" },
                { value: "reminder", label: "دیدن چیزی مرتبط با او" },
                { value: "none", label: "هیچ‌کدوم و تحریک خاصی نداشتم" },
              ],
            },
            {
              id: "coping_response",
              type: "single_select",
              title: "وقتی یادش افتادی یا تحریک شدی، چیکار کردی؟",
              required: true,
              options: [
                {
                  value: "redirected_attention",
                  label: "حواسم رو با انجام دادن یک کاری، پرت کردم",
                },
                { value: "self_talk", label: "با خودم منطقی حرف زدم" },
                {
                  value: "waited_wave",
                  label: "صبر کردم تا موج احساسی رد بشه",
                },
                {
                  value: "used_app_tools",
                  label: "از ابزارهای ققنوس مثل پناهگاه کمک گرفتم",
                },
                { value: "no_strategy", label: "هنوز راهکار مشخصی ندارم" },
              ],
            },
            {
              id: "current_feeling",
              type: "single_select",
              title: "الان نسبت به اینکه ارتباط نگرفتی چه حسی داری؟",
              required: true,
              options: [
                { value: "proud", label: "به خودم افتخار می‌کنم" },
                { value: "calmer", label: "آروم‌ترم" },
                {
                  value: "hard_but_right",
                  label: "هنوز سخته ولی می‌دونم دارم کار درست رو انجام میدم",
                },
                { value: "numb_unsure", label: "بی‌حسم یا مطمئن نیستم" },
              ],
            },
          ],

          necessary_contact: [
            {
              id: "contact_reason",
              type: "single_select",
              title: "چرا مجبور شدی ارتباط بگیری؟",
              required: true,
              options: [
                { value: "work_study", label: "موضوع کاری یا درسی" },
                { value: "financial", label: "موضوع مالی" },
                {
                  value: "family",
                  label: "موضوع خانوادگی یا مربوط به بچه مشترک",
                },
                {
                  value: "mature_reconciliation_review",
                  label: "بررسی سالم و بالغانه به دلیل برگشت به رابطه",
                },
                {
                  value: "belongings",
                  label: "موضوع مربوط به وسایل یا مسائل باقی‌مونده",
                },
                { value: "legal_admin", label: "موضوع قانونی یا اداری" },
                { value: "other", label: "دلیل دیگه" },
              ],
            },
            {
              id: "contact_reason_other",
              type: "text",
              title: "کوتاه بنویس چرا ارتباط لازم بود.",
              required: false,
              placeholder: "اگه خواستی بنویس...",
              showIf: {
                questionId: "contact_reason",
                equals: "other",
              },
            },
            {
              id: "contact_control_level",
              type: "single_select",
              title: "این ارتباط چقدر ضروری و کنترل‌شده بود؟",
              required: true,
              options: [
                {
                  value: "fully_necessary_short",
                  label: "کاملاً ضروری و کوتاه بود",
                },
                {
                  value: "longer_than_needed",
                  label: "کمی بیشتر از حد لازم طول کشید",
                },
                {
                  value: "controlled_but_emotional",
                  label: "از کنترل خارج نشد، ولی احساساتی شدم",
                },
                {
                  value: "partly_unnecessary",
                  label: "راستش بخشی از اون ضروری نبود",
                },
              ],
            },
            {
              id: "feeling_during_contact",
              type: "single_select",
              title: "حین ارتباط چه احساسی داشتی؟",
              required: true,
              options: [
                { value: "calm", label: "آروم و کنترل‌شده" },
                { value: "anxious", label: "مضطرب" },
                { value: "missing", label: "دلتنگ" },
                { value: "angry", label: "عصبانی" },
                { value: "hopeful", label: "امیدوار شدم دوباره چیزی درست بشه" },
                { value: "confused", label: "گیج و درگیر" },
                { value: "mixed_feelings", label: "چند حس رو با همدیگه داشتم" },
              ],
            },
            {
              id: "did_extend_conversation",
              type: "single_select",
              title:
                "آیا تو تلاش کردی مکالمه رو طولانی‌تر، صمیمی‌تر یا احساسی‌تر کنی؟",
              required: true,
              options: [
                {
                  value: "no_only_necessary",
                  label: "نه، فقط در حد ضرورت جواب دادم",
                },
                {
                  value: "a_little_but_stopped",
                  label: "کمی، ولی زود خودم رو جمع کردم",
                },
                {
                  value: "yes_sought_attention",
                  label: "بله، ناخودآگاه دنبال توجه یا واکنشش بودم",
                },
                { value: "not_sure", label: "مطمئن نیستم" },
              ],
            },
            {
              id: "other_person_extended",
              type: "single_select",
              title:
                "آیا اون تلاش کرد تو رو وارد گفتگوی بیشتر، احساسی‌تر یا تحریک‌کننده‌تر کنه؟",
              required: true,
              options: [
                { value: "no", label: "نه" },
                { value: "yes_not_engaged", label: "بله، ولی وارد بازی نشدم" },
                {
                  value: "yes_partly_engaged",
                  label: "بله و تا حدی درگیر شدم",
                },
                { value: "not_sure", label: "مطمئن نیستم" },
              ],
            },
            {
              id: "next_time_better_action",
              type: "multi_select",
              title:
                "دفعه بعد اگه ارتباط ضروری پیش بیاد، می‌خوای چطور بهتر عمل کنی؟ (چند گزینه می‌تونی انتخاب کنی)",
              required: true,
              options: [
                { value: "shorter_reply", label: "کوتاه‌تر جواب بدم" },
                { value: "more_formal", label: "خشک‌تر و شفاف‌تر جواب بدم" },
                {
                  value: "reply_later",
                  label: "دیرتر جواب بدم تا هیجانی واکنش ندم",
                },
                {
                  value: "only_main_topic",
                  label: "فقط به اصل موضوع جواب بدم",
                },
                {
                  value: "no_reply_if_not_needed",
                  label: "اگه لازم نبود، اصلاً جواب ندم",
                },
              ],
            },
          ],

          emotional_contact: [
            {
              id: "emotional_contact_type",
              type: "single_select",
              title: "این ارتباط یا چک‌کردن چطور اتفاق افتاد؟",
              required: true,
              options: [
                { value: "sent_message", label: "پیام دادم" },
                { value: "made_call", label: "تماس گرفتم" },
                {
                  value: "checked_profile",
                  label: "پروفایل یا استوری یا وضعیتش رو چک کردم",
                },
                {
                  value: "asked_someone_else",
                  label: "از طریق شخص دیگه‌ای پیگیری کردم",
                },
                {
                  value: "went_to_see",
                  label: "رفتم جایی که احتمال دیدنش بود",
                },
                { value: "other", label: "یه چیز دیگه" },
              ],
            },
            {
              id: "before_action_feeling",
              type: "multi_select",
              title:
                "قبل از انجامش، چه فکرها یا احساساتی بیشتر سراغت اومدند؟ (چند گزینه می‌تونی انتخاب کنی)",
              required: true,
              options: [
                { value: "missing", label: "دلتنگی" },
                { value: "anxiety", label: "اضطراب" },
                {
                  value: "fear_of_being_forgotten",
                  label: "ترس از فراموش شدن",
                },
                { value: "jealousy_comparison", label: "حسادت یا مقایسه" },
                { value: "anger", label: "خشم" },
                { value: "hope_for_return", label: "امید به برگشتن" },
                { value: "curiosity", label: "کنجکاوی" },
                { value: "loneliness", label: "تنهایی" },
              ],
            },
            {
              id: "what_were_you_seeking",
              type: "single_select",
              title: "لحظه‌ای که انجامش دادی، دنبال چه چیزی بودی؟",
              required: true,
              options: [
                { value: "calm_down", label: "آروم شدن" },
                { value: "get_attention", label: "گرفتن توجه" },
                { value: "know_their_status", label: "فهمیدن حال و وضعیت او" },
                {
                  value: "feel_important",
                  label: "مطمئن بشم که هنوز براش مهمم",
                },
                { value: "release_anger", label: "تخلیه خشم یا حرف ناگفته" },
                { value: "habit", label: "فقط از روی عادت انجامش دادم" },
              ],
            },
            {
              id: "feeling_after_action",
              type: "single_select",
              title: "بعد از انجامش چه حسی داشتی؟",
              required: true,
              options: [
                {
                  value: "short_relief_then_worse",
                  label: "آرامش کوتاه‌مدت، بعدش بدتر شدم",
                },
                { value: "regret", label: "پشیمون شدم" },
                { value: "shame_or_sadness", label: "شرمنده یا ناراحت شدم" },
                { value: "more_involved", label: "بیشتر درگیر شدم" },
                {
                  value: "more_attached",
                  label: "حس کردم دوباره وابسته‌تر شدم",
                },
                { value: "dont_know", label: "هنوز نمی‌دونم" },
              ],
            },
            {
              id: "did_it_help",
              type: "single_select",
              title: "آیا این کار واقعاً چیزی رو بهتر کرد؟",
              required: true,
              options: [
                {
                  value: "temporary_relief",
                  label: "نه، فقط حالم رو موقتاً آروم کرد",
                },
                { value: "made_it_worse", label: "نه، حتی بدترم کرد" },
                {
                  value: "slight_relief_unhealthy",
                  label: "کمی آروم شدم ولی می‌دونم راه سالمی نبود",
                },
                { value: "not_sure", label: "مطمئن نیستم" },
              ],
            },
            {
              id: "healthier_alternative",
              type: "multi_select",
              title:
                "اگه دوباره همین موج احساس بیاد، جایگزین سالم‌تر تو چیه؟ (چند گزینه رو می‌تونی انتخاب کنی)",
              required: true,
              options: [
                {
                  value: "wait_10_minutes",
                  label: "۱۰ دقیقه صبر می‌کنم و هیچ اقدامی نمی‌کنم",
                },
                {
                  value: "do_app_exercise",
                  label: "تکنیک چک نکردن پناهگاه رو انجام می‌دم",
                },
                {
                  value: "write_feelings",
                  label: "به جای ارتباط باهاش، احساساتم رو می‌نویسم",
                },
                {
                  value: "message_safe_person",
                  label: "به جای اون به یک آدم امن پیام می‌دم",
                },
                {
                  value: "put_phone_away",
                  label: "گوشی رو از دسترسم خارج می‌کنم",
                },
                {
                  value: "no_alternative_yet",
                  label: "هنوز جایگزین مشخصی ندارم",
                },
              ],
            },
          ],
        },
        guidanceByStatus: {
          no_contact: {
            message:
              "آفرین. امروز تو فقط «ارتباط نگرفتی»؛ امروز به مغزت یاد دادی که هر موج دلتنگی، دستور عمل نیست.\nهر روزی که ارتباط نمی‌گیری، وابستگی یک قدم ضعیف‌تر می‌شه و عزت‌نفست یک قدم قوی‌تر.",
            streakText:
              "امروز روز {streakCurrentDays} استمرار قطع ارتباط توست.",
            commitments: [
              "می‌پذیرم که وسوسه ممکنه بیاد، اما مجبور نیستم از اون اطاعت کنم.",
              "اگه تحریک شدم، قبل از هر اقدامی حداقل ۱۰ دقیقه صبر می‌کنم.",
              "امروز با چک‌کردن، پیام دادن یا بهانه‌سازی، زنجیره‌ استمرارم رو خراب نمی‌کنم.",
              "به جای برگشتن به رابطه قبلی، روی ترمیم خودم تمرکز می‌کنم.",
            ],
          },

          necessary_contact: {
            message:
              "خوب عمل کردی که فرق «ارتباط ضروری» و «ارتباط عاطفی» رو جدی گرفتی.\nهدف این نیست که از واقعیت فرار کنی؛ هدف اینه که اجازه ندی ضرورت، تبدیل به بهونه‌ای برای وابستگی بشه.",
            streakText:
              "استمرار قطع ارتباط عاطفی تو هنوز حفظ شده.\nامروز روز {streakCurrentDays} این استمراره.",
            commitments: [
              "ارتباط ضروری رو فقط در حد موضوع اصلی نگه می‌دارم.",
              "توضیح اضافه، شوخی عاطفی، کنایه، درد دل یا صمیمیت وارد مکالمه نمی‌کنم.",
              "اگه اون خواست مکالمه رو احساسی‌تر یا طولانی‌تر کنه، وارد بازی نمی‌شم.",
              "اگه رفتار تحریک‌کننده یا آزاردهنده‌ای دیدم، مقابله‌به‌مثل نمی‌کنم؛ چون شأن من با واکنش هیجانی پایین میاد.",
              "رابطه تموم‌شده رو با دوستی، پیگیری، توجه‌دادن یا توجه‌گرفتن زنده نگه نمی‌دارم.",
              "اگه ارتباط واقعاً ضروری نبود، جواب ندادن هم یک جواب سالمه.",
            ],
            closingNote:
              "بی‌توجهی آگاهانه، گاهی قوی‌ترین پاسخه. لازم نیست به هر تحریک، واکنش نشان بدی.",
          },

          emotional_contact: {
            useBackendResult: true,
            fallback: {
              message:
                "ممنون از صداقتت؛ برای امروز ارتباط یا چک‌کردن هیجانی ثبت شد. این صداقت رو حفظ کن و نذار این لغزش ادامه پیدا کنه.",
              streakText: "وضعیت استمرار تو بعد از ثبت نهایی مشخص میشه.",
              commitments: [
                "می‌پذیرم که این رفتار از روی نیاز هیجانی بود، نه ضرورت واقعی.",
                "تا ۲۴ ساعت آینده دوباره این رفتار رو تکرار نمی‌کنم.",
              ],
            },
            promise_required: {
              message:
                "برای امروز یک لغزش ثبت شد، اما هنوز شکست کامل نیست.\nمهم‌ترین کار الان این نیست که خودت رو له کنی؛ مهم‌ترین کار اینه که همین‌جا زنجیره لغزش رو قطع کنی.\nامروز امتیاز این اقدام،  به تو تعلق نمی‌گیره، اما استمرار تو فعلاً  پاک نمیشه و بهت فرصت جبران داده میشه .",
              streakText:
                "تو هنوز در روز {streakCurrentDays} استمرار قطع ارتباط هستی.\nاین فرصت رو جدی بگیر.",
              commitments: [
                "قبول دارم این ارتباط از روی نیاز عاطفی یا هیجانی بود، نه ضرورت واقعی.",
                "قول می‌دم امروز دوباره پیام، تماس، چک‌کردن یا پیگیری انجام ندم.",
                "اگه موج دلتنگی برگشت، قبل از هر اقدامی ۱۰ دقیقه صبر می‌کنم.",
                "به جای رفتن سمت اون، احساساتم رو در پناهگاه یا روی کاغذ تخلیه می‌کنم.",
                "می‌پذیرم که آرامش کوتاه‌مدت، ارزش خراب‌کردن روند درمانم رو نداره.",
              ],
            },
            serious_warning: {
              message:
                "این دومین لغزش جدی توئه.\nهنوز فرصت داری جلوی شکستن کامل استمرار رو بگیری، اما دیگه نباید با این موضوع ساده برخورد کنی.\nهر بار ارتباط هیجانی، مغزت رو دوباره به همون چرخه وابستگی برمی‌گردونه.\nامتیاز این اقدام امروز، به تو تعلق نمی‌گیره.",
              streakText:
                "تو هنوز در روز {streakCurrentDays} استمرار هستی، اما این استمرار در خطر بسیار جدی قرار داره.",
              commitments: [
                "می‌پذیرم که ادامه این رفتار، استمرارم رو می‌شکنه.",
                "تا ۲۴ ساعت آینده هیچ نوع پیام، تماس، چک‌کردن یا پیگیری انجام نمی‌دم.",
                "اگه تحریک شدم، گوشی رو از دسترسم خارج می‌کنم یا محیطم رو عوض می‌کنم.",
                "به خودم اجازه نمی‌دم با بهونه‌هایی مثل «فقط ببینم حالش چطوره» وارد چرخه اشتباه بشم.",
                "اگه لازم شد، از یک آدم امن یا تکنیک‌های پناهگاه کمک می‌گیرم، نه از رابطه قبلی.",
              ],
            },
            reset: {
              message:
                "استمرار قطع ارتباط تو شکسته شد.\nاین اتفاق نباید می‌افتاد، اما حالا که افتاده، خطر بزرگ‌تر اینه که بگی «دیگه خراب شد» و چند روز پشت‌سرهم ادامه بدی.\nشکست واقعی این نیست که امروز لغزیدی؛ شکست واقعی اینه که از فردا دوباره شروع نکنی.",
              streakText:
                "شمارنده استمرار تو از نو شروع میشه.\nامروز نقطه شروع دوباره‌ست.",
              commitments: [
                "قبول دارم که استمرارم شکسته شد، اما درمانم تموم نشده.",
                "از همین امروز دوباره شروع می‌کنم، نه از هفته بعد و نه بعد از یک لغزش دیگه.",
                "تا ۲۴ ساعت آینده هیچ ارتباط یا چک‌کردن هیجانی انجام نمی‌دم.",
                "محرک اصلی لغزش امروز رو جدی می‌گیرم و براش برنامه می‌ذارم.",
                "اگه دوباره وسوسه شدم، قبل از هر اقدامی از ابزارهای ققنوس کمک می‌گیرم.",
              ],
            },
          },
        },
        finalStep: {
          message:
            "قبل از ثبت نهایی، چند تعهد کوتاه رو تأیید کن. این‌ها برای محافظت از خودت در ۲۴ ساعت آینده‌اند.",
          commitments: [
            "جواب‌هام رو صادقانه ثبت کردم.",
            "می‌دونم هدف این اقدام تنبیه من نیست؛ هدفش کمک به قطع چرخه وابستگیه.",
            "برای ۲۴ ساعت آینده از مرز قطع ارتباط محافظت می‌کنم.",
            "اگه تحریک شدم، قبل از هر اقدامی مکث می‌کنم.",
          ],
          submitLabel: "ثبت نهایی وضعیت امروز",
        },

        options: [
          {
            key: "none",
            label: "امروز هیچ ارتباط یا چک‌کردن هیجانی نداشتم",
            helpText:
              "نه پیام احساسی دادم، نه چک کردم، نه از روی دلتنگی دنبالش رفتم.",
          },
          {
            key: "role_based",
            label: "فقط ارتباط ضروری و اجباری داشتم",
            helpText:
              "مثل کار، فرزند مشترک، همکلاسی، همسایه،بررسی بالغانه امکان برگشت به رابطه، شراکت یا هر ارتباط ضروری دیگه.",
          },
          {
            key: "emotional",
            label: "امروز ارتباط یا چک‌کردن هیجانی داشتم",
            helpText:
              "مثل چک کردن استوری، پروفایل، دادن پیام احساسی، تماس از روی دلتنگی یا هر رفتار مغایر با درمان.",
          },
        ],
        noteField: {
          key: "noContactNote",
          label: "اگه خواستی کوتاه توضیح بده",
          placeholder:
            "مثلاً: استوریش رو چک کردم یا برای موضوع کاری حرف زدیم یا از روی دلتنگی پیام دادم...",
          multiline: true,
          required: false,
        },
        encouragements: {
          safe: "آفرین. امروز زنجیره قطع تماس رو حفظ کردی. همین ثبات‌های کوچیک هستند که ذهن و بدن رو از وابستگی بیرون میارن.",
          roleBased:
            "این ارتباط ضروری تخلف درمانی حساب نمی‌شه، اما مراقب باش رابطه از مسیر نقش‌محور وارد فضای احساسی نشه.",
          relapse:
            "لغزش امروز به معنی شکست کامل نیست. فقط یعنی هنوز یک محرک فعاله. امشب خودت رو تنبیه نکن؛ مسیر چک‌کردن رو ببند، پیام جبرانی نفرست، و اگه لازم شد از پناهگاه کمک بگیر.",
        },
      },
    },
    {
      code: "sookhtan_day8_night_routine",
      titleFa: "روتین شبانگاهی",
      template: "routine_flow",
      variant: "night",
      required: true,
      completionRule: {
        type: "all_steps_completed",
      },
      steps: [
        {
          key: "night_mood_score",
          stepType: "mood_scale",
          title: "حال کلی امشب",
          instruction:
            "قبل از شروع روتین شبانگاهی، از ۱ تا ۱۰ مشخص کن الان حالت چطوره.",
          required: true,
          min: 1,
          max: 10,
        },
        {
          key: "night_mood_audio",
          stepType: "conditional_audio",
          title: "فایل متناسب با حال امشب",
          instruction:
            "بر اساس امتیازی که دادی، فایل مناسب حالت پخش می‌شه. کامل گوش بده و بعد برو مرحله بعد.",
          required: true,
          sourceScoreKey: "night_mood_score",
          variants: [
            {
              min: 1,
              max: 5,
              audioKey: AUDIO_KEYS.sookhtan.day08.nightMeditationMood1To5,
              title: "آرام‌سازی برای حال پایین",
            },
            {
              min: 6,
              max: 10,
              audioKey: AUDIO_KEYS.sookhtan.day08.nightMeditationMood6To10,
              title: "آرام‌سازی برای حال بهتر",
            },
          ],
        },
        {
          key: "night_day_review",
          stepType: "multi_text_with_score",
          title: "مرور روز",
          instruction:
            "چند دقیقه با صداقت روزت رو مرور کن. احساسات، افکار مزاحم و اتفاقات امروزت رو بنویس و در پایان از ۱ تا ۲۰ به روزت نمره بده. این نمره برای نمودار پیشرفت روزانه ذخیره می‌شه.",
          required: true,
          fields: [
            {
              key: "felt_today",
              label: "امروز چه احساساتی رو تجربه کردی؟",
              placeholder:
                "مثلاً: دلتنگی، خشم، بی‌حوصلگی، آرامش، امید، اضطراب...",
              required: true,
              multiline: true,
            },
            {
              key: "disturbing_thoughts",
              label: "چه افکار مزاحمی داشتی؟",
              placeholder:
                "افکاری که امروز زیاد برگشتند یا اذیتت کردند رو بنویس...",
              required: true,
              multiline: true,
            },
            {
              key: "what_happened_today",
              label: "امروز چه اتفاقاتی افتاد؟",
              placeholder: "مهم‌ترین اتفاقات امروزت رو کوتاه یا کامل بنویس...",
              required: true,
              multiline: true,
            },
            {
              key: "day_overview",
              label: "روزت به چه شکل بود؟",
              placeholder: "یک جمع‌بندی از حال‌وهوای امروزت بنویس...",
              required: true,
              multiline: true,
            },
          ],
          scoreField: {
            key: "night_day_score",
            label:
              "به کل روزت از ۱ تا ۲۰ چه نمره‌ای می‌دی؟ نمره واقع‌بینانه بده نه بدبینانه!",
            min: 1,
            max: 20,
          },
        },
        {
          key: "positive_actions",
          stepType: "repeatable_text_list",
          title: "کارهای مثبت امروز",
          instruction:
            "هر کار مثبتی که امروز انجام دادی بنویس؛ حتی اگه خیلی کوچیک و ساده بوده. خوردن غذا سر وقت، بلند شدن از تخت، مرتب کردن یک بخش کوچیک از اتاق، انجام دادن یه کار عقب‌افتاده یا مراقبت از بدن هم کار مثبت حساب می‌شه.",
          required: true,
          itemLabel: "کار مثبت",
          minItems: 1,
        },
        {
          key: "gratitude_audio",
          stepType: "audio_with_text",
          title: "شکرگزاری شب",
          instruction:
            "اول فایل صوتی شکرگزاری رو کامل گوش بده. بعد چند موردی رو که امشب بابتشون شکرگزار هستی رو بنویس.",
          required: true,
          audioKey: AUDIO_KEYS.sookhtan.day08.gratitude,
          textField: {
            key: "gratitude_notes",
            label: "موارد شکرگزاری امشب",
            placeholder:
              "مثلاً: بابت اینکه امروز ادامه دادم، شکرگزارم بابت سلامتیم، شکرگزارم بابت زیباییم، شکرگزارم بابت اتفاق کوچیکی که امروز افتاد...",
            multiline: true,
          },
        },
        {
          key: "sleep_stretch",
          stepType: "timer_audio",
          title: "حرکات کششی و ماساژ قبل از خواب",
          instruction:
            "فایل صوتی رو پخش کن و همراه راهنمایی‌ها، حرکات کششی و ماساژ آروم قبل از خواب رو انجام بده. قرار نیست سخت یا حرفه‌ای باشه؛ فقط بدن رو از تنش روز رها کن.",
          required: true,
          audioKey: AUDIO_KEYS.sookhtan.day08.nightStretchMeditation,
        },
        {
          key: "pre_sleep_meditation",
          stepType: "audio_with_text",
          title: "مراقبه قبل از خواب",
          instruction:
            "فایل مراقبه آرام‌سازی و تخلیه افکار مزاحم رو گوش بده. بعد از پایان مراقبه، افکاری رو که حین مراقبه به ذهنت اومد بنویس تا از ذهنت بیرون بیاد و روی صفحه قرار بگیره.",
          required: true,
          audioKey: AUDIO_KEYS.sookhtan.day08.beforeSleepMeditation,
          textField: {
            key: "meditation_intrusive_thoughts",
            label: "افکار مزاحم حین مراقبه",
            placeholder: "هر فکری که وسط مراقبه اومد رو بدون سانسور بنویس...",
            multiline: true,
          },
        },
        {
          key: "sleep_meditation_final",
          stepType: "sleep_audio",
          title: "مراقبه خواب",
          instruction:
            "در جای خوابت دراز بکش، فایل مراقبه خواب رو پخش کن و اجازه بده بدنت آروم‌آروم وارد خواب بشه. وقتی فایل تموم شد، این مرحله کامل میشه.",
          required: true,
          audioKey: AUDIO_KEYS.sookhtan.day08.sleepMeditation,
          ctaLabel: "فعالساز خواب",
          fallbackStepKey: "sleep_help",
          manualCompleteLabel: "انجام شد",
        },
        {
          key: "sleep_help",
          stepType: "sleep_reset",
          title: "فعالساز خواب",
          instruction:
            "توو روزهای اول بهم ریختن خواب کاملا طبیعیه پس اگه هنوز بیداری، قرار نیست با زور خودت رو بخوابونی. چند روز دیگه با ادامه این مسیر خوابت تنظیم میشه ولی الان فقط یکی از کارهای آروم و ساده پایین رو انتخاب کن، چند دقیقه انجامش بده، و بعد دوباره به مراقبه خواب برگرد و مراقبه خواب رو تکرار کن.",
          introTitle: "الان هدف خوابیدن نیست",
          introBody:
            "هدف فقط اینه که بدنت از تقلا و بیداریِ عصبی فاصله بگیره. همچنان نور محیط رو کم نگه دار، سراغ موبایل نرو، و فقط یک کار ساده و خنثی انجام بده تا کمک کنه شرایط خواب در درونت فعال بشه؛ سعی کن از جات بلند بشی و کنار جات این کارهارو انجام بدی.",
          backStepKey: "sleep_meditation_final",
          backButtonLabel: "برگشت به مراقبه خواب",
          activities: [
            {
              id: "dim_light_breathing",
              label: "۲ دقیقه فقط توو نور کم بشین و آروم نفس بکش",
              durationSeconds: 120,
              hint: "فقط دم و بازدم رو دنبال کن؛ لازم نیست چیزی رو درست کنی.",
            },
            {
              id: "drink_water",
              label: "۲ دقیقه چند جرعه آب بخور و آروم روی یک سطح خنک وایسا",
              durationSeconds: 120,
              hint: "بدون عجله و بدون چک کردن گوشی.",
            },
            {
              id: "sit_somewhere_else",
              label:
                "۳ دقیقه روی صندلی یا کنار تخت در نور کم بشین و به ساعت دیواری نگاه کن",
              durationSeconds: 180,
              hint: "فقط از تخت فاصله بگیر تا بدنت کمی ریست بشه.",
            },
            {
              id: "read_simple_book",
              label: "۵ دقیقه چند صفحه از یک کتاب رو بخون",
              durationSeconds: 300,
              hint: "ترجیحا محتواش هیجانی نباشه.",
            },
            {
              id: "brain_unload",
              label: "۳ دقیقه فکرهای مزاحم خودت رو روی کاغذ بنویس",
              durationSeconds: 180,
              hint: "فکرهات رو فقط خالی کن، تحلیل نکن.",
            },
            {
              id: "light_stretch",
              label: "۳ دقیقه کشش بدنی خیلی سبک انجام بده",
              durationSeconds: 180,
              hint: "حرکت‌ها باید آروم و بدون فشار باشن.",
            },
            {
              id: "wash_face",
              label: "۳ دقیقه صورتت رو بشور و آروم برگرد",
              durationSeconds: 180,
              hint: "بدون روشن کردن نور زیاد.",
            },
            {
              id: "stand_and_breathe",
              label: "۲ دقیقه بایست و شانه‌هات رو رها کن",
              durationSeconds: 120,
              hint: "فقط بدنت را از انقباض خارج کن.",
            },
            {
              id: "slow_walk_home",
              label: "۳ دقیقه خیلی آروم توو خونه قدم بزن",
              durationSeconds: 180,
              hint: "بی‌هدف، آروم، بدون فکر کردن به خواب.",
            },
            {
              id: "gaze_and_breathe",
              label: "۲ دقیقه به یک نقطه ثابت نگاه کن و نفس عمیق بکش",
              durationSeconds: 120,
              hint: "اجازه بده ذهن آروم‌آروم از شلوغی فاصله بگیره.",
            },
            {
              id: "wash_unwashed_dishes",
              label: "۵ دقیقه چند تا ظرف نشسته رو آروم بشور",
              durationSeconds: 300,
              hint: "فقط چند ظرف ساده رو بشور؛ نور رو اصلا زیاد نکن و دنبال تمیزکاری کامل نباش.",
            },
            {
              id: "organize_closet_clothes",
              label: "۵ دقیقه چند لباس داخل کمد رو مرتب کن",
              durationSeconds: 300,
              hint: "فقط چند تکه لباس رو مرتب کن؛ قرار نیست کل کمد رو مرتب کنی.",
            },
            {
              id: "clean_shoes",
              label: "۴ دقیقه کفش‌هات رو خیلی ساده تمیز کن",
              durationSeconds: 240,
              hint: "آروم و بدون وسواس؛ فقط یک تمیزکاری سبک و خنثی رو انجام بده.",
            },
            {
              id: "calm_goal_visualization",
              label: "۳ دقیقه به یک هدف ساده فکر کن و تصویر آرومش رو بساز",
              durationSeconds: 180,
              hint: "برنامه‌ریزی نکن؛ فقط یک تصویر ساده، امن و آروم ازش توی ذهنت بساز.",
            },
          ],
        },
      ],
    },
  ],
};
