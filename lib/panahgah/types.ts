// lib/panahgah/types.ts

export type StepVoice = {
  type: "voice";
  title: string;
  /** can be a full URL OR a media key (we'll resolve via mediaUrl in UI) OR a file:// */
  uri: string | number;
};

export type StepForm = {
  type: "form";
  title: string;
  fields: Array<{ key: string; label: string }>;
};

export type StepBreath = {
  type: "breath";
  title: string;
  seconds: number;
  hints?: string[];
};

/* -------------------- ✅ NEW: Check-in (pre intensity) -------------------- */
export type StepCheckin = {
  type: "checkin";
  title: string; // e.g. "الان شدت حال بدت چنده؟"
  /** min/max for slider-like UI */
  min?: number; // default 0
  max?: number; // default 10
  /** storage keys to save the rating */
  storageKey: string; // e.g. "pre"
  /** optional helper text */
  hint?: string;
};

/* -------------------- ✅ NEW: Action (behavioral activation) -------------------- */
export type StepAction = {
  type: "action";
  title: string; // e.g. "یه کار کوچیک انجام بده"
  /** list of simple actions user can choose from */
  items: Array<{
    key: string;
    label: string; // "۲ دقیقه قدم زدن"
    seconds?: number; // optional timer per item (fallback to defaultSeconds)
  }>;
  /** default timer when item.seconds not provided */
  defaultSeconds?: number; // e.g. 120
  /** after action, ask rating again and save */
  postStorageKey: string; // e.g. "post"
  /** min/max for rating after action */
  min?: number; // default 0
  max?: number; // default 10
  /** copy */
  afterPromptTitle?: string; // e.g. "الان حالت چنده؟"
};

/* -------------------- ✅ NEW: Done (finish + decision) -------------------- */
export type StepDone = {
  type: "done";
  title: string; // e.g. "تمام"
  /** which storage keys to compare */
  preKey: string; // "pre"
  postKey: string; // "post"
  /**
   * thresholds to suggest next step:
   * - goodDrop: if (pre - post) >= goodDrop → finish
   * - smallDrop: if (pre - post) >= smallDrop → suggest another action
   * - else → suggest relaxation again
   */
  goodDrop?: number; // default 2
  smallDrop?: number; // default 1
  /** optional texts */
  finishText?: string;
  suggestActionText?: string;
  suggestRelaxText?: string;
};

/* -------------------- Unified Step -------------------- */
export type Step = StepVoice | StepForm | StepBreath | StepCheckin | StepAction | StepDone;

/* -------------------- Plan & Module -------------------- */
export type Plan = Step[];

export type ScenarioModule = {
  id: string;
  title: string;
  getPlanForVisit: (visitIndex: number) => Plan;
};