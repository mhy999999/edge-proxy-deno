FROM denoland/deno:latest

WORKDIR /app

COPY deno-entry.js _worker.js deno.json ./

ENV UUID=667845aa-e6e3-41a5-9d86-6bd0a2b5fd5d

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "deno-entry.js"]