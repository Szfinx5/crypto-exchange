FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod

COPY . .

CMD ["pnpm", "workers"] # This should run your worker process (see your package.json "workers" script)