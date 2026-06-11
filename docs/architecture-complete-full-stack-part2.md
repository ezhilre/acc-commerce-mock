## 5. Producer Flow — Frontend to Kafka

How the Commerce Website publishes events to Kafka via the AWS API Gateway REST Proxy facade.

```mermaid
flowchart LR
    subgraph FE["Commerce Website  Browser"]
        EV1["BETA_COMMERCE_USER_SIGNUP\nauth-modal.js on Create Account\ncustomerId email firstName lastName\nphone gender interests dob\nSOURCE BETA_COMMERCE  timestamp  _id"]
        EV2["ADD_TO_CART\ndatalayer.js pushAddToCart\ncustomerId email betacartId\nproduct sku name price quantity\ncategory image  citems array"]
        EV3["ORDER_CONFIRMATION\ndatalayer.js pushOrderConfirmation\ncustomerId email orderId betacartId\ntotal currency itemCount\npayment billingAddress shippingAddress citems"]
        EV4["RESET_PASSWORD  future\nemail customerId token timestamp"]
    end

    subgraph HTTP["HTTP Envelope  fetch POST"]
        REQ["Content-Type: application/vnd.kafka.json.v2+json\nAccept: application/vnd.kafka.v2+json\nBody:\n{\n  records: [{\n    key: customerId or cartId or eventId,\n    value: { eventType, timestamp, _id,\n             SOURCE, ...domainFields }\n  }]\n}"]
    end

    subgraph AGW["AWS API Gateway\nhttps://i3wygncpai.execute-api.eu-west-1.amazonaws.com/prod"]
        AGW1["POST /topics/beta-commerce-signup-events"]
        AGW2["POST /topics/beta-commerce-cart-events"]
        AGW3["POST /topics/beta-commerce-order-placed-events"]
        AGW4["POST /topics/beta-commerce-reset-password-events"]
    end

    subgraph KRP["Confluent Kafka REST Proxy"]
        PROD["Kafka Producer\nConverts HTTP JSON to Kafka produce record\nResponse: { offsets: [{ partition, offset }] }"]
    end

    subgraph TOPICS["Apache Kafka Topics"]
        KT1[["beta-commerce-signup-events  partition 0..N"]]
        KT2[["beta-commerce-cart-events  partition 0..N"]]
        KT3[["beta-commerce-order-placed-events  partition 0..N"]]
        KT4[["beta-commerce-reset-password-events  partition 0..N"]]
    end

    EV1 --> REQ --> AGW1 --> PROD --> KT1
    EV2 --> REQ --> AGW2 --> PROD --> KT2
    EV3 --> REQ --> AGW3 --> PROD --> KT3
    EV4 --> REQ --> AGW4 --> PROD --> KT4

    classDef fe   fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef gw   fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef krp  fill:#f3e8ff,stroke:#7c3aed,color:#3b0764
    classDef kfk  fill:#1e293b,stroke:#22d3ee,color:#e2e8f0
    classDef http fill:#d1fae5,stroke:#059669,color:#064e3b

    class EV1,EV2,EV3,EV4 fe
    class REQ http
    class AGW1,AGW2,AGW3,AGW4 gw
    class PROD krp
    class KT1,KT2,KT3,KT4 kfk
```

---

## 6. Consumer Application Internal Architecture

The Node.js application running inside the ECS Fargate task — module-level view.

