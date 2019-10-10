import { Sequelize } from 'sequelize'
import { database } from '../utils/env'
import Category, { attributes as categoryAttributes } from './category'
import Company, { attributes as companyAttributes } from './company'

export const initialize = async () => {
  const sequelize = new Sequelize({ dialect: 'mysql', ...database })

  await sequelize.authenticate()

  Category.init(categoryAttributes, {
    sequelize,
    charset: 'utf8mb4',
    tableName: 'categories',
    indexes: [{ fields: ['id'], unique: true }]
  })
  Company.init(companyAttributes, {
    sequelize,
    charset: 'utf8mb4',
    tableName: 'companies'
  })

  Category.hasOne(Category, { foreignKey: 'parentId', sourceKey: 'id' })
  Company.belongsTo(Category, { foreignKey: 'categoryId', targetKey: 'id' })

  await Category.sync()
  await Company.sync()

  return sequelize
}
