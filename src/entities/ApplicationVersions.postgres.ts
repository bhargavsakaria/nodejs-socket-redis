import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Platform } from '../utils/constants';

@Entity()
export default class ApplicationVersions extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  versionNo!: string;

  @Column({ nullable: true })
  buildNumber!: string;

  @Column()
  deviceToken!: string;

  @Column({
    type: 'enum',
    enum: Platform,
    nullable: true
  })
  platform!: Platform;

  @CreateDateColumn()
  createdAt!: Date;
}
