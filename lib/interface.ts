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

export interface CityFinderResponseI {
    source: string;
    id: number;
    url: string;
    slug: string;
    kind: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    obsStationId?: number; // Optional field
    timeZone: number;
    country: {
        id: number;
        url: string;
        code: string;
    };
    district: {
        id: number;
        url: string;
    };
    subdistrict?: null | { id: number; url: string; };
    translations: {
        [key: string]: {
            city: {
                name: string;
                nameP?: string;
                nameR?: string;
            };
            country: {
                name: string;
                nameP?: string;
                nameR?: string;
            };
            district: {
                name: string;
                nameP?: string;
                nameR?: string;
            };
            subdistrict?: null | { name: string; nameP: string; nameR: string; };
        };
    };
    visitCount: number;
    slugHistory?: null | { timestamp: string; fromUrl: string; }; // Optional field
    options: {
        significantHeightDiff: boolean;
        landSeaMask: number;
    };
    updateAt: string;
}
