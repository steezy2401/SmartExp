import { Composer, Scenes, Markup } from "telegraf";
import { SessionContext } from "../context/context";
import { template } from "../utils/templater";
import { mainKeyboard, dateKeyboard, descriptionKeyboard } from '../constants/keyboards'
import { createKeyboard } from '../utils/categoryKeyboard'
import checkEmoji from "../utils/checkEmoji";

import CategoryModel from "../models/categoryModel"
import ExpenseModel from "../models/expenseModel"

const parser = require('any-date-parser');

interface expenseData {
  sum: number;
  category: string;
  date: string;
  description: string;
}

const saveExpense = async (data: expenseData) => {
  console.log(data)

  ExpenseModel.create(data, function (err) {
    if (err) throw new Error();
  })
}

function isNumeric(a: string) {
  if (typeof a != "string") return false // we only process strings!  
  return !isNaN(parseFloat(a)) // ...and ensure strings of whitespace fail
}

// Getting sum wizard step
const getSumStep = new Composer<SessionContext>();
getSumStep.on("text", async (ctx) => {

  const sum = ctx.message.text;

  if (!isNumeric(sum)) {
    ctx.reply(template("expense", "sum_error", {}));
    await ctx.reply(template("expense", "sum", {}));
    return;
  }

  ctx.session.expenseData.sum = parseFloat(sum.replace(',', '.')).toFixed(2);

  //Getting category keyboard
  const categoryKeyboard = await createKeyboard(ctx.from.id, 'EXPENSE')
  if (categoryKeyboard != null) {
    await ctx.reply(template("expense", "category", {}), categoryKeyboard.resize());
  } else {
    await ctx.reply(template("expense", "no_category", {}));
    await ctx.reply(template("expense", "category", {}));
  }
  return ctx.wizard.next();
});
getSumStep.use((ctx) =>
  ctx.reply(template("expense", "sum", {}))
);

// Getting category wizard step
const getCategoryStep = new Composer<SessionContext>();
getCategoryStep.on("text", async (ctx) => {

  const category = ctx.message.text;

  if (!checkEmoji(category) || category.length > 3) {
    ctx.reply(template("expense", "category_error", {}));
    await ctx.reply(template("expense", "category", {}));
    return;
  }

  const emoji = await CategoryModel.find({ emoji: category }).exec()
  if (emoji.length <= 0) {
    //TODO Ask user if he would like to add a new category
    ctx.session.newCategory = category
    await ctx.reply('У вас еще нет такой категории...', Markup.removeKeyboard());
    await ctx.reply(
      'Добавить новую категорию?',
      Markup.inlineKeyboard([
        Markup.button.callback('Да', 'confirmCategory'),
        Markup.button.callback('Нет', 'rejectCategory'),
      ])
    )
    return ctx.wizard.next();
  }


  ctx.session.expenseData.category = category
  await ctx.reply(template("expense", "date", {}), dateKeyboard.resize());
  return ctx.wizard.selectStep(4);
});

const newCategoryStep = new Composer<SessionContext>();
newCategoryStep.action('confirmCategory', async (ctx) => {
  const category = ctx.session.newCategory
  const userId = ctx.session.userId

  CategoryModel.create({
    emoji: category,
    type: 'EXPENSE',
    userTelegramId: userId
  }, function (err) {
    if (err) throw new Error();
  })
  await ctx.reply(template("expense", "category_add", { category: category }));
  
  ctx.session.expenseData.category = category
  await ctx.reply(template("expense", "date", {}), dateKeyboard.resize());
  return ctx.wizard.next()
})

newCategoryStep.action('rejectCategory', async (ctx) => {
  const category = ctx.session.newCategory
  const userId = ctx.session.userId

  await ctx.reply(template("expense", "category_notAdd", { category: category }));

  const categoryKeyboard = await createKeyboard(userId, 'EXPENSE')
  if (categoryKeyboard != null) {
    await ctx.reply(template("expense", "category", {}), categoryKeyboard.resize());
  } else {
    await ctx.reply(template("expense", "no_category", {}));
    await ctx.reply(template("expense", "category", {}));
  }
  
  return ctx.wizard.back()
})

// Getting date wizard step
const getDateStep = new Composer<SessionContext>();
getDateStep.on("text", async (ctx) => {
  const date = ctx.message.text;

  let parsedDate = parser.fromString(date);
  if (date == 'Сегодня' || date == 'Today') {
    parsedDate = parser.fromString('today');
  }

  // Validating date
  if (parsedDate.invalid != undefined) {
    ctx.reply(template("expense", "date_error", {}));
    await ctx.reply(template("expense", "date", {}));
    return;
  }

  ctx.session.expenseData.date = parsedDate
  await ctx.reply(template("expense", "description", {}), descriptionKeyboard.resize());
  return ctx.wizard.next();
});
getDateStep.use((ctx) =>
  ctx.replyWithMarkdown(template("expense", "date", {}))
);

// Getting description wizard step
const getDescriptionStep = new Composer<SessionContext>();
getDescriptionStep.on("text", async (ctx) => {

  let description = ctx.message.text;
  
  if (description.length > 100) {
    ctx.reply(template("expense", "description_error", {}));
    await ctx.reply(template("expense", "description", {}), descriptionKeyboard.resize());
    return;
  }

  if (description == 'Без описания') {
    description = '-'
  }

  ctx.session.expenseData.description = description

  // Saving data to the database
  //await saveExpense(ctx.session.expenseData)

  const date = new Date(ctx.session.expenseData.date);

  await ctx.replyWithMarkdown(template("expense", "wizardEnd", {
    sum: ctx.session.expenseData.sum,
    category: ctx.session.expenseData.category,
    date: date.getDate() + '.' + (("0" + (date.getMonth() + 1)).slice(-2)) + '.' + date.getFullYear(),
    description: ctx.session.expenseData.description
  }),
    mainKeyboard
      .resize()
  );
  return await ctx.scene.leave();
});
getDescriptionStep.use((ctx) =>
  ctx.replyWithMarkdown(template("expense", "description", {}))
);


export const expenseWizard = new Scenes.WizardScene(
  "expense-wizard",
  async (ctx) => {
    ctx.session.expenseData = {};
    ctx.session.expenseData.telegramId = ctx.from!.id

    const text = template("expense", "wizardStart", {});
    await ctx.replyWithMarkdown(text, Markup.removeKeyboard());
    await ctx.reply(template("expense", "sum", {}));
    return ctx.wizard.next();
  },
  getSumStep,
  getCategoryStep,
  newCategoryStep,
  getDateStep,
  getDescriptionStep
);
