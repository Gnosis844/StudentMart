import { useEffect, useSyncExternalStore } from "react";
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { AuthButton, AuthField, AuthLayout } from "../../auth/presentation/auth-components";
import type { ListingCreateModel } from "../business/listing-create-model";
import type { ListingCondition, ListingLookup, ListingType } from "../business/listing-create";
import type { ListingMediaModel } from "../business/listing-media-model";
import { ListingMediaPicker } from "./listing-media-picker";
import { CatalogSelector } from "./catalog-selector";
function Choices({ items, value, select, disabled }: { items: ListingLookup[]; value: string; select(id: string): void; disabled: boolean }) {
  return <View style={styles.choices}>{items.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: value === item.id, disabled }} disabled={disabled} onPress={() => select(item.id)} style={[styles.choice, item.id === value && styles.selected]}><Text style={styles.text}>{item.name}</Text></Pressable>)}</View>;
}
export function ListingComposeScreen({ model, media, onBack, onCreated }: { model: ListingCreateModel; media: ListingMediaModel; onBack(): void; onCreated(id: string): void }) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const images = useSyncExternalStore(media.subscribe, media.getSnapshot);
  const d = state.draft, errors = model.errors(), locked = state.busy || state.uncertain || images.busy;
  useEffect(() => { void model.loadCatalog(); }, [model]);
  useEffect(() => { if (state.listing) onCreated(state.listing.id); }, [state.listing, onCreated]);
  function leave() {
    if (state.busy || images.busy) return;
    if (model.dirty() || images.entries.length) Alert.alert("Rời màn hình đăng tin?", "Nội dung và lần gửi được giữ trong phiên hiện tại để bạn quay lại. Chưa hỗ trợ khôi phục khi tắt app. Đăng xuất sẽ xóa dữ liệu riêng.", [{ text: "Tiếp tục soạn", style: "cancel" }, { text: "Rời màn hình", onPress: onBack }]);
    else onBack();
  }
  useEffect(() => { const listener = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; }); return () => listener.remove(); });
  function changeType(type: ListingType) { if (type === d.type || locked) return; Alert.alert("Đổi loại tin?", "Tiêu đề, mô tả và ảnh được giữ. Chỉ các trường phù hợp với loại tin mới được gửi.", [{ text: "Hủy", style: "cancel" }, { text: "Đổi loại", onPress: () => model.set("type", type) }]); }
  return <AuthLayout title="Đăng tin mới" subtitle="Bán, tìm mua hoặc trao đổi trong Làng Đại học. Tin chỉ được xác nhận sau khi máy chủ lưu thành công.">
    <Text style={styles.heading}>Bạn muốn đăng loại tin nào?</Text>
    <View style={styles.choices}>{([["SELL", "Tin bán"], ["BUY", "Tìm mua"], ["EXCHANGE", "Trao đổi"]] as const).map(([type, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: d.type === type, disabled: locked }} disabled={locked} key={type} onPress={() => changeType(type)} style={[styles.choice, d.type === type && styles.selected]}><Text style={styles.text}>{label}</Text></Pressable>)}</View>
    <AuthField label={d.type === "BUY" ? "Món đồ cần tìm" : "Tên sản phẩm hoặc món đồ"} value={d.title} error={errors.title} editable={!locked} onChangeText={value => model.set("title", value)} placeholder="Nhập tiêu đề từ 10 đến 120 ký tự" />
    <CatalogSelector label="Danh mục" items={state.categories} value={d.categoryId} onSelect={id => model.set("categoryId", id)} status={state.catalogStatus} disabled={locked} error={errors.categoryId} onRetry={() => { void model.loadCatalog(); }} />
    <CatalogSelector label="Khu vực" items={state.areas} value={d.areaId} onSelect={id => model.set("areaId", id)} status={state.catalogStatus} disabled={locked} error={errors.areaId} onRetry={() => { void model.loadCatalog(); }} />
    <Text style={styles.hint}>Chọn khu vực chung thuận tiện gặp mặt trong Làng Đại học. Không cần GPS hoặc địa chỉ nhà riêng.</Text>
    {state.catalogStatus === "loading" && <Text>Đang tải danh mục và khu vực…</Text>}
    {state.catalogStatus === "ready" && (!state.categories.length || !state.areas.length) && <Text style={styles.hint}>Danh mục hoặc khu vực hỗ trợ chưa được cung cấp. Bạn có thể soạn nội dung, nhưng chưa thể đăng khi danh sách còn thiếu.</Text>}
    <AuthButton label={state.catalogStatus === "error" ? "Thử tải lại danh mục/khu vực" : "Tải lại danh mục/khu vực"} disabled={state.busy || state.catalogStatus === "loading"} onPress={() => { void model.loadCatalog(); }} />
    {d.type !== "BUY" && <><Text style={styles.heading}>Tình trạng món đồ</Text><Choices items={[{ id: "USED_GOOD", name: "Đã dùng, còn tốt" }, { id: "USED_FAIR", name: "Đã dùng, có hao mòn" }, { id: "NEEDS_REPAIR", name: "Cần sửa chữa" }]} value={d.condition} select={id => model.set("condition", id as ListingCondition)} disabled={locked} /></>}
    {d.type !== "EXCHANGE" && <AuthField label={d.type === "SELL" ? "Giá bán (VND)" : "Ngân sách (VND, không bắt buộc)"} value={d.amount} error={errors.amount} keyboardType="number-pad" editable={!locked} onChangeText={value => model.set("amount", value)} placeholder={d.type === "BUY" ? "Để trống nếu chưa có ngân sách" : "Nhập giá bán"} />}
    <AuthField label={d.type === "BUY" ? "Yêu cầu món cần tìm" : "Mô tả sản phẩm và khuyết điểm"} value={d.description} error={errors.description} multiline editable={!locked} onChangeText={value => model.set("description", value)} />
    {d.type === "EXCHANGE" && <AuthField label="Món hoặc điều kiện mong muốn trao đổi" value={d.exchangeWanted} error={errors.exchangeWanted} multiline editable={!locked} onChangeText={value => model.set("exchangeWanted", value)} />}
    <Text style={styles.hint}>{d.type === "BUY" ? "Ảnh tham khảo không bắt buộc. Ngân sách trống không được hiểu là miễn phí." : "Cần ít nhất một ảnh đã tải lên để đăng tin."}</Text>
    <View pointerEvents={state.busy || state.uncertain ? "none" : "auto"} style={state.busy || state.uncertain ? { opacity: 0.6 } : undefined}><ListingMediaPicker model={media} /></View>
    {!!state.message && <Text accessibilityLiveRegion="polite" style={state.uncertain ? styles.error : styles.hint}>{state.message}</Text>}
    {state.uncertain && <Text style={styles.hint}>Đang giữ nguyên nội dung và khóa lần gửi trước. Không tạo lần đăng khác cho đến khi xác định được kết quả.</Text>}
    <AuthButton label={state.uncertain ? "Đối chiếu và thử lại lần đăng trước" : "Đăng tin"} loading={state.busy} disabled={images.busy || (!state.uncertain && (state.catalogStatus !== "ready" || !state.categories.length || !state.areas.length))} onPress={() => { void model.submit(); }} />
    <AuthButton label="Quay lại khám phá" disabled={state.busy || images.busy} onPress={leave} />
  </AuthLayout>;
}
const styles = StyleSheet.create({ heading: { fontSize: 17, fontWeight: "600", color: "#252525" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F1F1", borderWidth: 1, borderColor: "#D3D3D3" }, selected: { backgroundColor: "#FFF0DE", borderColor: "#AD4709" }, text: { color: "#252525", fontSize: 15 }, error: { color: "#A12222", lineHeight: 22 }, hint: { color: "#626262", lineHeight: 22 } });
