import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { filterCatalog, type CatalogChoice } from "../business/catalog-search";

type Props = {
  label: string; items: CatalogChoice[]; value: string; onSelect(id: string): void;
  status: "idle" | "loading" | "ready" | "error"; disabled?: boolean; error?: string;
  onRetry(): void;
};

export function CatalogSelector({ label, items, value, onSelect, status, disabled, error, onRetry }: Props) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const selected = items.find(item => item.id === value);
  const available = status === "ready" && items.length > 0;
  const close = () => { setOpen(false); setQuery(""); };
  useEffect(() => { if (disabled || !available) { setOpen(false); setQuery(""); } }, [disabled, available]);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.name ?? "Chưa chọn"}`}
      accessibilityHint="Mở danh sách có tìm kiếm" accessibilityState={{ disabled: !!disabled || !available }}
      disabled={disabled || !available} onPress={() => { setQuery(""); setOpen(true); }}
      style={[styles.trigger, (disabled || !available) && styles.disabled, !!error && styles.invalid]}>
      <Text style={[styles.value, !selected && styles.muted]}>{selected?.name ?? `Chọn ${label.toLocaleLowerCase("vi")}`}</Text>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>
    {(status === "loading" || status === "idle") && <View style={styles.loading}><ActivityIndicator color="#AD4709" /><Text style={styles.muted}>Đang tải {label.toLocaleLowerCase("vi")}…</Text></View>}
    {status === "error" && <Text accessibilityLiveRegion="polite" style={styles.error}>Chưa tải được {label.toLocaleLowerCase("vi")}. Nội dung bạn đang soạn vẫn được giữ.</Text>}
    {status === "ready" && !items.length && <Text accessibilityLiveRegion="polite" style={styles.muted}>Chưa có {label.toLocaleLowerCase("vi")} được cấu hình. Vui lòng tải lại sau.</Text>}
    {(status === "error" || (status === "ready" && !items.length)) && <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }} onPress={onRetry} style={styles.retry}><Text style={styles.link}>Tải lại {label.toLocaleLowerCase("vi")}</Text></Pressable>}
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <Modal visible={open && !disabled && available} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Chọn {label.toLocaleLowerCase("vi")}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Đóng chọn ${label.toLocaleLowerCase("vi")}`} onPress={close} style={styles.close}><Text style={styles.link}>Đóng</Text></Pressable></View>
          <TextInput accessibilityLabel={`Tìm ${label.toLocaleLowerCase("vi")}`} value={query} onChangeText={setQuery} placeholder="Tìm theo tên, có hoặc không dấu" placeholderTextColor="#767676" autoCorrect={false} style={styles.search} />
          <FlatList data={filterCatalog(items, query)} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.muted}>Không có lựa chọn phù hợp. Hãy thử từ khóa khác.</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: item.id === value }} onPress={() => { onSelect(item.id); close(); }} style={[styles.option, item.id === value && styles.selected]}><Text style={styles.value}>{item.name}</Text><Text style={styles.link}>{item.id === value ? "●" : "○"}</Text></Pressable>} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 }, label: { fontSize: 17, fontWeight: "600", color: "#252525" },
  trigger: { minHeight: 52, padding: 14, borderWidth: 1, borderColor: "#C5C5C5", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  value: { fontSize: 16, color: "#252525", flex: 1, lineHeight: 23 }, muted: { color: "#626262", fontSize: 15, lineHeight: 22 },
  chevron: { color: "#AD4709", fontSize: 24 }, disabled: { opacity: 0.6 }, invalid: { borderColor: "#A12222" }, error: { color: "#A12222", lineHeight: 22 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 }, retry: { minHeight: 44, justifyContent: "center" }, link: { color: "#AD4709", fontSize: 16, fontWeight: "600" },
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 8 }, title: { flex: 1, fontSize: 23, fontWeight: "700", color: "#252525" }, close: { minHeight: 48, padding: 12, justifyContent: "center" },
  search: { minHeight: 52, marginHorizontal: 20, marginVertical: 12, borderWidth: 1, borderColor: "#C5C5C5", borderRadius: 12, padding: 14, fontSize: 16, color: "#252525" },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 }, option: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#DEDEDE" }, selected: { backgroundColor: "#FFF0DE", borderColor: "#AD4709" },
});
