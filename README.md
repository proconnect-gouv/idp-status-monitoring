# Monitoring

> 📡 Monitoring tools for our infra

## Docker Build

Build specific services:

```bash
# Consumer only
docker build --target consumer --tag monitoring-consumer .

# Producer only
docker build --target producer --tag monitoring-producer .

# Both services
docker build --target monitoring --tag monitoring .
```

## Usage

```bash
# Run consumer
docker run monitoring-consumer

# Run producer
docker run monitoring-producer

# Run both (defaults to consumer)
docker run monitoring
# Or explicitly run producer
docker run monitoring producer
```
