import { Telegraf, Scenes } from "telegraf"
import { SessionContext } from "./context/context"

import { Db } from "mongodb";
import { session } from "telegraf-session-mongodb"

import { expenseWizard } from './scenes/expenseScene'
import { incomeWizard } from './scenes/incomeScene'
import { timeIntervalWizard } from './scenes/timeIntervalScene'

// Controllers
import startupController from "./controllers/startupController"
import addController from "./controllers/addController"
import mainController from "./controllers/mainController"

import expenseController from "./controllers/expenseController"
import incomeController from "./controllers/incomeController"

import historyController from "./controllers/historyController"
import statisticsController from "./controllers/statisticsController"

// Keyboard
import keyboardButtons from './constants/keyboardButtons.json'

import authMiddleware from './middleware/authMiddleware'

import { historyMenu } from './menu'

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error("BOT_TOKEN must be provided!")
}

const bot = new Telegraf<SessionContext>(token)

export const setup = (db: Db) => {
  const stage = new Scenes.Stage([incomeWizard, expenseWizard, timeIntervalWizard])

  bot.use(session(db))
  bot.use(stage.middleware())

  bot.use(authMiddleware)

  //History Menu
  bot.use(historyMenu)

  //On startup bot greets the users, adds him to the databse (if doesn't exist) and shows an inline keyboard
  bot.start(startupController)

  //Main menu
  bot.hears(keyboardButtons.mainMenu.add, addController)
  bot.hears(keyboardButtons.mainMenu.history, historyController)
  bot.hears(keyboardButtons.mainMenu.statistics, statisticsController)

  //Adding expense / income
  bot.hears(keyboardButtons.addMenu.expenses, expenseController)
  bot.hears(keyboardButtons.addMenu.incomes, incomeController)

  //Back button
  bot.hears(keyboardButtons.back, mainController)

  return bot;
};
