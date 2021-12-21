FROM node:alpine
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN yarn build
CMD yarn start