```mermaid
flowchart TD
    IDX["src/index.js  Entry Point\n1 loadenv config\n2 getAllCheckpoints from DynamoDB  log resume positions\n3 startBatchTimer  5s interval flush check\n4 startRestConsumer TOPICS routeMessage\n5 SIGINT handler: flushAll + stopRestConsumer"]

    subgraph KAFKA_MOD["src/kafka/consumer.js"]
        CREATE["createConsumerInstance\nPOST /consumers/groupId\nauto.offset.reset earliest\nauto.commit.enable false\nformat json"]
        SUB["subscribeToTopics\nPOST .../subscription\nbody topics array"]
        POLL["pollMessages  every 2000ms\nGET .../records\nmax_bytes=1048576  timeout=3000\nReturns array of topic partition offset key value"]
        COMMIT["commitOffsets offsets\nPOST .../offsets\noffset = lastOffset + 1\nCalled ONLY after S3 upload success"]
        RECONNECT["reconnect\nAuto on HTTP 404 error_code 40403\ninstance evicted after 5min idle\nrecreate + resubscribe"]
    end

    subgraph ROUTER["src/handlers/index.js"]
        TMAP["TOPIC_KEY_MAP\nsignup → topicSignup + handleSignupEvent\ncart → topicCart + handleCartEvent\norder → topicOrder + handleOrderEvent\nreset-password → topicResetPassword + handleResetPasswordEvent\nFiltered by KAFKA_ACTIVE_TOPICS env var"]
        ROUTE["routeMessage msg\n1 JSON.parse msg.value\n2 Look up TOPIC_HANDLERS msg.topic\n3 Call handler payload topic partition offset"]
    end

    subgraph HANDLERS["src/handlers/"]
        SH["signupHandler.js\nhandleSignupEvent event topic partition offset\ntoSignupRecord event\naddToBatch record signup topic partition offset"]
        CH["cartHandler.js\nhandleCartEvent\ntoCartRecord  addToBatch cart"]
        OH["orderHandler.js\nhandleOrderEvent\ntoOrderRecord  addToBatch order"]
        RH["resetPasswordHandler.js\nhandleResetPasswordEvent\ntoResetPasswordRecord  addToBatch reset-password"]
    end

    subgraph MODELS["src/models/"]
        SM["signupModel.js  toSignupRecord\ncustomerId email firstName lastName\nphone country isEmailVerified\nsource eventId eventType timestamp"]
        CM["cartModel.js  toCartRecord\ncartId customerId email\ncartTotal itemCount currency\nitems JSON string timestamp"]
        OM["orderModel.js  toOrderRecord\neventId eventType source customerId email\norderId cartId total currency itemCount totalQuantity\npaymentMethod paymentLast4 paymentCardType\nshippingCity shippingCountry billingCity billingCountry\nitems JSON string"]
        RM["resetPasswordModel.js  toResetPasswordRecord\nemail customerId eventId eventType timestamp"]
    end

    subgraph BATCHSVC["src/services/batchService.js"]
        BUF["In-memory buffers object\nbuffers signup  buffers cart\nbuffers order  buffers reset-password\neach entry: record topic partition offset"]
        FSIZE["Size Flush\nbuffer.length >= BATCH_MAX_SIZE 100"]
        FTIME["Timer Flush\nelapsed >= BATCH_MAX_TIME_MS 30000ms\nchecked every BATCH_TIMER_INTERVAL_MS 5000ms"]
        UPL["uploadBatch entries type\n1 buildPartitionOffsetMap group by partition\n2 Per partition: generateS3Key type_pN_offS-E.csv\n3 jsonToCsv partitionRecords\n4 S3 putObject with retry x3 delay 2s\n5 commitOffsets to Kafka REST Proxy\n6 saveCheckpoint to DynamoDB\nIf CSV bytes > 5MB split batch in half"]
    end

    subgraph SERVICES["Supporting Services"]
        S3S["src/services/s3Service.js\nuploadToS3 key body\nnew AWS.S3 region eu-west-1\ns3.putObject Bucket Key Body\nCredentials via ECS Task IAM Role\nlazy init  fresh creds per call"]
        OFS["src/services/offsetStore.js\nDynamoDB DocumentClient\nsaveCheckpoint: PK topic#partition\nstores nextOffset=lastOffset+1\ngetCheckpoint single item read\ngetAllCheckpoints full table scan on startup"]
        CSV["src/utils/csvUtil.js\njsonToCsv records array\nConverts object array to CSV with headers"]
        LOG["src/utils/logger.js  Structured logging"]
    end

    IDX --> CREATE --> SUB --> POLL
    POLL -->|"messages array"| ROUTE
    TMAP --> ROUTE
    ROUTE --> SH & CH & OH & RH
    SH --> SM
    CH --> CM
    OH --> OM
    RH --> RM
    SM & CM & OM & RM --> BUF
    BUF --> FSIZE & FTIME
    FSIZE & FTIME --> UPL
    UPL --> S3S & COMMIT & OFS
    RECONNECT -.->|"on 404 eviction"| CREATE

    classDef entry   fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef kafka   fill:#1e293b,stroke:#22d3ee,color:#e2e8f0
    classDef handler fill:#d1fae5,stroke:#059669,color:#064e3b
    classDef model   fill:#f0fdf4,stroke:#16a34a,color:#14532d
    classDef batch   fill:#fef9c3,stroke:#ca8a04,color:#713f12
    classDef svc     fill:#ede9fe,stroke:#6d28d9,color:#2e1065

    class IDX entry
    class CREATE,SUB,POLL,COMMIT,RECONNECT kafka
    class TMAP,ROUTE,SH,CH,OH,RH handler
    class SM,CM,OM,RM model
    class BUF,FSIZE,FTIME,UPL batch
    class S3S,OFS,CSV,LOG svc
```

