import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { AuthButton, AuthLayout } from "../../auth/presentation/auth-components";
import type { ListingCreateRepository, OwnListing } from "../business/listing-create";
export function OwnListingScreen({ id, repository, onBrowse, onNew }: { id: string; repository: ListingCreateRepository; onBrowse(): void; onNew(): void }) {
  const [state, setState] = useState<{ listing: OwnListing | null; loading: boolean; error: string }>({ listing: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setState({ listing: null, loading: true, error: "" }); void repository.get(id).then(listing => { if (active) setState({ listing, loading: false, error: "" }); }).catch(() => { if (active) setState({ listing: null, loading: false, error: "Chưa tải được tin đã lưu. Không cần đăng lại; hãy thử tải lại tin." }); }); return () => { active = false; }; }, [id, repository, attempt]);
  const l = state.listing;
  return <AuthLayout title="Tin đã lưu của bạn" subtitle="Thông tin được tải từ máy chủ. Tìm kiếm, quản lý và liên hệ theo tin sẽ được triển khai ở các task riêng.">
    {state.loading && <Text>Đang tải tin…</Text>}
    {!!state.error && <><Text accessibilityLiveRegion="polite">{state.error}</Text><AuthButton label="Tải lại tin đã lưu" onPress={() => setAttempt(n => n + 1)} /></>}
    {l && <><Text accessibilityRole="header">{l.title}</Text><Text>{l.type === "SELL" ? "Bán" : l.type === "BUY" ? "Tìm mua" : "Trao đổi"} · {l.lifecycle.status === "OPEN" ? "Đang mở" : l.lifecycle.status}</Text><Text>{l.category.name} · {l.area.name}</Text><Text>{l.description}</Text><Text>{l.type === "SELL" ? `${l.price!.toLocaleString("vi-VN")} đ` : l.type === "BUY" ? l.budget === null ? "Chưa khai báo ngân sách" : `${l.budget!.toLocaleString("vi-VN")} đ` : l.exchangeWanted}</Text>{l.images.map((image, i) => <Image key={image.id} source={{ uri: image.url }} accessibilityLabel={`Ảnh ${i + 1} của tin đã lưu`} style={{ width: "100%", height: 220, borderRadius: 12 }} />)}<AuthButton label="Soạn tin mới" onPress={onNew} /></>}
    <AuthButton label="Quay lại khám phá" onPress={onBrowse} />
  </AuthLayout>;
}
