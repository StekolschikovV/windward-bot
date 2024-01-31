export enum ELastMessage {
    config = "config",
    city = "city",
    lang = "lang",
    langdone = "langdone",
    citydone = "citydone",
    citydonedone = "citydonedone",
    weather = "weather",
    type = "type",
    typedone = "typedone",
    time = "time",
    timedone = "timedone ",
    start = "start",
    null = "null"
}

export interface ICityData {
    name: string | null
    slug: string | null
    id: number | null
    country?: string | null
    district?: string | null
    city?: string | null
}

export interface IChatConfig {
    chatId: number
    time: string | null
    city: string | null
    cityId: number | null
    cityData: ICityData
    citiesData: ICityData[]
    type: 1 | 3 | 10 | null
    lastMessage: ELastMessage
    lang: string
}
