# Use AWS Lambda Node.js base image
FROM public.ecr.aws/lambda/nodejs:20

# Install system dependencies (ffmpeg + build tools for sharp)
RUN yum update -y && \
    yum install -y \
      gcc-c++ \
      make \
      tar \
      gzip \
      ffmpeg && \
    yum clean all

# Set working directory
WORKDIR /var/task

# Copy package files
COPY package*.json ./

# Install dependencies (includes sharp)
RUN npm install --omit=dev

# Copy application code to container
COPY . .

# Ensure sharp works correctly in Lambda environment
ENV NODE_ENV=production

# Lambda handler entry point
CMD ["index.handler"]