import { config } from 'dotenv'

config()

const env = process.env

export const auth = {
  username: env.INDONETWORK_USERNAME!!,
  password: env.INDONETWORK_PASSWORD!!
}

export const puppeteer = {
  headless: env.HEADLESS === 'true',
  // executablePath: env.CHROME_EXECUTABLE_PATH!!,
  userDataDir: env.USER_DATA_DIR!!
}

export const database = {
  host: env.DATABASE_HOST!!,
  port: parseInt(env.DATABASE_HOST!!, 10),
  database: env.DATABASE_NAME!!,
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD
}

export default { auth, puppeteer, database }
