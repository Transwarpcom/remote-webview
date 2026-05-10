FROM ubuntu:24.04

ENV TZ=Asia/Shanghai
ENV PLAYWRIGHT_SKIP_BROWSER_GC=1
ENV DEBIAN_FRONTEND=noninteractive

ADD . /app
WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg && \
    curl -sL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install && \
    npx playwright install --with-deps webkit && \
    apt-get purge -y curl gnupg && apt-get autoremove -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*

EXPOSE 8050
CMD ["node", "index.js"]
