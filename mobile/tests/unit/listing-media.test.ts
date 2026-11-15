import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../../src/features/auth/business/auth";
import { createAuthCoordinator } from "../../src/features/auth/business/auth-coordinator";
import { createListingMediaModel } from "../../src/features/listings/business/listing-media-model";
import { imageError, parseListingMedia } from "../../src/features/listings/business/listing-media";
import { createListingMediaRepository } from "../../src/features/listings/data/listing-media-repository";
import { account, credential, deferred, expiresAt, now } from "../support/auth-fixtures";
const image = {uri:"file:///image.jpg",name:"image.jpg",mimeType:"image/jpeg",size:100,width:100,height:100};
const media = (index=1) => ({id:account(index).id,url:"https://example.invalid/image.webp",width:100,height:100,expiresAt});
async function setup() {
  let actor=1; const api={login:vi.fn(async()=>({account:account(actor),session:{token:credential(actor).token,expiresAt}})),me:vi.fn(async()=>account(actor)),logout:vi.fn(async()=>undefined)};
  const auth=createAuthCoordinator(api,{async read(){return null;},async write(){},async clear(){}},()=>now);
  await auth.login({email:account().email,password:"test-password"});
  const repository={upload:vi.fn(async()=>media()),remove:vi.fn(async()=>undefined)};
  const pick=vi.fn<() => Promise<typeof image[] | null>>(async()=>[image]);
  const model=createListingMediaModel(repository,auth,pick,()=>now);
  return {model,repository,pick,auth,api,setActor:(index:number)=>{actor=index;}};
}
describe("listing media",()=>{
  it("keeps local and confirmed images separate, preserves order and cancellation",async()=>{
    const {model,pick}=await setup();pick.mockResolvedValueOnce([image,{...image,name:"second.jpg"}]);await model.choose();
    expect(()=>model.confirmedIds()).toThrow();const [a,b]=model.getSnapshot().entries;await model.upload(a.key);await model.upload(b.key);model.move(b.key,-1);
    expect(model.getSnapshot().entries.map(e=>e.key)).toEqual([b.key,a.key]);expect(model.confirmedIds()).toHaveLength(2);
    pick.mockResolvedValueOnce(null);await model.choose();expect(model.getSnapshot().entries).toHaveLength(2);model.dispose();
  });
  it("retains failed images to retry and confirmed images on failed delete",async()=>{
    const {model,repository}=await setup();await model.choose();const key=model.getSnapshot().entries[0].key;
    repository.upload.mockRejectedValueOnce(new AuthError("NETWORK_ERROR","Network unavailable"));await model.upload(key);
    expect(model.getSnapshot().entries[0]).toMatchObject({status:"error",asset:image});await model.upload(key);expect(model.confirmedIds()).toEqual([media().id]);
    repository.remove.mockRejectedValueOnce(new Error());await model.remove(key);expect(model.getSnapshot().entries).toHaveLength(1);await model.remove(key);expect(model.getSnapshot().entries).toHaveLength(0);model.dispose();
  });
  it("caps selection, rejects invalid files and expires confirmed media before submit",async()=>{
    const {model,pick,repository}=await setup();pick.mockResolvedValueOnce(Array.from({length:9},()=>image));await model.choose();expect(model.getSnapshot().entries).toHaveLength(0);
    pick.mockResolvedValueOnce([{...image,mimeType:"image/heic"}]);await model.choose();await model.upload(model.getSnapshot().entries[0].key);expect(repository.upload).not.toHaveBeenCalled();model.reset();
    await model.choose();repository.upload.mockResolvedValueOnce({...media(),expiresAt:new Date(now-1).toISOString()});await model.upload(model.getSnapshot().entries[0].key);expect(()=>model.confirmedIds()).toThrow();model.dispose();
  });
  it("discards late A upload and local files on logout/login B",async()=>{
    const {model,auth,setActor,repository}=await setup();await model.choose();const late=deferred<ReturnType<typeof media>>();repository.upload.mockReturnValueOnce(late.promise);
    const uploading=model.upload(model.getSnapshot().entries[0].key);await auth.endSession();setActor(2);await auth.login({email:account(2).email,password:"test-password"});late.resolve(media());await uploading;
    expect(model.getSnapshot().entries).toEqual([]);expect(model.getSnapshot().busy).toBe(false);model.dispose();
  });
  it("enforces file bounds and strict confirmed projection",()=>{
    expect(imageError({...image,size:10*1024*1024+1})).not.toBeNull();expect(imageError({...image,width:12001})).not.toBeNull();
    expect(imageError({...image,width:6000,height:4001})).not.toBeNull();expect(parseListingMedia(media())).toEqual(media());expect(()=>parseListingMedia({...media(),url:"http://unsafe.invalid"})).toThrow();
  });
  it("uses server acknowledgements and maps size/conflict errors without provider details",async()=>{
    const {auth}=await setup();const request=vi.fn(async (_url: string, _init?: RequestInit)=>new Response(JSON.stringify({media:media()}),{status:201}));const repo=createListingMediaRepository("http://api.invalid",auth,request,()=>new FormData());
    expect(await repo.upload(image)).toEqual(media());expect(request.mock.calls[0][0]).toBe("http://api.invalid/api/v1/listing-media");
    request.mockResolvedValueOnce(new Response("sensitive provider message",{status:413}));await expect(repo.upload(image)).rejects.toMatchObject({code:"PAYLOAD_TOO_LARGE"});
    request.mockResolvedValueOnce(new Response("private payload",{status:409}));await expect(repo.remove(media().id)).rejects.toMatchObject({code:"CONFLICT"});
  });
});
