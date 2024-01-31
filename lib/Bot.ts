import TelegramBot, {Message} from 'node-telegram-bot-api';
import cron from 'node-cron'
import dotenv from 'dotenv';

import cityFinder from "./CityFinder";
import screenshot from "./Screenshot";
import dbManager from "./DatabaseManager";
import {ELastMessage, IChatConfig, ICityData} from "./interface";

dotenv.config();

class Bot {

    bot: TelegramBot;
    timeVariationLine = ["7:00", "8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"]
    API_KEY_BOT = ""
    typeVariants = ["Прогноз на один денть", "Прогноз на три дня", "Прогноз на десять деней"]
    cronTask: cron.ScheduledTask[] = []
    botName = ""

    constructor() {
        this.loadEnv()
        this.loadDB()
        this.bot = new TelegramBot(this.API_KEY_BOT, {
            polling: {
                interval: 300,
                autoStart: true
            }
        })
        this.listen()
        this.setCommands()
        this.crone()
    }

    private _chatConfig: IChatConfig[] = [];

    get chatConfig(): IChatConfig[] {
        return this._chatConfig;
    }

    set chatConfig(configs: IChatConfig[]) {
        this._chatConfig = configs;
        this.saveDB()
        this.crone()
    }

    loadDB = () => {
        dbManager.loadObject((loadedObject) => {
            if (loadedObject) this.chatConfig = loadedObject
        });
    }

    saveDB = () => {
        dbManager.saveObject(this.chatConfig);
    }

    setCommands(): void {
        const commands = [
            {
                command: ELastMessage.start,
                description: "Запуск бота"
            },
            {
                command: ELastMessage.config,
                description: "Показать конфигурацию бота"
            },
            {
                command: ELastMessage.time,
                description: "Указать время"
            },
            {
                command: ELastMessage.city,
                description: "Указать город"
            },
            {
                command: ELastMessage.weather,
                description: "Узнать погоду"
            },
            {
                command: ELastMessage.type,
                description: "Задать тип прогноза"
            }
        ]
        this.bot.setMyCommands(commands);
    }

    private loadEnv = () => {
        if (process.env.BOT_NAME && process.env.API_KEY_BOT) {
            this.API_KEY_BOT = process.env.API_KEY_BOT
            this.botName = process.env.BOT_NAME
        } else {
            throw new Error("The application encountered an error due to missing variables: BOT_NAME or API_KEY_BOT. Please check the .env configuration file or provide them when starting the container.")
        }
    }

    private crone = () => {
        this.cronTask.forEach(task => task.stop());
        this.timeVariationLine.forEach(tv => {
            const cronPattern = `0 ${tv.split(":")[1]} ${tv.split(":")[0]} * * *`; // Запускаем каждый день в выбранное время
            const task = cron.schedule(cronPattern, () => {
                this.chatConfig.forEach(chatConfig => {
                    if (chatConfig.time === tv) {
                        this.sendWeather(chatConfig)
                    }
                })
            });
            this.cronTask.push(task);
        })
    }

    private isAdmin = async (msg: Message) => {
        let result = false
        if (msg?.chat?.type !== "private") {
            const administrators = await this.bot.getChatAdministrators(msg.chat.id);
            administrators.forEach(a => {
                if (a.user.id === msg?.from?.id) {
                    result = true
                }
            })
        } else {
            result = true
        }
        return result
    }