---

## 7. Batch Processing and S3 Upload Flow

Detailed flow of how records are buffered, flushed, converted to CSV, and uploaded to S3 with Kafka commit and DynamoDB checkpoint.

```mermaid
flowchart TD
    MSG["Incoming Kafka Message\ntopic  partition  offset  value JSON"]
    PARSE["routeMessage\nJSON.parse value\nhandler payload topic partition offset"]
    TRANSFORM["toXxxRecord payload\nFlatten nested JSON to flat CSV-ready object"]
    ADD["addToBatch record type topic partition offset\nbuffers type .push entry\nLog Batch size N latest offset pN@M"]

    SIZE_CHECK{"buffers type .length\n>= 100 records?"}
    TIMER_CHECK{"Timer tick AND\nelapsed >= 30s?"}
    KEEP["Keep accumulating\nResume polling"]

    DRAIN["flush type\nDrain buffer to local array\nprevent duplicate flush on concurrent ticks"]
    CSV_CHECK{"CSV bytes\n> 5 MB?"}

    SPLIT["Split batch in half\nfirstHalf to uploadBatch\nsecondHalf back to buffer"]

    PMAP["buildPartitionOffsetMap entries\nGroup by partition number\nFor each partition: startOffset  endOffset"]

    PLOOP["For each partition:\nfilter entries by partition\njsonToCsv partitionRecords\ngenerateS3Key:\nbeta-commerce/signup/signup_p0_off100-199.csv"]

    S3UP["uploadToS3 key body\nAWS SDK S3.putObject\nBucket: adobe-dx-acc-kafka-batch-storage-poc-bucket\nIAM ECS Task Role credentials"]

    S3OK{"S3 upload\nsucceeded?"}
    RETRY["Wait 2000ms\nRetry attempt N of 3"]
    MAX_RETRY{"Max retries\nexceeded?"}
    RESTORE["Restore entries to buffer\nnext timer cycle will retry"]

    COMMIT["commitOffsets\nPOST /consumers/group/instances/id/offsets\npayload: topic partition offset=endOffset+1\nmarks messages as consumed at Kafka broker"]

    CKPT["saveCheckpoint\nDynamoDB putItem\ntopicPartition = topic#partition\noffset = endOffset + 1\ns3Key = uploaded file key\nupdatedAt = ISO timestamp"]

    DONE["Batch complete\nNext partition or resume polling"]

    MSG --> PARSE --> TRANSFORM --> ADD
    ADD --> SIZE_CHECK & TIMER_CHECK
    SIZE_CHECK -->|"Yes"| DRAIN
    SIZE_CHECK -->|"No"| KEEP
    TIMER_CHECK -->|"Yes"| DRAIN
    TIMER_CHECK -->|"No"| KEEP
    DRAIN --> CSV_CHECK
    CSV_CHECK -->|"Yes over 5MB"| SPLIT --> PMAP
    CSV_CHECK -->|"No"| PMAP
    PMAP --> PLOOP --> S3UP
    S3UP --> S3OK
    S3OK -->|"Success"| COMMIT --> CKPT --> DONE
    S3OK -->|"Fail"| RETRY --> MAX_RETRY
    MAX_RETRY -->|"No retry"| S3UP
    MAX_RETRY -->|"Yes give up"| RESTORE --> KEEP

    classDef input    fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef process  fill:#d1fae5,stroke:#059669,color:#064e3b
    classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef storage  fill:#fef9c3,stroke:#ca8a04,color:#713f12
    classDef dyndb    fill:#ede9fe,stroke:#6d28d9,color:#2e1065

    class MSG,PARSE input
    class TRANSFORM,ADD,DRAIN,SPLIT,PMAP,PLOOP,COMMIT process
    class SIZE_CHECK,TIMER_CHECK,CSV_CHECK,S3OK,MAX_RETRY decision
    class S3UP storage
    class CKPT dyndb
    class RETRY,RESTORE,KEEP,DONE process
```

