FROM ubuntu:focal

ENV TZ=Asia/Shanghai
ENV PLAYWRIGHT_SKIP_BROWSER_GC=1

ADD . /app
WORKDIR /app

RUN apt-get update && \
    # Install node16
    apt-get install -y curl wget gpg && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    # clean apt cache
    rm -rf /var/lib/apt/lists/* && \
    # install playwright
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install && \
    npx playwright install --with-deps webkit && \
    apt-get remove -y curl wget gpg && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 8050
CMD ["node", "index.js"]
