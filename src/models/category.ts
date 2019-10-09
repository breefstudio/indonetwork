import { DataTypes, Model, ModelAttributes } from 'sequelize'

export interface CategoryEntity {
  readonly id: string
  readonly name: string
  readonly parentId?: string
}

export default class Category extends Model {
  public readonly id!: string
  public readonly name!: string
  public readonly parentId?: string
}

export const attributes: ModelAttributes = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING
  }
}
