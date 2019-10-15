// tslint:disable: no-console
import {} from 'bluebird-global'
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
  const scraped = await CompanyModel.getCompanyIdsByIds(
    items.map(({ id }) => (id ? id : ''))
  )
  const unscraped = items.filter(({ id }) => id && scraped.indexOf(id) < 0)
  const hasNext = await isNextPageAvailable(tab)
  const companies = await unscraped.reduce<Promise<Company[]>>(
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
  return { companies, hasNext: hasNext && items.length > 0 }
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
): Promise<void> => {
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
    return syncRelations(tab, database, id, page + 1)
  }
}

const syncCompanies = async (
  tab: Page,
  database: Sequelize,
  id: string,
  page: number = 1
): Promise<void> => {
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
    return syncCompanies(tab, database, id, page + 1)
  }
}

const init = async () => {
  return { tab: await prepare(), database: await initialize() }
}

const syncCategories = async (tab: Page) => {
  const dd = await getCompanyCategories()
  if (dd.length === 0) {
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
    return getCompanyCategories()
  } else {
    return dd
  }
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

const scrapeResurrect = async (
  tab: Page,
  database: Sequelize,
  suffix: 'asc' | 'desc',
  resurrectCount: number = 0
): Promise<void> => {
  const last = await OptionModel.loadLastScrape(suffix)
  try {
    const ids = await getCompanyCategories(suffix === 'asc' ? 'ASC' : 'DESC')
    let index = 0
    if (last) {
      index = ids.indexOf(last.category)
    }
    const categories = ids.slice(index)
    return await categories.reduce(async (acc, category) => {
      await acc
      if (last && last.category === category) {
        return syncCompanies(tab, database, category, last.page)
      }
      return syncCompanies(tab, database, category)
    }, Promise.resolve())
  } catch (e) {
    if (resurrectCount >= 10) {
      throw e
    }
    console.log(e)
    console.log(`resurrecting .... ${resurrectCount}`)
    return scrapeResurrect(tab, database, suffix, resurrectCount + 1)
  }
}

const prepareTab = async (suffix: 'asc' | 'desc', index: number) => {
  const tab = await openTab(
    await openBrowser({ userDataDir: `puppeteer/${suffix}` }),
    index
  )
  if (!(await isLoggedIn(tab))) {
    await login(tab, auth)
  }
  return tab
}

const resurrect = async () => {
  const database = await initialize()
  const tabAsc = await prepareTab('asc', 0)
  if (!(await isLoggedIn(tabAsc))) {
    await login(tabAsc, auth)
  }
  await syncCategories(tabAsc)
  const tabDesc = await prepareTab('desc', 0)
  try {
    return await Promise.all([
      scrapeResurrect(tabAsc, database, 'asc'),
      scrapeResurrect(tabDesc, database, 'desc')
    ])
  } catch (e) {
    if (e.message === 'no last!') {
      throw e
    } else {
      console.log(e)
      process.exit(1)
    }
  }
}

resurrect()
