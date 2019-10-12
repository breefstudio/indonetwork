import { Browser, launch, LaunchOptions, Page } from 'puppeteer'
import env from '../utils/env'

export const openBrowser = (option: LaunchOptions = {}) =>
  launch({
    ...env.puppeteer,
    ...option,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

export const openTab = async (browser: Browser, index: number = 0) => {
  const page = (await browser.pages())[index] || (await browser.newPage())
  await page.setViewport({ width: 1366, height: 768 })
  await page.goto('https://www.indonetwork.co.id')
  return page
}

export const goToCompanyDetailPage = async (page: Page, url: string) => {
  await page.goto(url)
  return page
}

export const goToCompaniesPage = async (
  tab: Page,
  category: string,
  page: number
) => {
  await tab.goto(
    `https://www.indonetwork.co.id/${category}/perusahaan?page=${page}`
  )
  try {
    await tab.waitForSelector('.list-wrapper.row.prodcompany.d-block')
  } catch (e) {
    await tab.waitForSelector('.wrapper.searchresult > h4')
  }
  return tab
}

export const goToCategoriesPage = async (page: Page) => {
  await page.goto('https://www.indonetwork.co.id/categories')
  return page
}

export interface Auth {
  readonly username: string
  readonly password: string
}

const setValue = (e: any, value: string) => (e.value = value)

export const login = async (tab: Page, auth: Auth) => {
  await tab.goto('https://www.indonetwork.co.id/user/login')
  const username = await tab.waitForSelector(
    'div.container > div.loginpagebox > div.rightside-login > div > input#username'
  )
  await username.evaluate(setValue, auth.username)
  const password = await tab.waitForSelector(
    'div.container > div.loginpagebox > div.rightside-login > div > input#password'
  )
  await password.evaluate(setValue, auth.password)
  const loginButton = await tab.waitForSelector(
    'div.container > div.loginpagebox > div.rightside-login > input.regis-btn'
  )
  await loginButton.click()
  return tab.waitForSelector('.label-icon-header.label-icon-header-account')
}

export const isLoggedIn = async (page: Page) => {
  const button = await page.$('.label-icon-header.label-icon-header-account')
  return !!button
}