---

## 8. AWS S3 Storage Architecture

How data is organised inside the S3 bucket, the key naming convention, and downstream access patterns.

```mermaid
flowchart TD
    subgraph BUCKET["AWS S3 Bucket\nadobe-dx-acc-kafka-batch-storage-poc-bucket\neu-west-1  Standard Storage Class"]

        subgraph PREFIX_SIGNUP["Prefix: beta-commerce/signup/"]
            F_S1["signup_p0_off0-99.csv\n100 records  partition 0  offsets 0-99"]
            F_S2["signup_p0_off100-199.csv\n100 records  partition 0  offsets 100-199"]
            F_S3["signup_p1_off0-149.csv\n150 records  partition 1  offsets 0-149"]
        end

        subgraph PREFIX_CART["Prefix: beta-commerce/cart/"]
            F_C1["cart_p0_off0-99.csv\nADD_TO_CART events  flat cart rows"]
            F_C2["cart_p0_off100-199.csv"]
        end

        subgraph PREFIX_ORDER["Prefix: beta-commerce/orderConfirmation/"]
            F_O1["order_p0_off0-49.csv\nORDER_CONFIRMATION events\nfull order + payment + address rows"]
            F_O2["order_p1_off50-84.csv"]
        end

        subgraph PREFIX_RESET["Prefix: beta-commerce/resetPassword/"]
            F_R1["reset-password_p0_off0-99.csv"]
        end
    end

    subgraph KEY_PATTERN["S3 Key Naming Convention"]
        KP["{prefix}/{eventType}_p{partition}_off{startOffset}-{endOffset}.csv\n\nExamples:\nbeta-commerce/signup/signup_p0_off0-99.csv\nbeta-commerce/orderConfirmation/order_p1_off50-84.csv\nbeta-commerce/cart/cart_p0_off200-299.csv\n\nDeterministic key = idempotent re-upload overwrites same object\nNo duplicate files on retry or replay"]
    end

    subgraph CSV_SCHEMA["CSV File Schema per Event Type"]
        SIGNUP_CSV["signup CSV columns\ncustomerId  email  firstName  lastName\nphone  country  isEmailVerified\nsource  eventId  eventType  timestamp"]
        CART_CSV["cart CSV columns\neventId  eventType  source  cartId\ncustomerId  email  cartTotal\nitemCount  currency  items JSON  timestamp"]
        ORDER_CSV["order CSV columns\neventId  eventType  source  eventTimestamp\ncustomerId  email  authenticated\norderId  cartId  orderDate  total  currency\nitemCount  totalQuantity  paymentStatus\npaymentMethod  paymentLast4  paymentCardType\nshippingStreet  shippingCity  shippingState\nshippingZip  shippingCountry\nbillingStreet  billingCity  billingState\nbillingZip  billingCountry  items JSON"]
        RESET_CSV["reset-password CSV columns\neventId  eventType  source\nemail  customerId  timestamp"]
    end

    subgraph IAM_ACCESS["IAM Access Control"]
        TASK_ROLE["ECS Task IAM Role\ns3:PutObject\narn:aws:s3:::adobe-dx-acc-kafka-batch-storage-poc-bucket/*\nNo s3:GetObject needed by consumer\nNo static credentials  ECS metadata service"]
        GLUE_ROLE["AWS Glue / Athena Role\ns3:GetObject  s3:ListBucket\nFor downstream query access"]
    end

    subgraph DOWNSTREAM["Downstream Query Patterns"]
        GLUE["AWS Glue Crawler\nAuto-discover CSV schema\nCreate Glue Data Catalog tables\nbeta_commerce_signup  beta_commerce_cart\nbeta_commerce_order  beta_commerce_reset"]
        ATHENA["Amazon Athena\nSQL queries over CSV in S3\nSELECT email orderId total\nFROM beta_commerce_order\nWHERE paymentStatus = SUCCESS\nPartitioned by prefix and filename"]
        ACC["Adobe Campaign Classic\nIngests signup + order CSV\nCRM segmentation\nMarketing automation triggers"]
        BI["BI Analytics\nRedshift  QuickSight  Looker\nOrder funnel analysis\nCart abandonment rates"]
    end

    BUCKET --> KEY_PATTERN
    PREFIX_SIGNUP --> SIGNUP_CSV
    PREFIX_CART --> CART_CSV
    PREFIX_ORDER --> ORDER_CSV
    PREFIX_RESET --> RESET_CSV

    TASK_ROLE -->|"writes"| BUCKET
    GLUE_ROLE -->|"reads"| BUCKET

    PREFIX_SIGNUP & PREFIX_ORDER --> ACC
    PREFIX_SIGNUP & PREFIX_CART & PREFIX_ORDER & PREFIX_RESET --> GLUE --> ATHENA
    ATHENA --> BI

    classDef bucket  fill:#fef9c3,stroke:#ca8a04,color:#713f12
    classDef schema  fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef iam     fill:#d1fae5,stroke:#059669,color:#064e3b
    classDef ds      fill:#fce7f3,stroke:#be185d,color:#500724

    class PREFIX_SIGNUP,PREFIX_CART,PREFIX_ORDER,PREFIX_RESET,F_S1,F_S2,F_S3,F_C1,F_C2,F_O1,F_O2,F_R1 bucket
    class SIGNUP_CSV,CART_CSV,ORDER_CSV,RESET_CSV,KP schema
    class TASK_ROLE,GLUE_ROLE iam
    class GLUE,ATHENA,ACC,BI ds
```

