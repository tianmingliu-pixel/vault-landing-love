import type { Post } from "../posts-types";

export const dataSystems: Post = {
  slug: "data-you-can-rebuild",
  focus: "data-systems",
  title: "Data You Can Rebuild From Scratch",
  subtitle: "SQL that explains itself, Spark only when it pays, and Docker so anyone can reproduce the whole pipeline with one command.",
  date: "2026-10-03",
  minutes: 13,
  accent: "#38bdf8",
  motif: "columns",
  kit: {
    name: "Reproducible Data Lab",
    tagline: "A one-command Postgres + Spark stack with a real open dataset and an idempotent pipeline.",
    includes: [
      "docker compose stack: PostgreSQL 17 + Spark + Jupyter, pinned versions",
      "Idempotent loader for NOAA space-weather JSON (the same feeds this site uses)",
      "Spark job: daily aggregates, partitioned Parquet, row-count reconciliation",
      "EXPLAIN ANALYZE playbook: reading plans and choosing indexes",
    ],
  },
  sections: [
    {
      id: "principles",
      access: "anonymous",
      title: "Three properties of a data system you can trust",
      teaser: "",
      blocks: [
        { kind: "list", items: ["Correct: constraints in the schema catch bad data at the door, not in a dashboard weeks later.", "Explainable: every number can be traced back to a query you can read and a plan you can inspect.", "Reproducible: a new teammate gets the same tables, the same versions and the same results with one command."] },
        { kind: "diagram", name: "data-pipeline", caption: "Raw files land unchanged, a loader writes them idempotently into PostgreSQL, Spark handles what outgrows one machine, and every stage runs in a pinned container." },
        { kind: "p", text: "PostgreSQL will carry you much further than most people expect — hundreds of millions of rows with the right indexes. Reach for Spark when the data or the computation no longer fits one machine, not before: distributed systems add cost and failure modes." },
        { kind: "video", id: "zsjvFFKOm3c", title: "SQL Explained in 100 Seconds", by: "Fireship", note: "The relational idea in a minute and a half." },
        { kind: "video", id: "n2Fluyr3lbc", title: "PostgreSQL in 100 Seconds", by: "Fireship", note: "Why Postgres became the default open-source database." },
        {
          kind: "resources",
          items: [
            { title: "PostgreSQL Documentation", by: "PostgreSQL Global Development Group", url: "https://www.postgresql.org/docs/current/", kind: "doc", note: "The tutorial chapter and \"Using EXPLAIN\" are worth reading cover to cover." },
            { title: "15-445/645 Intro to Database Systems", by: "Carnegie Mellon University (Andy Pavlo)", url: "https://15445.courses.cs.cmu.edu/", kind: "course", note: "How databases work inside — storage, indexes, query execution — with free lecture videos." },
            { title: "Apache Spark Documentation", by: "Apache Software Foundation", url: "https://spark.apache.org/docs/latest/", kind: "doc", note: "Start with the SQL, DataFrames and Datasets guide." },
            { title: "Docker Docs: Get started", by: "Docker", url: "https://docs.docker.com/get-started/", kind: "doc", note: "Images, containers, volumes and Compose." },
            { title: "Designing Data-Intensive Applications", by: "Martin Kleppmann (O'Reilly)", url: "https://dataintensive.net/", kind: "book", note: "The standard book on reliability, scalability and maintainability of data systems." },
          ],
        },
      ],
    },
    {
      id: "stack",
      access: "member",
      title: "A one-command stack and reading a query plan",
      teaser: "docker compose for Postgres + Spark, a constrained schema, and how to read EXPLAIN ANALYZE.",
      blocks: [
        {
          kind: "code",
          lang: "yaml",
          title: "compose.yaml",
          text: `services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: dev-only
      POSTGRES_DB: lab
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data", "./sql:/docker-entrypoint-initdb.d:ro"]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 5s
  spark:
    image: apache/spark:3.5.6
    command: ["/opt/spark/bin/spark-class", "org.apache.spark.deploy.master.Master"]
    ports: ["8080:8080", "7077:7077"]
volumes:
  pgdata: {}`,
        },
        {
          kind: "code",
          lang: "sql",
          title: "sql/001_schema.sql",
          text: `CREATE TABLE solar_wind (
  observed_at  timestamptz PRIMARY KEY,
  speed_kms    real    CHECK (speed_kms BETWEEN 150 AND 3000),
  density_cc   real    CHECK (density_cc >= 0),
  bz_nt        real,
  source       text    NOT NULL
);
CREATE INDEX ON solar_wind (source, observed_at DESC);`,
        },
        { kind: "p", text: "Run EXPLAIN (ANALYZE, BUFFERS) on any slow query. Read it bottom-up: the innermost nodes run first. Look for a Seq Scan on a large table where you expected an Index Scan, and for estimated rows that are wildly different from actual rows — that means stale statistics (run ANALYZE) or a predicate the planner can't estimate." },
        { kind: "video", id: "IELMSD2kdmk", title: "Apache Spark in 100 Seconds", by: "Fireship", note: "When distributed processing is worth it." },
        { kind: "video", id: "Gjnup-PuquQ", title: "Docker in 100 Seconds", by: "Fireship", note: "Images vs containers in one picture." },
      ],
    },
    {
      id: "lab",
      access: "platinum",
      title: "Lab: an idempotent pipeline on real open data",
      teaser: "Load NOAA space-weather feeds idempotently, aggregate them with Spark into partitioned Parquet, and prove nothing was lost.",
      blocks: [
        { kind: "p", text: "You'll use the same public NOAA feeds that power this site's Sun panel. Idempotent means you can re-run the loader as often as you like and the table ends up identical — the property that makes pipelines safe to retry." },
        {
          kind: "code",
          lang: "python",
          title: "load_solar_wind.py",
          text: `import json, urllib.request, psycopg

URL = "https://services.swpc.noaa.gov/json/ace/swepam/ace_swepam_1h.json"
rows = json.load(urllib.request.urlopen(URL))

with psycopg.connect("postgresql://postgres:dev-only@localhost/lab") as conn:
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO solar_wind (observed_at, speed_kms, density_cc, source)
               VALUES (%s, %s, %s, 'ACE')
               ON CONFLICT (observed_at) DO UPDATE
               SET speed_kms = EXCLUDED.speed_kms, density_cc = EXCLUDED.density_cc""",
            [(r["time_tag"] + "Z", r["speed"], r["dens"]) for r in rows
             if r["dsflag"] == 0 and r["speed"] > 0],
        )
    print(f"upserted {len(rows)} rows")`,
        },
        {
          kind: "code",
          lang: "python",
          title: "daily_aggregates.py (PySpark)",
          text: `from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("solar-wind-daily").getOrCreate()
wind = (spark.read.format("jdbc")
        .option("url", "jdbc:postgresql://db:5432/lab").option("dbtable", "solar_wind")
        .option("user", "postgres").option("password", "dev-only").load())

daily = (wind.withColumn("day", F.to_date("observed_at"))
         .groupBy("day")
         .agg(F.avg("speed_kms").alias("mean_speed"), F.max("speed_kms").alias("peak_speed"), F.count("*").alias("hours")))

daily.write.mode("overwrite").partitionBy("day").parquet("out/solar_wind_daily")
assert daily.agg(F.sum("hours")).first()[0] == wind.count(), "row count mismatch"`,
        },
        { kind: "h", text: "Checks before you trust the output" },
        { kind: "list", items: ["Row counts reconcile from source → table → aggregate.", "Re-running the loader twice changes nothing (same count, same checksum).", "CHECK constraints rejected the sentinel values (−9999.9) instead of storing them.", "The compose file pins every image tag — no :latest."] },
        { kind: "video", id: "HXV3zeQKqGY", title: "SQL Tutorial — Full Database Course for Beginners", by: "freeCodeCamp.org", note: "Four hours of SQL fundamentals if any query above felt unfamiliar." },
        { kind: "video", id: "pg19Z8LL06w", title: "Docker Crash Course for Absolute Beginners", by: "TechWorld with Nana", note: "Containers, images, volumes and Compose step by step." },
      ],
    },
  ],
};
