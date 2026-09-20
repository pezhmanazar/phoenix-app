//phoenix-app\components\pelekan\sookhtan\day3-config.ts
import { AUDIO_KEYS } from "@/constants/media";
import type { DayConfig } from "../daily/types";

export const sookhtanDay3Config: DayConfig = {
  dayCode: "sookhtan_day3",
  stageCode: "sookhtan",
  dayNumber: 3,
  titleFa: "روز سوم سوختن",

  requiredTaskCodes: [
    "sookhtan_day3_feelings_log",
    "sookhtan_day3_morning_routine",
    "sookhtan_day3_daily_commitment",
    "sookhtan_day3_daily_meditation",
    "sookhtan_day3_torch",
    "sookhtan_day3_technique_1",
    "sookhtan_day3_no_contact_check",
    "sookhtan_day3_night_routine",
  ],
  tasks: [
    {
      code: "sookhtan_day3_feelings_log",
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
      code: "sookhtan_day3_morning_routine",
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
          sourceTaskCode: "sookhtan_day3_feelings_log",
          variants: [
            {
              min: 1,
              max: 5,
              audioKey: AUDIO_KEYS.sookhtan.day03.morningMeditationMood1To5,
              title: "مراقبه برای حال پایین",
            },
            {
              min: 6,
              max: 10,
              audioKey: AUDIO_KEYS.sookhtan.day03.morningMeditationMood6To10,
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
          audioKey: AUDIO_KEYS.sookhtan.day03.sunMeditation,
          required: true,
        },
        {
          key: "morning_stretch",
          stepType: "timer_audio",
          title: "حرکات کششی صبحگاهی",
          instruction:
            "هم‌زمان با راهنمایی‌ صوتی، چند حرکت کششی آروم و سبک انجام بده.",
          audioKey: AUDIO_KEYS.sookhtan.day03.morningStretchMeditation,
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
              id: "reminder_emotion_wave",
              label:
                "احساسات شدید مثل موج‌اند؛ بالا می‌رن و دوباره پایین میان.",
            },
            {
              id: "reminder_no_action_needed",
              label: "هر احساسی نیاز به واکنش یا اقدام نداره.",
            },
            {
              id: "reminder_stay_with_self",
              label: "وقتی حالم بد می‌شه، می‌تونم کنار خودم بمونم.",
            },
          ],
          placeholder:
            "مثلاً: امروز وقتی موج دلتنگی یا ناراحتی میاد، به خودم فرصت می‌دم تا ازش عبور کنم.",
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
      code: "sookhtan_day3_daily_commitment",
      titleFa: "تعهد روزانه",
      template: "commitment",
      required: true,
      completionRule: {
        type: "commitment",
        requiredChecked: "all",
        requiredTypedConfirmations: [
          {
            key: "confirm_1",
            exactText: "امروز هر احساسی رو به عمل تبدیل نمی‌کنم",
          },
          {
            key: "confirm_2",
            exactText: "امروز قبل از واکنش هیجانی مکث می‌کنم",
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
            text: "امروز هر احساس شدیدی رو دستورِ عمل تلقی نمی‌کنم",
          },
          {
            id: "c8",
            text: "اگه موج دلتنگی، خشم یا اضطراب اومد، قبل از هر واکنش هیجانی مکث می‌کنم",
          },
          {
            id: "c9",
            text: "امروز به جای دنبال کردن فکرهای مزاحم، توجهم رو دوباره به کاری که در لحظه انجام می‌دم برمی‌گردونم",
          },
        ],
      },
    },

    {
      code: "sookhtan_day3_safe_place",
      titleFa: "پناهگاه",
      template: "reminder",
      required: false,
      completionRule: { type: "manual" },
      meta: {
        submitLabel: "متوجه شدم",
      },
    },
    {
      code: "sookhtan_day3_daily_meditation",
      titleFa: "مراقبه اختصاصی روز",
      template: "audio_reflection",
      required: true,
      completionRule: {
        type: "required_fields_and_steps",
        requiredFields: ["meditationNotes"],
        requiredSteps: ["audio_completed", "breathing_completed"],
      },
      meta: {
        audioKey: AUDIO_KEYS.sookhtan.day03.specialMeditation,
        submitLabel: "ثبت مراقبه",
      },
    },
    {
      code: "sookhtan_day3_feel_good_task",
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
          "قرار نیست با انجام این کار یک‌دفعه حالت عالی بشه. فقط می‌خوایم برای چند دقیقه از فشار ذهنی فاصله بگیری و به بدن و ذهنت فرصت نفس کشیدن بدی. از بین گزینه‌های زیر کاری رو انتخاب کن که امروز انجام دادنش برات راحت‌تر و دلپذیرتره.",
        activityPlaceholder:
          "اگه کار حال خوب‌کن تو داخل لیست نیست، اینجا بنویس...",
        timerTitle: "برای انجام این کار، یک بازه زمانی تعیین کن",
        reminderTitle: "یادآوری‌های ادامه روز",
        activities: [
          "شنیدن دو یا سه آهنگ حال خوب‌کن",
          "دیدن یک قسمت از یک سریال سبک و حال خوب‌کن",
          "دیدن یک کارتون یا برنامه کوتاه سرگرم‌کننده",
          "گوش دادن به یک پادکست آرام یا سرگرم‌کننده",
          "گرفتن یک دوش کوتاه",
          "قدم زدن در هوای آزاد",
          "خوردن یک نوشیدنی یا میان‌وعده‌ای که دوست دارم",
          "نشستن چند دقیقه در نور آفتاب یا هوای آزاد",
          "مرتب کردن یک بخش کوچک از اتاق یا خونه",
          "پوشیدن لباس راحت یا لباسی که توش حس خوبی دارم",
          "تماس یا گفت‌وگوی کوتاه با یک آدم امن",
          "خوندن چند صفحه از یک کتاب",
          "انجام چند حرکت کششی سبک",
          "رسیدگی کوتاه به ظاهر یا مراقبت شخصی",
          "انجام یک سرگرمی یا کار موردعلاقه",
        ],
        reminders: [
          "برای خواب بهتر، از عصر به بعد مصرف چای، قهوه و نوشابه‌های انرژی‌زا رو کمتر کن.",
          "غذای شب رو تا جای ممکن حداقل دو ساعت قبل از خواب بخور.",
          "امشب برای بهتر شدن حالت سراغ پروفایل، پیام‌ها، عکس‌ها یا خاطره‌بازی نرو.",
          "اگه ذهنت شلوغ شد، لازم نیست همون لحظه همه‌چیز رو حل کنی؛ چند دقیقه به یک کار ساده و آروم برگرد.",
          "از شب به بعد نور محیط رو کمتر کن تا بدنت کم‌کم برای خواب آماده بشه.",
          "قبل از خواب وارد بحث یا گفت‌وگوی احساسی سنگین نشو.",
        ],
        minTimerSeconds: 300,
        maxTimerSeconds: 3600,
        defaultTimerSeconds: 900,
      },
    },
    {
      code: "sookhtan_day3_torch",
      titleFa: "مشعل روز سوم",
      template: "quiz_audio",
      required: true,
      completionRule: {
        type: "quiz_pass",
        passingScorePercent: 70,
        requireAudioCompleted: true,
      },
      meta: {
        audioKey: AUDIO_KEYS.mashaal.lesson03,
        submitLabel: "ثبت درس امروز",
        questions: [
          {
            id: "q1",
            type: "true_false",
            prompt:
              "بعد از پایان یک رابطه، ممکنه آدم فقط برای خودِ طرف مقابل سوگوار نباشه و برای آینده‌ای که با اون تصور کرده هم سوگواری کنه.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "true",
          },
          {
            id: "q2",
            type: "true_false",
            prompt: "از دست دادن رابطه و از دست دادن خود دقیقاً یک معنی دارن.",
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
              "بعد از جدایی، خاطره‌ها لزوماً از بین نمی‌رن و حتی ممکنه بعضی از اون‌ها پررنگ‌تر بشن.",
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
              "اگه بعد از جدایی احساس کنی خودت رو گم کردی، یعنی هویتت برای همیشه از بین رفته و قابل بازسازی نیست.",
            options: [
              { id: "true", text: "صحیح" },
              { id: "false", text: "غلط" },
            ],
            correctOptionId: "false",
          },
          {
            id: "q5",
            type: "multiple_choice",
            prompt:
              "طبق این درس، چرا درد جدایی گاهی خیلی عمیق و گیج‌کننده می‌شه؟",
            options: [
              {
                id: "a",
                text: "چون بعد از جدایی تمام خاطرات رابطه از بین می‌رن",
              },
              {
                id: "b",
                text: "چون ممکنه همزمان فرد، عادت‌ها، نقش‌ها، امنیت و تصویر آینده رو از دست بدیم",
              },
              {
                id: "c",
                text: "چون بعد از هر جدایی تمام بخش‌های زندگی تغییر می‌کنن",
              },
              {
                id: "d",
                text: "چون آدم بعد از جدایی دیگه نمی‌تونه به زندگی عادی برگرده",
              },
            ],
            correctOptionId: "b",
          },
          {
            id: "q6",
            type: "multiple_choice",
            prompt: "منظور از سوگواری برای «آینده تصورشده» چیه؟",
            options: [
              {
                id: "a",
                text: "ناراحت شدن فقط برای خاطراتی که قبلاً اتفاق افتادن",
              },
              {
                id: "b",
                text: "تلاش برای پیش‌بینی اینکه طرف مقابل در آینده چه کار می‌کنه",
              },
              {
                id: "c",
                text: "سوگواری برای برنامه‌ها و تجربه‌هایی که تصور می‌کردیم با اون فرد خواهیم داشت",
              },
              {
                id: "d",
                text: "تصمیم گرفتن برای شروع سریع یک رابطه جدید",
              },
            ],
            correctOptionId: "c",
          },
          {
            id: "q7",
            type: "multiple_choice",
            prompt: "از دست دادن «نقش» بعد از جدایی به کدوم تجربه اشاره داره؟",
            options: [
              {
                id: "a",
                text: "از دست دادن جایگاهی که در زندگی طرف مقابل داشتیم",
              },
              {
                id: "b",
                text: "فراموش کردن اتفاقات رابطه",
              },
              {
                id: "c",
                text: "تغییر کردن شغل بعد از جدایی",
              },
              {
                id: "d",
                text: "از دست دادن توانایی برقراری رابطه با دیگران",
              },
            ],
            correctOptionId: "a",
          },
          {
            id: "q8",
            type: "multiple_choice",
            prompt:
              "طبق این درس، «از دست دادن خود» بعد از یک رابطه بیشتر به چه معناست؟",
            options: [
              {
                id: "a",
                text: "اینکه فرد دیگه هیچ شخصیتی نداره",
              },
              {
                id: "b",
                text: "اینکه فرد تمام خاطرات قبل از رابطه رو فراموش کرده",
              },
              {
                id: "c",
                text: "اینکه فرد احساس می‌کنه بخشی از هویت، علایق، مرزها یا حس ارزشمندی خودش رو گم کرده",
              },
              {
                id: "d",
                text: "اینکه فرد باید شخصیت کاملاً جدیدی برای خودش بسازه",
              },
            ],
            correctOptionId: "c",
          },
          {
            id: "q9",
            type: "multiple_choice",
            prompt:
              "اگه بخش زیادی از درد جدایی مربوط به از دست دادن خودت باشه،چه کاری اهمیت بیشتری پیدا می‌کنه؟",
            options: [
              {
                id: "a",
                text: "فهمیدن اینکه طرف مقابل الان درباره تو چه فکری می‌کنه",
              },
              {
                id: "b",
                text: "برگردوندن سریع رابطه برای پر کردن جای خالی",
              },
              {
                id: "c",
                text: "دوباره پیدا کردن علایق، نیازها، مرزها و بخش‌های فراموش‌شده خودت",
              },
              {
                id: "d",
                text: "پاک کردن تمام خاطرات مربوط به رابطه",
              },
            ],
            correctOptionId: "c",
          },
          {
            id: "q10",
            type: "multiple_choice",
            prompt: "کدوم سؤال بیشتر با پیام اصلی این درس هماهنگه؟",
            options: [
              {
                id: "a",
                text: "چطور کاری کنم که حتماً برگرده؟",
              },
              {
                id: "b",
                text: "چطور همه خاطرات رابطه رو سریع فراموش کنم؟",
              },
              {
                id: "c",
                text: "چطور بفهمم هنوز به من فکر می‌کنه یا نه؟",
              },
              {
                id: "d",
                text: "من دقیقاً چه چیزهایی رو از دست دادم و کدوم بخش از خودم رو باید دوباره پیدا کنم؟",
              },
            ],
            correctOptionId: "d",
          },
        ],
      },
    },

    {
      code: "sookhtan_day3_technique_1",
      titleFa: "زیر این حال بد چه احساسی هست؟",
      descriptionFa:
        "گاهی بعد از جدایی فقط می‌دونیم «حالم بده»، اما این حال بد می‌تونه ترکیبی از چند احساس متفاوت باشه. در این تمرین، احساساتت رو از هم جدا می‌کنی تا بفهمی دقیقاً چه چیزی درونت می‌گذره.",
      template: "routine_flow",
      required: true,
      completionRule: {
        type: "all_steps_completed",
      },
      meta: {
        submitLabel: "ثبت احساسات",
      },
      steps: [
        {
          key: "recent_emotional_moment",
          stepType: "text_input",
          title: "یک لحظه سخت اخیر",
          instruction:
            "یک موقعیت از یکی دو روز اخیر رو انتخاب کن که ناگهان حالت بد شد یا احساس شدیدی پیدا کردی. فقط همون موقعیت رو کوتاه و ساده بنویس.",
          placeholder:
            "مثلاً: شب وقتی تنها شدم یادش افتادم / یک زوج رو دیدم / یه آهنگ شنیدم / فکر کردم شاید الان با کس دیگه‌ای باشه.",
          multiline: true,
          required: true,
        },
        {
          key: "first_emotions",
          stepType: "text_input",
          title: "اولین احساس‌ها",
          instruction:
            "به جای نوشتن «حالم بد شد»، اسم احساس‌هایی رو که در اون لحظه تجربه کردی بنویس. ممکنه هم‌زمان چند احساس متفاوت داشته باشی.",
          placeholder:
            "مثلاً: غم، دلتنگی، خشم، ترس، حسادت، تنهایی، شرم، ناامیدی، اضطراب، حسرت یا احساس طردشدگی.",
          multiline: true,
          required: true,
        },
        {
          key: "thoughts_behind_emotions",
          stepType: "text_input",
          title: "فکری که همراه احساس اومد",
          instruction:
            "حالا بنویس وقتی این احساس‌ها فعال شدن، چه فکر یا جمله‌ای از ذهنت گذشت. فکر رو با احساس اشتباه نکن؛ مثلاً «من کافی نبودم» یک فکره و «غم» یا «شرم» یک احساس.",
          placeholder:
            "مثلاً: اون بدون من خوشحاله / دیگه کسی رو پیدا نمی‌کنم / من کافی نبودم / همه‌چیز رو از دست دادم / نباید این‌طوری تموم می‌شد.",
          multiline: true,
          required: true,
        },
        {
          key: "deeper_emotion",
          stepType: "text_input",
          title: "یک لایه عمیق‌تر",
          instruction:
            "حالا از خودت بپرس: «اگه این فکر برای من واقعی باشه، چه چیزی در اون این‌قدر دردناکه؟» ببین زیر احساس اولیه، احساس عمیق‌تری وجود داره یا نه.",
          placeholder:
            "مثلاً: اول فکر کردم فقط دلتنگم، اما زیر دلتنگی ترس از تنها موندن بود / پشت خشمم احساس طردشدگی بود / پشت حسادتم احساس کافی نبودن بود.",
          multiline: true,
          required: true,
        },
        {
          key: "body_location",
          stepType: "text_input",
          title: "این احساس رو کجای بدنت حس می‌کنی؟",
          instruction:
            "برای چند لحظه به بدنت توجه کن. وقتی این احساس فعال می‌شه، بیشتر کجای بدنت و به چه شکلی متوجهش می‌شی؟",
          placeholder:
            "مثلاً: فشار روی سینه، گرفتگی گلو، سنگینی شکم، بی‌قراری دست‌ها، گرگرفتگی صورت، سنگینی بدن یا تند شدن ضربان قلب.",
          multiline: true,
          required: true,
        },
        {
          key: "emotion_need",
          stepType: "text_input",
          title: "این احساس به چی نیاز داره؟",
          instruction:
            "اگه قرار نباشه فوراً احساس رو خاموش کنی، فکر کن این بخش از تو الان به چه چیزی نیاز داره. منظور این نیست که طرف مقابل باید این نیاز رو برآورده کنه.",
          placeholder:
            "مثلاً: آرامش، امنیت، استراحت، شنیده شدن، حمایت، مهربانی با خودم، فاصله گرفتن از محرک یا بودن کنار یک آدم امن.",
          multiline: true,
          required: true,
        },
        {
          key: "emotion_summary",
          stepType: "text_input",
          title: "اسم واقعی حال بدت",
          instruction:
            "حالا جمله «حالم بده» رو کنار بذار و با چیزی که فهمیدی، حالت رو دقیق‌تر توصیف کن.",
          placeholder:
            "مثلاً: امروز بیشتر از اینکه فقط دلتنگ باشم، از تنها موندن می‌ترسم و از اینکه احساس می‌کنم جایگزین شدم غمگینم.",
          multiline: true,
          required: true,
        },
      ],
    },

    {
      code: "sookhtan_day3_technique_2",
      titleFa: "نامه از زبان احساسم",
      descriptionFa:
        "گاهی وقتی به جای جنگیدن با یک احساس اجازه می‌دیم چند دقیقه حرف بزنه، بهتر می‌فهمیم چرا هنوز درون ما فعاله. در این تمرین، یکی از احساسات پررنگ امروزت رو انتخاب می‌کنی و برای چند دقیقه از زبان همون احساس می‌نویسی.",
      template: "routine_flow",
      required: false,
      completionRule: {
        type: "all_steps_completed",
      },
      meta: {
        submitLabel: "ثبت نامه احساس",
      },
      steps: [
        {
          key: "selected_emotion",
          stepType: "text_input",
          title: "انتخاب احساس",
          instruction:
            "از بین احساساتی که امروز پیدا کردی، یکی رو انتخاب کن که از بقیه پررنگ‌تر یا سنگین‌تره.",
          placeholder:
            "مثلاً: غم، خشم، ترس، دلتنگی، حسادت، تنهایی، شرم یا حسرت.",
          multiline: true,
          required: true,
        },
        {
          key: "emotion_voice",
          stepType: "text_input",
          title: "اگه احساست می‌تونست حرف بزنه",
          instruction:
            "حالا تصور کن این احساس می‌تونه مستقیم با تو حرف بزنه. جمله رو با «من ... هستم و اومدم چون...» شروع کن و بدون مرتب کردن یا قضاوت کردن ادامه بده.",
          placeholder:
            "مثلاً: من غمم و اومدم چون چیزی که برات مهم بود تموم شده... / من خشمم و اومدم چون احساس کردی باهات ناعادلانه رفتار شده...",
          multiline: true,
          required: true,
        },
        {
          key: "emotion_protection",
          stepType: "text_input",
          title: "از چی می‌خواد محافظت کنه؟",
          instruction:
            "فکر کن این احساس داره از چه بخش آسیب‌دیده یا چه چیز مهمی در تو محافظت می‌کنه. حتی احساس‌های سخت معمولاً بی‌دلیل ظاهر نمی‌شن.",
          placeholder:
            "مثلاً: خشمم از مرزهای من دفاع می‌کنه / ترسم می‌خواد دوباره آسیب نبینم / غمم نشون می‌ده چیزی رو واقعاً از دست دادم.",
          multiline: true,
          required: true,
        },
        {
          key: "emotion_request",
          stepType: "text_input",
          title: "از تو چی می‌خواد؟",
          instruction:
            "اگه این احساس می‌تونست یک درخواست سالم از تو داشته باشه، چی می‌خواست؟ دنبال کاری باش که خودت می‌تونی برای خودت انجام بدی، نه چیزی که نیازمند برگشتن طرف مقابل باشه.",
          placeholder:
            "مثلاً: چند دقیقه استراحت کنم، با خودم مهربون‌تر باشم، از یک محرک فاصله بگیرم، با یک آدم امن حرف بزنم یا امشب بیشتر مراقب خودم باشم.",
          multiline: true,
          required: true,
        },
        {
          key: "response_to_emotion",
          stepType: "text_input",
          title: "جواب تو به احساست",
          instruction:
            "در چند جمله به این احساس جواب بده. لازم نیست قول بدی که از بین می‌ره؛ فقط نشون بده که متوجه حضورش شدی و قرار نیست برای خاموش کردنش به خودت یا مسیرت آسیب بزنی.",
          placeholder:
            "مثلاً: می‌فهمم چرا اینجایی. لازم نیست همین الان ناپدید بشی. من صدات رو می‌شنوم و امروز سعی می‌کنم بدون برگشتن به گذشته از خودم مراقبت کنم.",
          multiline: true,
          required: true,
        },
      ],
    },

    {
      code: "sookhtan_day3_no_contact_check",
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
                  label: "حواسم رو با انجام دادن یک  کاری، پرت کردم",
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
      code: "sookhtan_day3_night_routine",
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
              audioKey: AUDIO_KEYS.sookhtan.day03.nightMeditationMood1To5,
              title: "آرام‌سازی برای حال پایین",
            },
            {
              min: 6,
              max: 10,
              audioKey: AUDIO_KEYS.sookhtan.day03.nightMeditationMood6To10,
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
          audioKey: AUDIO_KEYS.sookhtan.day03.gratitude,
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
          audioKey: AUDIO_KEYS.sookhtan.day03.nightStretchMeditation,
        },
        {
          key: "pre_sleep_meditation",
          stepType: "audio_with_text",
          title: "مراقبه قبل از خواب",
          instruction:
            "فایل مراقبه آرام‌سازی و تخلیه افکار مزاحم رو گوش بده. بعد از پایان مراقبه، افکاری رو که حین مراقبه به ذهنت اومد بنویس تا از ذهنت بیرون بیاد و روی صفحه قرار بگیره.",
          required: true,
          audioKey: AUDIO_KEYS.sookhtan.day03.beforeSleepMeditation,
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
          audioKey: AUDIO_KEYS.sookhtan.day03.sleepMeditation,
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