---

## 9. Crash Recovery — DynamoDB Offset Checkpoint Flow

How the system guarantees **at-least-once delivery** and safe crash recovery using DynamoDB as a durable checkpoint store alongside Kafka manual offset commits.

```mermaid
flowchart TD
    subgraph WRITE["Normal Operation  After Each Batch Upload"]
        direction LR
        W1["S3 putObject succeeds\nbeta-commerce/signup/signup_p0_off100-199.csv"]
        W2["commitOffsets to Kafka REST Proxy\noffset = 200\nmarks p0 at 199 as consumed in broker"]
        W3["saveCheckpoint to DynamoDB\ntopicPartition: beta-commerce-signup-events#0\noffset: 200  s3Key: signup_p0_off100-199.csv\nupdatedAt: ISO timestamp"]
        W1 --> W2 --> W3
    end

    subgraph CRASH["Crash Scenario"]
        C1["ECS Task crashes or restarts\nIn-memory buffer LOST\nKafka offsets may or may not be committed"]
        C2["New ECS Task starts\nsrc/index.js runs getAllCheckpoints\nDynamoDB scan of kafka-consumer-offsets table"]
        C3["Checkpoint found:\ntopicPartition: beta-commerce-signup-events#0\nnextOffset: 200\ns3Key: signup_p0_off100-199.csv"]
        C4["Consumer creates new instance\nKafka group committed offset = 200\nConsumer resumes from offset 200\nNo duplicates  no gaps"]
        C1 --> C2 --> C3 --> C4
    end

    subgraph NOCHECK["Fresh Start  No Checkpoint"]
        NC1["getAllCheckpoints returns empty map\nNo prior state in DynamoDB"]
        NC2["Consumer starts with auto.offset.reset=earliest\nConsumes from beginning of Kafka retention\nor from Kafka group committed offset if exists"]
        NC1 --> NC2
    end

    subgraph KAFKAONLY["Kafka Commit Fails but DynamoDB Succeeds"]
        K1["S3 upload succeeded\nKafka commitOffsets FAILED\ninstance may have been evicted"]
        K2["DynamoDB checkpoint STILL WRITTEN\nnextOffset = 200 stored durably"]
        K3["On restart: DynamoDB offset = 200\nConsumer resumes from 200\nAt-least-once guarantee preserved\nPossible duplicate if S3 key already exists\nidempotent overwrite handles it"]
        K1 --> K2 --> K3
    end

    classDef ok    fill:#d1fae5,stroke:#059669,color:#064e3b
    classDef crash fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    classDef fresh fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef warn  fill:#fef3c7,stroke:#d97706,color:#78350f

    class W1,W2,W3 ok
    class C1,C2,C3,C4 crash
    class NC1,NC2 fresh
    class K1,K2,K3 warn
```

