import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import React, { useEffect, useMemo, useRef, useState } from "react"; /* ⬅️ useEffect اضافه شد */
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

/* ⬇️ اضافه: ایمپورت استوریج (مسیر را در صورت نیاز تطبیق بده) */
import {
  loadReminders,
  /* +++ TAGS */
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

/* ---------------- helpers ---------------- */
const toFa = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const timeLabel = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
/* ⬇️ تنها تغییر: افزودن done? به‌صورت اختیاری برای تیکِ یادآور */
/* +++ NOTIFS: notificationId? برای مدیریت نوتیف */
type ReminderItem = { id: string; title: string; when: number; createdAt: number; done?: boolean; tags?: string[]; notificationId?: string };

/* +++ TAGS: تعریف نوع نمایش تگ با آیکن (فقط برای UI) */
type TagDef = { name: string; icon: string };

/* ---------- tiny UI ---------- */
function ProgressBar({ value = 0, color = "#FF6B00", track = "#ECEEF2" }:{
  value: number; color?: string; track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height: 10, borderRadius: 999, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

/* +++ TAGS: چپس کوچکِ برچسب (با آیکن اختیاری و دکمه حذف) */
function TagChip({
  label, selected, onPress, onRemove, iconName,
}:{ label:string; selected?:boolean; onPress?:()=>void; onRemove?:()=>void; iconName?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection:"row", alignItems:"center",
        borderWidth:1, borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : "transparent",
        paddingHorizontal:10, paddingVertical:6, borderRadius:999, margin:4, gap:6,
      }}>
      {iconName ? (
        <Ionicons name={iconName as any} size={14} color={selected ? "#fff" : colors.text} />
      ) : null}
      <Text style={{ color: selected ? "#fff" : colors.text }}>{label}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={{ marginStart:2 }}>
          <Ionicons name="close" size={14} color={selected ? "#fff" : colors.text} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

/* ---------- Header ---------- */
function RoozHeader() {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "right" }}>
        روزنگار
      </Text>
      <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 2, textAlign: "right" }}>
        {jalaliLabel(new Date())}
      </Text>
    </View>
  );
}

/* ---------- Segmented tabs ---------- */
function Segmented({
  tab, setTab,
}: { tab: "today"|"rem"; setTab: (t:"today"|"rem")=>void }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      padding: 6, flexDirection: "row-reverse", gap: 6,
    }}>
      <TouchableOpacity
        onPress={() => setTab("today")}
        style={{
          flex: 1,
          backgroundColor: tab === "today" ? colors.primary : colors.background,
          borderRadius: 12, paddingVertical: 10, alignItems: "center",
          borderWidth: 1, borderColor: colors.border,
        }}>
        <Text style={{ color: tab === "today" ? "#fff" : colors.text, fontWeight: "800" }}>
          برنامهٔ امروز
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setTab("rem")}
        style={{
          flex: 1,
          backgroundColor: tab === "rem" ? colors.primary : colors.background,
          borderRadius: 12, paddingVertical: 10, alignItems: "center",
          borderWidth: 1, borderColor: colors.border,
        }}>
        <Text style={{ color: tab === "rem" ? "#fff" : colors.text, fontWeight: "800" }}>
          یادآور
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- ProgressCard ---------- */
function ProgressCard({ value }:{ value:number }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>پیشرفت امروز</Text>
        <Text style={{ color: "#8E8E93" }}>{toFa(value)}٪</Text>
      </View>
      <ProgressBar value={value} color={colors.primary} track={colors.border} />
    </View>
  );
}

