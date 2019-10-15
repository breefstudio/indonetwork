import { DataTypes, Model, ModelAttributes, Op } from 'sequelize'

export interface CompanyEntity {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly website: string
  readonly address: string
  readonly city: string
  readonly phones?: string
  readonly email?: string
  readonly whatsapp?: string
  readonly categoryId: string
}

export default class Company extends Model {
  public static readonly getCompanyIdsByIds = async (
    ids: ReadonlyArray<string>
  ) => {
    const data = await Company.findAll({
      attributes: ['id'],
      where: { id: { [Op.in]: ids } }
    })
    return data.map(({ id }) => id)
  }

  public readonly id!: string
  public readonly name!: string
  public readonly description!: string
  public readonly website!: string
  public readonly address!: string
  public readonly city!: string
  public readonly phones?: string
  public readonly email?: string
  public readonly whatsapp?: string
  public readonly categoryId!: string
}

export const attributes: ModelAttributes = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.TEXT
  },
  website: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  city: {
    type: DataTypes.STRING
  },
  phones: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  whatsapp: {
    type: DataTypes.STRING,
    allowNull: true
  }
}