---

## 10. Message Processing State Machine

Full lifecycle of the consumer from startup through steady-state polling to graceful shutdown.

```mermaid
stateDiagram-v2
    [*] --> AppStart : node src/index.js

    AppStart --> LoadCheckpoints : getAllCheckpoints from DynamoDB
    LoadCheckpoints --> StartTimers : startBatchTimer every 5s
    StartTimers --> CreateInstance : startRestConsumer

    CreateInstance --> Subscribe : POST /consumers/acc-kafka-consumer-group
    Subscribe --> Polling : POST .../subscription topics

    Polling --> FetchMessages : GET .../records every 2000ms
    FetchMessages --> NoMessages : 0 messages returned
    FetchMessages --> ProcessMessages : 1+ messages returned
    NoMessages --> Polling : wait 2000ms

    ProcessMessages --> ParseMessage : JSON.parse value
    ParseMessage --> RouteToHandler : TOPIC_HANDLERS lookup

    RouteToHandler --> SignupHandler : topic = signup-events
    RouteToHandler --> CartHandler : topic = cart-events
    RouteToHandler --> OrderHandler : topic = order-placed-events
    RouteToHandler --> ResetHandler : topic = reset-password-events
    RouteToHandler --> UnknownTopic : no handler registered

    SignupHandler --> TransformSignup : toSignupRecord
    CartHandler --> TransformCart : toCartRecord
    OrderHandler --> TransformOrder : toOrderRecord
    ResetHandler --> TransformReset : toResetPasswordRecord
    UnknownTopic --> Polling : log warning skip

    TransformSignup --> BatchBuffer : addToBatch signup
    TransformCart --> BatchBuffer : addToBatch cart
    TransformOrder --> BatchBuffer : addToBatch order
    TransformReset --> BatchBuffer : addToBatch reset-password

    BatchBuffer --> SizeFlush : buffer length >= 100
    BatchBuffer --> TimerFlush : timer elapsed 30s

    SizeFlush --> UploadBatch : flush type
    TimerFlush --> UploadBatch : flush type

    UploadBatch --> S3Upload : per partition S3 putObject
    S3Upload --> S3Success : upload OK
    S3Upload --> S3Fail : upload error

    S3Fail --> RetryUpload : attempt 1 of 3
    RetryUpload --> S3Upload : wait 2s
    RetryUpload --> BufferRestore : max retries exceeded

    S3Success --> CommitKafka : commitOffsets to REST Proxy
    CommitKafka --> SaveDynamo : saveCheckpoint to DynamoDB
    SaveDynamo --> Polling : batch done resume polling

    BufferRestore --> Polling : entries back in buffer

    Polling --> InstanceEvicted : HTTP 404 error_code 40403
    InstanceEvicted --> Reconnect : recreate instance and resubscribe
    Reconnect --> Polling : reconnected

    Polling --> GracefulShutdown : SIGINT received
    GracefulShutdown --> FlushAll : flush all pending buffers
    FlushAll --> DeleteInstance : DELETE consumer instance
    DeleteInstance --> [*]
```

---

## 11. End-to-End Sequence Diagram

