FROM node:16-bullseye

RUN apt-get update
RUN apt-get install chromium -y
RUN apt-get install yarn -y

ENV HOME=/home/app-user

RUN useradd -m -d $HOME -s /bin/bash app-user
RUN mkdir -p $HOME/app

WORKDIR $HOME/app

COPY package.json ./
RUN yarn global add pm2 ts-node typescript
RUN #yarn add typescript
RUN yarn install --frozen-lockfile

RUN mkdir -p screenshots db
RUN touch db/db.sqlite
VOLUME db
RUN chmod 7777 db/db.sqlite
ENV PATH $PATH:./node_modules/.bin/


COPY . .


#RUN tsc index.ts


ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

ENV BOT_NAME=""
ENV API_KEY_BOT=""
ENV TIME_RANGE=""


VOLUME db.sqlite

CMD ["pm2-runtime", "index.js"]
