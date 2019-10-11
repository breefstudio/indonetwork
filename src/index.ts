// tslint:disable: no-console
import parseArgv, { OptionDefinition } from 'command-line-args'
import { Page } from 'puppeteer'
import { Sequelize } from 'sequelize/types'
import { initialize } from './models'
import CategoryModel, {
  CategoryEntity,
  getCompanyCategories
} from './models/category'
import CompanyModel, { CompanyEntity } from './models/company'
import CompanyCategoryModel, {
  CompanyCategoryEntity
} from './models/company-category'
import OptionModel, { loadLastScrape, saveLastScrape } from './models/option'
import {
  goToCategoriesPage,
  goToCompaniesPage,
  goToCompanyDetailPage,
  isLoggedIn,
  login,
  openBrowser,
  openTab
} from './services/browser'
import { getCategories } from './services/categories'
import {
  Company as CompanyItem,
  getCompanies,
  isNextPageAvailable
} from './services/companies'
import { Company, getCompany } from './services/company'
import { auth } from './utils/env'

const prepare = async () => {
  const tab = await openTab(await openBrowser())
  if (await isLoggedIn(tab)) {
    return tab
  } else {
    await login(tab, auth)
    return tab
  }
}

const scrapeRelations = async (
  tab: Page,
  category: string,
  page: number = 1
) => {
  await goToCompaniesPage(tab, category, page)
  const companies = await getCompanies(tab)
  const hasNext = await isNextPageAvailable(tab)
  return { companies, hasNext }
}

const scrapeCompanies = async (
  acc: Company[],
  tab: Page,
  category: string,
  page: number = 1
) => {
  await goToCompaniesPage(tab, category, page)
  const items = await getCompanies(tab)
  const hasNext = await isNextPageAvailable(tab)
  const companies = await items.reduce<Promise<Company[]>>(
    async (p, { url, description }) => {
      const cc = await p
      if (!url) {
        return cc
      }
      const company = await scrapeCompany(tab, url)
      cc.push({ ...company, description })
      return cc
    },
    Promise.resolve(acc)
  )
  return { companies, hasNext }
}

const scrapeCompany = async (tab: Page, url: string) => {
  console.log(`mulai scrape company ${url}`)
  await goToCompanyDetailPage(tab, url)
  console.log(`berhasil masuk halaman`)
  return getCompany(tab)
}

const syncRelations = async (
  tab: Page,
  database: Sequelize,
  id: string,
  page: number = 1
) => {
  console.log(`mulai scrape -c ${id} -p ${page}`)
  if (!(await isLoggedIn(tab))) {
    await login(tab, auth)
  }
  let companies: ReadonlyArray<CompanyItem>
  let hasNext = false
  try {
    const result = await scrapeRelations(tab, id, page)
    companies = result.companies
    hasNext = result.hasNext
  } catch (e) {
    if (!(await isLoggedIn(tab))) {
      await login(tab, auth)
      const result = await scrapeRelations(tab, id, page)
      companies = result.companies
      hasNext = result.hasNext
    }
    throw e
  }
  if (companies.length === 0) {
    return
  }
  const transaction = await database.transaction()
  try {
    await CompanyCategoryModel.bulkCreate(
      companies.map<CompanyCategoryEntity>(c => ({
        companyId: c.url!!.replace(
          'https://www.indonetwork.co.id/company/',
          ''
        ),
        categoryId: id
      })),
      { ignoreDuplicates: true }
    )
    await transaction.commit()
  } catch (e) {
    await transaction.rollback()
    throw e
  }
  await saveLastScrape(id, page)
  console.log(`berhasil scrape -c ${id} -p ${page}`)
  if (hasNext) {
    await syncRelations(tab, database, id, page + 1)
  }
}