/* +++ TAGS: مودال مدیریت/ویرایش تگ‌ها (نام + آیکن) */
function TagManagerModal({
  visible, onClose, tags, onChange,
}:{
  visible:boolean; onClose:()=>void; tags:TagDef[]; onChange:(next:TagDef[])=>void;
}) {
  const { colors } = useTheme();
  /* ✅ افزوده برای Safe Area پایین مودال */
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
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.35)", alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:"92%", maxHeight:"80%", borderRadius:16, backgroundColor:colors.card, borderWidth:1, borderColor:colors.border, padding:16, paddingBottom: (insets.bottom || 0) + 12, gap:12 }}>
          <Text style={{ color:colors.text, fontWeight:"800", textAlign:"right" }}>مدیریت برچسب‌ها</Text>

          <ScrollView style={{ maxHeight: 340 }}>
            {list.map((t, idx) => (
              <View key={`${t.name}-${idx}`} style={{ borderWidth:1, borderColor:colors.border, borderRadius:12, padding:10, marginBottom:8, gap:8 }}>
                <View style={{ borderWidth:1, borderColor:colors.border, borderRadius:10, paddingHorizontal:10, height:40, justifyContent:"center" }}>
                  <TextInput
                    value={t.name}
                    onChangeText={(v)=>updateTag(idx, { name:v })}
                    placeholder="نام تگ"
                    placeholderTextColor="#8E8E93"
                    style={{ color:colors.text, textAlign:"right" }}
                  />
                </View>

                <View style={{ flexDirection:"row", flexWrap:"wrap", gap:6 }}>
                  {iconBank.map(ic => {
                    const selected = ic === t.icon;
                    return (
                      <TouchableOpacity
                        key={ic}
                        onPress={()=>updateTag(idx,{ icon:ic })}
                        style={{ borderWidth:1, borderColor:selected?colors.primary:colors.border, borderRadius:8, padding:8 }}
                      >
                        <Ionicons name={ic as any} size={18} color={selected?colors.primary:colors.text} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection:"row", justifyContent:"flex-end" }}>
                  <TouchableOpacity onPress={()=>removeAt(idx)}>
                    <Ionicons name="trash-outline" size={18} color="#ff6666" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection:"row", gap:8 }}>
            <TouchableOpacity onPress={addEmpty} style={{ flex:1, borderColor:colors.border, borderWidth:1, borderRadius:12, paddingVertical:10, alignItems:"center" }}>
              <Text style={{ color:colors.text, fontWeight:"800" }}>تگ جدید</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={persist} style={{ flex:1, backgroundColor:colors.primary, borderRadius:12, paddingVertical:10, alignItems:"center" }}>
              <Text style={{ color:"#fff", fontWeight:"800" }}>ذخیره</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} style={{ borderColor:colors.border, borderWidth:1, borderRadius:12, paddingVertical:10, alignItems:"center", marginTop:6 }}>
            <Text style={{ color:colors.text, fontWeight:"800" }}>بستن</Text>
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
  /* ⬇️ اضافه برای ویرایش */
  editingId,
  onEditItem,
  /* +++ TAGS: پروپ‌های تگ */
  todaySelectedTags,
  onAddTagToToday,
  onRemoveTagFromToday,
  tagInput,
  setTagInput,
  allTags,
  /* +++ TAGS: آیکن‌های تگ برای نمایش */
  tagIcons,
}:{
  rtl: boolean;
  items: TodayItem[]; setItems: React.Dispatch<React.SetStateAction<TodayItem[]>>;
  title: string; setTitle: (s:string)=>void;
  time: Date|null;
  onOpenTime: ()=>void;
  onAdd: ()=>void;
  /* ⬇️ اضافه برای ویرایش */
  editingId: string | null;
  onEditItem: (it: TodayItem) => void;
  /* +++ TAGS */
  todaySelectedTags: string[];
  onAddTagToToday: (t:string)=>void;
  onRemoveTagFromToday: (t:string)=>void;
  tagInput: string;
  setTagInput: (s:string)=>void;
  allTags: string[];
  tagIcons: Record<string,string>;
}) {
  const { colors } = useTheme();
  const toggle = (id:string) =>
    setItems(list => sortToday(list.map(it => it.id===id ? {...it, done: !it.done} : it)));
  const remove = (id:string) => setItems(list => list.filter(it => it.id!==id));

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
      <Text style={{ color: "#8E8E93", fontSize: 12, textAlign: "right" }}>
        برنامه امروزت رو اینجا اضافه کن
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={onOpenTime}
          style={{ borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:12, alignItems:"center", justifyContent:"center", height:46 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {time ? toFa(timeLabel(time)) : "انتخاب ساعت"}
          </Text>
        </TouchableOpacity>

        <View style={{ flex:1, borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:12, height:46, justifyContent:"center" }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان کار"
            placeholderTextColor="#8E8E93"
            style={{ color: colors.text, textAlign: rtl ? "right" : "left" }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.8}
          style={{ backgroundColor: colors.primary, borderRadius:12, paddingHorizontal:14, alignItems:"center", justifyContent:"center", height:46 }}>
          {editingId ? (
            <Text style={{ color:"#fff", fontWeight:"800" }}>ذخیره</Text>
          ) : (
            <Ionicons name="add" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* +++ TAGS: فرم انتخاب برچسب برای امروز */}
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {todaySelectedTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} selected onRemove={()=>onRemoveTagFromToday(t)} />
          ))}
        </View>

        <View style={{ flexDirection:"row", alignItems:"center", marginTop:6 }}>
          <View style={{ flex:1, borderWidth:1, borderColor:"#E0E0E0", borderRadius:12, paddingHorizontal:12, height:44, justifyContent:"center" }}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="اضافه‌کردن برچسب"
              placeholderTextColor="#8E8E93"
              onSubmitEditing={()=> onAddTagToToday(tagInput.trim())}
              style={{ color: colors.text, textAlign: "right" }}
            />
          </View>
          <TouchableOpacity onPress={()=> onAddTagToToday(tagInput.trim())} style={{ marginStart:8 }}>
            <Ionicons name="pricetag-outline" size={22} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:6 }}>
          {allTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} onPress={()=>onAddTagToToday(t)} />
          ))}
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={{ color: "#8E8E93", fontSize: 12, textAlign: "center" }}>
          هنوز آیتمی در این برنامه ثبت نشده.
        </Text>
      ) : (
        <View>
          {items.map(item => (
            <View key={item.id}
              style={{ borderWidth:1, borderColor:colors.border, backgroundColor:colors.background, borderRadius:12, padding:10, marginVertical:4, flexDirection:"row", alignItems:"center", gap:8 }}>
              <TouchableOpacity
                onPress={()=>toggle(item.id)}
                style={{ width:22, height:22, borderRadius:6, borderWidth:2, borderColor:item.done?colors.primary:colors.border, alignItems:"center", justifyContent:"center", backgroundColor:item.done?colors.primary:"transparent" }}>
                {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>

              <View style={{ flex:1 }}>
                <Text
                  style={{ color:colors.text, textAlign:"right", textDecorationLine:item.done?"line-through":"none", opacity:item.done?0.6:1 }}
                  onLongPress={() => { setTitle(item.title); remove(item.id); }}
                >
                  {item.title}
                </Text>

                {/* +++ TAGS: نشان دادن تگ‌های آیتم */}
                <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:4 }}>
                  {(item.tags ?? []).map(t => (
                    <TagChip key={t} label={t} iconName={tagIcons[t]} />
                  ))}
                </View>
              </View>

              <Text style={{ color:"#8E8E93", width:52, textAlign:"center" }}>
                {toFa(item.time)}
              </Text>

              {/* ⬇️ آیکن ویرایش */}
              <TouchableOpacity onPress={() => onEditItem(item)}>
                <Ionicons name="create-outline" size={18} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity onPress={()=>remove(item.id)}>
                <Ionicons name="trash-outline" size={18} color="#ff6666" />
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
  /* ⬇️ اضافه برای ویرایش */
  editingId,
  onEditItem,
  /* +++ TAGS: پروپ‌های تگ */
  remSelectedTags,
  onAddTagToRem,
  onRemoveTagFromRem,
  tagInput,
  setTagInput,
  allTags,
  /* +++ TAGS: آیکن‌های تگ برای نمایش */
  tagIcons,
  /* +++ NOTIFS: کنترل‌ها */
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
  /* ⬇️ اضافه برای ویرایش */
  editingId: string | null;
  onEditItem: (it: ReminderItem) => void;
  /* +++ TAGS */
  remSelectedTags: string[];
  onAddTagToRem: (t:string)=>void;
  onRemoveTagFromRem: (t:string)=>void;
  tagInput: string;
  setTagInput: (s:string)=>void;
  allTags: string[];
  tagIcons: Record<string,string>;
  /* +++ NOTIFS */
  onToggleReminder: (id:string)=>void;
  onRemoveReminder: (id:string)=>void;
  onSnoozeReminder: (id:string)=>void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
      <Text style={{ color:"#8E8E93", fontSize:12, textAlign:"right" }}>
        کارهای مهم خودت رو در روزهای آینده اینجا اضافه کن
      </Text>

      {/* ورودی‌ها */}
      <View style={{ flexDirection:"row", gap:8, flexWrap:"wrap" }}>
        <TouchableOpacity
          onPress={onOpenDate}
          style={{ borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:12, alignItems:"center", justifyContent:"center", height:46 }}>
          <Text style={{ color: colors.text, fontWeight:"700" }}>
            {toFa(jy)}/{toFa(pad(jm))}/{toFa(pad(jd))}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenTime}
          style={{ borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:12, alignItems:"center", justifyContent:"center", height:46 }}>
          <Text style={{ color: colors.text, fontWeight:"700" }}>
            {remTime ? toFa(timeLabel(remTime)) : "انتخاب ساعت"}
          </Text>
        </TouchableOpacity>

        <View style={{ flex:1, borderWidth:1, borderColor:colors.border, borderRadius:12, paddingHorizontal:12, height:46, justifyContent:"center" }}>
          <TextInput
            value={remTitle}
            onChangeText={setRemTitle}
            placeholder="عنوان"
            placeholderTextColor="#8E8E93"
            style={{ color: colors.text, textAlign: rtl ? "right" : "left" }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.8}
          style={{ backgroundColor: colors.primary, borderRadius:12, paddingHorizontal:14, alignItems:"center", justifyContent:"center", height:46 }}>
          {editingId ? (
            <Text style={{ color:"#fff", fontWeight:"800" }}>ذخیره</Text>
          ) : (
            <Ionicons name="add" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* +++ TAGS: فرم انتخاب برچسب برای یادآور */}
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {remSelectedTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} selected onRemove={()=>onRemoveTagFromRem(t)} />
          ))}
        </View>

        <View style={{ flexDirection:"row", alignItems:"center", marginTop:6 }}>
          <View style={{ flex:1, borderWidth:1, borderColor:"#E0E0E0", borderRadius:12, paddingHorizontal:12, height:44, justifyContent:"center" }}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="اضافه‌کردن برچسب"
              placeholderTextColor="#8E8E93"
              onSubmitEditing={()=> onAddTagToRem(tagInput.trim())}
              style={{ color: colors.text, textAlign: "right" }}
            />
          </View>
          <TouchableOpacity onPress={()=> onAddTagToRem(tagInput.trim())} style={{ marginStart:8 }}>
            <Ionicons name="pricetag-outline" size={22} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:6 }}>
          {allTags.map(t => (
            <TagChip key={t} label={t} iconName={tagIcons[t]} onPress={()=>onAddTagToRem(t)} />
          ))}
        </View>
      </View>

      {/* لیست یادآورها (الان با تیک انجام + اسنوز) */}
      {items.length === 0 ? (
        <Text style={{ color:"#8E8E93", fontSize:12, textAlign:"center" }}>
          هنوز یادآوری ثبت نشده است.
        </Text>
      ) : (
        <View>
          {items.map(item => {
            const d = new Date(item.when);
            const done = !!item.done;
            return (
              <View key={item.id}
                style={{ borderWidth:1, borderColor:colors.border, backgroundColor:colors.background, borderRadius:12, padding:10, marginVertical:4, flexDirection:"row", alignItems:"center", gap:8 }}>
                {/* ⬇️ چک‌باکس */}
                <TouchableOpacity
                  onPress={()=>onToggleReminder(item.id)}
                  style={{ width:22, height:22, borderRadius:6, borderWidth:2, borderColor:done?colors.primary:colors.border, alignItems:"center", justifyContent:"center", backgroundColor:done?colors.primary:"transparent" }}>
                  {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>

                <View style={{ flex:1 }}>
                  <Text style={{ color:colors.text, fontWeight:"700", textAlign:"right", textDecorationLine: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color:"#8E8E93", fontSize:12, textAlign:"right" }}>
                    {jalaliLabel(d)} • {toFa(timeLabel(d))}
                  </Text>

                  {/* +++ TAGS: نشان دادن تگ‌های آیتم */}
                  <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:4 }}>
                    {(item.tags ?? []).map(t => (
                      <TagChip key={t} label={t} iconName={tagIcons[t]} />
                    ))}
                  </View>

                  {/* +++ NOTIFS: اسنوز */}
                  {!done && (
                    <View style={{ flexDirection:"row", justifyContent:"flex-start", marginTop:6 }}>
                      <TouchableOpacity onPress={()=>onSnoozeReminder(item.id)} style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, paddingHorizontal:10, paddingVertical:6, alignItems:"center", flexDirection:"row", gap:6 }}>
                        <Ionicons name="time-outline" size={16} color={colors.text} />
                        <Text style={{ color:colors.text, fontSize:12 }}>+۱۰ دقیقه</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* ⬇️ آیکن ویرایش */}
                <TouchableOpacity onPress={() => onEditItem(item)}>
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity onPress={()=>onRemoveReminder(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ff6666" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ---------- DateModal: انتخاب سریع سال/ماه/روز شمسی (بدون محاسبه‌ی روز هفته) ---------- */
function DateModal({
  visible, onClose,
  jy, jm, jd, setJy, setJm, setJd,
}:{
  visible:boolean; onClose:()=>void;
  jy:number; jm:number; jd:number; setJy:(n:number)=>void; setJm:(n:number)=>void; setJd:(n:number)=>void;
}) {
  const { colors } = useTheme();
  /* ✅ افزوده برای Safe Area پایین مودال تاریخ */
  const insets = useSafeAreaInsets();
  const monthsFa = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

  // برای جلوگیری از باگ روزِ نامعتبر بعد از تغییر ماه/سال
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

  // تولید روزها از 1 تا آخر ماه
  const daysInMonth = jalaaliMonthLength(jy, jm);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.35)", alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:"92%", borderRadius:16, backgroundColor:colors.card, borderWidth:1, borderColor:colors.border, padding:16, paddingBottom: (insets.bottom || 0) + 12, gap:12 }}>

          {/* سال */}
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between",
                         borderWidth:1, borderColor:colors.border, borderRadius:12, padding:10 }}>
            <TouchableOpacity onPress={()=>changeYear(-1)}>
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color:colors.text, fontWeight:"800" }}>
              {String(jy).replace(/\d/g, d=>"۰۱۲۳۴۵۶۷۸۹"[+d])}
            </Text>
            <TouchableOpacity onPress={()=>changeYear(1)}>
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* انتخاب سریع ماه‌ها: شبکه ۳×۴ */}
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, justifyContent:"space-between" }}>
            {monthsFa.map((mTitle, idx) => {
              const m = idx + 1;
              const selected = jm === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={()=>selectMonth(m)}
                  style={{
                    width: "31%",
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : "transparent",
                  }}>
                  <Text style={{ color: selected ? "#fff" : colors.text, fontWeight:"700" }}>{mTitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* روزهای ماه */}
          <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:4 }}>
            {days.map((d) => {
              const selected = d === jd;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={()=>setJd(d)}
                  style={{
                    width: `${100/7}%`,
                    aspectRatio: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    marginVertical: 2,
                    borderRadius: 10,
                    backgroundColor: selected ? colors.primary : "transparent",
                  }}>
                  <Text style={{ color: selected ? "#fff" : colors.text, fontWeight:"700" }}>
                    {String(d).replace(/\d/g, x=>"۰۱۲۳۴۵۶۷۸۹"[+x])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* دکمه‌ها */}
          <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex:1, backgroundColor:colors.primary, borderRadius:12, paddingVertical:10, alignItems:"center" }}>
              <Text style={{ color:"#fff", fontWeight:"800" }}>تأیید</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex:1, borderColor:colors.border, borderWidth:1, borderRadius:12, paddingVertical:10, alignItems:"center" }}>
              <Text style={{ color:colors.text, fontWeight:"800" }}>بستن</Text>
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
  const { colors } = useTheme();
  const { setDayProgress } = usePhoenix();

  const [tab, setTab] = useState<"today" | "rem">("today");

  // امروز
  const [todayTitle, setTodayTitle] = useState("");
  const [todayTime, setTodayTime] = useState<Date | null>(null);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [showTodayTime, setShowTodayTime] = useState(false);
  /* ⬇️ اضافه برای ویرایش امروز */
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
  /* ⬇️ اضافه برای ویرایش یادآور */
  const [remEditingId, setRemEditingId] = useState<string | null>(null);

  /* +++ TAGS: استیت‌های برچسب */
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [todayTags, setTodayTags] = useState<string[]>([]);
  const [remTags, setRemTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  /* +++ TAGS: آیکن هر تگ (persist locally in this file) */
  const [tagIcons, setTagIcons] = useState<Record<string,string>>({});
  const [showTagManager, setShowTagManager] = useState(false);

  /* ⬇️ ADDED: فلگ لود اولیه برای جلوگیری از سیو قبلِ لود */
  const loadedRef = useRef(false);

  /* +++ NOTIFS: وضعیت اجازه */
  const [notifAllowed, setNotifAllowed] = useState<boolean>(false);
  const askedRef = useRef(false);

  /* +++ NOTIFS: کانال اندروید */
  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Reminders",
          importance: Notifications.AndroidImportance.MAX, // ⬅️ فقط این خط تغییر کرد (قبلاً DEFAULT بود)
          sound: "default", // ⬅️ تغییر برای فعال‌کردن صدای پیش‌فرض
          audioAttributes: { // ⬅️ اضافه برای اطمینان از پخش صدا
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // ✅ دستهٔ اکشن‌ها فقط iOS
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
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    if (!granted) {
      const res = await Notifications.requestPermissionsAsync();
      granted = res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
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

  // ⬇️⬇️ تنها اصلاح لازم: استفاده از trigger: Date برای iOS و Android
  const scheduleForReminder = async (it: ReminderItem): Promise<string | undefined> => {
    if (!(await ensureNotifPermission())) return undefined;

    const triggerDate = new Date(it.when);
    if (triggerDate.getTime() <= Date.now()) return undefined;

    const content: Notifications.NotificationContentInput & { categoryIdentifier?: string; data?: any } = {
      title: "یادآور",
      body: it.title,
      sound: "default", // ⬅️ تغییر برای فعال‌کردن صدای پیش‌فرض در iOS/Android
      categoryIdentifier: Platform.OS === "ios" ? "reminder_actions" : undefined, // ✅ iOS actions
      data: { rid: it.id }, // ✅ برای واکنش به Tap/Action
    };

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: triggerDate, // ✅ پایدارترین حالت در اکسپو
    });

    return id;
  };

  const cancelNotif = async (id?: string) => {
    if (!id) return;
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  };

  const sortToday = (arr: TodayItem[]) =>
    [...arr].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.time !== b.time) return a.time < b.time ? -1 : 1;
      if (a.title !== b.title) return a.title.localeCompare(b.title, "fa");
      return a.createdAt - b.createdAt;
    });

  const todayProgress = useMemo(() => {
    const total = todayItems.length;
    if (!total) return 0;
    const done = todayItems.filter((i) => i.done).length;
    return Math.round((done / total) * 100);
  }, [todayItems]);

  React.useEffect(() => {
    setDayProgress(todayProgress);
  }, [todayProgress, setDayProgress]);

  /* ⬇️ ADDED: لود اولیه از استوریج */
  useEffect(() => {
    (async () => {
      try {
        const [tList, rList, tags, iconMapStr] = await Promise.all([
          loadToday(), loadReminders(), loadTags(), AsyncStorage.getItem(K_TAG_ICONS)
        ]);
        if (Array.isArray(tList)) setTodayItems(prev => (prev.length ? prev : sortToday(tList)));
        if (Array.isArray(rList)) setRemItems(prev => (prev.length ? prev : sortReminders(rList)));
        if (Array.isArray(tags)) setAllTags(tags);
        if (iconMapStr) {
          try { setTagIcons(JSON.parse(iconMapStr) || {}); } catch { setTagIcons({}); }
        }
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  /* ⬇️ ADDED: سیو خودکار امروز */
  useEffect(() => {
    if (!loadedRef.current) return;
    saveToday(todayItems).catch(() => {});
  }, [todayItems]);

  /* ⬇️ ADDED: سیو خودکار یادآور */
  useEffect(() => {
    if (!loadedRef.current) return;
    saveReminders(remItems).catch(() => {});
  }, [remItems]);

  /* +++ TAGS: سیو خودکار تگ‌ها */
  useEffect(() => {
    if (!loadedRef.current) return;
    saveTags(allTags).catch(()=>{});
  }, [allTags]);

  /* +++ TAGS: سیو خودکار آیکن‌ها */
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(K_TAG_ICONS, JSON.stringify(tagIcons)).catch(()=>{});
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
            it.id === todayEditingId ? { ...it, title: t, time: timeLabel(todayTime), /* +++ TAGS */ tags: todayTags } : it
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
        /* +++ TAGS */ tags: todayTags,
      };
      setTodayItems((list) => sortToday([...list, item]));
    }

    setTodayTitle("");
    setTodayTime(null);
    setTodayTags([]); /* +++ TAGS: ریست تگ‌های انتخاب‌شده */
    Keyboard.dismiss();
  };

  const addReminder = async () => {
    const t = remTitle.trim();
    /* ⬇️ تنها تغییرِ این تابع: اگر ساعت انتخاب نشده بود هشدار بده */
    if (!t) return;
    if (!remTime) {
      Alert.alert("ساعت لازم است", "برای ثبت یادآور، حتماً ساعت را انتخاب کن.");
      return;
    }
    const g = toGregorian(jy, jm, jd);
    const when = new Date(g.gy, g.gm - 1, g.gd, remTime.getHours(), remTime.getMinutes(), 0, 0);

    if (remEditingId) {
      // ویرایش: ابتدا نوتیف قبلی لغو، سپس زمان‌بندی جدید
      let updatedNotificationId: string | undefined;
      await Promise.resolve(); // برای ایمنی async
      setRemItems((list) => {
        const mapped = list.map((it) => {
          if (it.id === remEditingId) {
            // لغو قبلی
            cancelNotif(it.notificationId);
            return { ...it, title: t, when: when.getTime(), /* +++ TAGS */ tags: remTags, notificationId: undefined };
          }
          return it;
        });
        return sortReminders(mapped);
      });
      // زمان‌بندی جدید
      updatedNotificationId = await scheduleForReminder({ id: remEditingId, title: t, when: when.getTime(), createdAt: Date.now(), done: false, tags: remTags });
      setRemItems((list) =>
        list.map((it) => (it.id === remEditingId ? { ...it, notificationId: updatedNotificationId } : it))
      );
      setRemEditingId(null);
    } else {
      const base: ReminderItem = { id: uid(), title: t, when: when.getTime(), createdAt: Date.now(), done: false, /* +++ TAGS */ tags: remTags };
      const notificationId = await scheduleForReminder(base);
      const item: ReminderItem = { ...base, notificationId };
      /* ⬇️ تغییر 3: افزودن مرتب‌سازی بعد از اضافه‌کردن */
      setRemItems((list) => sortReminders([...list, item]));
    }

    setRemTitle("");
    setRemTime(null);
    setRemTags([]); /* +++ TAGS: ریست تگ‌ها */
    Keyboard.dismiss();
  };

  /* +++ TAGS: فهرستِ فیلترشده */
  const filteredToday = activeTag ? todayItems.filter(i => (i.tags ?? []).includes(activeTag)) : todayItems;
  const filteredRem   = activeTag ? remItems.filter(i => (i.tags ?? []).includes(activeTag)) : remItems;

  /* +++; TAGS: تهیه لیست TagDef برای ویرایشگر از روی allTags + tagIcons */
  const tagDefs: TagDef[] = useMemo(() => {
    return (allTags || []).map(name => ({ name, icon: tagIcons[name] || "pricetag-outline" }));
  }, [allTags, tagIcons]);

  /* +++ NOTIFS: هندل‌های حذف/تیک/اسنوز */
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
      // انجام شد -> لغو نوتیف
      if (target.notificationId) await cancelNotif(target.notificationId);
      setRemItems(list => sortReminders(list.map(r => r.id === id ? { ...r, done: true, notificationId: undefined } : r)));
    } else {
      // از حالت انجام به ناتمام -> اگر در آینده است، زمان‌بندی کن
      const notificationId = await scheduleForReminder({ ...target, done: false });
      setRemItems(list => sortReminders(list.map(r => r.id === id ? { ...r, done: false, notificationId } : r)));
    }
  };

  const handleSnoozeReminder = async (id: string) => {
    const target = remItems.find(r => r.id === id);
    if (!target) return;
    const base = Math.max(Date.now(), target.when);
    const nextWhen = base + 10 * 60 * 1000; // +۱۰ دقیقه
    if (target.notificationId) await cancelNotif(target.notificationId);
    const next: ReminderItem = { ...target, when: nextWhen, done: false };
    const newNotif = await scheduleForReminder(next);
    setRemItems(list =>
      sortReminders(list.map(r => r.id === id ? { ...next, notificationId: newNotif } : r))
    );
  };

  /* ✅ لیسنر اکشن/تپ روی نوتیف: iOS اکشن‌ها، Android دیالوگ سریع بعد از Tap */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const rid = (resp?.notification?.request?.content?.data as any)?.rid as string | undefined;
      const act = resp?.actionIdentifier;

      if (!rid) return;

      if (Platform.OS === "ios") {
        if (act === "DONE") {
          handleToggleReminder(rid);
          return;
        }
        if (act === "SNOOZE_10") {
          handleSnoozeReminder(rid);
          return;
        }
        return; // Tap ساده روی iOS: فعلاً کاری نمی‌کنیم
      }

      // Android: Tap روی نوتیف → دیالوگ سریع
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom, paddingHorizontal: 0, rowGap: 14, direction: rtl ? "rtl" : "ltr" }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        >
          <View style={{ paddingHorizontal: 16 }}>
            <RoozHeader />
            <ProgressCard value={todayProgress} />
            <Segmented tab={tab} setTab={setTab} />

            {/* +++ TAGS: نوار فیلتر تگ‌ها */}
            <View style={{ marginTop: 8, flexDirection:"row", flexWrap:"wrap", alignItems:"center" }}>
              <TagChip label="همه" selected={activeTag === null} onPress={()=>setActiveTag(null)} />
              {allTags.map(t => (
                <TagChip key={t} label={t} iconName={tagIcons[t]} selected={activeTag === t} onPress={()=>setActiveTag(t)} />
              ))}
              {/* دکمه مدیریت تگ‌ها */}
              <TouchableOpacity onPress={()=>setShowTagManager(true)} style={{ marginStart:6 }}>
                <Ionicons name="settings-outline" size={20} color={colors.text} />
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
                /* ⬇️ پروپ‌های ویرایش امروز */
                editingId={todayEditingId}
                onEditItem={(it) => {
                  setTodayEditingId(it.id);
                  setTodayTitle(it.title);
                  const [hh, mm] = it.time.split(":").map((x) => parseInt(x, 10));
                  const d = new Date();
                  d.setHours(hh || 0, mm || 0, 0, 0);
                  setTodayTime(d);
                  setTodayTags(it.tags ?? []); /* +++ TAGS: بارگذاری تگ‌ها برای ویرایش */
                }}
                /* +++ TAGS: ارسال پراپ‌ها */
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
                /* ⬇️ پروپ‌های ویرایش یادآور */
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
                  setRemTags(it.tags ?? []); /* +++ TAGS: بارگذاری تگ‌ها */
                }}
                /* +++ TAGS: ارسال پراپ‌ها */
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
                /* +++ NOTIFS: ارسال کنترل‌ها */
                onToggleReminder={handleToggleReminder}
                onRemoveReminder={handleRemoveReminder}
                onSnoozeReminder={handleSnoozeReminder}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* پیکرهای زمان/تاریخ */}
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

      {/* +++ TAGS: مدیر تگ‌ها */}
      <TagManagerModal
        visible={showTagManager}
        onClose={()=>setShowTagManager(false)}
        tags={tagDefs}
        onChange={(next)=>{
          // به‌روزرسانی نام‌ها (allTags) و آیکن‌ها (tagIcons)
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

/* ⬇️ تابع جدید برای مرتب‌سازی یادآورها (تنها افزودنی این پایین) */
function sortReminders(arr: ReminderItem[]) {
  return [...arr].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1; // done بره پایین
    if (a.when !== b.when) return a.when - b.when;     // بر اساس تاریخ/ساعت
    return a.title.localeCompare(b.title, "fa");
  });
}