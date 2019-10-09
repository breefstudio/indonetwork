import { Page } from 'puppeteer'
import { initialize } from './models'
import CategoryModel, { CategoryEntity } from './models/category'
import CompanyModel, { CompanyEntity } from './models/company'
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
  await goToCompanyDetailPage(tab, url)
  return getCompany(tab)
}

interface Category {
  readonly id: string
  readonly name: string
  readonly companies: ReadonlyArray<Company>
}

const scrapeCompanyForCategory = async (
  tab: Page,
  id: string,
  page: number = 1
) => {
  const { companies, hasNext } = await scrapeCompanies([], tab, id, page)
  if (companies.length === 0) {
    return
  }
  await CompanyModel.bulkCreate(
    companies.map<CompanyEntity>(c => {
      return {
        ...c,
        categoryId: id
      }
    })
  )
  if (hasNext) {
    await scrapeCompanyForCategory(tab, id, page + 1)
  }
}

const scrape = async () => {
  await initialize()
  const tab = await prepare()
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
  return categories.reduce<Promise<any>>(async (acc, category) => {
    if (category.children.length === 0) {
      await acc
      return scrapeCompanyForCategory(tab, category.id)
    } else {
      return category.children.reduce(async (accc, sub) => {
        await accc
        return scrapeCompanyForCategory(tab, sub.id)
      }, acc)
    }
  }, Promise.resolve())
}

scrape()