const syncCompanies = async (
  tab: Page,
  database: Sequelize,
  id: string,
  page: number = 1
) => {
  console.log(`mulai scrape -c ${id} -p ${page}`)
  if (!(await isLoggedIn(tab))) {
    await login(tab, auth)
  }
  let companies: Company[]
  let hasNext = false
  try {
    const result = await scrapeCompanies([], tab, id, page)
    companies = result.companies
    hasNext = result.hasNext
  } catch (e) {
    if (!(await isLoggedIn(tab))) {
      await login(tab, auth)
      const result = await scrapeCompanies([], tab, id, page)
      companies = result.companies
      hasNext = result.hasNext
    }
    throw e
  }
  if (companies.length === 0) {
    return
  }
  const transaction = await database.transaction()
  try {
    await CompanyModel.bulkCreate(
      companies.map<CompanyEntity>(c => ({ ...c, categoryId: id })),
      { ignoreDuplicates: true }
    )
    await CompanyCategoryModel.bulkCreate(
      companies.map<CompanyCategoryEntity>(c => ({
        companyId: c.id,
        categoryId: id
      })),
      { ignoreDuplicates: true }
    )
    await transaction.commit()
  } catch (e) {
    await transaction.rollback()
    throw e
  }
  await saveLastScrape(id, page)
  console.log(`berhasil scrape -c ${id} -p ${page}`)
  if (hasNext) {
    await syncCompanies(tab, database, id, page + 1)
  }
}

const init = async () => {
  return { tab: await prepare(), database: await initialize() }
}

const syncCategories = async (tab: Page) => {
  await goToCategoriesPage(tab)
  const categories = await getCategories(tab)
  await CategoryModel.bulkCreate(
    categories.reduce<CategoryEntity[]>((acc, c) => {
      acc.push({ id: c.id, name: c.name })
      return c.children.reduce((accc, sc) => {
        accc.push({ id: sc.id, name: sc.name, parentId: c.id })
        return accc
      }, acc)
    }, [])
  )
  return categories
}

const scrapeAll = async () => {
  const { tab, database } = await init()
  const categories = await syncCategories(tab)
  return categories.reduce<Promise<any>>(async (acc, category) => {
    if (category.children.length === 0) {
      await acc
      return syncCompanies(tab, database, category.id)
    } else {
      return category.children.reduce(async (accc, sub) => {
        await accc
        return syncCompanies(tab, database, sub.id)
      }, acc)
    }
  }, Promise.resolve())
}

const scrapeRelationWithStart = async (
  id: string,
  page: number = 1,
  resurrectCount: number = 0
): Promise<any> => {
  try {
    const { tab, database } = await init()
    const ids = (await getCompanyCategories()).reverse()
    const index = ids.indexOf(id)
    const categories = ids.slice(index)
    return await categories.reduce(async (acc, category) => {
      await acc
      if (id === category) {
        return syncRelations(tab, database, category, page)
      }
      return syncRelations(tab, database, category)
    }, Promise.resolve())
  } catch (e) {
    if (resurrectCount >= 10) {
      throw e
    }
    const last = await loadLastScrape()
    if (last) {
      console.log(e)
      console.log(`resurrecting .... ${resurrectCount}`)
      return scrapeRelationWithStart(
        last.category,
        last.page,
        resurrectCount + 1
      )
    } else {
      throw e
    }
  }
}

const scrapeWithStart = async (
  id: string,
  page: number = 1,
  resurrectCount: number = 0
): Promise<any> => {
  try {
    const { tab, database } = await init()
    const ids = await getCompanyCategories()
    const index = ids.indexOf(id)
    const categories = ids.slice(index)
    return await categories.reduce(async (acc, category) => {
      await acc
      if (id === category) {
        return syncCompanies(tab, database, category, page)
      }
      return syncCompanies(tab, database, category)
    }, Promise.resolve())
  } catch (e) {
    if (resurrectCount >= 10) {
      throw e
    }
    const last = await loadLastScrape()
    if (last) {
      console.log(e)
      console.log(`resurrecting .... ${resurrectCount}`)
      return scrapeWithStart(last.category, last.page, resurrectCount + 1)
    } else {
      throw e
    }
  }
}

const resurrect = async () => {
  try {
    const last = await loadLastScrape()
    await scrapeWithStart(last!!.category, last!!.page)
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

const argvDevinition: OptionDefinition[] = [
  { name: 'category', alias: 'c', type: String },
  { name: 'page', alias: 'p', type: Number },
  { name: 'relation', alias: 'r', type: Boolean },
  { name: 'resurrect', type: Boolean }
]

const argv = process.argv.slice(2)

const args = parseArgv(argvDevinition, { argv })

if (args.resurrect) {
  resurrect()
} else if (args.category && args.page) {
  if (args.relation) {
    scrapeRelationWithStart(args.category, args.page)
  } else {
    scrapeWithStart(args.category, args.page)
  }
} else {
  scrapeAll()
}
