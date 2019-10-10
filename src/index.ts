// tslint:disable: no-console
import parseArgv, { OptionDefinition } from 'command-line-args'
import { Page } from 'puppeteer'
import { initialize } from './models'
import CategoryModel, {
  CategoryEntity,
  getCompanyCategories
} from './models/category'
import CompanyModel, { CompanyEntity } from './models/company'
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
import { getCompanies, isNextPageAvailable } from './services/companies'
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

const syncCompanies = async (tab: Page, id: string, page: number = 1) => {
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
  await CompanyModel.bulkCreate(
    companies.map<CompanyEntity>(c => ({ ...c, categoryId: id })),
    { ignoreDuplicates: true }
  )
  await saveLastScrape(id, page)
  console.log(`berhasil scrape -c ${id} -p ${page}`)
  if (hasNext) {
    await syncCompanies(tab, id, page + 1)
  }
}

const init = async () => {
  await initialize()
  return prepare()
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
  const tab = await init()
  const categories = await syncCategories(tab)
  return categories.reduce<Promise<any>>(async (acc, category) => {
    if (category.children.length === 0) {
      await acc
      return syncCompanies(tab, category.id)
    } else {
      return category.children.reduce(async (accc, sub) => {
        await accc
        return syncCompanies(tab, sub.id)
      }, acc)
    }
  }, Promise.resolve())
}

const scrapeWithCategory = async (id: string, page: number = 1) => {
  const tab = await init()
  return syncCompanies(tab, id, page)
}

const scrapeWithStart = async (id: string, page: number = 1): Promise<any> => {
  try {
    const tab = await init()
    const ids = await getCompanyCategories()
    const index = ids.indexOf(id)
    const categories = ids.slice(index)
    return await categories.reduce(async (acc, category) => {
      await acc
      if (id === category) {
        return syncCompanies(tab, category, page)
      }
      return syncCompanies(tab, category)
    }, Promise.resolve())
  } catch (e) {
    const last = await loadLastScrape()
    if (last) {
      console.log(e)
      console.log('resurrecting ....')
      return scrapeWithStart(last.category, last.page)
    } else {
      throw e
    }
  }
}

const argvDevinition: OptionDefinition[] = [
  { name: 'category', alias: 'c', type: String },
  { name: 'page', alias: 'p', type: Number }
]

const argv = process.argv.slice(2)

const args = parseArgv(argvDevinition, { argv })

if (args.category && args.page) {
  scrapeWithStart(args.category, args.page)
} else {
  scrapeAll()
}
