FROM httpd:2.4

# COPY ./public-html/ /usr/local/apache2/htdocs/

WORKDIR /app
COPY package*.json ./
CMD [ "npm", "start" ]

RUN npm ci

COPY . .
