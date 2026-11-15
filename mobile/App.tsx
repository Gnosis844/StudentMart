import { randomUUID } from "expo-crypto";
import { createListingCreateRepository } from "./src/features/listings/data/listing-create-repository";
import { createListingCreateModel } from "./src/features/listings/business/listing-create-model";
import { ListingComposeScreen } from "./src/features/listings/presentation/listing-compose-screen";
import { OwnListingScreen } from "./src/features/listings/presentation/own-listing-screen";
import { ListingMediaPicker } from "./src/features/listings/presentation/listing-media-picker";
import { createListingMediaModel } from "./src/features/listings/business/listing-media-model";
import { createNativeListingMediaRepository, pickListingImages } from "./src/features/listings/data/native-listing-media";
import { createAvatarModel } from "./src/features/profile/business/avatar-model";
import { createNativeAvatarRepository } from "./src/features/profile/data/native-avatar-repository";
import { pickAvatar } from "./src/features/profile/data/native-image-picker";
import { ProfileEditScreen } from "./src/features/profile/presentation/profile-edit-screen";
import { createProfileEditModel } from "./src/features/profile/business/profile-edit-model";
import { createProfileEditRepository } from "./src/features/profile/data/profile-edit-repository";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { API_URL } from "./src/shared/config/env";
import { createRegistrationApi } from "./src/features/auth/data/registration-api";
import { RegisterScreen } from "./src/features/auth/presentation/register-screen";
import { LoginScreen } from "./src/features/auth/presentation/login-screen";
import { createAuthApi } from "./src/features/auth/data/auth-api";
import { credentialStore } from "./src/features/auth/data/native-credential-store";
import { createAuthCoordinator } from "./src/features/auth/business/auth-coordinator";
import { AccountScreen } from "./src/features/profile/presentation/account-screen";
import { AuthRecoveryScreen } from "./src/features/auth/presentation/auth-recovery-screen";
import { AuthButton, AuthLayout } from "./src/features/auth/presentation/auth-components";
import { createSessionNavigation } from "./src/navigation/session-navigation";
import { unavailableListings } from "./src/features/listings/business/listing-gateway";
import { BrowseScreen, ListingScreen } from "./src/features/listings/presentation/listing-screens";
import type { LoginInput } from "./src/features/auth/business/auth";
import { createAccountLogoutResources } from "./src/features/auth/business/account-logout-resources";
import { createProfileRepository } from "./src/features/profile/data/profile-repository";
import { createProfileModel } from "./src/features/profile/business/profile-model";

const register = createRegistrationApi(API_URL);
// Future account-scoped cache/chat/push adapters register here; public data stays outside this registry.
const accountResources = createAccountLogoutResources();
const auth = createAuthCoordinator(createAuthApi(API_URL), credentialStore, Date.now, accountResources);
const listingCreateRepository = createListingCreateRepository(API_URL, auth);
// The session is checked by runPrivate; catalog availability is real, not a fake create success.
const navigation = createSessionNavigation(auth, { ...unavailableListings, async checkCreate() { await listingCreateRepository.catalog(); } });
const avatar = createAvatarModel(createNativeAvatarRepository(API_URL, auth), auth, pickAvatar);
const profileEdit = createProfileEditModel(createProfileEditRepository(API_URL, auth), auth);
const listingMedia = createListingMediaModel(createNativeListingMediaRepository(API_URL, auth), auth, pickListingImages);
const listingCreate = createListingCreateModel(listingCreateRepository, auth, listingMedia, randomUUID);
const profile = createProfileModel(createProfileRepository(auth), auth);
accountResources.register({ async clearPrivate() { profile.reset(); profileEdit.reset(); avatar.reset(); listingMedia.reset(); listingCreate.reset(); } });

async function cancelLogin() {
  const pendingLogin = auth.getSnapshot().status === "guest" && auth.getSnapshot().busy;
  navigation.cancelLogin();
  if (pendingLogin) await auth.endSession();
}
async function login(input: LoginInput) {
  const hadIntent = navigation.getSnapshot().intent !== null;
  const loginEpoch = auth.getSnapshot().epoch + 1;
  await auth.login(input);
  if (!hadIntent && auth.getSnapshot().status === "authenticated" && auth.getSnapshot().epoch === loginEpoch) await navigation.request({ action: "openPrivateProfile" });
}

