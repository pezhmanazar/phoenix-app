import { Ionicons } from "@expo/vector-icons";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  I18nManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePhoenix } from "../../hooks/PhoenixContext";

import {
  loadReminders,
  loadTags,
  loadToday,
  saveReminders,
  saveTags,
  saveToday,
} from "../../lib/storage";

/* +++ TAGS: ذخیره آیکن‌های تگ‌ها فقط داخل همین فایل */
import AsyncStorage from "@react-native-async-storage/async-storage";
const K_TAG_ICONS = "phoenix.tagicons.v1";

/* +++ NOTIFS: اکسپو نوتیفیکیشن */
import * as Notifications from "expo-notifications";

/* ===================== UI PALETTE (Phoenix dark, consistent with Mashaal) ===================== */
const UI = {
  BG: "#0b0f14",
  BAR: "#030712",
  TEXT: "#F9FAFB",
  MUTED: "rgba(231,238,247,.55)",
  MUTED2: "rgba(231,238,247,.72)",
  CARD: "rgba(255,255,255,.04)",
  CARD2: "rgba(255,255,255,.03)",
  BORDER: "rgba(255,255,255,.08)",
  BORDER2: "rgba(255,255,255,.10)",
  PRIMARY: "#D4AF37",
  DANGER: "#ff6666",
  PLACEHOLDER: "rgba(231,238,247,.40)",
};

/* ---------------- helpers ---------------- */
const toFa = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const timeLabel = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

const jalaliLabel = (d: Date) => {
  const { jy, jm, jd } = toJalaali(d);
  const months = [
    "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
    "مهر","آبان","آذر","دی","بهمن","اسفند",
  ];
  const weekdays = ["یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه","شنبه"];
  return `${weekdays[d.getDay()]} ${toFa(jd)} ${months[jm - 1]} ${toFa(jy)}`;
};

/* +++ TAGS: افزودن فیلد اختیاری tags به مدل‌ها */
type TodayItem = { id: string; title: string; time: string; done: boolean; createdAt: number; tags?: string[] };
type ReminderItem = { id: string; title: string; when: number; createdAt: number; done?: boolean; tags?: string[]; notificationId?: string };

/* +++ TAGS: تعریف نوع نمایش تگ با آیکن (فقط برای UI) */
type TagDef = { name: string; icon: string };

