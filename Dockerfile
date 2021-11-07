FROM node:14-alpine

WORKDIR /app
COPY package*.json ./
CMD [ "npm", "start" ]

RUN npm ci

COPY . .
