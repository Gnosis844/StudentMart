import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListingMedia1794708894334 implements MigrationInterface {
    name = 'AddListingMedia1794708894334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ListingMedia" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerId" uuid NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'STAGED', "publicId" text NOT NULL, "url" text, "width" integer NOT NULL, "height" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "listingId" uuid, CONSTRAINT "PK_ae6868e3df24bb0bdd601b9cd55" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ListingMedia_owner" ON "ListingMedia" ("ownerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ListingMedia_owner"`);
        await queryRunner.query(`DROP TABLE "ListingMedia"`);
    }

}
