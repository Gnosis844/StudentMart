import { Controller, Post, Delete, Param, Req, Res, Inject, HttpCode, HttpException } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { CurrentActor } from "../../auth/presentation/access.decorators";
import type { SessionActor } from "../../auth/business/session-actor";
import { ListingMediaService } from "../business/listing-media.service";
import { MAX_LISTING_MEDIA_BYTES, normalizeListingMedia } from "./listing-media-validation";
@Controller("api/v1/listing-media")
export class ListingMediaController {
    constructor(
    @Inject(ListingMediaService)
    private readonly media: ListingMediaService) { }
    @Post()
    async upload(
    @CurrentActor()
    actor: SessionActor, 
    @Req()
    request: FastifyRequest, 
    @Res({ passthrough: true })
    reply: FastifyReply) { reply.header("Cache-Control", "no-store"); if (!request.isMultipart())
        throw new HttpException("Multipart required", 415); let image: Buffer | undefined, mime = ""; for await (const part of request.parts({ limits: { fileSize: MAX_LISTING_MEDIA_BYTES, files: 1, fields: 0, parts: 1 } })) {
        if (part.type !== "file" || part.fieldname !== "file")
            throw new HttpException("One file required", 400);
        mime = part.mimetype;
        image = await part.toBuffer();
        if (part.file.truncated)
            throw new HttpException("Too large", 413);
    } if (!image)
        throw new HttpException("One file required", 400); return { media: await this.media.upload(actor.account.id, await normalizeListingMedia(image, mime)) }; }
    @Delete(":mediaId")
    @HttpCode(204)
    async remove(
    @CurrentActor()
    actor: SessionActor, 
    @Param("mediaId")
    id: string, 
    @Res({ passthrough: true })
    reply: FastifyReply) { reply.header("Cache-Control", "no-store"); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw new HttpException("Invalid media ID", 400); await this.media.remove(actor.account.id, id); }
}
