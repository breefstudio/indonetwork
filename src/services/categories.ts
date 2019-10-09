import { ElementHandle, Page } from 'puppeteer'
import { getPropertyValue, getTextContent } from '../utils'

const baseUrl = 'https://www.indonetwork.co.id/'

const getId = async (h: ElementHandle<any>) => {
  const url = await getPropertyValue(h, 'href')
  return url.replace(baseUrl, '')
}

export interface SubCategory {
  readonly id: string
  readonly name: string
}

export interface Category {
  readonly id: string
  readonly name: string
  readonly children: ReadonlyArray<SubCategory>
}

const getSubCategories = async (
  h: ElementHandle<any>
): Promise<ReadonlyArray<SubCategory>> => {
  const handles = await h.$$('ul > li.sub2cat > a')
  return Promise.all(
    handles.map(async v => ({
      id: await getId(v),
      name: await getTextContent(v)
    }))
  )
}

const getCategory = async (h: ElementHandle<any>): Promise<Category> => {
  const a = (await h.$('div.sub1cat > a'))!!
  const name = await getTextContent(a)
  const id = await getId(a)
  const children = await getSubCategories(h)
  return { id, name, children }
}

export const getCategories = async (tab: Page) => {
  const categoryHandles = await tab.$$(
    'div.subkat.clearfix > div.parentSubCat > div.innerParentSubCat'
  )
  return Promise.all(categoryHandles.map(getCategory))
}
