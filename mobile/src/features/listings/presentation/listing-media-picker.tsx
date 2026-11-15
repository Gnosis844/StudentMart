import { useSyncExternalStore } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ListingMediaModel } from "../business/listing-media-model";
export function ListingMediaPicker({ model }: { model: ListingMediaModel }) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Ảnh tin đăng ({state.entries.length}/8)</Text>
    <Text style={styles.hint}>JPEG, PNG hoặc WebP; tối đa 10 MiB/ảnh, 24 megapixel. Ảnh đầu tiên là ảnh bìa. Chọn ảnh không đồng nghĩa đã đăng tin.</Text>
    <Pressable accessibilityRole="button" disabled={state.busy || state.entries.length >= 8} onPress={() => { void model.choose(); }} style={[styles.button, (state.busy || state.entries.length >= 8) && styles.disabled]}><Text style={styles.buttonText}>+ Chọn ảnh từ thư viện</Text></Pressable>
    {state.busy && <View accessibilityLiveRegion="polite"><ActivityIndicator color="#AD4709" /><Text>Đang xử lý ảnh…</Text></View>}
    {state.entries.length === 0 && <Text style={styles.hint}>Chưa có ảnh. Ảnh đã chọn sẽ hiện tại đây.</Text>}
    {state.entries.map((entry, index) => <View style={styles.card} key={entry.key}>
      <Image source={{ uri: entry.media?.url ?? entry.asset.uri }} accessibilityLabel={"Ảnh tin đăng " + (index + 1)} style={styles.preview} />
      <Text style={styles.label}>{index === 0 ? "Ảnh bìa" : "Ảnh " + (index + 1)} · {entry.status === "confirmed" ? "Đã tải lên, chưa gắn tin" : entry.status === "uploading" ? "Đang tải lên" : entry.status === "error" ? "Chưa tải được" : "Chỉ có trên thiết bị"}</Text>
      {!!entry.error && <Text accessibilityLiveRegion="polite" style={styles.error}>{entry.error}</Text>}
      {entry.media && <Text style={styles.hint}>Ảnh chưa gắn tin hết hạn: {new Date(entry.media.expiresAt).toLocaleString("vi-VN")}</Text>}
      <View style={styles.actions}>
        {(entry.status !== "confirmed" || (entry.media && Date.parse(entry.media.expiresAt) <= Date.now())) && <Pressable accessibilityRole="button" disabled={state.busy} style={styles.action} onPress={() => { void model.upload(entry.key); }}><Text style={styles.link}>{entry.status === "error" || entry.media ? "Thử tải lại" : "Tải ảnh lên"}</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={"Chuyển ảnh " + (index + 1) + " lên trước"} disabled={state.busy || index === 0} style={[styles.action, index === 0 && styles.disabled]} onPress={() => model.move(entry.key, -1)}><Text>← Trước</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={"Chuyển ảnh " + (index + 1) + " xuống sau"} disabled={state.busy || index === state.entries.length - 1} style={[styles.action, index === state.entries.length - 1 && styles.disabled]} onPress={() => model.move(entry.key, 1)}><Text>Sau →</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={state.busy} style={styles.action} onPress={() => { void model.remove(entry.key); }}><Text style={styles.error}>Xóa ảnh</Text></Pressable>
      </View>
    </View>)}
    {!!state.message && <Text accessibilityLiveRegion="polite" style={styles.error}>{state.message}</Text>}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 14 }, heading: { fontSize: 20, fontWeight: "700", color: "#252525" }, hint: { fontSize: 14, lineHeight: 21, color: "#626262" }, button: { backgroundColor: "#AD4709", padding: 16, borderRadius: 12, minHeight: 48, alignItems: "center" }, buttonText: { color: "white", fontSize: 16, fontWeight: "700" }, card: { backgroundColor: "white", padding: 14, borderColor: "#DDD", borderWidth: 1, borderRadius: 14, gap: 10 }, preview: { width: "100%", height: 190, borderRadius: 10, resizeMode: "contain", backgroundColor: "#EEE" }, label: { fontSize: 16, fontWeight: "600" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, action: { padding: 12, minHeight: 48, justifyContent: "center" }, link: { color: "#AD4709", fontWeight: "600" }, error: { color: "#A12C24", lineHeight: 21 }, disabled: { opacity: 0.4 } });
