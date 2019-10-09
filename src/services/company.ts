import { Page } from 'puppeteer'
import { parse, ParsedQuery } from 'query-string'
import { getPropertyValue, getTextContent } from '../utils'

const getPhones = async (tab: Page) => {
  try {
    const handle = await tab.waitForSelector(
      'div.hub > div.emailprofile#mask-phone > div.absphone.nowa'
    )
    const phones = await handle.$$('div > a.nobor')
    return Promise.all(phones.map(getTextContent))
  } catch (e) {
    return []
  }
}

const getEmail = async (tab: Page) => {
  try {
    const handle = await tab.waitForSelector(
      'div.hub > div.emailprofile#mask-email > div.absphone.nowa > div > a.nobor'
    )
    return getTextContent(handle)
  } catch (e) {
    return undefined
  }
}

const getWhatsApp = async (tab: Page) => {
  try {
    await tab.waitForSelector(
      'div.hub > div.emailprofile > div.absphone.nowa > div.mb-1 > a.nobor'
    )
    const handles = await tab.$$(
      'div.hub > div.emailprofile > div.absphone.nowa > div.mb-1 > a.nobor'
    )
    return Promise.all(
      handles.map(async v => {
        const url = await getPropertyValue(v, 'href')
        return url.split('=')[1]
      })
    )
  } catch (e) {
    return []
  }
}

export interface Company {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly website: string
  readonly address: string
  readonly city: string
  readonly phones: string
  readonly email: string
  readonly whatsapp: string
}

const getLeads = async (tab: Page, selector: string): Promise<string> => {
  const handle = await tab.$(selector)
  if (!handle) {
    return ''
  }
  const text = await getPropertyValue(handle, 'id')
  handle.click()
  const response = await tab.waitForResponse(r => {
    if (r.url() !== 'https://www.indonetwork.co.id/leads') {
      return false
    }
    const request = r.request()
    const body = request.postData()
    if (!body || body.length === 0) {
      return false
    }
    const parsed = parse(body)
    return parsed.text === `'${text}'`
  })
  const data = await response.json()
  return data.text
}

export const getCompany = async (tab: Page): Promise<Company> => {
  const name = await tab
    .waitForSelector(
      '.sc-company__stack.sc-company__vendor > h1.sc-company__title'
    )
    .then(getTextContent)
  const website = await tab
    .waitForSelector('a.sc-link-domain > span.sc-text__www')
    .then(getTextContent)
  const address = await tab
    .waitForSelector('.sc-company__stack.sc-company__verified > address')
    .then(getTextContent)
  const city = await tab
    .waitForSelector(
      '.sc-company__stack.sc-company__verified > div.row > div > span.text-capitalize'
    )
    .then(getTextContent)
  const descriptionHandles = await tab.$$(
    'div.rc-company > div.rc-company__description > div'
  )
  const descriptions = await Promise.all(descriptionHandles.map(getTextContent))
  const description = descriptions.reduce((acc, v) => {
    const text = v.trim()
    if (text.length === 0) {
      return acc
    } else {
      return `${acc}\n${text}`
    }
  }, '')

  const phones = await getLeads(
    tab,
    '.sc-company__stack.sc-company__contact > div > div > div.emailprofile#mask-phone > button.mask-phone-button'
  )
  const email = await getLeads(
    tab,
    '.sc-company__stack.sc-company__contact > div > div > div.emailprofile#mask-email > button.mask-email-button'
  )
  const whatsapp = await getLeads(
    tab,
    '.sc-company__stack.sc-company__contact > div > div > div.emailprofile > button.mask-wa-button'
  )

  return {
    id: tab.url().replace('https://www.indonetwork.co.id/company/', ''),
    name,
    description,
    website,
    address: address.trim(),
    city,
    phones,
    email,
    whatsapp
  }
}
