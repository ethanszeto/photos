FROM public.ecr.aws/lambda/nodejs:24

RUN dnf install -y \
    gcc-c++ \
    make \
    tar \
    gzip \
    xz \
    && dnf clean all

ADD https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz /tmp/

RUN mkdir -p /opt/ffmpeg && \
    tar -xJf /tmp/ffmpeg-release-amd64-static.tar.xz -C /opt/ffmpeg --strip-components=1 && \
    ln -s /opt/ffmpeg/ffmpeg /usr/local/bin/ffmpeg && \
    ln -s /opt/ffmpeg/ffprobe /usr/local/bin/ffprobe

WORKDIR /var/task

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["index.handler"]