import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListingCreation1794710883065 implements MigrationInterface {
    name = 'AddListingCreation1794710883065'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ListingCategory" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "code" character varying(100) NOT NULL, "name" character varying(200) NOT NULL, CONSTRAINT "UQ_958be3dc40f26aea4c4e152581d" UNIQUE ("code"), CONSTRAINT "PK_2e125a0a19ddc8464747d3e2d17" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "Listing" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerId" uuid NOT NULL, "categoryId" uuid NOT NULL, "areaId" uuid NOT NULL, "type" character varying(16) NOT NULL, "title" character varying(120) NOT NULL, "description" character varying(5000) NOT NULL, "price" integer, "budget" integer, "condition" character varying(32), "exchangeWanted" character varying(2000), "status" character varying(16) NOT NULL DEFAULT 'OPEN', "version" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_Listing_money" CHECK (("price" IS NULL OR "price" BETWEEN 0 AND 1000000000) AND ("budget" IS NULL OR "budget" BETWEEN 0 AND 1000000000)), CONSTRAINT "CHK_Listing_type_fields" CHECK (("type" = 'SELL' AND "price" IS NOT NULL AND "budget" IS NULL AND "condition" IS NOT NULL AND "exchangeWanted" IS NULL) OR ("type" = 'BUY' AND "price" IS NULL AND "condition" IS NULL AND "exchangeWanted" IS NULL) OR ("type" = 'EXCHANGE' AND "price" IS NULL AND "budget" IS NULL AND "condition" IS NOT NULL AND "exchangeWanted" IS NOT NULL)), CONSTRAINT "PK_d16a94e342ebc78e68473d85015" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ListingImage" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "listingId" uuid NOT NULL, "mediaId" uuid NOT NULL, "position" integer NOT NULL, CONSTRAINT "PK_3ee868a8aefef503da0de4cac95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ListingImage_position" ON "ListingImage" ("listingId", "position") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ListingImage_media" ON "ListingImage" ("mediaId") `);
        await queryRunner.query(`CREATE TABLE "ListingMutation" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actorId" uuid NOT NULL, "key" uuid NOT NULL, "hash" character varying(64) NOT NULL, "operation" character varying(32) NOT NULL DEFAULT 'CREATE', "state" character varying(16) NOT NULL DEFAULT 'PROCESSING', "listingId" uuid, "resultVersion" integer, "errorCode" character varying(64), "errorStatus" integer, "snapshot" jsonb, "admittedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "replayUntil" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_423bc11d6363fb29741ef559821" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ListingMutation_actor_key" ON "ListingMutation" ("actorId", "key") `);
        await queryRunner.query(`ALTER TABLE "Listing" ADD CONSTRAINT "FK_6c989a4611a31b2f35e65fd07c4" FOREIGN KEY ("ownerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Listing" ADD CONSTRAINT "FK_0ce8191d960f20a4f321acb697d" FOREIGN KEY ("categoryId") REFERENCES "ListingCategory"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Listing" ADD CONSTRAINT "FK_d3e843a60e2e3b4f3ba46852c68" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ListingImage" ADD CONSTRAINT "FK_1c0cffecedd5d9d8944e2e4a522" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ListingImage" ADD CONSTRAINT "FK_e43afee1f93a2beccf21f9216c1" FOREIGN KEY ("mediaId") REFERENCES "ListingMedia"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ListingMutation" ADD CONSTRAINT "FK_eef064044fd18d7694523fdd004" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ListingMutation" DROP CONSTRAINT "FK_eef064044fd18d7694523fdd004"`);
        await queryRunner.query(`ALTER TABLE "ListingImage" DROP CONSTRAINT "FK_e43afee1f93a2beccf21f9216c1"`);
        await queryRunner.query(`ALTER TABLE "ListingImage" DROP CONSTRAINT "FK_1c0cffecedd5d9d8944e2e4a522"`);
        await queryRunner.query(`ALTER TABLE "Listing" DROP CONSTRAINT "FK_d3e843a60e2e3b4f3ba46852c68"`);
        await queryRunner.query(`ALTER TABLE "Listing" DROP CONSTRAINT "FK_0ce8191d960f20a4f321acb697d"`);
        await queryRunner.query(`ALTER TABLE "Listing" DROP CONSTRAINT "FK_6c989a4611a31b2f35e65fd07c4"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_ListingMutation_actor_key"`);
        await queryRunner.query(`DROP TABLE "ListingMutation"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_ListingImage_media"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_ListingImage_position"`);
        await queryRunner.query(`DROP TABLE "ListingImage"`);
        await queryRunner.query(`DROP TABLE "Listing"`);
        await queryRunner.query(`DROP TABLE "ListingCategory"`);
    }

}
