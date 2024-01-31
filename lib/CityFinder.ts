import axios from "axios";

interface ResponseI {
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
        ru: {
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

class CityFinder {

    async searchCities(cityName: string): Promise<ResponseI[]> {
        const response: { data: ResponseI[] } = await axios
            .get(`https://www.gismeteo.ru/mq/search/${cityName}/9/`)
            .then(e => e.data)
            .catch(e => {
                return {
                    data: []
                }
            })
        return response.data
    }

}

const cityFinder = new CityFinder();
export default cityFinder;
