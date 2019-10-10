import { col, DataTypes, fn, Model, ModelAttributes, Op } from 'sequelize'

export interface CategoryEntity {
  readonly id: string
  readonly name: string
  readonly parentId?: string
}

export default class Category extends Model {
  public readonly id!: string
  public readonly name!: string
  public readonly parentId?: string
  public readonly index!: number
}

export const attributes: ModelAttributes = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING
  },
  index: {
    type: DataTypes.INTEGER,
    autoIncrement: true
  }
}

export const getCompanyCategories = async () => {
  const parents = await Category.findAll({
    attributes: [[fn('DISTINCT', col('parentId')), 'parentId']],
    where: { parentId: { [Op.ne]: null } }
  })
  const ids = await Category.findAll({
    attributes: ['id'],
    where: {
      [Op.or]: [
        { parentId: { [Op.ne]: null } },
        { id: { [Op.notIn]: parents.map(v => v.parentId!!) } }
      ]
    },
    order: [['index', 'ASC']]
  })
  return ids.map(v => v.id)
}
