import React from "react";
import { View, TextInput, Text, Pressable, ActivityIndicator } from "react-native";

export function PhoneInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>شماره موبایل</Text>
      <TextInput
        keyboardType="phone-pad"
        value={value}
        onChangeText={onChange}
        placeholder="مثلاً 0912xxxxxxx"
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 12,
          borderRadius: 10,
          fontSize: 16,
        }}
      />
      <Pressable
        onPress={onSubmit}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff" }}>ارسال کد</Text>}
      </Pressable>
    </View>
  );
}

export function CodeInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>کد تأیید</Text>
      <TextInput
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        placeholder="کد ۵ رقمی"
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 12,
          borderRadius: 10,
          fontSize: 16,
          letterSpacing: 6,
          textAlign: "center",
        }}
        maxLength={6}
      />
      <Pressable
        onPress={onSubmit}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff" }}>تأیید</Text>}
      </Pressable>
    </View>
  );
}