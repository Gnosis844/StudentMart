import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, Check } from "typeorm";
import { Account } from "../../accounts/business/account.entity";
import { Area } from "../../accounts/business/catalog.entity";
import { ListingMedia } from "./listing-media.entity";
@Entity({ name: "ListingCategory" })
export class ListingCategory {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "varchar", length: 100, unique: true })
    code!: string;
    @Column({ type: "varchar", length: 200 })
    name!: string;
}
@Entity({ name: "Listing" })
@Check("CHK_Listing_type_fields", `("type" = 'SELL' AND "price" IS NOT NULL AND "budget" IS NULL AND "condition" IS NOT NULL AND "exchangeWanted" IS NULL) OR ("type" = 'BUY' AND "price" IS NULL AND "condition" IS NULL AND "exchangeWanted" IS NULL) OR ("type" = 'EXCHANGE' AND "price" IS NULL AND "budget" IS NULL AND "condition" IS NOT NULL AND "exchangeWanted" IS NOT NULL)`)
@Check("CHK_Listing_money", '("price" IS NULL OR "price" BETWEEN 0 AND 1000000000) AND ("budget" IS NULL OR "budget" BETWEEN 0 AND 1000000000)')
export class Listing {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "uuid" })
    ownerId!: string;
    @ManyToOne(() => Account, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "ownerId" })
    owner!: Account;
    @Column({ type: "uuid" })
    categoryId!: string;
    @ManyToOne(() => ListingCategory, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "categoryId" })
    category!: ListingCategory;
    @Column({ type: "uuid" })
    areaId!: string;
    @ManyToOne(() => Area, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "areaId" })
    area!: Area;
    @Column({ type: "varchar", length: 16 })
    type!: "SELL" | "BUY" | "EXCHANGE";
    @Column({ type: "varchar", length: 120 })
    title!: string;
    @Column({ type: "varchar", length: 5000 })
    description!: string;
    @Column({ type: "integer", nullable: true })
    price!: number | null;
    @Column({ type: "integer", nullable: true })
    budget!: number | null;
    @Column({ type: "varchar", length: 32, nullable: true })
    condition!: string | null;
    @Column({ type: "varchar", length: 2000, nullable: true })
    exchangeWanted!: string | null;
    @Column({ type: "varchar", length: 16, default: "OPEN" })
    status!: string;
    @Column({ type: "integer", default: 1 })
    version!: number;
    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;
}
@Entity({ name: "ListingImage" })
@Index("UQ_ListingImage_media", ["mediaId"], { unique: true })
@Index("UQ_ListingImage_position", ["listingId", "position"], { unique: true })
export class ListingImage {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "uuid" })
    listingId!: string;
    @ManyToOne(() => Listing, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listingId" })
    listing!: Listing;
    @Column({ type: "uuid" })
    mediaId!: string;
    @ManyToOne(() => ListingMedia, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "mediaId" })
    media!: ListingMedia;
    @Column({ type: "integer" })
    position!: number;
}
@Entity({ name: "ListingMutation" })
@Index("UQ_ListingMutation_actor_key", ["actorId", "key"], { unique: true })
export class ListingMutation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "uuid" })
    actorId!: string;
    @ManyToOne(() => Account, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "actorId" })
    actor!: Account;
    @Column({ type: "uuid" })
    key!: string;
    @Column({ type: "varchar", length: 64 })
    hash!: string;
    @Column({ type: "varchar", length: 32, default: "CREATE" })
    operation!: string;
    @Column({ type: "varchar", length: 16, default: "PROCESSING" })
    state!: "PROCESSING" | "SUCCEEDED" | "FAILED";
    @Column({ type: "uuid", nullable: true })
    listingId!: string | null;
    @Column({ type: "integer", nullable: true })
    resultVersion!: number | null;
    @Column({ type: "varchar", length: 64, nullable: true })
    errorCode!: string | null;
    @Column({ type: "integer", nullable: true })
    errorStatus!: number | null;
    @Column({ type: "jsonb", nullable: true, select: false })
    snapshot!: unknown;
    @CreateDateColumn({ type: "timestamptz" })
    admittedAt!: Date;
    @Column({ type: "timestamptz" })
    replayUntil!: Date;
}
