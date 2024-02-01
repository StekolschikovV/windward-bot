import i18n from 'i18n';
import path from 'path';

const locales = ['en', 'ru', 'uk', 'es', 'zh']

i18n.configure({
    locales,
    directory: path.join(__dirname, '/locales'),
    defaultLocale: 'en',
    objectNotation: true
});

export {locales, i18n}
