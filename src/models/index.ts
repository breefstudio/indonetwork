import { Sequelize } from 'sequelize'
import { database } from '../utils/env'
import Category, { attributes as categoryAttributes } from './category'
import Company, { attributes as companyAttributes } from './company'
import CompanyCategory, {
  attributes as companyCategoryAttributes
} from './company-category'
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
  CompanyCategory.init(companyCategoryAttributes, {
    sequelize,
    charset: 'utf8mb4',
    tableName: 'company_category'
  })

  Category.belongsTo(Category, {
    foreignKey: 'parentId',
    targetKey: 'id',
    as: 'parent'
  })
  Category.hasMany(Category, {
    foreignKey: 'parentId',
    sourceKey: 'id',
    as: 'children'
  })
  Category.belongsToMany(Company, {
    through: CompanyCategory,
    otherKey: 'companyId',
    foreignKey: 'categoryId',
    targetKey: 'id',
    as: 'companies'
  })
  Company.belongsToMany(Category, {
    through: CompanyCategory,
    otherKey: 'categoryId',
    foreignKey: 'companyId',
    targetKey: 'id',
    as: 'categories'
  })

  return sequelize.sync()
}