    private listen(): void {
        this.bot.on('text', async msg => {

            const text: string | null | undefined | ELastMessage = msg.text
            const chatId = msg.chat?.id
            let chatConfig = this.chatConfig?.find(cc => cc.chatId === chatId) || null
            const isAdmin = await this.isAdmin(msg)

            if (!isAdmin) return

            if (!chatConfig) {
                const newConfig = {
                    chatId,
                    time: null,
                    city: null,
                    lastMessage: ELastMessage.null,
                    type: null,
                    cityData: {
                        name: null,
                        slug: null,
                        id: null
                    },
                    citiesData: [],
                    cityId: null
                }
                chatConfig = newConfig
                console.log(this.chatConfig)
                this.chatConfig.push(newConfig)
            }

            // start
            if (this.isMessageCommand(msg, ELastMessage.start)) {
                await this.bot.sendMessage(msg.chat.id, `Вы запустили бота!`);
            }

            // config
            if (this.isMessageCommand(msg, ELastMessage.config)) {
                await this.bot.sendMessage(msg.chat.id, JSON.stringify(this.chatConfig, null, "\t"));
            }

            // timedone
            if (this.isMessageCommand(msg, ELastMessage.time)) {
                this.setLastMessage(msg, ELastMessage.timedone)
                await this.bot.sendMessage(msg.chat.id, `Укажите время когда отправлять погоду`, this.getTimeKeyboard())
            }

            // timedone
            if (
                chatConfig && text && chatConfig?.lastMessage === ELastMessage.timedone && this.timeVariationLine.includes(text)
            ) {
                this.setLastMessage(msg, ELastMessage.null)
                this.setTime(msg, text)
                await this.bot.sendMessage(msg.chat.id, "Время установлено");
            }

            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### CITY CONFIG

            // city
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.city)) {
                if (text && text.length > 3) {
                    await this.bot.sendMessage(msg.chat.id, "Напиши название своего города")
                    this.setLastMessage(msg, ELastMessage.null)

                    setTimeout(() => {
                        this.setLastMessage(msg, ELastMessage.citydone)
                    }, 3500)
                }
            }

            // citydone
            if (chatConfig && text && text.length > 3 && chatConfig?.lastMessage === ELastMessage.citydone) {
                const cities = await cityFinder.searchCities(text)
                const citiesData: ICityData[] = cities.map(c => {
                    return {
                        id: c.id,
                        slug: c.slug,
                        name: c?.translations?.ru?.city?.name,
                        country: c.translations?.ru?.country?.name,
                        district: c.translations?.ru?.district?.name,
                        city: c.translations?.ru?.city?.name
                    }
                })
                if (citiesData.length > 0) {
                    this.setCitiesData(msg, citiesData)
                    const citiesNames: string[] = cities.map(c =>
                        this.getFullCityName(c.translations?.ru?.country?.name, c.translations?.ru?.district?.name, c.translations?.ru?.city?.name))
                    const citiesKeys = this.getCitiesKeyboard(citiesNames)
                    await this.bot.sendMessage(msg.chat.id, `Выберите город`, citiesKeys)
                    this.setLastMessage(msg, ELastMessage.citydonedone)
                } else {
                    await this.bot.sendMessage(msg.chat.id, "Проверьте другое название своего города");
                }
            }

            // citydonedone
            if (chatConfig && text && chatConfig?.lastMessage === ELastMessage.citydonedone) {
                let targetCitiData: ICityData | null = null
                chatConfig.citiesData.forEach(cd => {
                    const fullCityName = this.getFullCityName(cd?.country || null, cd?.district || null, cd?.city || null)
                    if (fullCityName === text) {
                        targetCitiData = cd
                        targetCitiData.city = cd?.city
                    }
                })
                if (targetCitiData) {
                    this.setCitiName(msg, (targetCitiData as ICityData)?.name || "")
                    this.setCitiData(msg, (targetCitiData as ICityData).name, (targetCitiData as ICityData).slug, (targetCitiData as ICityData).id)
                    this.setLastMessage(msg, ELastMessage.null)
                    this.setCitiesData(msg, [])
                    this.setCitiesId(msg, (targetCitiData as ICityData).id)
                    await this.bot.sendMessage(msg.chat.id, `Город задан`)
                }
            }
            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ###

            // type
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.type)) {
                await this.bot.sendMessage(msg.chat.id, `Укажите тип:`, this.getTypeKeyboard())
                this.setLastMessage(msg, ELastMessage.typedone)
            }

            // typedone
            if (chatConfig && text && chatConfig?.lastMessage === ELastMessage.typedone && this.typeVariants.includes(text)) {
                await this.bot.sendMessage(msg.chat.id, `Типа задан`)
                let type: 1 | 3 | 10 = 1
                if (text === this.typeVariants[0]) type = 1
                else if (text === this.typeVariants[1]) type = 3
                else if (text === this.typeVariants[2]) type = 10
                this.setType(msg, type)
                this.setLastMessage(msg, ELastMessage.null)
            }

            // weather
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.weather)) {
                if (this.isBotConfigured(msg)) {
                    await this.bot.sendMessage(msg.chat.id, `Подготавливаю прогноз...`)
                    this.sendWeather(chatConfig)
                } else {
                    await this.bot.sendMessage(msg.chat.id, `Чтобы получать погоду, сначала нужно сконфигурировать бот!`)
                }
            }
        })
    }

    private isMessageCommand = (msg: Message, command: string) => {
        return msg.text && (msg.text == `/${command}` || msg.text == `/${command}@${this.botName}`)
    }

    private sendWeather = async (chatConfig: IChatConfig) => {
        let isError = false
        if (chatConfig.type === 1) {
            if (await screenshot.takeScreenshotFor1Day(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `Прогноз погоды для ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/1-${chatConfig.cityId}.png`);
            } else isError = true
        } else if (chatConfig.type === 3) {
            if (await screenshot.takeScreenshotFor3Days(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `Прогноз погоды для ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/3-${chatConfig.cityId}.png`);
            } else isError = true
        } else {
            if (await screenshot.takeScreenshotFor10Days(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `Прогноз погоды для ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/10-${chatConfig.cityId}.png`);
            } else isError = true
        }
        if (isError) {
            await this.bot.sendMessage(chatConfig.chatId, `Возникла ошибка при получении данных.`)
        }
    }

    private setType = (msg: Message, type: 1 | 3 | 10) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.type = type
            }
            return cc
        })
    }


    private isBotConfigured = (msg: Message) => {
        let result = false
        this.chatConfig.forEach(cc => {
            if (cc.chatId === msg.chat.id) {
                if (cc.time && cc.type && cc.city) {
                    result = true
                }
            }
        })
        return result
    }

    private setTime = (msg: Message, time: string) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.time = time
            }
            return cc
        })
    }

    private setCitiName = (msg: Message, name: string) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.city = name
            }
            return cc
        })
    }

    private setLastMessage = (msg: Message, lastMessage: ELastMessage) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.lastMessage = lastMessage
            }
            return cc
        })
    }

    private setCitiesId = (msg: Message, cityId: number | null) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.cityId = cityId
            }
            return cc
        })
    }
    private setCitiesData = (msg: Message, cityData: ICityData[]) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.citiesData = cityData
            }
            return cc
        })
    }

    private setCitiData = (msg: Message, name: string | null, slug: string | null, id: number | null) => {
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.cityData = {id, name, slug}
            }
            return cc
        })
    }

    private getFullCityName = (country: string | null, district: string | null, city?: string | null) => {
        return `${country}, ${district}, ${city}`
    }

    private getCitiesKeyboard = (cities: string[]) => {
        return {
            reply_markup: {
                keyboard: this.arrayToArrays(cities, 1)
                    .map(e => {
                        return e.map(ee => {
                            return {
                                text: ee
                            }
                        })
                    }),
                resize_keyboard: false,
                one_time_keyboard: true
            }
        }
    }

    private getTimeKeyboard = () => {
        return {
            reply_markup: {
                keyboard: this.arrayToArrays(this.timeVariationLine, 4)
                    .map(e => {
                        return e.map(ee => {
                            return {
                                text: ee
                            }
                        })
                    }),
                resize_keyboard: false,
                one_time_keyboard: true
            }
        }
    }

    private getTypeKeyboard = () => {
        return {
            reply_markup: {
                keyboard: [this.typeVariants.map(tv => {
                    return {
                        text: tv
                    }
                })],
                resize_keyboard: false,
                one_time_keyboard: true
            }
        }
    }

    private arrayToArrays = (array: any[], arrayCount: number) => {
        const result: [][] = []
        let temp: [] = []
        array.forEach(a => {
            // @ts-ignore
            temp.push(a)
            if (temp.length >= arrayCount) {
                result.push(temp)
                temp = []
            }
        })
        if (temp) {
            result.push(temp)
        }
        return result
    }

}

const bot = new Bot();
export default bot;
