import { DataTypes, Model, ModelAttributes } from 'sequelize'

export interface CompanyCategoryEntity {
  readonly categoryId: string
  readonly companyId: string
}

export default class CategoryEntity extends Model {
  public readonly id!: number
  public readonly categoryId!: string
  public readonly companyId!: string
}

export const attributes: ModelAttributes = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  }
}
