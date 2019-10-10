import { Sequelize } from 'sequelize'
import { database } from '../utils/env'
import Category, { attributes as categoryAttributes } from './category'
import Company, { attributes as companyAttributes } from './company'
import Option, { attributes as optionAttributes } from './option'

export const initialize = async () => {
  const sequelize = new Sequelize({ dialect: 'mysql', ...database })

  await sequelize.authenticate()

  Category.init(categoryAttributes, {
    sequelize,
    charset: 'utf8mb4',
    tableName: 'categories'
  })
  Company.init(companyAttributes, {
    sequelize,
    charset: 'utf8mb4',
    tableName: 'companies'
  })
  Option.init(optionAttributes, { sequelize, tableName: 'options' })

  Category.hasOne(Category, { foreignKey: 'parentId', sourceKey: 'id' })
  Company.belongsTo(Category, { foreignKey: 'categoryId', targetKey: 'id' })

  await Option.sync()
  await Category.sync()
  await Company.sync()

  return sequelize
}
