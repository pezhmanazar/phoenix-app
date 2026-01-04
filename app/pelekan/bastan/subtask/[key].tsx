// app/pelekan/bastan/subtask/[key].tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AR1OwnShareScreen from "./AR_1_own_share";
import AR2PatternLinkScreen from "./AR_2_pattern_link";
import AR3BoundaryNextTimeScreen from "./AR_3_boundary_next_time";
import AR4NoBlameConfirmScreen from "./AR_4_no_blame_confirm";
import CC1ReadContractScreen from "./CC_1_read_contract";
import CC2SignatureScreen from "./CC_2_signature";
import CR1ChooseRitualScreen from "./CR_1_choose_ritual";
import CR2DoRitualScreen from "./CR_2_do_ritual";
import CR3AfterFeelingScreen from "./CR_3_after_feeling";
import CR4CloseConfirmWithDate from "./CR_4_close_confirm_with_date";
import FRL0ContactGateScreen from "./FRL_0_contact_gate";
import FRL1DefineRolesScreen from "./FRL_1_define_roles";
import FRL2ContactRulesScreen from "./FRL_2_contact_rules";
import FRL3NoEmotionalContactConfirmScreen from "./FRL_3_no_emotional_contact_confirm";
import FRL4BoundaryScriptScreen from "./FRL_4_boundary_script";
import FRL5ViolationPlanScreen from "./FRL_5_violation_plan";
import ML1WhatDidILearnScreen from "./ML_1_what_did_i_learn";
import ML2PatternAwarenessScreen from "./ML_2_pattern_awareness";
import ML3ValuesNextTimeScreen from "./ML_3_values_next_time";
import ML4GoldenRuleScreen from "./ML_4_golden_rule";
import ML5LearningConfirmScreen from "./ML_5_learning_confirm";
import RC1RedFlagsScreen from "./RC_1_red_flags";
import RC2CostsScreen from "./RC_2_costs";
import RC3RealityVsFantasyScreen from "./RC_3_reality_vs_fantasy";
import RC4DealBreakersScreen from "./RC_4_deal_breakers";
import RC5CommitConfirmScreen from "./RC_5_commit_confirm";
import TD1SocialCleanupScreen from "./TD_1_social_cleanup";
import TD2GalleryCleanupScreen from "./TD_2_gallery_cleanup";
import TD3PlacesPlaylistScreen from "./TD_3_places_playlist";
import TD4IfThenPlanScreen from "./TD_4_if_then_plan";
import TD5HomeObjectScreen from "./TD_5_home_object";
import TD6DetoxConfirmScreen from "./TD_6_detox_confirm";
import UL1LetterWriteOrPhotoScreen from "./UL_1_letter_write_or_photo";
import UL2NoSendConfirmScreen from "./UL_2_no_send_confirm";
import UL3UrgeWaveControlScreen from "./UL_3_72h_lock_confirm";
import UL4StoreRitualScreen from "./UL_4_store_ritual";
/* ----------------------------- UI ----------------------------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
};

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

export default function BastanSubtaskRouter() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const subtaskKey = String((params as any)?.key || "").trim();

 console.log("CR3AfterFeelingScreen typeof =", typeof CR3AfterFeelingScreen);
 console.log("CR3AfterFeelingScreen value =", CR3AfterFeelingScreen);

  // ✅ dispatch
if (subtaskKey === "RC_1_red_flags") return <RC1RedFlagsScreen />;
if (subtaskKey === "RC_2_costs") return <RC2CostsScreen />;
if (subtaskKey === "RC_3_reality_vs_fantasy") return <RC3RealityVsFantasyScreen />;
if (subtaskKey === "RC_4_deal_breakers") return <RC4DealBreakersScreen />;
if (subtaskKey === "RC_5_commit_confirm") return <RC5CommitConfirmScreen />;

if (subtaskKey === "AR_1_own_share") return <AR1OwnShareScreen />;
if (subtaskKey === "AR_2_pattern_link") return <AR2PatternLinkScreen />;
if (subtaskKey === "AR_3_boundary_next_time") return <AR3BoundaryNextTimeScreen />;
if (subtaskKey === "AR_4_no_blame_confirm") return <AR4NoBlameConfirmScreen />;

if (subtaskKey === "UL_1_letter_write_or_photo") return <UL1LetterWriteOrPhotoScreen />;
if (subtaskKey === "UL_2_no_send_confirm") return <UL2NoSendConfirmScreen />;
if (subtaskKey === "UL_3_72h_lock_confirm") return <UL3UrgeWaveControlScreen />;
if (subtaskKey === "UL_4_store_ritual") return <UL4StoreRitualScreen />;

if (subtaskKey === "TD_1_social_cleanup") return <TD1SocialCleanupScreen />;
if (subtaskKey === "TD_2_gallery_cleanup") return <TD2GalleryCleanupScreen />;
if (subtaskKey === "TD_3_places_playlist") return <TD3PlacesPlaylistScreen />;
if (subtaskKey === "TD_4_if_then_plan") return <TD4IfThenPlanScreen />;
if (subtaskKey === "TD_5_home_object") return <TD5HomeObjectScreen />;
if (subtaskKey === "TD_6_detox_confirm") return <TD6DetoxConfirmScreen />;

if (subtaskKey === "FRL_0_contact_gate") return <FRL0ContactGateScreen />;
if (subtaskKey === "FRL_1_define_roles") return <FRL1DefineRolesScreen />;
if (subtaskKey === "FRL_2_contact_rules") return <FRL2ContactRulesScreen />;
if (subtaskKey === "FRL_3_no_emotional_contact_confirm") return <FRL3NoEmotionalContactConfirmScreen />;
if (subtaskKey === "FRL_4_boundary_script") return <FRL4BoundaryScriptScreen />;
if (subtaskKey === "FRL_5_violation_plan") return <FRL5ViolationPlanScreen />;

if (subtaskKey === "ML_1_what_did_i_learn") return <ML1WhatDidILearnScreen />;
if (subtaskKey === "ML_2_pattern_awareness") return <ML2PatternAwarenessScreen />;
if (subtaskKey === "ML_3_values_next_time") return <ML3ValuesNextTimeScreen />;
if (subtaskKey === "ML_4_golden_rule") return <ML4GoldenRuleScreen />;
if (subtaskKey === "ML_5_learning_confirm") return <ML5LearningConfirmScreen />;

if (subtaskKey === "CR_1_choose_ritual") return <CR1ChooseRitualScreen />;
if (subtaskKey === "CR_2_do_ritual") return <CR2DoRitualScreen />;
if (subtaskKey === "CR_3_after_feeling") return <CR3AfterFeelingScreen />;
if (subtaskKey === "CR_4_close_confirm_with_date") return <CR4CloseConfirmWithDate />;


if (subtaskKey === "CC_1_read_contract") return <CC1ReadContractScreen />;
if (subtaskKey === "CC_2_signature") return <CC2SignatureScreen />;

  // ✅ fallback (همان UI قبلی)
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>ریز‌اقدام</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {faOnlyTitle(subtaskKey || "—")}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      <View style={styles.center}>
        <Text style={styles.mutedText}>این ریز‌اقدام هنوز طراحی نشده.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  glowTop: {
    position: "absolute",
    top: 0,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -30,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.glass2,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },
  headerSub: { color: "rgba(231,238,247,.85)", marginTop: 4, fontSize: 12, textAlign: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mutedText: { color: palette.muted, fontSize: 12, textAlign: "center" },
});