Step-by-step interaction between all system components for a complete message cycle.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Commerce Website
    participant FB as Firebase Auth
    participant AGW as AWS API Gateway
    participant KRP as Kafka REST Proxy
    participant KFK as Apache Kafka
    participant ECS as ECS Task Consumer
    participant S3 as AWS S3
    participant DDB as AWS DynamoDB

    Note over FE,DDB: Sign Up — User creates account

    FE->>FB: createUserWithEmailAndPassword email password
    FB-->>FE: userCredential uid emailVerified
    FE->>AGW: POST /topics/beta-commerce-signup-events
    Note right of FE: { records:[{ value:{ eventType:BETA_COMMERCE_USER_SIGNUP, user:{...} } }] }
    AGW->>KRP: Forward HTTP request
    KRP->>KFK: Produce to signup-events topic
    KFK-->>KRP: ACK offset=5 partition=0
    KRP-->>AGW: HTTP 200 { offsets:[{ partition:0, offset:5 }] }
    AGW-->>FE: HTTP 200 OK

    Note over FE,DDB: Add to Cart — User clicks Add to Cart

    FE->>AGW: POST /topics/beta-commerce-cart-events
    Note right of FE: { records:[{ key:customerId, value:{ eventType:ADD_TO_CART, cart:{...} } }] }
    AGW->>KRP: Forward
    KRP->>KFK: Produce to cart-events topic
    KFK-->>KRP: ACK offset=12 partition=0
    KRP-->>FE: HTTP 200 OK

    Note over FE,DDB: Order Placed — Confirmation page loads

    FE->>AGW: POST /topics/beta-commerce-order-placed-events
    Note right of FE: { records:[{ key:customerId, value:{ eventType:ORDER_CONFIRMATION, order:{...} } }] }
    AGW->>KRP: Forward
    KRP->>KFK: Produce to order-placed-events
    KFK-->>KRP: ACK offset=7 partition=0
    KRP-->>FE: HTTP 200 OK

    Note over FE,DDB: Consumer Startup

    ECS->>KRP: POST /consumers/acc-kafka-consumer-group
    Note right of ECS: { auto.offset.reset:earliest, auto.commit.enable:false, format:json }
    KRP-->>ECS: { instance_id:inst-1, base_uri:... }
    ECS->>DDB: Scan kafka-consumer-offsets table
    DDB-->>ECS: checkpoints map { topic#partition: { offset, s3Key } }
    ECS->>KRP: POST .../inst-1/subscription
    Note right of ECS: { topics:[signup-events, cart-events, order-placed-events, reset-password-events] }
    KRP-->>ECS: HTTP 204 No Content

    Note over FE,DDB: Poll Loop every 2000ms

    loop Every 2000ms
        ECS->>KRP: GET .../inst-1/records?max_bytes=1048576&timeout=3000
        KRP->>KFK: Fetch from subscribed topics
        KFK-->>KRP: Messages array
        KRP-->>ECS: HTTP 200 [{ topic, partition, offset, key, value }]
        ECS->>ECS: routeMessage JSON.parse value
        ECS->>ECS: handler toXxxRecord flatten to CSV row
        ECS->>ECS: addToBatch record type topic partition offset

        alt Buffer full >= 100 OR timer elapsed >= 30s
            ECS->>ECS: flush type drain buffer jsonToCsv
            ECS->>S3: s3.putObject Bucket=adobe-dx-acc-kafka-batch-storage-poc-bucket Key=order_p0_off0-99.csv
            Note right of ECS: IAM Task Role credentials via ECS metadata service
            S3-->>ECS: HTTP 200 OK ETag
            ECS->>KRP: POST .../inst-1/offsets
            Note right of ECS: { offsets:[{ topic, partition, offset:100, metadata:s3-committed }] }
            KRP-->>ECS: HTTP 200 OK
            ECS->>DDB: putItem kafka-consumer-offsets
            Note right of ECS: topicPartition=beta-commerce-order-placed-events#0 offset=100 s3Key=order_p0_off0-99.csv
            DDB-->>ECS: HTTP 200 OK
        end
    end

    Note over ECS,KRP: Auto-Reconnect on Instance Eviction

    ECS->>KRP: GET /records
    KRP-->>ECS: HTTP 404 { error_code:40403 }
    ECS->>KRP: POST /consumers/acc-kafka-consumer-group
    KRP-->>ECS: { instance_id:inst-2 }
    ECS->>KRP: POST .../subscription topics
    KRP-->>ECS
