import { ElementHandle } from 'puppeteer'

export const getNumberContent = async (h: ElementHandle<any>) =>
  parseInt(await getTextContent(h), 10)

export const getTextContent = async (h: ElementHandle<any>): Promise<string> =>
  getPropertyValue(h, 'textContent')

export const getPropertyValue = async (
  h: ElementHandle<any>,
  name: string
): Promise<string> => (await h.getProperty(name)).jsonValue()