/* ---------- tiny UI ---------- */
function ProgressBar({
  value = 0,
  color = UI.PRIMARY,
  track = UI.BORDER,
}:{
  value: number; color?: string; track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height: 10, borderRadius: 999, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

/* +++ TAGS: چپس کوچکِ برچسب */
function TagChip({
  label, selected, onPress, onRemove, iconName,
}:{
  label: string;
  selected?: boolean;
  onPress?: ()=>void;
  onRemove?: ()=>void;
  iconName?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.chip,
        selected ? styles.chipSelected : null,
      ]}
    >
      {iconName ? (
        <Ionicons
          name={iconName as any}
          size={14}
          color={selected ? "#111827" : UI.TEXT}
          style={{ opacity: selected ? 1 : 0.9 }}
        />
      ) : null}

      <Text style={{ color: selected ? "#111827" : UI.TEXT, fontWeight: "800" }}>
        {label}
      </Text>

      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={{ marginStart: 2 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={14} color={selected ? "#111827" : UI.TEXT} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

/* ---------- Header (Phoenix style, no badge) ---------- */
function RoozHeader() {
  return (
    <View style={styles.headerBar}>
      {/* عنوان سمت راست */}
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.headerTitle}>روزنگار</Text>
        <Text style={styles.headerSub}>{jalaliLabel(new Date())}</Text>
      </View>

      {/* اکشن ساده سمت چپ (اختیاری / زیبایی) */}
      <View style={{ width: 44, alignItems: "flex-start" }}>
        <View style={styles.headerIconBubble}>
          <Ionicons name="calendar-outline" size={18} color={UI.TEXT} style={{ opacity: 0.9 }} />
        </View>
      </View>
    </View>
  );
}

/* ---------- Segmented tabs ---------- */
function Segmented({
  tab, setTab,
}: { tab: "today"|"rem"; setTab: (t:"today"|"rem")=>void }) {
  return (
    <View style={styles.segmentWrap}>
      <TouchableOpacity
        onPress={() => setTab("today")}
        activeOpacity={0.85}
        style={[styles.segmentBtn, tab === "today" ? styles.segmentBtnActive : null]}
      >
        <Text style={[styles.segmentText, tab === "today" ? styles.segmentTextActive : null]}>
          برنامهٔ امروز
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setTab("rem")}
        activeOpacity={0.85}
        style={[styles.segmentBtn, tab === "rem" ? styles.segmentBtnActive : null]}
      >
        <Text style={[styles.segmentText, tab === "rem" ? styles.segmentTextActive : null]}>
          یادآور
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- ProgressCard ---------- */
function ProgressCard({ value }:{ value:number }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: UI.TEXT, fontWeight: "900" }}>پیشرفت امروز</Text>
        <Text style={{ color: UI.MUTED, fontWeight: "900" }}>{toFa(value)}٪</Text>
      </View>
      <ProgressBar value={value} color={UI.PRIMARY} track={UI.BORDER} />
    </View>
  );
}

/* +++ TAGS: مودال مدیریت/ویرایش تگ‌ها */
function TagManagerModal({
  visible, onClose, tags, onChange,
}:{
  visible:boolean; onClose:()=>void; tags:TagDef[]; onChange:(next:TagDef[])=>void;
}) {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<TagDef[]>(tags);

  useEffect(()=> setList(tags), [tags]);

  const iconBank: string[] = [
    "pricetag-outline","bookmark-outline","heart-outline","briefcase-outline",
    "book-outline","fitness-outline","bicycle-outline","code-slash-outline",
    "medkit-outline","musical-notes-outline","sparkles-outline","sunny-outline",
  ];

  const updateTag = (idx:number, patch:Partial<TagDef>) => {
    setList(arr => arr.map((t,i)=> i===idx ? {...t, ...patch} : t));
  };
  const addEmpty = () => setList(arr => [...arr, { name:"", icon:"pricetag-outline" }]);
  const removeAt = (idx:number) => setList(arr => arr.filter((_,i)=>i!==idx));
  const persist = () => {
    const cleaned = list.map(t=>({ name:t.name.trim(), icon:t.icon })).filter(t=>t.name);
    const seen:Record<string,TagDef> = {};
    cleaned.forEach(t => { seen[t.name]=t; });
    onChange(Object.values(seen));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { paddingBottom: (insets.bottom || 0) + 12 }]}>
          <Text style={styles.modalTitle}>مدیریت برچسب‌ها</Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {list.map((t, idx) => (
              <View key={`${t.name}-${idx}`} style={styles.modalItem}>
                <View style={styles.inputBox}>
                  <TextInput
                    value={t.name}
                    onChangeText={(v)=>updateTag(idx, { name:v })}
                    placeholder="نام تگ"
                    placeholderTextColor={UI.PLACEHOLDER}
                    style={{ color: UI.TEXT, textAlign: "right", fontWeight: "800" }}
                  />
                </View>

                <View style={{ flexDirection:"row", flexWrap:"wrap", gap: 6 }}>
                  {iconBank.map(ic => {
                    const selected = ic === t.icon;
                    return (
                      <TouchableOpacity
                        key={ic}
                        onPress={()=>updateTag(idx,{ icon:ic })}
                        activeOpacity={0.85}
                        style={{
                          borderWidth: 1,
                          borderColor: selected ? "rgba(212,175,55,.55)" : UI.BORDER,
                          borderRadius: 10,
                          padding: 8,
                          backgroundColor: selected ? "rgba(212,175,55,.12)" : "transparent",
                        }}
                      >
                        <Ionicons name={ic as any} size={18} color={selected ? UI.PRIMARY : UI.TEXT} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection:"row", justifyContent:"flex-end" }}>
                  <TouchableOpacity onPress={()=>removeAt(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={UI.DANGER} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection:"row-reverse", gap:8 }}>
            <TouchableOpacity onPress={persist} activeOpacity={0.85} style={[styles.btn, styles.btnPrimary, { flex: 1 }]}>
              <Text style={styles.btnPrimaryText}>ذخیره</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addEmpty} activeOpacity={0.85} style={[styles.btn, styles.btnOutline, { flex: 1 }]}>
              <Text style={styles.btnOutlineText}>تگ جدید</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={[styles.btn, styles.btnOutline, { marginTop: 6 }]}>
            <Text style={styles.btnOutlineText}>بستن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- TodayBlock ---------- */
function TodayBlock({
  rtl,
  items, setItems,
  title, setTitle,
  time,
  onOpenTime,
  onAdd,
  editingId,
  onEditItem,
  todaySelectedTags,
  onAddTagToToday,
  onRemoveTagFromToday,
  tagInput,
  setTagInput,
  allTags,
  tagIcons,
}:{
  rtl: boolean;
  items: TodayItem[]; setItems: React.Dispatch<React.SetStateAction<TodayItem[]>>;
  title: string; setTitle: (s:string)=>void;
  time: Date|null;
  onOpenTime: ()=>void;
  onAdd: ()=>void;
  editingId: string | null;
  onEditItem: (it: TodayItem) => void;
  todaySelectedTags: string[];
  onAddTagToToday: (t:string)=>void;
  onRemoveTagFromToday: (t:string)=>void;
  tagInput: string;
  setTagInput: (s:string)=>void;
  allTags: string[];
  tagIcons: Record<string,string>;
}) {
  const toggle = (id:string) =>
    setItems(list => sortToday(list.map(it => it.id===id ? {...it, done: !it.done} : it)));
  const remove = (id:string) => setItems(list => list.filter(it => it.id!==id));

  return (
    <View style={styles.card}>
      <Text style={styles.helperText}>برنامه امروزت رو اینجا اضافه کن</Text>

      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
        <TouchableOpacity
          onPress={onOpenTime}
          activeOpacity={0.85}
          style={styles.timeBtn}
        >
          <Text style={{ color: UI.TEXT, fontWeight: "900" }}>
            {time ? toFa(timeLabel(time)) : "انتخاب ساعت"}
          </Text>
        </TouchableOpacity>

        <View style={[styles.inputBox, { flex: 1, height: 46 }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان کار"
            placeholderTextColor={UI.PLACEHOLDER}
            style={{ color: UI.TEXT, textAlign: rtl ? "right" : "left", fontWeight: "800" }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.85}
          style={styles.addBtn}
        >
          {editingId ? (
            <Text style={{ color:"#111827", fontWeight:"900" }}>ذخیره</Text>
          ) : (
            <Ionicons name="add" size={22} color="#111827" />
          )}
        </TouchableOpacity>
      </View>

      {/* TAGS: امروز */}
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {todaySelectedTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} selected onRemove={()=>onRemoveTagFromToday(t)} />
          ))}
        </View>

        <View style={{ flexDirection:"row-reverse", alignItems:"center", marginTop:6 }}>
          <TouchableOpacity onPress={()=> onAddTagToToday(tagInput.trim())} style={{ marginStart: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pricetag-outline" size={22} color={UI.MUTED2} />
          </TouchableOpacity>

          <View style={[styles.inputBox, { flex: 1, height: 44 }]}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="اضافه‌کردن برچسب"
              placeholderTextColor={UI.PLACEHOLDER}
              onSubmitEditing={()=> onAddTagToToday(tagInput.trim())}
              style={{ color: UI.TEXT, textAlign: "right", fontWeight: "800" }}
            />
          </View>
        </View>

        <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:6 }}>
          {allTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} onPress={()=>onAddTagToToday(t)} />
          ))}
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>هنوز آیتمی در این برنامه ثبت نشده.</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          {items.map(item => (
            <View key={item.id} style={styles.rowCard}>
              <TouchableOpacity
                onPress={()=>toggle(item.id)}
                activeOpacity={0.85}
                style={[
                  styles.checkBox,
                  item.done ? styles.checkBoxDone : null,
                ]}
              >
                {item.done && <Ionicons name="checkmark" size={14} color="#111827" />}
              </TouchableOpacity>

              <View style={{ flex:1 }}>
                <Text
                  style={{
                    color: UI.TEXT,
                    textAlign:"right",
                    fontWeight: "900",
                    textDecorationLine: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.6 : 1,
                  }}
                  onLongPress={() => { setTitle(item.title); remove(item.id); }}
                >
                  {item.title}
                </Text>

                <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:4 }}>
                  {(item.tags ?? []).map(t => (
                    <TagChip key={t} label={t} iconName={tagIcons[t]} />
                  ))}
                </View>
              </View>

              <Text style={{ color: UI.MUTED, width:52, textAlign:"center", fontWeight: "900" }}>
                {toFa(item.time)}
              </Text>

              <TouchableOpacity onPress={() => onEditItem(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={18} color={UI.TEXT} />
              </TouchableOpacity>

              <TouchableOpacity onPress={()=>remove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color={UI.DANGER} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- ReminderBlock ---------- */
function ReminderBlock({
  rtl,
  jy, jm, jd, setJy, setJm, setJd,
  remTitle, setRemTitle,
  remTime,
  onOpenDate,
  onOpenTime,
  items, setItems,
  onAdd,
  editingId,
  onEditItem,
  remSelectedTags,
  onAddTagToRem,
  onRemoveTagFromRem,
  tagInput,
  setTagInput,
  allTags,
  tagIcons,
  onToggleReminder,
  onRemoveReminder,
  onSnoozeReminder,
}:{
  rtl:boolean;
  jy:number; jm:number; jd:number; setJy:(n:number)=>void; setJm:(n:number)=>void; setJd:(n:number)=>void;
  remTitle:string; setRemTitle:(s:string)=>void;
  remTime:Date|null;
  onOpenDate:()=>void;
  onOpenTime:()=>void;
  items:ReminderItem[]; setItems:React.Dispatch<React.SetStateAction<ReminderItem[]>>;
  onAdd:()=>void;
  editingId: string | null;
  onEditItem: (it: ReminderItem) => void;
  remSelectedTags: string[];
  onAddTagToRem: (t:string)=>void;
  onRemoveTagFromRem: (t:string)=>void;
  tagInput: string;
  setTagInput: (s:string)=>void;
  allTags: string[];
  tagIcons: Record<string,string>;
  onToggleReminder: (id:string)=>void;
  onRemoveReminder: (id:string)=>void;
  onSnoozeReminder: (id:string)=>void;
}) {

  return (
    <View style={styles.card}>
      <Text style={styles.helperText}>کارهای مهم خودت رو در روزهای آینده اینجا اضافه کن</Text>

      <View style={{ flexDirection:"row-reverse", gap:8, flexWrap:"wrap" }}>
        <TouchableOpacity onPress={onOpenDate} activeOpacity={0.85} style={styles.timeBtn}>
          <Text style={{ color: UI.TEXT, fontWeight:"900" }}>
            {toFa(jy)}/{toFa(pad(jm))}/{toFa(pad(jd))}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenTime} activeOpacity={0.85} style={styles.timeBtn}>
          <Text style={{ color: UI.TEXT, fontWeight:"900" }}>
            {remTime ? toFa(timeLabel(remTime)) : "انتخاب ساعت"}
          </Text>
        </TouchableOpacity>

        <View style={[styles.inputBox, { flex: 1, height: 46 }]}>
          <TextInput
            value={remTitle}
            onChangeText={setRemTitle}
            placeholder="عنوان"
            placeholderTextColor={UI.PLACEHOLDER}
            style={{ color: UI.TEXT, textAlign: rtl ? "right" : "left", fontWeight: "800" }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={styles.addBtn}>
          {editingId ? (
            <Text style={{ color:"#111827", fontWeight:"900" }}>ذخیره</Text>
          ) : (
            <Ionicons name="add" size={22} color="#111827" />
          )}
        </TouchableOpacity>
      </View>

      {/* TAGS: یادآور */}
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {remSelectedTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} selected onRemove={()=>onRemoveTagFromRem(t)} />
          ))}
        </View>

        <View style={{ flexDirection:"row-reverse", alignItems:"center", marginTop:6 }}>
          <TouchableOpacity onPress={()=> onAddTagToRem(tagInput.trim())} style={{ marginStart: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pricetag-outline" size={22} color={UI.MUTED2} />
          </TouchableOpacity>

          <View style={[styles.inputBox, { flex: 1, height: 44 }]}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="اضافه‌کردن برچسب"
              placeholderTextColor={UI.PLACEHOLDER}
              onSubmitEditing={()=> onAddTagToRem(tagInput.trim())}
              style={{ color: UI.TEXT, textAlign: "right", fontWeight: "800" }}
            />
          </View>
        </View>

        <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:6 }}>
          {allTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} onPress={()=>onAddTagToRem(t)} />
          ))}
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>هنوز یادآوری ثبت نشده است.</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          {items.map(item => {
            const d = new Date(item.when);
            const done = !!item.done;

            return (
              <View key={item.id} style={styles.rowCard}>
                <TouchableOpacity
                  onPress={()=>onToggleReminder(item.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.checkBox,
                    done ? styles.checkBoxDone : null,
                  ]}
                >
                  {done && <Ionicons name="checkmark" size={14} color="#111827" />}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: UI.TEXT,
                      fontWeight:"900",
                      textAlign:"right",
                      textDecorationLine: done ? "line-through" : "none",
                      opacity: done ? 0.6 : 1,
                    }}
                  >
                    {item.title}
                  </Text>

                  <Text style={{ color: UI.MUTED, fontSize: 12, textAlign:"right", fontWeight: "800", marginTop: 2 }}>
                    {jalaliLabel(d)} • {toFa(timeLabel(d))}
                  </Text>

                  <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop: 6 }}>
                    {(item.tags ?? []).map(t => (
                      <TagChip key={t} label={t} iconName={tagIcons[t]} />
                    ))}
                  </View>

                  {!done && (
                    <View style={{ flexDirection:"row-reverse", justifyContent:"flex-start", marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={()=>onSnoozeReminder(item.id)}
                        activeOpacity={0.85}
                        style={styles.snoozeBtn}
                      >
                        <Ionicons name="time-outline" size={16} color={UI.TEXT} />
                        <Text style={{ color: UI.TEXT, fontSize: 12, fontWeight: "900" }}>+۱۰ دقیقه</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity onPress={() => onEditItem(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={18} color={UI.TEXT} />
                </TouchableOpacity>

                <TouchableOpacity onPress={()=>onRemoveReminder(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={UI.DANGER} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ---------- DateModal ---------- */
function DateModal({
  visible, onClose,
  jy, jm, jd, setJy, setJm, setJd,
}:{
  visible:boolean; onClose:()=>void;
  jy:number; jm:number; jd:number; setJy:(n:number)=>void; setJm:(n:number)=>void; setJd:(n:number)=>void;
}) {
  const insets = useSafeAreaInsets();
  const monthsFa = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

  const clampDay = (y:number, m:number) => {
    const lim = jalaaliMonthLength(y, m);
    if (jd > lim) setJd(lim);
  };

  const changeYear = (delta:number) => {
    const y = jy + delta;
    setJy(y);
    clampDay(y, jm);
  };

  const selectMonth = (m:number) => {
    setJm(m);
    clampDay(jy, m);
  };

  const daysInMonth = jalaaliMonthLength(jy, jm);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { paddingBottom: (insets.bottom || 0) + 12 }]}>
          <Text style={styles.modalTitle}>انتخاب تاریخ</Text>

          <View style={styles.yearRow}>
            <TouchableOpacity onPress={()=>changeYear(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="remove" size={20} color={UI.TEXT} />
            </TouchableOpacity>
            <Text style={{ color: UI.TEXT, fontWeight:"900" }}>
              {String(jy).replace(/\d/g, d=>"۰۱۲۳۴۵۶۷۸۹"[+d])}
            </Text>
            <TouchableOpacity onPress={()=>changeYear(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add" size={20} color={UI.TEXT} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, justifyContent:"space-between" }}>
            {monthsFa.map((mTitle, idx) => {
              const m = idx + 1;
              const selected = jm === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={()=>selectMonth(m)}
                  activeOpacity={0.85}
                  style={[
                    styles.monthBtn,
                    selected ? styles.monthBtnActive : null,
                  ]}
                >
                  <Text style={{ color: selected ? "#111827" : UI.TEXT, fontWeight:"900" }}>{mTitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop: 6 }}>
            {days.map((d) => {
              const selected = d === jd;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={()=>setJd(d)}
                  activeOpacity={0.85}
                  style={[
                    styles.dayBtn,
                    selected ? styles.dayBtnActive : null,
                  ]}
                >
                  <Text style={{ color: selected ? "#111827" : UI.TEXT, fontWeight:"900" }}>
                    {String(d).replace(/\d/g, x=>"۰۱۲۳۴۵۶۷۸۹"[+x])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection:"row-reverse", gap:8, marginTop: 10 }}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={[styles.btn, styles.btnPrimary, { flex:1 }]}>
              <Text style={styles.btnPrimaryText}>تأیید</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={[styles.btn, styles.btnOutline, { flex:1 }]}>
              <Text style={styles.btnOutlineText}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ========================================================= */
export default function Rooznegar() {
  const rtl = I18nManager.isRTL;
  const insets = useSafeAreaInsets();
  const { setDayProgress } = usePhoenix();

  const [tab, setTab] = useState<"today" | "rem">("today");

  // امروز
  const [todayTitle, setTodayTitle] = useState("");
  const [todayTime, setTodayTime] = useState<Date | null>(null);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [showTodayTime, setShowTodayTime] = useState(false);
  const [todayEditingId, setTodayEditingId] = useState<string | null>(null);

  // یادآور
  const tJ = toJalaali(new Date());
  const [jy, setJy] = useState<number>(tJ.jy);
  const [jm, setJm] = useState<number>(tJ.jm);
  const [jd, setJd] = useState<number>(tJ.jd);
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState<Date | null>(null);
  const [remItems, setRemItems] = useState<ReminderItem[]>([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showRemTime, setShowRemTime] = useState(false);
  const [remEditingId, setRemEditingId] = useState<string | null>(null);

  /* TAGS */
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [todayTags, setTodayTags] = useState<string[]>([]);
  const [remTags, setRemTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [tagIcons, setTagIcons] = useState<Record<string,string>>({});
  const [showTagManager, setShowTagManager] = useState(false);

  const loadedRef = useRef(false);

  /* NOTIFS */
  const [notifAllowed, setNotifAllowed] = useState<boolean>(false);
  const askedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Reminders",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      if (Platform.OS === "ios") {
        await Notifications.setNotificationCategoryAsync("reminder_actions", [
          { identifier: "DONE", buttonTitle: "انجام شد" },
          { identifier: "SNOOZE_10", buttonTitle: "+۱۰ دقیقه" },
        ]);
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    })();
  }, []);

  const ensureNotifPermission = async () => {
    if (notifAllowed) return true;
    if (askedRef.current) return false;
    askedRef.current = true;
    const settings = await Notifications.getPermissionsAsync();
    let granted =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    if (!granted) {
      const res = await Notifications.requestPermissionsAsync();
      granted =
        res.granted ||
        res.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    }
    setNotifAllowed(granted);
    if (!granted) {
      Alert.alert(
        "اجازه نوتیفیکیشن لازم است",
        "برای یادآورها نوتیف بده؛ اگر نمی‌خوای هم مشکلی نیست، اپ بدون نوتیف هم کار می‌کند."
      );
    }
    return granted;
  };

  const scheduleForReminder = async (it: ReminderItem): Promise<string | undefined> => {
    if (!(await ensureNotifPermission())) return undefined;

    const triggerDate = new Date(it.when);
    if (triggerDate.getTime() <= Date.now()) return undefined;

    const content: Notifications.NotificationContentInput & { categoryIdentifier?: string; data?: any } = {
      title: "یادآور",
      body: it.title,
      sound: "default",
      categoryIdentifier: Platform.OS === "ios" ? "reminder_actions" : undefined,
      data: { rid: it.id },
    };

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: triggerDate,
    });

    return id;
  };

  const cancelNotif = async (id?: string) => {
    if (!id) return;
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  };

  const todayProgress = useMemo(() => {
    const total = todayItems.length;
    if (!total) return 0;
    const done = todayItems.filter((i) => i.done).length;
    return Math.round((done / total) * 100);
  }, [todayItems]);

  React.useEffect(() => {
    setDayProgress(todayProgress);
  }, [todayProgress, setDayProgress]);

  useEffect(() => {
    (async () => {
      try {
        const [tList, rList, tags, iconMapStr] = await Promise.all([
          loadToday(),
          loadReminders(),
          loadTags(),
          AsyncStorage.getItem(K_TAG_ICONS),
        ]);
        if (Array.isArray(tList)) setTodayItems((prev) => (prev.length ? prev : sortToday(tList)));
        if (Array.isArray(rList)) setRemItems((prev) => (prev.length ? prev : sortReminders(rList)));
        if (Array.isArray(tags)) setAllTags(tags);
        if (iconMapStr) {
          try { setTagIcons(JSON.parse(iconMapStr) || {}); } catch { setTagIcons({}); }
        }
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveToday(todayItems).catch(() => {});
  }, [todayItems]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveReminders(remItems).catch(() => {});
  }, [remItems]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveTags(allTags).catch(() => {});
  }, [allTags]);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(K_TAG_ICONS, JSON.stringify(tagIcons)).catch(() => {});
  }, [tagIcons]);

  const addTodayItem = () => {
    const t = todayTitle.trim();
    if (!t) return;
    if (!todayTime) {
      Alert.alert("ساعت لازم است", "برای ثبت کارِ امروز، حتماً ساعت را انتخاب کن.");
      return;
    }

    if (todayEditingId) {
      setTodayItems((list) =>
        sortToday(
          list.map((it) =>
            it.id === todayEditingId
              ? { ...it, title: t, time: timeLabel(todayTime), tags: todayTags }
              : it
          )
        )
      );
      setTodayEditingId(null);
    } else {
      const item: TodayItem = {
        id: uid(),
        title: t,
        time: timeLabel(todayTime),
        done: false,
        createdAt: Date.now(),
        tags: todayTags,
      };
      setTodayItems((list) => sortToday([...list, item]));
    }

    setTodayTitle("");
    setTodayTime(null);
    setTodayTags([]);
    Keyboard.dismiss();
  };

  const addReminder = async () => {
    const t = remTitle.trim();
    if (!t) return;
    if (!remTime) {
      Alert.alert("ساعت لازم است", "برای ثبت یادآور، حتماً ساعت را انتخاب کن.");
      return;
    }
    const g = toGregorian(jy, jm, jd);
    const when = new Date(g.gy, g.gm - 1, g.gd, remTime.getHours(), remTime.getMinutes(), 0, 0);

    if (remEditingId) {
      let updatedNotificationId: string | undefined;
      await Promise.resolve();
      setRemItems((list) => {
        const mapped = list.map((it) => {
          if (it.id === remEditingId) {
            cancelNotif(it.notificationId);
            return { ...it, title: t, when: when.getTime(), tags: remTags, notificationId: undefined };
          }
          return it;
        });
        return sortReminders(mapped);
      });

      updatedNotificationId = await scheduleForReminder({
        id: remEditingId,
        title: t,
        when: when.getTime(),
        createdAt: Date.now(),
        done: false,
        tags: remTags,
      });

      setRemItems((list) =>
        list.map((it) => (it.id === remEditingId ? { ...it, notificationId: updatedNotificationId } : it))
      );
      setRemEditingId(null);
    } else {
      const base: ReminderItem = { id: uid(), title: t, when: when.getTime(), createdAt: Date.now(), done: false, tags: remTags };
      const notificationId = await scheduleForReminder(base);
      const item: ReminderItem = { ...base, notificationId };
      setRemItems((list) => sortReminders([...list, item]));
    }

    setRemTitle("");
    setRemTime(null);
    setRemTags([]);
    Keyboard.dismiss();
  };

  const filteredToday = activeTag ? todayItems.filter(i => (i.tags ?? []).includes(activeTag)) : todayItems;
  const filteredRem   = activeTag ? remItems.filter(i => (i.tags ?? []).includes(activeTag)) : remItems;

  const tagDefs: TagDef[] = useMemo(() => {
    return (allTags || []).map(name => ({ name, icon: tagIcons[name] || "pricetag-outline" }));
  }, [allTags, tagIcons]);

  const handleRemoveReminder = async (id: string) => {
    const target = remItems.find(r => r.id === id);
    if (target?.notificationId) await cancelNotif(target.notificationId);
    setRemItems(list => sortReminders(list.filter(r => r.id !== id)));
  };

  const handleToggleReminder = async (id: string) => {
    const target = remItems.find(r => r.id === id);
    if (!target) return;
    const toggledDone = !target.done;
    if (toggledDone) {
      if (target.notificationId) await cancelNotif(target.notificationId);
      setRemItems(list => sortReminders(list.map(r => r.id === id ? { ...r, done: true, notificationId: undefined } : r)));
    } else {
      const notificationId = await scheduleForReminder({ ...target, done: false });
      setRemItems(list => sortReminders(list.map(r => r.id === id ? { ...r, done: false, notificationId } : r)));
    }
  };

  const handleSnoozeReminder = async (id: string) => {
    const target = remItems.find(r => r.id === id);
    if (!target) return;
    const base = Math.max(Date.now(), target.when);
    const nextWhen = base + 10 * 60 * 1000;
    if (target.notificationId) await cancelNotif(target.notificationId);
    const next: ReminderItem = { ...target, when: nextWhen, done: false };
    const newNotif = await scheduleForReminder(next);
    setRemItems(list => sortReminders(list.map(r => r.id === id ? { ...next, notificationId: newNotif } : r)));
  };

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const rid = (resp?.notification?.request?.content?.data as any)?.rid as string | undefined;
      const act = resp?.actionIdentifier;
      if (!rid) return;

      if (Platform.OS === "ios") {
        if (act === "DONE") { handleToggleReminder(rid); return; }
        if (act === "SNOOZE_10") { handleSnoozeReminder(rid); return; }
        return;
      }

      if (act === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        const item = remItems.find(r => r.id === rid);
        Alert.alert(
          item?.title || "یادآور",
          "چه کاری انجام بدم؟",
          [
            { text: "انجام شد", onPress: () => handleToggleReminder(rid) },
            { text: "+۱۰ دقیقه", onPress: () => handleSnoozeReminder(rid) },
            { text: "بستن", style: "cancel" },
          ],
          { cancelable: true }
        );
      }
    });

    return () => { try { sub.remove(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remItems]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: UI.BG }}>
      {/* Glow shapes مثل مشعل */}
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(24, insets.bottom + 24),
            paddingHorizontal: 0,
            rowGap: 14,
            direction: rtl ? "rtl" : "ltr",
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <RoozHeader />
            <ProgressCard value={todayProgress} />
            <Segmented tab={tab} setTab={setTab} />

            {/* TAGS: فیلتر */}
            <View style={{ marginTop: 2, flexDirection:"row-reverse", flexWrap:"wrap", alignItems:"center" }}>
              <TagChip label="همه" selected={activeTag === null} onPress={()=>setActiveTag(null)} />
              {allTags.map(t => (
                <TagChip
                  key={t}
                  label={t}
                  iconName={tagIcons[t]}
                  selected={activeTag === t}
                  onPress={()=>setActiveTag(t)}
                />
              ))}
              <TouchableOpacity onPress={()=>setShowTagManager(true)} style={{ marginStart: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="settings-outline" size={20} color={UI.TEXT} style={{ opacity: 0.9 }} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {tab === "today" ? (
              <TodayBlock
                rtl={rtl}
                items={filteredToday}
                setItems={setTodayItems}
                title={todayTitle}
                setTitle={setTodayTitle}
                time={todayTime}
                onOpenTime={() => setShowTodayTime(true)}
                onAdd={addTodayItem}
                editingId={todayEditingId}
                onEditItem={(it) => {
                  setTodayEditingId(it.id);
                  setTodayTitle(it.title);
                  const [hh, mm] = it.time.split(":").map((x) => parseInt(x, 10));
                  const d = new Date();
                  d.setHours(hh || 0, mm || 0, 0, 0);
                  setTodayTime(d);
                  setTodayTags(it.tags ?? []);
                }}
                todaySelectedTags={todayTags}
                onAddTagToToday={(t:string)=>{
                  const v = t.trim();
                  if (!v) return;
                  if (!allTags.includes(v)) {
                    setAllTags(prev=>[...prev, v]);
                    setTagIcons(prev => ({ ...prev, [v]: "pricetag-outline" }));
                  }
                  setTodayTags(prev=> prev.includes(v) ? prev : [...prev, v]);
                  setTagInput("");
                }}
                onRemoveTagFromToday={(t)=> setTodayTags(prev=> prev.filter(x=>x!==t))}
                tagInput={tagInput}
                setTagInput={setTagInput}
                allTags={allTags}
                tagIcons={tagIcons}
              />
            ) : (
              <ReminderBlock
                rtl={rtl}
                jy={jy} jm={jm} jd={jd}
                setJy={setJy} setJm={setJm} setJd={setJd}
                remTitle={remTitle} setRemTitle={setRemTitle}
                remTime={remTime}
                onOpenDate={() => setShowDateModal(true)}
                onOpenTime={() => setShowRemTime(true)}
                items={filteredRem}
                setItems={setRemItems}
                onAdd={addReminder}
                editingId={remEditingId}
                onEditItem={(it) => {
                  setRemEditingId(it.id);
                  setRemTitle(it.title);
                  const d = new Date(it.when);
                  const j = toJalaali(d);
                  setJy(j.jy); setJm(j.jm); setJd(j.jd);
                  const tmp = new Date();
                  tmp.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  setRemTime(tmp);
                  setRemTags(it.tags ?? []);
                }}
                remSelectedTags={remTags}
                onAddTagToRem={(t:string)=>{
                  const v = t.trim();
                  if (!v) return;
                  if (!allTags.includes(v)) {
                    setAllTags(prev=>[...prev, v]);
                    setTagIcons(prev => ({ ...prev, [v]: "pricetag-outline" }));
                  }
                  setRemTags(prev=> prev.includes(v) ? prev : [...prev, v]);
                  setTagInput("");
                }}
                onRemoveTagFromRem={(t)=> setRemTags(prev=> prev.filter(x=>x!==t))}
                tagInput={tagInput}
                setTagInput={setTagInput}
                allTags={allTags}
                tagIcons={tagIcons}
                onToggleReminder={handleToggleReminder}
                onRemoveReminder={handleRemoveReminder}
                onSnoozeReminder={handleSnoozeReminder}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <DateTimePickerModal
        isVisible={showTodayTime}
        mode="time"
        locale={Platform.OS === "ios" ? "fa-IR" : undefined}
        onConfirm={(d)=>{ setTodayTime(d); setShowTodayTime(false); }}
        onCancel={()=>setShowTodayTime(false)}
      />
      <DateTimePickerModal
        isVisible={showRemTime}
        mode="time"
        locale={Platform.OS === "ios" ? "fa-IR" : undefined}
        onConfirm={(d)=>{ setRemTime(d); setShowRemTime(false); }}
        onCancel={()=>setShowRemTime(false)}
      />
      <DateModal
        visible={showDateModal}
        onClose={()=>setShowDateModal(false)}
        jy={jy} jm={jm} jd={jd}
        setJy={setJy} setJm={setJm} setJd={setJd}
      />

      <TagManagerModal
        visible={showTagManager}
        onClose={()=>setShowTagManager(false)}
        tags={tagDefs}
        onChange={(next)=>{
          setAllTags(next.map(x=>x.name));
          const map: Record<string,string> = {};
          next.forEach(x => { map[x.name] = x.icon || "pricetag-outline"; });
          setTagIcons(map);
        }}
      />
    </SafeAreaView>
  );
}

/* ---------------- tiny util ---------------- */
function toDateFromTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function sortToday(arr: TodayItem[]) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.title !== b.title) return a.title.localeCompare(b.title, "fa");
    return a.createdAt - b.createdAt;
  });
}

function sortReminders(arr: ReminderItem[]) {
  return [...arr].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.when !== b.when) return a.when - b.when;
    return a.title.localeCompare(b.title, "fa");
  });
}

/* ===================== styles ===================== */
const styles = {
  bgGlowTop: {
    position: "absolute" as const,
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute" as const,
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  headerBar: {
    backgroundColor: UI.BAR,
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  headerTitle: {
    color: UI.TEXT,
    fontSize: 18,
    fontWeight: "900" as const,
    textAlign: "right" as const,
  },
  headerSub: {
    color: UI.MUTED,
    fontSize: 12,
    fontWeight: "800" as const,
    marginTop: 2,
    textAlign: "right" as const,
  },
  headerIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: UI.CARD,
    borderWidth: 1,
    borderColor: UI.BORDER,
  },

  card: {
    backgroundColor: UI.CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.BORDER,
    gap: 12,
  },

  helperText: {
    color: UI.MUTED,
    fontSize: 12,
    textAlign: "right" as const,
    fontWeight: "800" as const,
  },
  emptyText: {
    color: UI.MUTED,
    fontSize: 12,
    textAlign: "center" as const,
    fontWeight: "800" as const,
  },

  segmentWrap: {
    backgroundColor: UI.CARD2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.BORDER,
    padding: 6,
    flexDirection: "row-reverse" as const,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  segmentBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderColor: "rgba(212,175,55,.45)",
  },
  segmentText: {
    color: UI.TEXT,
    fontWeight: "900" as const,
    opacity: 0.9,
  },
  segmentTextActive: {
    color: "#111827",
    opacity: 1,
  },

  inputBox: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,.02)",
  },

  timeBtn: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 46,
    backgroundColor: "rgba(255,255,255,.02)",
  },
  addBtn: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },

  rowCard: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "rgba(255,255,255,.02)",
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
  },

  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: UI.BORDER,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "transparent",
  },
  checkBoxDone: {
    borderColor: "rgba(212,175,55,.65)",
    backgroundColor: "rgba(212,175,55,.92)",
  },

  chip: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    margin: 4,
    gap: 6,
  },
  chipSelected: {
    borderColor: "rgba(212,175,55,.65)",
    backgroundColor: "rgba(212,175,55,.92)",
  },

  snoozeBtn: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center" as const,
    flexDirection: "row-reverse" as const,
    gap: 6,
    backgroundColor: "rgba(255,255,255,.02)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  modalCard: {
    width: "92%" as const,
    maxHeight: "84%" as const,
    borderRadius: 16,
    backgroundColor: UI.BAR,
    borderWidth: 1,
    borderColor: UI.BORDER,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: UI.TEXT,
    fontWeight: "900" as const,
    textAlign: "right" as const,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 8,
    backgroundColor: UI.CARD,
  },

  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  btnPrimary: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },
  btnPrimaryText: {
    color: "#111827",
    fontWeight: "900" as const,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  btnOutlineText: {
    color: UI.TEXT,
    fontWeight: "900" as const,
  },

  yearRow: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    padding: 10,
    backgroundColor: UI.CARD,
  },

  monthBtn: {
    width: "31%" as const,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  monthBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderColor: "rgba(212,175,55,.45)",
  },

  dayBtn: {
    width: `${100/7}%` as const,
    aspectRatio: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
  },
} as const;