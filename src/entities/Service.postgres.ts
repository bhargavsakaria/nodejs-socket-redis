import { BaseEntity, Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

import Order from './Order.postgres';

enum Category {
  Main = 'main',
  Additional = 'additional',
  Shipping = 'shipping'
}

enum PriceType {
  OneTime = 'one_time',
  Recurring = 'recurring'
}

// enum ShippingCategory {
//     Direct = 'direct',
//     Posti = 'posti'
// }

@Entity()
export default class Service extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  sortNumber!: number;

  @Column({ nullable: true })
  name!: string;

  @Column()
  descriptionFirst!: string;

  @Column()
  descriptionSecond!: string;

  @Column({ type: 'real', nullable: true })
  price!: number;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: Category,
    default: Category.Main
  })
  category!: Category;

  @Column({
    nullable: true
  })
  shippingCategory!: string;

  @Column({ nullable: true })
  stripeProductId!: string;

  @Column({ nullable: true })
  stripeShippingRateId!: string;

  @Column({ nullable: true })
  stripeShippingRateIdFree!: string;

  @Column({
    type: 'enum',
    enum: PriceType,
    nullable: true,
    default: PriceType.OneTime
  })
  priceType!: PriceType;

  @ManyToMany((type) => Order, (order) => order.services, {
    // cascade: ['insert'],
  })
  @JoinTable()
  orders!: Order[];
}
