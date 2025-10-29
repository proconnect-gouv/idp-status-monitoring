# IDP Status Monitoring

This application provides a way to access status endpoints available on the **RIE (Réseau Interministériel de l'État)** from the public internet, for the purpose of displaying their status on our public status page.

HTTP requests initiated by the status platform are converted into messages in a **RabbitMQ** queue by the _producer_, and then transformed back into HTTP calls within the RIE by the _consumer_.

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
