FROM node:16-bullseye

RUN apt-get update
RUN apt-get install chromium -y
RUN apt-get install yarn -y

WORKDIR app

COPY package.json ./

RUN yarn global add pm2 ts-node typescript
RUN yarn install --frozen-lockfile

RUN mkdir -p screenshots db
RUN touch db/db.sqlite

VOLUME db

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

ENV BOT_NAME=""
ENV API_KEY_BOT=""
ENV TIME_RANGE=""

VOLUME db.sqlite

CMD ["pm2-runtime", "start", "npm", "--", "start"]
