import TelegramBot, {Message} from 'node-telegram-bot-api';
import cron from 'node-cron'
import dotenv from 'dotenv';
import {i18n} from "./config"

import cityFinder from "./CityFinder";
import screenshot from "./Screenshot";
import dbManager from "./DatabaseManager";

import {ELastMessage, IChatConfig, ICityData} from "./interface";

dotenv.config();

class Helper {
    protected isMessageCommand = (msg: Message, command: string, BOT_NAME: string) => {
        return msg.text && (msg.text == `/${command}` || msg.text == `/${command}@${BOT_NAME}`)
    }
    protected getFullCityName = (country: string | null, district: string | null, city?: string | null) => {
        return `${country}, ${district}, ${city}`
    }

    protected arrayToArrays = (array: any[], arrayCount: number) => {
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

class Bot extends Helper {

    bot!: TelegramBot;

    TIME_RANGE: string[] = []
    API_KEY_BOT = ""
    BOT_NAME = ""

    cronTask: cron.ScheduledTask[] = []
    langFullNames = ["English", "Chinese", "Ukrainian", "Russian", "Spanish"]

    constructor() {
        super()
        this.loadEnv()
        this.loadDB()
        this.bot = new TelegramBot(this.API_KEY_BOT, {
            polling: {
                // interval: 300,
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
                description: i18n.__('bot_commands.start')
            },
            {
                command: ELastMessage.lang,
                description: i18n.__('bot_commands.lang')
            },
            {
                command: ELastMessage.time,
                description: i18n.__('bot_commands.time')
            },
            {
                command: ELastMessage.city,
                description: i18n.__('bot_commands.city')
            },
            {
                command: ELastMessage.type,
                description: i18n.__('bot_commands.type')
            },
            {
                command: ELastMessage.weather,
                description: i18n.__('bot_commands.weather')
            },
            {
                command: ELastMessage.config,
                description: i18n.__('bot_commands.config')
            },
        ]
        this.bot.setMyCommands(commands);
    }

    private getTypeVariants = (chatConfig: IChatConfig) => {
        return [
            i18n.__({phrase: 'keyboard.time.1day', locale: chatConfig.lang}),
            i18n.__({phrase: 'keyboard.time.3day', locale: chatConfig.lang}),
            i18n.__({phrase: 'keyboard.time.10day', locale: chatConfig.lang}),
        ]
    }

    private loadEnv = () => {
        if (process.env.BOT_NAME && process.env.API_KEY_BOT && process.env.TIME_RANGE) {
            this.API_KEY_BOT = process.env.API_KEY_BOT
            this.BOT_NAME = process.env.BOT_NAME
            this.TIME_RANGE = (process.env.TIME_RANGE || "").split(",")
        } else {
            throw new Error("The application encountered an error due to missing variables: BOT_NAME or API_KEY_BOT or TIME_RANGE. Please check the .env configuration file or provide them when starting the container.")
        }
    }

    private crone = () => {
        this.cronTask.forEach(task => task.stop());
        this.TIME_RANGE.forEach(tv => {
            const cronPattern = `0 ${tv.split(":")[1]} ${tv.split(":")[0]} * * *`;
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

            const isAdmin = await this.isAdmin(msg)
            if (!isAdmin) return

            const text: string | null | undefined | ELastMessage = msg.text
            const chatId = msg.chat?.id
            let chatConfig = this.chatConfig?.find(cc => cc.chatId === chatId) || null

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
                    cityId: null,
                    lang: "en"
                }
                chatConfig = newConfig
                this.chatConfig.push(newConfig)
            }

            // start
            if (this.isMessageCommand(msg, ELastMessage.start, this.BOT_NAME)) {
                const notSpecifiedText = i18n.__({phrase: "bot_messages.start", locale: chatConfig.lang})
                await this.bot.sendMessage(msg.chat.id, notSpecifiedText, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
            }

            // config
            if (this.isMessageCommand(msg, ELastMessage.config, this.BOT_NAME)) {
                const {city, time, type, lang} = this.getConfig(msg)
                const notSpecifiedText = i18n.__({phrase: "text.not_specified", locale: chatConfig.lang})
                await this.bot.sendMessage(msg.chat.id,
                    (i18n.__({phrase: "bot_messages.configuration", locale: chatConfig.lang}, {
                            city: city || notSpecifiedText,
                            time: time || notSpecifiedText,
                            type: type || notSpecifiedText,
                            lang: lang || notSpecifiedText,
                        }
                    )),
                    {parse_mode: 'Markdown'});
            }

            // timedone
            if (this.isMessageCommand(msg, ELastMessage.time, this.BOT_NAME)) {
                this.setLastMessage(msg, ELastMessage.timedone)
                await this.bot.sendMessage(msg.chat.id, i18n.__('bot_messages.specify_time'), this.getTimeKeyboard())
            }

            // timedone
            if (
                chatConfig && text && chatConfig?.lastMessage === ELastMessage.timedone && this.TIME_RANGE.includes(text)
            ) {
                this.setLastMessage(msg, ELastMessage.null)
                this.setTime(msg, text)
                await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_time_done',
                    locale: chatConfig.lang
                    }),
                );
            }

            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### CITY CONFIG

            // city
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.city, this.BOT_NAME)) {
                if (text && text.length > 3) {
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_city',
                        locale: chatConfig.lang
                    }))
                    this.setLastMessage(msg, ELastMessage.null)

                    setTimeout(() => {
                        this.setLastMessage(msg, ELastMessage.citydone)
                    }, 1500)
                }
            }

            // citydone
            if (chatConfig && text && text.length > 3 && chatConfig?.lastMessage === ELastMessage.citydone) {
                let lang = "en"
                const cities = await cityFinder.searchCities(text, lang)
                const citiesData: ICityData[] = cities.map(c => {
                    return {
                        id: c.id,
                        slug: c.slug,
                        name: c?.translations?.[lang]?.city?.name,
                        country: c.translations?.[lang]?.country?.name,
                        district: c.translations?.[lang]?.district?.name,
                        city: c.translations?.[lang]?.city?.name
                    }
                })
                if (citiesData.length > 0) {
                    this.setCitiesData(msg, citiesData)
                    const citiesNames: string[] = cities.map(c =>
                        this.getFullCityName(
                            c.translations?.[lang]?.country?.name,
                            c.translations?.[lang]?.district?.name,
                            c.translations?.[lang]?.city?.name
                        )
                    )
                    const citiesKeys = this.getCitiesKeyboard(citiesNames)
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_city_select',
                        locale: chatConfig.lang
                    }), citiesKeys)
                    this.setLastMessage(msg, ELastMessage.citydonedone)
                } else {
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_city_another',
                        locale: chatConfig.lang
                    }));
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
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_city_done',
                        locale: chatConfig.lang
                    }))
                }
            }

            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ###

            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### LANG

            // get
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.lang, this.BOT_NAME)) {
                await this.bot.sendMessage(msg.chat.id, i18n.__({
                    phrase: 'bot_messages.specify_lang',
                    locale: chatConfig.lang
                }), this.getLangKeyboard())
                setTimeout(() => {
                    this.setLastMessage(msg, ELastMessage.langdone)
                }, 700)
            }
            // select
            if (chatConfig && text && chatConfig?.lastMessage === ELastMessage.langdone && this.langFullNames.includes(text)) {
                await this.bot.sendMessage(msg.chat.id, i18n.__({
                    phrase: 'bot_messages.specify_lang_select_done',
                    locale: chatConfig.lang
                }))
                this.setLangData(msg, text)
                this.setLastMessage(msg, ELastMessage.null)
            }

            // ### ### ### ### ### ### ### ### ### ### ### ### ### ### ### ###

            // type
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.type, this.BOT_NAME)) {
                await this.bot.sendMessage(msg.chat.id, i18n.__({
                    phrase: 'bot_messages.specify_set_type',
                    locale: chatConfig.lang
                }), this.getTypeKeyboard(chatConfig))
                this.setLastMessage(msg, ELastMessage.typedone)
            }

            // typedone
            if (chatConfig && text && chatConfig?.lastMessage === ELastMessage.typedone && this.getTypeVariants(chatConfig).includes(text)) {
                await this.bot.sendMessage(msg.chat.id, i18n.__({
                    phrase: 'bot_messages.specify_set_type_done',
                    locale: chatConfig.lang
                }))
                let type: 1 | 3 | 10 = 1
                if (text === this.getTypeVariants(chatConfig)[0]) type = 1
                else if (text === this.getTypeVariants(chatConfig)[1]) type = 3
                else if (text === this.getTypeVariants(chatConfig)[2]) type = 10
                this.setType(msg, type)
                this.setLastMessage(msg, ELastMessage.null)
            }

            // weather
            if (chatConfig && this.isMessageCommand(msg, ELastMessage.weather, this.BOT_NAME)) {
                if (this.isBotConfigured(msg)) {
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.preparing_forecast',
                        locale: chatConfig.lang
                    }))
                    this.sendWeather(chatConfig)
                } else {
                    await this.bot.sendMessage(msg.chat.id, i18n.__({
                        phrase: 'bot_messages.specify_need_config',
                        locale: chatConfig.lang
                    }))
                }
            }
        })
    }


    private sendWeather = async (chatConfig: IChatConfig) => {
        let isError = false
        if (chatConfig.type === 1) {
            if (await screenshot.takeScreenshotFor1Day(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `${i18n.__({
                    phrase: 'bot_messages.forecast_for',
                    locale: chatConfig.lang
                })} ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/1-${chatConfig.cityId}.png`);
            } else isError = true
        } else if (chatConfig.type === 3) {
            if (await screenshot.takeScreenshotFor3Days(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `${i18n.__({
                    phrase: 'bot_messages.forecast_for',
                    locale: chatConfig.lang
                })} ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/3-${chatConfig.cityId}.png`);
            } else isError = true
        } else {
            if (await screenshot.takeScreenshotFor10Days(`${chatConfig.city}`, chatConfig.cityId || 0)) {
                await this.bot.sendMessage(chatConfig.chatId, `${i18n.__({
                    phrase: 'bot_messages.forecast_for',
                    locale: chatConfig.lang
                })} ${chatConfig?.cityData?.name}:`)
                await this.bot.sendPhoto(chatConfig.chatId, `./screenshots/10-${chatConfig.cityId}.png`);
            } else isError = true
        }
        if (isError) {
            await this.bot.sendMessage(chatConfig.chatId, i18n.__({
                phrase: 'bot_messages.error_receiving_data',
                locale: chatConfig.lang
            }))
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

    private getConfig = (msg: Message) => {
        let time, city, type, lang = ""
        this.chatConfig.forEach(cc => {
            if (cc.chatId === msg.chat.id) {
                time = cc.time
                city = cc.city
                type = cc.type
                lang = cc.lang
            }
        })
        return {time, city, type, lang}
    }

    private setLangData = (msg: Message, lang: string) => {
        let _leng = "en"
        if (lang === this.langFullNames[1]) _leng = "zh"
        if (lang === this.langFullNames[2]) _leng = "uk"
        if (lang === this.langFullNames[3]) _leng = "ru"
        if (lang === this.langFullNames[4]) _leng = "es"
        this.chatConfig = this.chatConfig.map(cc => {
            if (cc.chatId === msg.chat.id) {
                cc.lang = _leng
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
                keyboard: this.arrayToArrays(this.TIME_RANGE, 4)
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

    private getTypeKeyboard = (chatConfig: IChatConfig) => {
        return {
            reply_markup: {
                keyboard: [this.getTypeVariants(chatConfig).map(tv => {
                    return {
                        text: tv
                    }
                })],
                resize_keyboard: false,
                one_time_keyboard: true
            }
        }
    }
    private getLangKeyboard = () => {
        return {
            reply_markup: {
                keyboard: [this.langFullNames.map(tv => {
                    return {
                        text: tv
                    }
                })],
                resize_keyboard: false,
                one_time_keyboard: true
            }
        }
    }

}

const bot = new Bot();
export default bot;
