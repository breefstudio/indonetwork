import { DataTypes, Model, ModelAttributes } from 'sequelize'

export interface OptionEntity {
  readonly id: string
  readonly value: string
}

export default class Option extends Model {
  public readonly id!: string
  public readonly value!: string
}

export const attributes: ModelAttributes = {
  id: { type: DataTypes.STRING, primaryKey: true },
  value: DataTypes.STRING
}

export const saveLastScrape = async (category: string, page: number) => {
  await Option.upsert({ id: 'last_category', value: category })
  await Option.upsert({ id: 'last_page', value: page.toString() })
}

export const loadLastScrape = async () => {
  const category = await Option.findOne({
    attributes: ['value'],
    where: { id: 'last_category' }
  })
  const page = await Option.findOne({
    attributes: ['value'],
    where: { id: 'last_page' }
  })
  if (category && page) {
    return { category: category.value, page: parseInt(page.value, 10) }
  }
  return null
}
