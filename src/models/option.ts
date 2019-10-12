import { DataTypes, Model, ModelAttributes } from 'sequelize'

export interface OptionEntity {
  readonly id: string
  readonly value: string
}

export interface LastScrape {
  readonly category: string
  readonly page: number
}

export default class Option extends Model {
  public static readonly saveLastScrapeAsc = (last: LastScrape) =>
    Option.saveLastScrape('desc', last)
  public static readonly saveLastScrapeDesc = (last: LastScrape) =>
    Option.saveLastScrape('desc', last)

  public static readonly loadLastScrapeAsc = () => Option.loadLastScrape('asc')
  public static readonly loadLastScrapeDesc = () =>
    Option.loadLastScrape('desc')

  public static readonly saveLastScrape = async (
    sufix: string,
    { category, page }: LastScrape
  ) => {
    const transaction = await Option.sequelize!!.transaction()
    try {
      await Option.upsert({ id: `last_category_${sufix}`, value: category })
      await Option.upsert({ id: `last_page_${sufix}`, value: page.toString() })
      transaction.commit()
    } catch {
      await transaction.rollback()
    }
  }

  public static readonly loadLastScrape = async (suffix: string) => {
    const category = await Option.findOne({
      attributes: ['value'],
      where: { id: `last_category_${suffix}` }
    })
    const page = await Option.findOne({
      attributes: ['value'],
      where: { id: `last_page_${suffix}` }
    })
    if (category && page) {
      return { category: category.value, page: parseInt(page.value, 10) }
    }
    return null
  }

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
