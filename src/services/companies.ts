import { ElementHandle, Page } from 'puppeteer'
import { getNumberContent, getPropertyValue, getTextContent } from '../utils'

interface Company {
  readonly name: string
  readonly url?: string
  readonly description: string
}

const getCompany = async (hanlde: ElementHandle<any>): Promise<Company> => {
  const title = (await hanlde.$('div > div > h3'))!!
  const description = await getTextContent((await hanlde.$('div > div.desc'))!!)
  const name = await getTextContent(title)
  const url = await title.$('a.link_product')
  if (url) {
    return {
      name: name.trim(),
      url: await getPropertyValue(url, 'href'),
      description: description.trim()
    }
  } else {
    return { name: name.trim(), description: description.trim() }
  }
}

export const getCompanies = async (
  tab: Page
): Promise<ReadonlyArray<Company>> => {
  const elements = await tab.$$('div > div.product-info')
  return (await Promise.all(elements.map(getCompany))).filter(v => !!v.url)
}

export const isNextPageAvailable = async (tab: Page) => {
  const activePageHandle = await tab.$('.page-link.active')
  if (!activePageHandle) {
    return false
  }
  const pageHanles = await tab.$$('.page-link')

  const activePage = await getNumberContent(activePageHandle)
  const pages = await Promise.all(pageHanles.map(getNumberContent))

  return pages.length > 1 && pages[pages.length - 1] > activePage
}
