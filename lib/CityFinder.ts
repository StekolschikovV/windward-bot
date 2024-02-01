import axios from "axios";
import {CityFinderResponseI} from "./interface";

class CityFinder {

    async searchCitiesEn(cityName: string): Promise<CityFinderResponseI[]> {
        const response: { data: CityFinderResponseI[] } = await axios
            .get(`https://www.gismeteo.com/mq/search/${cityName}/9/`)
            .then(e => {
                return e.data
            })
            .catch(e => {
                return {
                    data: []
                }
            })
        return response.data
    }

    async searchCitiesRu(cityName: string): Promise<CityFinderResponseI[]> {
        const response: { data: CityFinderResponseI[] } = await axios
            .get(`https://www.gismeteo.com/mq/search/${cityName}/9/`)
            .then(e => {
                return e.data
            })
            .catch(e => {
                return {
                    data: []
                }
            })
        return response.data
    }

    searchCities = (cityName: string, lang: string) => {
        if (lang === "ru") {
            return this.searchCitiesRu(cityName)
        } else {
            return this.searchCitiesEn(cityName)
        }
    }

}

const cityFinder = new CityFinder();
export default cityFinder;
