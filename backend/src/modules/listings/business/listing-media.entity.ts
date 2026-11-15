import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, Index } from "typeorm";
@Entity({ name: "ListingMedia" })
@Index("IDX_ListingMedia_owner", ["ownerId"])
export class ListingMedia {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "uuid" })
    ownerId!: string;
    @Column({ type: "varchar", length: 16, default: "STAGED" })
    state!: "UPLOADING" | "STAGED" | "ATTACHED" | "DELETING" | "DELETED";
    @Column({ type: "text" })
    publicId!: string;
    @Column({ type: "text", nullable: true })
    url!: string | null;
    @Column({ type: "integer" })
    width!: number;
    @Column({ type: "integer" })
    height!: number;
    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;
    @Column({ type: "timestamptz" })
    expiresAt!: Date;
    @Column({ type: "uuid", nullable: true })
    listingId!: string | null;
}
