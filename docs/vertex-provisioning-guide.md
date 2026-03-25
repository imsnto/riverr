
# Vertex AI Vector Search Provisioning Guide

Use this guide to provision the production vector retrieval infrastructure for Manowar.

## 1. Create the Index
Run the following `gcloud` command to create the Vector Search Index. This will host the embeddings for Articles, Topics, and Insights.

```bash
gcloud ai indexes create \
  --display-name="manowar-intelligence-v2" \
  --description="Unified Support Intelligence Index (v2)" \
  --metadata-file="index_metadata.json" \
  --region="us-central1" \
  --project="timeflow-6i3eo"
```

**index_metadata.json:**
```json
{
  "contentsDeltaUri": "gs://timeflow-6i3eo-vector-data/init/",
  "config": {
    "dimensions": 2048,
    "approximateNeighborsCount": 150,
    "distanceMeasureType": "DOT_PRODUCT_DISTANCE",
    "algorithmConfig": {
      "treeAhConfig": {
        "leafNodeEmbeddingCount": 500,
        "leafNodesToSearchPercent": 10
      }
    }
  }
}
```

## 2. Create the Index Endpoint
Create the endpoint that will serve as the gateway for nearest-neighbor queries from the app.

```bash
gcloud ai index-endpoints create \
  --display-name="manowar-search-endpoint" \
  --region="us-central1" \
  --project="timeflow-6i3eo"
```

## 3. Deploy the Index
Deploy the index to the endpoint. This step connects the vector storage to the serving layer.

```bash
gcloud ai index-endpoints deploy-index {ENDPOINT_ID} \
  --index={INDEX_ID} \
  --deployed-index-id="manowar_v2_deployed" \
  --display-name="Production Intelligence Deployment" \
  --region="us-central1" \
  --project="timeflow-6i3eo"
```

## 4. Configuration
After deployment, copy the following values into your environment variables:

```bash
GOOGLE_CLOUD_PROJECT="timeflow-6i3eo"
GOOGLE_CLOUD_LOCATION="us-central1"
VERTEX_VECTOR_INDEX_ENDPOINT_ID="captured-from-step-2"
VERTEX_VECTOR_DEPLOYED_INDEX_ID="manowar_v2_deployed"
```

## 5. Migration Validation
Once provisioned, run the **"Reindex Content Library"** action in Knowledge > Business Brain. This will:
1. Preserve all 30 existing public help center articles.
2. Generate fresh `text-embedding-004` vectors.
3. Upsert them into your new Vertex Index.
4. Verify retrieval through the Chat Simulator.