export default function App() {
  const state = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const nav = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot);
  useEffect(() => { void auth.restore(); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => {
      // Guest forms have no credential to revalidate; keep autofill/background transitions from discarding them.
      if (next === "active" && ["profile-edit", "listing-media", "compose"].includes(navigation.getSnapshot().route.name) && auth.getSnapshot().status === "authenticated") {
        // Revalidate without replacing the epoch/draft when the system image picker returns.
        void auth.runPrivate(async () => undefined).catch(() => undefined);
      } else if (next === "active" && auth.getSnapshot().status !== "guest") void auth.restore({ force: true });
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      const route = navigation.getSnapshot().route.name;
      if (["login", "register"].includes(route)) { void cancelLogin(); return true; }
      if (route === "profile-edit" || route === "compose") return true;
      if (["profile-verification"].includes(route)) { void navigation.request({ action: "openPrivateProfile" }); return true; }
      if (route !== "browse") { navigation.browse(); return true; }
      return false;
    });
    return () => { subscription.remove(); back.remove(); };
  }, []);
  const route = nav.route;
  let screen;
  if (state.status === "checking" || (route.name === "recovery" && state.status !== "guest" && state.status !== "authenticated")) {
    screen = <AuthRecoveryScreen state={state} auth={auth} onBrowse={navigation.browse} />;
  } else if (nav.resuming) {
    screen = <AuthLayout title="Đang xác nhận quyền truy cập" subtitle="Kiểm tra lại phiên và ngữ cảnh trước khi tiếp tục."><ActivityIndicator /><AuthButton label="Hủy, quay lại" onPress={navigation.cancelLogin} /></AuthLayout>;
  } else if (route.name === "profile" && state.status === "authenticated" && state.account) {
    screen = <AccountScreen key={state.account.id} model={profile} onBrowse={navigation.browse}
      onListingMedia={navigation.listingMedia} onEdit={() => navigation.profileDestination("edit")} onVerify={() => navigation.profileDestination("verification")}
      onEndSession={async () => { navigation.resetForLogout(); await auth.endSession(); }} />;
  } else if (route.name === "listing-media" && state.status === "authenticated") {
    screen = <AuthLayout title="Chuẩn bị ảnh tin đăng" subtitle="Ảnh tải lên được giữ tối đa 24 giờ khi chưa gắn tin. Chức năng đăng tin đang được triển khai riêng; đây chưa phải tin đã đăng."><ListingMediaPicker model={listingMedia} /><AuthButton label="Quay về hồ sơ" onPress={() => { void navigation.request({ action: "openPrivateProfile" }); }} /></AuthLayout>;
  } else if (route.name === "profile-edit" && state.status === "authenticated") {
    screen = <ProfileEditScreen key={state.account?.id} model={profileEdit} avatar={avatar} onBack={() => { void navigation.request({ action: "openPrivateProfile" }); }} />;
  } else if (["profile-verification"].includes(route.name) && state.status === "authenticated" && state.account) {
    screen = <AuthLayout title={route.name === "profile-edit" ? "Chỉnh sửa hồ sơ" : "Xác thực email trường"}
      subtitle={route.name === "profile-edit" ? "Chức năng chỉnh sửa hồ sơ chưa sẵn sàng. Thông tin hiện tại của bạn vẫn được giữ nguyên."
        : "Xác thực email trường là tùy chọn và chưa sẵn sàng trên phiên bản này. Bạn vẫn có thể dùng các chức năng được phép khi chưa xác thực."}>
      <AuthButton label="Quay về hồ sơ" onPress={() => { void navigation.request({ action: "openPrivateProfile" }); }} />
    </AuthLayout>;
  } else if (route.name === "compose" && state.status === "authenticated") {
    screen = <ListingComposeScreen model={listingCreate} media={listingMedia} onBack={navigation.browse} onCreated={navigation.ownListing} />;
  } else if (route.name === "own-listing" && state.status === "authenticated") {
    screen = <OwnListingScreen key={route.listingId} id={route.listingId} repository={listingCreateRepository} onBrowse={navigation.browse} onNew={() => { listingCreate.reset(); listingMedia.reset(); void navigation.request({ action: "createListing" }); }} />;
  } else if (route.name === "register") {
    screen = <RegisterScreen register={register} onRegistered={email => navigation.login(email, true)} onLogin={() => navigation.login()} />;
  } else if (route.name === "login") {
    screen = <LoginScreen key={`${route.email}:${route.created}`} email={route.email} created={route.created} login={login} notice={nav.message || state.message} onRegister={navigation.register} onCancel={() => { void cancelLogin(); }} />;
  } else if (route.name === "listing") {
    screen = <ListingScreen key={route.listingId} id={route.listingId} gateway={unavailableListings} onContact={() => { void navigation.request({ action: "contactListing", listingId: route.listingId }); }} onBrowse={navigation.browse} contactReady={route.contactReady} message={nav.message} />;
  } else {
    screen = <BrowseScreen gateway={unavailableListings} onListing={navigation.openListing} onCreate={() => { void navigation.request({ action: "createListing" }); }} onProfile={() => { void navigation.request({ action: "openPrivateProfile" }); }} onLogin={() => navigation.login()} signedIn={state.status === "authenticated"} message={nav.message || state.message} />;
  }
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    {screen}
  </SafeAreaProvider>;
}
