-- Column-for-column from yhub bin/init-db.js (unquoted identifiers so
-- case-folding matches yhub's persistence.js queries).
CREATE TABLE IF NOT EXISTS yhub_ydoc_v1 (
    org             text,
    docid           text,
    branch          text,
    t               text,
    created         INT8,
    gcDoc           bytea,
    nongcDoc        bytea,
    contentmap      bytea,
    contentids      bytea,
    PRIMARY KEY     (org,docid,branch,t)
);
