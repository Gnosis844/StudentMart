import { describe, expect, it, vi } from "vitest";
import { AuthError, type AuthApi, type Credential } from "../../src/features/auth/business/auth";
import { createAuthCoordinator } from "../../src/features/auth/business/auth-coordinator";
import { createListingCreateModel } from "../../src/features/listings/business/listing-create-model";
import { emptyListingDraft, listingDraftErrors, listingInput, type ListingCreateRepository, type OwnListing } from "../../src/features/listings/business/listing-create";
import { createListingCreateRepository } from "../../src/features/listings/data/listing-create-repository";
import { createSessionNavigation } from "../../src/navigation/session-navigation";
import { unavailableListings } from "../../src/features/listings/business/listing-gateway";
import { account, credential, deferred, expiresAt, now } from "../support/auth-fixtures";
const categoryId = "10000000-0000-4000-8000-000000000001", areaId = "10000000-0000-4000-8000-000000000002", key = "10000000-0000-4000-8000-000000000003";
const saved = (): OwnListing => ({ id: "10000000-0000-4000-8000-000000000004", type: "BUY", title: "Tìm sách lập trình", description: "Sách còn rõ chữ", version: 1, category: { id: categoryId, name: "Sách" }, area: { id: areaId, name: "Khu vực" }, images: [], owner: { id: account().id, displayName: account().displayName, avatarUrl: null }, lifecycle: { status: "OPEN" }, budget: null });
async function setup() {
  let record: Credential | null = null;
  const api = { login: vi.fn<AuthApi["login"]>().mockResolvedValue({ account: account(), session: { token: credential().token, expiresAt } }), me: vi.fn<AuthApi["me"]>().mockResolvedValue(account()), logout: vi.fn<AuthApi["logout"]>().mockResolvedValue(undefined) };
  const auth = createAuthCoordinator(api, { async read() { return record; }, async write(v) { record = v; }, async clear() { record = null; } }, () => now);
  await auth.login({ email: account().email, password: "test-password" });
  const repo = { catalog: vi.fn<ListingCreateRepository["catalog"]>().mockResolvedValue({ categories: [{ id: categoryId, name: "Sách" }], areas: [{ id: areaId, name: "Khu vực" }] }), create: vi.fn<ListingCreateRepository["create"]>().mockResolvedValue(saved()), submission: vi.fn<ListingCreateRepository["submission"]>().mockResolvedValue(null), get: vi.fn<ListingCreateRepository["get"]>().mockResolvedValue(saved()) };
  const media = { confirmedIds: vi.fn(() => [] as string[]), reset: vi.fn() }, uuid = vi.fn(() => key);
  const model = createListingCreateModel(repo, auth, media, uuid);
  await model.loadCatalog(); model.set("type", "BUY"); model.set("title", "Tìm sách lập trình"); model.set("description", "Sách còn rõ chữ"); model.set("categoryId", categoryId); model.set("areaId", areaId);
  return { repo, auth, model, media, uuid, api };
}
describe("listing creation", () => {
  it("opens the real compose flow after catalog readiness and keeps the saved route private on logout", async () => {
    const { auth, repo } = await setup();
    const navigation = createSessionNavigation(auth, { ...unavailableListings, async checkCreate() { await repo.catalog(); } });
    await navigation.request({ action: "createListing" });
    expect(navigation.getSnapshot().route).toEqual({ name: "compose" });
    navigation.ownListing(saved().id);
    expect(navigation.getSnapshot().route).toEqual({ name: "own-listing", listingId: saved().id });
    await auth.endSession();
    expect(navigation.getSnapshot().route.name).not.toBe("own-listing");
    navigation.dispose();
  });
  it("validates three type projections, Unicode lengths and optional BUY budget without inventing zero", () => {
    const d = { ...emptyListingDraft(), title: "😀".repeat(10), description: "Đồ dùng", categoryId, areaId };
    expect(listingInput({ ...d, type: "BUY" }, [])).toMatchObject({ budget: null, mediaIds: [] });
    expect(() => listingInput(d, [])).toThrow();
    expect(listingInput({ ...d, amount: "0" }, [key])).toMatchObject({ type: "SELL", price: 0, condition: "USED_GOOD" });
    expect(listingInput({ ...d, type: "EXCHANGE", exchangeWanted: "Đổi sách" }, [key])).not.toHaveProperty("price");
    expect(listingDraftErrors({ ...d, title: "😀".repeat(9) })).toHaveProperty("title");
    expect(listingDraftErrors({ ...d, amount: "1.5" })).toHaveProperty("amount");
  });
  it("waits for ACK, deduplicates concurrent taps, clears media only after confirmed save", async () => {
    const { repo, model, media } = await setup(); const reply = deferred<OwnListing>(); repo.create.mockReturnValueOnce(reply.promise);
    const pending = model.submit(); await model.submit(); expect(repo.create).toHaveBeenCalledTimes(1); expect(model.getSnapshot().listing).toBeNull(); expect(media.reset).not.toHaveBeenCalled();
    reply.resolve(saved()); await pending; expect(model.getSnapshot().listing?.id).toBe(saved().id); expect(media.reset).toHaveBeenCalledTimes(1);
  });
  it("keeps exact key and payload after unknown outcome, locks changes and retries same attempt", async () => {
    const { repo, model, uuid } = await setup(); repo.create.mockRejectedValueOnce(new AuthError("NETWORK_ERROR", "Offline"));
    await model.submit(); model.set("title", "Changed during unknown outcome"); expect(model.getSnapshot().draft.title).toBe("Tìm sách lập trình");
    await model.submit(); expect(repo.submission).toHaveBeenCalledWith(key); expect(uuid).toHaveBeenCalledTimes(1); expect(repo.create.mock.calls[1]).toEqual(repo.create.mock.calls[0]);
  });
  it("reconciles saved outcome without posting a second listing and stops on processing/expired unknown", async () => {
    const { repo, model } = await setup(); repo.create.mockRejectedValueOnce(new AuthError("NETWORK_ERROR", "Offline")); await model.submit();
    repo.submission.mockResolvedValueOnce({ key, state: "PROCESSING", listingId: null, errorCode: null }); await model.submit(); expect(repo.create).toHaveBeenCalledTimes(1);
    repo.submission.mockResolvedValueOnce({ key, state: "EXPIRED", listingId: null, errorCode: null }); await model.submit(); expect(model.getSnapshot().uncertain).toBe(true);
    repo.submission.mockResolvedValueOnce({ key, state: "SUCCEEDED", listingId: saved().id, errorCode: null }); await model.submit(); expect(repo.get).toHaveBeenCalledWith(saved().id); expect(repo.create).toHaveBeenCalledTimes(1);
  });
  it("keeps inputs after validation errors and refuses missing real catalog or expired media", async () => {
    const { repo, model, media } = await setup(); repo.create.mockRejectedValueOnce(new AuthError("VALIDATION_ERROR", "Invalid")); await model.submit(); expect(model.getSnapshot().uncertain).toBe(false); expect(model.getSnapshot().draft.title).toBe("Tìm sách lập trình");
    media.confirmedIds.mockImplementationOnce(() => { throw new AuthError("MEDIA_NOT_READY", "Expired"); }); await model.submit(); expect(repo.create).toHaveBeenCalledTimes(1);
    repo.catalog.mockResolvedValueOnce({ categories: [], areas: [] }); await model.loadCatalog(); await model.submit(); expect(repo.create).toHaveBeenCalledTimes(1);
  });
  it("discards late A acknowledgement and clears private draft when session changes", async () => {
    const { repo, model, auth, media } = await setup(); const reply = deferred<OwnListing>(); repo.create.mockReturnValueOnce(reply.promise); const pending = model.submit(); await auth.endSession(); reply.resolve(saved()); await pending;
    expect(model.getSnapshot().listing).toBeNull(); expect(model.getSnapshot().draft.title).toBe(""); expect(media.reset).not.toHaveBeenCalled();
  });
  it("refreshes current listing after replay and strips unexpected private response fields", async () => {
    const { auth } = await setup(); const requests: string[] = [];
    const request = vi.fn(async (url: string) => { requests.push(url); return new Response(JSON.stringify({ listing: { ...saved(), version: requests.length, passwordHash: "do not project" } }), { status: requests.length === 1 ? 201 : 200, headers: { "Idempotency-Replayed": "true" } }); });
    const repo = createListingCreateRepository("https://example.invalid", auth, request); const result = await repo.create(listingInput({ ...emptyListingDraft(), type: "BUY", title: saved().title, description: "Sách", categoryId, areaId }, []), key);
    expect(requests[1]).toContain(`/me/listings/${saved().id}`); expect(result.version).toBe(2); expect(result).not.toHaveProperty("passwordHash");
  });
});
