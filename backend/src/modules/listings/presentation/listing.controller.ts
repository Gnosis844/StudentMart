import { Body, Controller, Get, Headers, Inject, Param, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CurrentActor, PublicRoute } from "../../auth/presentation/access.decorators";
import type { SessionActor } from "../../auth/business/session-actor";
import { ListingService } from "../business/listing.service";
import { createListingSchema, listingUuid } from "./listing-validation";
@Controller("api/v1")
export class ListingController {
    constructor(
    @Inject(ListingService)
    private readonly listings: ListingService) { }
    @PublicRoute()
    @Get("catalog/listing-categories")
    async categories() { return { items: await this.listings.categories() }; }
    @Post("listings")
    async create(
    @CurrentActor()
    actor: SessionActor, 
    @Headers("idempotency-key")
    key: unknown, 
    @Body()
    body: unknown, 
    @Res({ passthrough: true })
    reply: FastifyReply) { reply.header("Cache-Control", "no-store"); const result = await this.listings.create(actor.account.id, listingUuid.parse(key), createListingSchema.parse(body)); reply.header("Idempotency-Replayed", String(result.replayed)); return { listing: result.listing }; }
    @Get("me/listings/:id")
    async read(
    @CurrentActor()
    actor: SessionActor, 
    @Param("id")
    id: unknown, 
    @Res({ passthrough: true })
    reply: FastifyReply) { reply.header("Cache-Control", "no-store"); return { listing: await this.listings.read(actor.account.id, listingUuid.parse(id)) }; }
    @Get("me/listing-submissions/:key")
    async status(
    @CurrentActor()
    actor: SessionActor, 
    @Param("key")
    key: unknown, 
    @Res({ passthrough: true })
    reply: FastifyReply) { reply.header("Cache-Control", "no-store"); const submission = await this.listings.submission(actor.account.id, listingUuid.parse(key)); if (submission.state === "PROCESSING")
        reply.header("Retry-After", "1"); return { submission }; }
}
