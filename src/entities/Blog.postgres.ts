import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import User from './User.postgres';
import BlogTopic from './BlogTopic.postgres';

enum CoverType {
  Image = 'image',
  Video = 'video',
  YouTubeVideo = 'youtube_video'
}

@Entity()
export default class Blog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  title!: string;

  @Column()
  cover!: string;

  @ManyToOne(() => User, {
    cascade: ['insert'],
    eager: true
  })
  author_id!: User;

  @ManyToMany(() => BlogTopic, {
    cascade: true,
    eager: true
  })
  @JoinTable({
    name: 'blog_topics_topic',
    joinColumn: { name: 'blogId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'blogTopicId' }
  })
  topics: BlogTopic[] | undefined;

  @Column({ type: 'text', nullable: true })
  content!: string;

  @Column({ nullable: true })
  content_preview!: string;

  @Column({ default: false })
  featured!: boolean;
}
